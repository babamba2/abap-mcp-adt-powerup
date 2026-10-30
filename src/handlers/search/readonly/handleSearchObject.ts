import type { SearchObjectsParams } from '@babamba2/mcp-abap-adt-clients';
import type { IAdtResponse } from '@babamba2/mcp-abap-adt-interfaces';
import { createAdtClient } from '../../../lib/clients';
import { objectsListCache } from '../../../lib/getObjectsListCache';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  isLegacyUnsupported,
  legacyTableRead,
} from '../../../lib/legacyTableRead';
import { sapLanguageKey } from '../../../lib/sapLanguage';
import { ErrorCode, McpError, return_response } from '../../../lib/utils';
import { decodeXmlEntities } from '../../../lib/xmlEntities';
import { parseSqlQueryXml } from '../../system/readonly/handleGetSqlQuery';

const DEFAULT_MAX_RESULTS = 50;
// Names per TRDIRT read; keeps the dynamic WHERE short on the BASIS < 7.50 dispatcher path.
const TRDIRT_CHUNK = 20;

/**
 * TRDIRT languages to read: the logon language, then English. Standard
 * programs carry 30–40 languages, so reading all of them under a row cap cut
 * off whole names (key order fills the cap with the first name's languages).
 * @param logonLanguage SAP_LANGUAGE (1-character key or ISO code)
 * @returns distinct 1-character SAP keys, logon language first
 */
export function titleLanguages(logonLanguage: string | undefined): string[] {
  const logon = sapLanguageKey(logonLanguage);
  return logon && logon !== 'E' ? [logon, 'E'] : ['E'];
}

/**
 * Picks one program title from its TRDIRT rows: the logon language, then a
 * text the search response carried, then English, then any row.
 * @param rows TRDIRT rows of one program (language key + text)
 * @param langs languages from titleLanguages, logon language first
 * @param sapTexts every description the search response carried
 * @returns the title, or undefined when there is no row
 */
export function pickProgramTitle(
  rows: Array<{ sprsl: string; text: string }>,
  langs: string[],
  sapTexts: Set<string>,
): string | undefined {
  return (
    rows.find((r) => r.sprsl === langs[0])?.text ??
    rows.find((r) => sapTexts.has(r.text))?.text ??
    rows.find((r) => r.sprsl === 'E')?.text ??
    rows[0]?.text
  );
}

/**
 * Re-reads the titles of program / include hits (PROG/*) from TRDIRT.
 * ECC 7.40 quick search pairs names and descriptions from differently sorted
 * lists, so a hit can carry another object's title; S/4HANA sends no
 * description for programs at all.
 * @param context handler context (connection + logger)
 * @param names PROG/* object names from the search result
 * @param sapTexts every description the search response carried
 * @returns titles (name → title; names without a TRDIRT row are absent) and
 *   complete = false when a read hit its row cap, so a missing name may still have a title
 */
async function readProgramTitles(
  context: HandlerContext,
  names: string[],
  sapTexts: Set<string>,
): Promise<{ titles: Map<string, string>; complete: boolean }> {
  const { connection, logger } = context;
  const client = createAdtClient(connection, logger);
  const langs = titleLanguages(process.env.SAP_LANGUAGE);
  const langIn = langs.map((l) => `'${l.replace(/'/g, "''")}'`).join(', ');
  const byName = new Map<string, Array<{ sprsl: string; text: string }>>();
  let complete = true;
  for (let i = 0; i < names.length; i += TRDIRT_CHUNK) {
    const chunk = names.slice(i, i + TRDIRT_CHUNK);
    const where = `name IN (${chunk.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')}) AND sprsl IN (${langIn})`;
    const sql = `SELECT name, sprsl, text FROM trdirt WHERE ${where}`;
    const maxRows = chunk.length * langs.length;
    let rows: Array<Record<string, unknown>>;
    try {
      const res = await client
        .getUtils()
        .getSqlQuery({ sql_query: sql, row_number: maxRows });
      rows = parseSqlQueryXml(res.data, sql, maxRows, logger).rows;
    } catch (e) {
      if (!isLegacyUnsupported(e)) throw e;
      rows = (
        await legacyTableRead(connection, {
          table: 'TRDIRT',
          fields: ['NAME', 'SPRSL', 'TEXT'],
          where,
          maxRows,
          sqlQuery: sql,
        })
      ).rows;
    }
    if (rows.length >= maxRows) complete = false;
    for (const r of rows) {
      const name = String(r.NAME ?? '').trim();
      const sprsl = String(r.SPRSL ?? '').trim();
      const text = String(r.TEXT ?? '').trim();
      if (!name || !text) continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push({ sprsl, text });
    }
  }
  const titles = new Map<string, string>();
  for (const [name, rows] of byName) {
    const title = pickProgramTitle(rows, langs, sapTexts);
    if (title) titles.set(name, title);
  }
  return { titles, complete };
}

export const TOOL_DEFINITION = {
  name: 'SearchObject',
  available_in: ['onprem', 'cloud'] as const,
  description:
    "[read-only] Find, search, locate, or check if an ABAP repository object exists by name or wildcard pattern (e.g. 'ZOK*'). Use this tool to answer questions like 'is there a program named...', 'find all objects starting with...', 'does this class exist?', 'list objects matching...'. Supports all repository object types — optionally filter by type (PROG, CLAS, INTF, DEVC, TABL, DDLS, DTEL, FUGR, SRVD, SRVB, BDEF, DDLX, etc.).",
  inputSchema: {
    type: 'object',
    properties: {
      object_name: {
        type: 'string',
        description: "Object name or mask (e.g. 'MARA*')",
      },
      object_type: {
        type: 'string',
        description: "Optional ABAP object type (e.g. 'TABL', 'CLAS/OC')",
      },
      maxResults: {
        type: 'number',
        description: `Maximum number of results to return (default ${DEFAULT_MAX_RESULTS}). The response has truncated=true when this limit was hit.`,
        default: DEFAULT_MAX_RESULTS,
      },
      include_raw_xml: {
        type: 'boolean',
        description:
          'Also return the raw ADT XML (the parsed results already carry every field). Default false.',
        default: false,
      },
    },
    required: ['object_name'],
  },
} as const;

// --- New function for ADT error handling ---
function detectAdtSearchError(
  response: any,
): { isError: boolean; content: any[] } | null {
  if (!response) return null;
  const status = response.status || response?.response?.status;
  if (status !== 200) {
    let msg = `ADT request failed (status ${status})`;
    if (status === 406) msg = 'Invalid object_type (406 Not Acceptable)';
    if (status === 400) msg = 'Bad request (400)';
    return {
      isError: true,
      content: [{ type: 'text', text: msg }],
    };
  }
  return null;
}

export async function handleSearchObject(context: HandlerContext, args: any) {
  const { connection, logger } = context;
  try {
    const { object_name, object_type } = args;
    if (!object_name) {
      throw new McpError(ErrorCode.InvalidParams, 'object_name is required');
    }
    const maxResults: number = args.maxResults || DEFAULT_MAX_RESULTS;

    const client = createAdtClient(connection, logger);
    const utils = client.getUtils();

    const searchParams: SearchObjectsParams = {
      query: object_name,
      maxResults,
    };

    if (object_type) {
      searchParams.objectType = object_type;
    }

    logger?.info(
      `Searching objects: query=${object_name}${object_type ? ` type=${object_type}` : ''}`,
    );
    const response = await utils.searchObjects(searchParams);

    if (!response) {
      throw new Error('Search failed: no response received');
    }

    // --- Error handling using new function ---
    const adtError = detectAdtSearchError(response);
    if (adtError) return adtError;

    const result = return_response(response as IAdtResponse);
    const { isError, ...rest } = result;

    // Detect empty XML (<adtcore:objectReferences/>) results
    const xmlText = rest.content?.[0]?.text || '';
    if (!xmlText.includes('<adtcore:objectReference ')) {
      // Return an empty result (not an error) when ADT finds nothing
      return {
        isError: false,
        content: [],
      };
    }

    // Parse every <adtcore:objectReference .../> entry from the XML
    const matches = Array.from(
      xmlText.matchAll(/<adtcore:objectReference\s+([^>]*)\/>/g),
    );
    if (!matches || matches.length === 0) {
      // Return an empty result (not an error) when ADT finds nothing
      return {
        isError: false,
        content: [],
      };
    }

    const resultsArr: Array<{
      name: string;
      type: string;
      description?: string;
      packageName?: string;
    }> = [];
    for (const m of matches as Array<RegExpMatchArray>) {
      const attrs = m[1];
      function extract(attr: string, def = ''): string {
        const mm = attrs.match(new RegExp(`${attr}="([^"]*)"`));
        return mm ? mm[1] : def;
      }
      const name = decodeXmlEntities(extract('adtcore:name'));
      const type = extract('adtcore:type');
      const description = decodeXmlEntities(extract('adtcore:description'));
      let pkgName = extract('adtcore:packageName');
      // If packageName is missing, attempt to pull it from the raw XML via <adtcore:packageName>
      if (!pkgName) {
        const pkgMatch = xmlText.match(
          /<adtcore:packageName>([^<]*)<\/adtcore:packageName>/,
        );
        if (pkgMatch) {
          pkgName = pkgMatch[1];
        }
      }
      // Empty description / package are left out rather than sent as "".
      resultsArr.push({
        name,
        type,
        ...(description ? { description } : {}),
        ...(pkgName ? { packageName: pkgName } : {}),
      });
    }

    // Program / include titles come from TRDIRT, because the search response can
    // pair them with the wrong object (ECC 7.40). On a read error the search
    // descriptions stay as they are.
    const progHits = resultsArr.filter((r) => r.type.startsWith('PROG/'));
    if (progHits.length) {
      const sapTexts = new Set(
        resultsArr.map((r) => r.description).filter((d): d is string => !!d),
      );
      try {
        const { titles, complete } = await readProgramTitles(
          context,
          progHits.map((r) => r.name),
          sapTexts,
        );
        for (const r of progHits) {
          const title = titles.get(r.name);
          if (title) r.description = title;
          // no row after a complete read: the search description belonged to another object
          else if (complete) delete r.description;
        }
      } catch (e: any) {
        logger?.warn(`SearchObject: TRDIRT title read failed: ${e?.message}`);
      }
    }

    objectsListCache.setCache(result);
    // rawXML repeated every parsed field and was over half of the response;
    // it is now opt-in.
    const body: Record<string, unknown> = { results: resultsArr };
    if (resultsArr.length >= maxResults) body.truncated = true;
    if (args.include_raw_xml === true) body.rawXML = xmlText;
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(body),
        },
      ],
    };
  } catch (error) {
    // MCP-compliant error response: always return content[] with type "text"
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ADT error: ${String(error)}`,
        },
      ],
    };
  }
}
