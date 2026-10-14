import type {
  IAbapConnection,
  ILogger,
} from '@babamba2/mcp-abap-adt-interfaces';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  isLegacyUnsupported,
  legacyTableRead,
} from '../../../lib/legacyTableRead';
import { parseSqlQueryXml } from './handleGetSqlQuery';

export const TOOL_DEFINITION = {
  name: 'GetTransaction',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[read-only] Retrieve ABAP transaction (t-code) details from TSTC / TSTCP — program, screen, and kind (program, parameter transaction with its target t-code and parameters such as an SM30 view, variant transaction). Pass transaction_names for many t-codes in one call.',
  inputSchema: {
    type: 'object',
    properties: {
      transaction_name: {
        type: 'string',
        description: 'Name of the ABAP transaction',
      },
      transaction_names: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Several transactions in one call (e.g. ["VA01","ZMY_TCODE"]).',
      },
    },
  },
} as const;

export interface TransactionInfo {
  tcode: string;
  found: boolean;
  /** program started (TSTC-PGMNA); for a parameter transaction usually empty */
  program?: string;
  screen?: string;
  /** program = report / dialog / OO entry; parameter = TSTCP '/*' or '/N' start; variant = TSTCP '@' */
  kind?: 'program' | 'parameter' | 'variant';
  /** parameter transaction: the t-code it calls (e.g. SM30) */
  target_tcode?: string;
  /** parameter transaction: NAME=VALUE pairs (e.g. VIEWNAME, UPDATE) */
  parameters?: Record<string, string>;
  /** raw TSTCP-PARAM */
  param?: string;
}

const quoteList = (names: string[]) =>
  names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');

/** SELECT through the ADT data preview, or ZMCP_ADT_DISPATCH TABLE_READ on BASIS < 7.50. */
async function selectRows(
  connection: IAbapConnection,
  logger: ILogger | undefined,
  table: string,
  fields: string[],
  where: string,
  maxRows: number,
): Promise<Array<Record<string, any>>> {
  const sql = `SELECT ${fields.join(', ')} FROM ${table} WHERE ${where}`;
  try {
    const response = await createAdtClient(connection, logger)
      .getUtils()
      .getSqlQuery({ sql_query: sql, row_number: maxRows });
    return parseSqlQueryXml(response.data, sql, maxRows, logger).rows;
  } catch (e) {
    if (!isLegacyUnsupported(e)) throw e;
    const res = await legacyTableRead(connection, {
      table,
      fields,
      where,
      maxRows,
      sqlQuery: sql,
    });
    return res.rows;
  }
}

/** '/*SM30 VIEWNAME=ZX;UPDATE=X;' → { target: 'SM30', parameters: { VIEWNAME: 'ZX', UPDATE: 'X' } } */
export function parseTransactionParam(param: string): {
  kind: 'parameter' | 'variant' | null;
  target?: string;
  parameters?: Record<string, string>;
} {
  const p = String(param ?? '').trim();
  if (p.startsWith('@')) return { kind: 'variant' };
  const m = /^\/[*N](\S+)\s*(.*)$/i.exec(p);
  if (!m) return { kind: null };
  const parameters: Record<string, string> = {};
  for (const part of m[2].split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0)
      parameters[part.slice(0, eq).trim().toUpperCase()] = part
        .slice(eq + 1)
        .trim();
  }
  return { kind: 'parameter', target: m[1].toUpperCase(), parameters };
}

export function buildTransactionInfo(
  names: string[],
  tstc: Array<Record<string, any>>,
  tstcp: Array<Record<string, any>>,
): TransactionInfo[] {
  const byCode = new Map(tstc.map((r) => [String(r.TCODE).toUpperCase(), r]));
  const paramBy = new Map(
    tstcp.map((r) => [String(r.TCODE).toUpperCase(), String(r.PARAM ?? '')]),
  );
  return names.map((tcode) => {
    const row = byCode.get(tcode);
    if (!row) return { tcode, found: false };
    const info: TransactionInfo = { tcode, found: true, kind: 'program' };
    const program = String(row.PGMNA ?? '').trim();
    const screen = String(row.DYPNO ?? '').trim();
    if (program) info.program = program;
    if (screen) info.screen = screen;
    const param = paramBy.get(tcode);
    if (param) {
      info.param = param;
      const parsed = parseTransactionParam(param);
      if (parsed.kind) info.kind = parsed.kind;
      if (parsed.target) info.target_tcode = parsed.target;
      if (parsed.parameters && Object.keys(parsed.parameters).length)
        info.parameters = parsed.parameters;
    }
    return info;
  });
}

export async function handleGetTransaction(context: HandlerContext, args: any) {
  const { connection, logger } = context;
  try {
    const names = [
      ...(Array.isArray(args?.transaction_names) ? args.transaction_names : []),
      ...(args?.transaction_name ? [args.transaction_name] : []),
    ]
      .map((n: unknown) => String(n).trim().toUpperCase())
      .filter(Boolean);
    const unique = [...new Set<string>(names)];
    if (!unique.length)
      throw new Error('transaction_name or transaction_names is required');
    const where = `TCODE IN (${quoteList(unique)})`;
    const tstc = await selectRows(
      connection,
      logger,
      'TSTC',
      ['TCODE', 'PGMNA', 'DYPNO'],
      where,
      unique.length + 1,
    );
    const tstcp = await selectRows(
      connection,
      logger,
      'TSTCP',
      ['TCODE', 'PARAM'],
      where,
      unique.length + 1,
    );
    const transactions = buildTransactionInfo(unique, tstc, tstcp);
    const payload =
      transactions.length === 1 && !Array.isArray(args?.transaction_names)
        ? { success: true, ...transactions[0] }
        : { success: true, transactions };
    return {
      isError: false,
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  } catch (error) {
    logger?.error('GetTransaction failed', error as any);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ADT error: ${String((error as Error)?.message ?? error)}`,
        },
      ],
    };
  }
}
