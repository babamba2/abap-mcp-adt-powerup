/**
 * Table reads on legacy systems (BASIS < 7.50, e.g. ECC 6.0 EhP7).
 *
 * The ADT data-preview endpoints behind GetSqlQuery (/datapreview/freestyle)
 * and GetTableContents (/datapreview/ddic) do not exist there, so the client
 * library refuses both. This module answers the same requests through the
 * ZMCP_ADT_DISPATCH action TABLE_READ instead — a read-only, allow-listed
 * SELECT on one table (abap/zmcp_adt_dispatch_ecc.abap, FORM table_read).
 *
 * Only simple single-table statements are translated:
 *   SELECT f1, f2 | * FROM tab [AS a] [WHERE <condition>] [ORDER BY …]
 * The WHERE text is passed on as an Open SQL condition; the ABAP side rejects
 * sub-queries and any table outside its allow list. JOINs, UNION, GROUP BY and
 * aggregates are refused here with a clear message.
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import type { SqlQueryResponse } from '../handlers/system/readonly/handleGetSqlQuery';
import { callDispatch } from './rfcBackend';

/** Tables the dispatcher's TABLE_READ accepts (keep in sync with the ABAP allow list). */
export const LEGACY_READABLE_TABLES = [
  'MODACT',
  'MODATTR',
  'MODSAP',
  'GB31',
  'GB92',
  'GB93',
  'T001D',
  'T001Q',
  'TBE24',
  'TBE34',
  'TPS34',
  'TFRM',
  'TFRMT',
  'T100',
] as const;

/** Row cap of the ABAP TABLE_READ action (FORM table_read: max_rows > 5000 → 5000). */
export const DISPATCH_MAX_ROWS = 5000;

/** True for the client library's "not supported on this SAP system (legacy …)" refusal. */
export function isLegacyUnsupported(error: unknown): boolean {
  return /not supported on this SAP system \(legacy|BASIS < 7\.50/i.test(
    String((error as Error)?.message ?? error),
  );
}

export interface SimpleSelect {
  table: string;
  fields: string[];
  where: string;
}

/**
 * Parse a single-table SELECT into { table, fields, where }. Returns null for
 * anything else (joins, unions, aggregates, grouping, sub-selects).
 */
export function parseSimpleSelect(sql: string): SimpleSelect | null {
  const text = String(sql ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;$/, '');
  if (/\b(JOIN|UNION|GROUP BY|HAVING)\b/i.test(text)) return null;
  const m =
    /^SELECT (?:SINGLE |DISTINCT )?(.+?) FROM ([A-Za-z0-9_/]+)(?: (?:AS )?(?!WHERE\b|ORDER\b|UP\b)([A-Za-z]\w*))?(?: WHERE (.+?))?(?: ORDER BY .+?)?(?: UP TO \d+ ROWS)?$/i.exec(
      text,
    );
  if (!m) return null;
  const [, fieldList, table, alias, where = ''] = m;
  if (/\bSELECT\b/i.test(where)) return null;
  if (/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(fieldList)) return null;
  const stripAlias = (s: string) => s.trim().replace(/^\w+~/, '');
  const fields =
    fieldList.trim() === '*'
      ? []
      : fieldList
          .split(',')
          .map((f) => stripAlias(f).toUpperCase())
          .filter(Boolean);
  const cond = alias
    ? where.replace(new RegExp(`\\b${alias}~`, 'gi'), '')
    : where.replace(/\b\w+~/g, '');
  return { table: table.toUpperCase(), fields, where: cond.trim() };
}

/**
 * Read rows through ZMCP_ADT_DISPATCH TABLE_READ and return them in the
 * GetSqlQuery response shape.
 */
export async function legacyTableRead(
  connection: IAbapConnection,
  req: {
    table: string;
    fields?: string[];
    where?: string;
    maxRows: number;
    sqlQuery?: string;
  },
): Promise<SqlQueryResponse> {
  const table = req.table.toUpperCase();
  if (!(LEGACY_READABLE_TABLES as readonly string[]).includes(table)) {
    throw new Error(
      `Table reads on this SAP release (BASIS < 7.50) go through ZMCP_ADT_DISPATCH TABLE_READ, which allows only ${LEGACY_READABLE_TABLES.join(', ')} — ${table} is not in that list.`,
    );
  }
  // Ask for one row more than requested, so a full page is only reported as
  // truncated when more rows really exist. The ABAP side caps at
  // DISPATCH_MAX_ROWS; at that cap a full page still counts as truncated.
  const fetchRows = Math.min(req.maxRows + 1, DISPATCH_MAX_ROWS);
  const { result } = await callDispatch(connection, 'TABLE_READ', {
    table_name: table,
    field_list: req.fields ?? [],
    condition: req.where ?? '',
    max_rows: fetchRows,
  });
  const all: Array<Record<string, any>> = Array.isArray(
    result?.rows ?? result?.ROWS,
  )
    ? (result.rows ?? result.ROWS)
    : [];
  const truncated =
    all.length > req.maxRows ||
    (req.maxRows >= DISPATCH_MAX_ROWS && all.length >= DISPATCH_MAX_ROWS);
  const rows = all.slice(0, req.maxRows);
  const names = req.fields?.length
    ? req.fields
    : rows.length
      ? Object.keys(rows[0])
      : [];
  return {
    sql_query: req.sqlQuery ?? `SELECT * FROM ${table}`,
    row_number: req.maxRows,
    total_rows: rows.length,
    columns: names.map((name) => ({ name: name.toUpperCase(), type: 'C' })),
    rows: rows.map((r) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) out[k.toUpperCase()] = v;
      return out;
    }),
    ...(truncated ? { truncated: true } : {}),
  };
}
