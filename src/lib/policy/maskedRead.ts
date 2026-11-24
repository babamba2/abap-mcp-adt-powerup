/**
 * `mask` on the row-reading tools: resolve the table's DDIC on the connected system and
 * return the rows already masked (see personalMask.ts). Any failure returns no rows.
 */
import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import * as z from 'zod';
import { createAdtClient } from '../clients';
import { callDdicTablRead } from '../rfcBackend';
import {
  ddicFromTableData,
  isRefusedTable,
  MASK_VERSION,
  type MaskSpec,
  maskRows,
  type StrictSelect,
  type TableDdic,
} from './personalMask';

export const MASK_DESCRIPTION =
  'Test-data mode: return the rows with personal values already masked (deterministic tokens from salt; ' +
  'default-deny — a column keeps its value only when it is a non-personal field of the table by name, data element ' +
  'or domain). The table DDIC is read first; personal / credential tables are refused; GetSqlQuery then accepts only ' +
  'a single-table SELECT with plain fields, optional AS, a simple WHERE. No rows at all when any step fails. ' +
  'Tokens are keyed by a server-side secret the caller never sees; the result carries only the masked rows, column metadata and a "masking" block (version, masked columns).';

/** `mask` for zod-typed tool schemas. */
export const maskZod = z
  .object({
    salt: z.string().describe('16–64 hex characters, the run salt.'),
    extra_fields: z
      .array(z.string())
      .optional()
      .describe('More field names to mask as personal.'),
  })
  .optional()
  .describe(MASK_DESCRIPTION);

/** `mask` for JSON-schema tool definitions. */
export const MASK_JSON_SCHEMA = {
  type: 'object',
  description: MASK_DESCRIPTION,
  properties: {
    salt: {
      type: 'string',
      description: '16–64 hex characters, the run salt.',
    },
    extra_fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'More field names to mask as personal.',
    },
  },
  required: ['salt'],
} as const;

/**
 * Field → data element / domain of `table` on the connected system (the DEV system also
 * for a remote read: the same table is defined the same way; a field it does not know is
 * masked anyway).
 */
export async function resolveTableDdic(
  connection: IAbapConnection,
  table: string,
  logger?: { info?: (m: string) => void },
): Promise<TableDdic> {
  let body: string;
  if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
    const bridge = await callDdicTablRead(connection, { name: table });
    if (bridge.subrc !== 0)
      throw new Error(
        `DDIC of ${table} not readable (ZMCP_ADT_DDIC_TABL_READ subrc=${bridge.subrc}): ${bridge.message}`,
      );
    body = JSON.stringify(bridge.result);
  } else {
    const read = await createAdtClient(connection, logger as any)
      .getTable()
      .read({ tableName: table }, 'active');
    const data = read?.readResult?.data;
    body = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  }
  const ddic = ddicFromTableData(body);
  if (!ddic)
    throw new Error(
      `DDIC of ${table} has no fields this server can read; rows are not returned`,
    );
  return ddic;
}

/** Refuses a masked read of a personal / credential table (any of `tables`). */
export function refuseMaskedTables(tables: readonly string[]): void {
  const refused = tables.filter(isRefusedTable);
  if (refused.length)
    throw new Error(
      `mask: personal / credential table ${refused.join(', ')} — not read for test data`,
    );
}

/**
 * The read result with its rows masked and a `masking` block. Rows must be objects
 * keyed by column name; anything else (array rows, no rows key) fails.
 */
export function maskPayload(
  payload: Record<string, any>,
  spec: MaskSpec,
  ddic: TableDdic,
  select: StrictSelect | null,
  table: string,
  secret: Buffer,
): Record<string, any> {
  const rows = payload?.rows;
  if (!Array.isArray(rows))
    throw new Error('mask: the result has no row list; rows are not returned');
  if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r)))
    throw new Error(
      'mask: rows without column names cannot be masked; rows are not returned',
    );
  const sel = select && select.ok ? select : null;
  const result = maskRows(rows, spec.salt, spec.extraFields, {
    ddic,
    columns: sel ? sel.columns : null,
    star: sel ? sel.star : false,
    table,
    secret,
  });
  // Only listed metadata keys go back: no other copy of the rows can ride along.
  const kept: Record<string, any> = {};
  for (const key of SAFE_KEYS) if (key in payload) kept[key] = payload[key];
  return {
    ...kept,
    rows: result.rows,
    masking: {
      version: MASK_VERSION,
      default_deny: true,
      masked_columns: result.masked,
      ddic_fields: Object.keys(ddic).length,
    },
  };
}

/** Result keys a masked answer may keep besides `rows` (metadata only). */
const SAFE_KEYS = [
  'table',
  'table_name',
  'destination',
  'columns',
  'fields',
  'count',
  'rows_returned',
  'total_rows',
  'truncated',
  'note',
  'path',
] as const;
