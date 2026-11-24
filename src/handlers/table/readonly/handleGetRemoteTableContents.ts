import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as z from 'zod';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  maskPayload,
  maskZod,
  refuseMaskedTables,
  resolveTableDdic,
} from '../../../lib/policy/maskedRead';
import { loadMaskSecret } from '../../../lib/policy/maskSecret';
import { maskSpecFrom, type TableDdic } from '../../../lib/policy/personalMask';
import {
  activeProfile,
  checkTables,
  evaluateHits,
} from '../../../lib/policy/tableBlocklist';
import { getActiveAlias } from '../../../lib/profile';
import { callDispatch } from '../../../lib/rfcBackend';
import { ErrorCode, McpError } from '../../../lib/utils';

// Same cap as the ABAP REMOTE_READ action; larger extracts page with skip_rows.
const MAX_ROWS = 5000;
// Rows returned when max_rows is not given: enough to see the data shape without a large dump.
const DEFAULT_ROWS = 100;
// RFC_READ_TABLE takes the WHERE clause as OPTIONS lines of at most 72 characters.
const OPTION_WIDTH = 72;
// Saved destinations kept per profile; older ones drop off so the picker list stays short.
const DEST_KEEP = 10;

export const TOOL_DEFINITION = {
  name: 'GetRemoteTableContents',
  available_in: ['onprem'] as const,
  description:
    '[read-only; needs the REMOTE_READ action in ZMCP_ADT_DISPATCH] Read rows of one table in another ' +
    'SAP system through an SM59 RFC destination (ABAP connection) with RFC_READ_TABLE, for building ' +
    'realistic test data. Never guess the destination: when the user has not named one, call without ' +
    'it — the error lists the destinations saved for this profile — and let the user pick one of them ' +
    'or enter another. A destination is saved after its first successful read. Business tables are ' +
    'allowed; the table blocklist still applies. One table per call (no joins); a row longer than 512 ' +
    'characters fails, so pick fields. Filter on key / indexed fields (large tables time out otherwise) ' +
    'and page large extracts with skip_rows.',
  inputSchema: {
    table_name: z.string().describe('Table in the remote system, e.g. VBAK.'),
    fields: z
      .array(z.string())
      .optional()
      .describe(
        'Fields to read; all fields when omitted (fails above 512 characters per row).',
      ),
    where: z
      .string()
      .optional()
      .describe(
        "Open SQL condition without WHERE, e.g. VKORG = '1000'. No sub-queries.",
      ),
    max_rows: z
      .number()
      .optional()
      .describe(`Rows to return (default ${DEFAULT_ROWS}, max ${MAX_ROWS}).`),
    skip_rows: z
      .number()
      .optional()
      .describe('Rows to skip first, for paging (default 0).'),
    destination: z
      .string()
      .optional()
      .describe(
        'SM59 RFC destination (ABAP connection, case-sensitive) chosen by the user, e.g. PRDCLNT100. ' +
          'Omit it to get the saved list for this profile (profile config.json → remoteDestinations).',
      ),
    acknowledge_risk: z
      .boolean()
      .optional()
      .describe(
        "Set to true ONLY after the user has explicitly authorized row extraction from an 'ask'-tier protected table.",
      ),
    mask: maskZod,
  },
} as const;

/** Path of the active profile's config.json, or null when no profile alias is active (legacy sap.env). */
function profileConfigPath(): string | null {
  const alias = getActiveAlias();
  if (!alias) return null;
  const home =
    process.env.SC4SAP_HOME_DIR || path.join(os.homedir(), '.sc4sap');
  return path.join(home, 'profiles', alias, 'config.json');
}

/** Destinations saved for the active profile, most recently used first (empty when none / unreadable). */
export function readRemoteDestinations(): string[] {
  const file = profileConfigPath();
  if (!file || !fs.existsSync(file)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8')).remoteDestinations;
    return Array.isArray(list)
      ? list.filter((d) => typeof d === 'string' && d)
      : [];
  } catch {
    return [];
  }
}

/**
 * Moves `dest` to the front of the saved list and writes config.json back, keeping every other key.
 * A failed write is only reported: the read itself already succeeded.
 */
export function rememberRemoteDestination(dest: string): void {
  const file = profileConfigPath();
  if (!file || !fs.existsSync(file)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const prev: string[] = Array.isArray(cfg.remoteDestinations)
      ? cfg.remoteDestinations
      : [];
    const next = [dest, ...prev.filter((d) => d !== dest)].slice(0, DEST_KEEP);
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    cfg.remoteDestinations = next;
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    process.stderr.write(
      `[mcp-abap-adt] remote destination not saved: ${String(e)}\n`,
    );
  }
}

/**
 * Splits an Open SQL condition into RFC_READ_TABLE OPTIONS lines of at most `width` characters.
 * Breaks only at whitespace outside quoted literals, so a literal is never cut in two.
 * @returns the lines (empty array for an empty condition)
 */
export function splitWhereLines(
  condition: string | undefined,
  width = OPTION_WIDTH,
): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of String(condition ?? '')) {
    if (ch === "'") quoted = !quoted; // '' inside a literal toggles twice and stays quoted
    if (!quoted && /\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (quoted)
    throw new McpError(
      ErrorCode.InvalidParams,
      'where: unclosed quote in the condition',
    );
  if (cur) tokens.push(cur);
  const lines: string[] = [];
  let line = '';
  for (const t of tokens) {
    if (t.length > width) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `where: "${t.slice(0, 40)}…" is longer than ${width} characters; RFC_READ_TABLE cannot split it`,
      );
    }
    if (!line) line = t;
    else if (line.length + 1 + t.length <= width) line += ` ${t}`;
    else {
      lines.push(line);
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * callDispatch throws "ZMCP_ADT_DISPATCH error (action=…, subrc=…): <message>" on a non-zero subrc.
 * Returns the REMOTE_READ message unchanged, or an install hint when the dispatcher lacks the action.
 */
export function dispatchErrorText(error: unknown): string {
  const msg = String((error as Error)?.message ?? error);
  if (/Unknown action:\s*REMOTE_READ/i.test(msg)) {
    return (
      'REMOTE_READ is not in ZMCP_ADT_DISPATCH on the connected system. Upload the current ' +
      'dispatcher source (sc4sap abap/zmcp_adt_dispatch.abap or _ecc.abap) there first.'
    );
  }
  return msg.replace(
    /^ZMCP_ADT_DISPATCH error \(action=REMOTE_READ, subrc=\d+\):\s*/,
    '',
  );
}

/**
 * GetRemoteTableContents: rows of one table in another SAP system via the dispatcher action
 * REMOTE_READ (RFC_READ_TABLE over the SM59 ABAP destination the user named).
 * @returns destination, table, fields [{name,type,length,text}], rows, count — or, without a
 *   destination, an error listing the saved destinations so the agent can ask the user.
 */
export async function handleGetRemoteTableContents(
  context: HandlerContext,
  args: any,
) {
  const { connection, logger } = context;
  try {
    if (!args?.table_name) {
      throw new McpError(ErrorCode.InvalidParams, 'table_name is required');
    }
    const destination = String(args.destination ?? '').trim(); // SM59 names are case-sensitive
    if (!destination) {
      // No default destination on purpose: the agent shows the saved list and lets the user pick.
      const saved = readRemoteDestinations();
      throw new McpError(
        ErrorCode.InvalidParams,
        saved.length
          ? `destination is required. Saved for this profile (most recent first): ${saved.join(', ')}. ` +
              'Ask the user to pick one of them or to name another SM59 destination.'
          : 'destination is required and none is saved for this profile yet. Ask the user for the SM59 destination name.',
      );
    }

    const tableName = String(args.table_name).trim().toUpperCase();
    const verdict = evaluateHits(
      checkTables([tableName]),
      args.acknowledge_risk === true,
      activeProfile(),
    );
    if (verdict.kind === 'deny' || verdict.kind === 'ask') {
      logger?.warn(`GetRemoteTableContents ${verdict.kind}: ${tableName}`);
      throw new McpError(ErrorCode.InvalidRequest, verdict.message);
    }
    if (verdict.kind === 'approved') {
      process.stderr.write(
        `[mcp-abap-adt][blocklist] AUDIT: user-acknowledged GetRemoteTableContents on ${verdict.tables.join(',')}\n`,
      );
    }

    // Test-data mode: the DDIC of the connected (DEV) system first; no rows when it fails.
    const mask = maskSpecFrom(args.mask);
    if (typeof mask === 'string')
      throw new McpError(ErrorCode.InvalidParams, mask);
    let ddic: TableDdic | null = null;
    let secret: Buffer | null = null;
    if (mask) {
      refuseMaskedTables([tableName]);
      secret = loadMaskSecret();
      try {
        ddic = await resolveTableDdic(connection, tableName, logger);
      } catch (e) {
        // A table the connected (DEV) system does not know, e.g. a Z table that exists
        // only in the remote system: no field is known, so every column is masked.
        logger?.warn(
          `mask: DDIC of ${tableName} not read on the connected system (${String(e)}); every column is masked`,
        );
        ddic = {};
      }
    }

    const requested =
      Number(args.max_rows) > 0
        ? Math.floor(Number(args.max_rows))
        : DEFAULT_ROWS;
    const params = {
      destination,
      table_name: tableName,
      field_list: Array.isArray(args.fields)
        ? args.fields
            .map((f: unknown) => String(f).trim().toUpperCase())
            .filter(Boolean)
        : [],
      options: splitWhereLines(args.where),
      max_rows: Math.min(requested, MAX_ROWS),
      skip_rows:
        Number(args.skip_rows) > 0 ? Math.floor(Number(args.skip_rows)) : 0,
    };
    let result: unknown;
    try {
      ({ result } = await callDispatch(connection, 'REMOTE_READ', params));
    } catch (e) {
      throw new Error(dispatchErrorText(e));
    }
    rememberRemoteDestination(destination); // saved only after a read worked, so typos never enter the list
    if (mask && ddic) {
      let parsed: unknown = result;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          throw new Error(
            'mask: the remote result is not JSON; rows are not returned',
          );
        }
      }
      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              maskPayload(
                parsed as Record<string, any>,
                mask,
                ddic,
                null,
                tableName,
                secret as Buffer,
              ),
            ),
          },
        ],
      };
    }
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    logger?.error('GetRemoteTableContents failed', error as any);
    return {
      isError: true,
      content: [{ type: 'text', text: `ADT error: ${String(error)}` }],
    };
  }
}
