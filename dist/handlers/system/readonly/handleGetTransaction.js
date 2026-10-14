"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.parseTransactionParam = parseTransactionParam;
exports.buildTransactionInfo = buildTransactionInfo;
exports.handleGetTransaction = handleGetTransaction;
const clients_1 = require("../../../lib/clients");
const legacyTableRead_1 = require("../../../lib/legacyTableRead");
const handleGetSqlQuery_1 = require("./handleGetSqlQuery");
exports.TOOL_DEFINITION = {
    name: 'GetTransaction',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve ABAP transaction (t-code) details from TSTC / TSTCP — program, screen, and kind (program, parameter transaction with its target t-code and parameters such as an SM30 view, variant transaction). Pass transaction_names for many t-codes in one call.',
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
                description: 'Several transactions in one call (e.g. ["VA01","ZMY_TCODE"]).',
            },
        },
    },
};
const quoteList = (names) => names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
/** SELECT through the ADT data preview, or ZMCP_ADT_DISPATCH TABLE_READ on BASIS < 7.50. */
async function selectRows(connection, logger, table, fields, where, maxRows) {
    const sql = `SELECT ${fields.join(', ')} FROM ${table} WHERE ${where}`;
    try {
        const response = await (0, clients_1.createAdtClient)(connection, logger)
            .getUtils()
            .getSqlQuery({ sql_query: sql, row_number: maxRows });
        return (0, handleGetSqlQuery_1.parseSqlQueryXml)(response.data, sql, maxRows, logger).rows;
    }
    catch (e) {
        if (!(0, legacyTableRead_1.isLegacyUnsupported)(e))
            throw e;
        const res = await (0, legacyTableRead_1.legacyTableRead)(connection, {
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
function parseTransactionParam(param) {
    const p = String(param ?? '').trim();
    if (p.startsWith('@'))
        return { kind: 'variant' };
    const m = /^\/[*N](\S+)\s*(.*)$/i.exec(p);
    if (!m)
        return { kind: null };
    const parameters = {};
    for (const part of m[2].split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0)
            parameters[part.slice(0, eq).trim().toUpperCase()] = part
                .slice(eq + 1)
                .trim();
    }
    return { kind: 'parameter', target: m[1].toUpperCase(), parameters };
}
function buildTransactionInfo(names, tstc, tstcp) {
    const byCode = new Map(tstc.map((r) => [String(r.TCODE).toUpperCase(), r]));
    const paramBy = new Map(tstcp.map((r) => [String(r.TCODE).toUpperCase(), String(r.PARAM ?? '')]));
    return names.map((tcode) => {
        const row = byCode.get(tcode);
        if (!row)
            return { tcode, found: false };
        const info = { tcode, found: true, kind: 'program' };
        const program = String(row.PGMNA ?? '').trim();
        const screen = String(row.DYPNO ?? '').trim();
        if (program)
            info.program = program;
        if (screen)
            info.screen = screen;
        const param = paramBy.get(tcode);
        if (param) {
            info.param = param;
            const parsed = parseTransactionParam(param);
            if (parsed.kind)
                info.kind = parsed.kind;
            if (parsed.target)
                info.target_tcode = parsed.target;
            if (parsed.parameters && Object.keys(parsed.parameters).length)
                info.parameters = parsed.parameters;
        }
        return info;
    });
}
async function handleGetTransaction(context, args) {
    const { connection, logger } = context;
    try {
        const names = [
            ...(Array.isArray(args?.transaction_names) ? args.transaction_names : []),
            ...(args?.transaction_name ? [args.transaction_name] : []),
        ]
            .map((n) => String(n).trim().toUpperCase())
            .filter(Boolean);
        const unique = [...new Set(names)];
        if (!unique.length)
            throw new Error('transaction_name or transaction_names is required');
        const where = `TCODE IN (${quoteList(unique)})`;
        const tstc = await selectRows(connection, logger, 'TSTC', ['TCODE', 'PGMNA', 'DYPNO'], where, unique.length + 1);
        const tstcp = await selectRows(connection, logger, 'TSTCP', ['TCODE', 'PARAM'], where, unique.length + 1);
        const transactions = buildTransactionInfo(unique, tstc, tstcp);
        const payload = transactions.length === 1 && !Array.isArray(args?.transaction_names)
            ? { success: true, ...transactions[0] }
            : { success: true, transactions };
        return {
            isError: false,
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
    }
    catch (error) {
        logger?.error('GetTransaction failed', error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `ADT error: ${String(error?.message ?? error)}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetTransaction.js.map