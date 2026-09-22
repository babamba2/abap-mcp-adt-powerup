import type { SearchObjectsParams } from '@babamba2/mcp-abap-adt-clients';
import type { IAdtResponse } from '@babamba2/mcp-abap-adt-interfaces';
import { createAdtClient } from '../../../lib/clients';
import { objectsListCache } from '../../../lib/getObjectsListCache';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { ErrorCode, McpError, return_response } from '../../../lib/utils';
import { decodeXmlEntities } from '../../../lib/xmlEntities';

const DEFAULT_MAX_RESULTS = 50;

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
