"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASK_JSON_SCHEMA = exports.maskZod = exports.MASK_DESCRIPTION = void 0;
exports.resolveTableDdic = resolveTableDdic;
exports.refuseMaskedTables = refuseMaskedTables;
exports.maskPayload = maskPayload;
const z = __importStar(require("zod"));
const clients_1 = require("../clients");
const rfcBackend_1 = require("../rfcBackend");
const personalMask_1 = require("./personalMask");
exports.MASK_DESCRIPTION = 'Test-data mode: return the rows with personal values already masked (deterministic tokens from salt; ' +
    'default-deny — a column keeps its value only when it is a non-personal field of the table by name, data element ' +
    'or domain). The table DDIC is read first; personal / credential tables are refused; GetSqlQuery then accepts only ' +
    'a single-table SELECT with plain fields, optional AS, a simple WHERE. No rows at all when any step fails. ' +
    'Tokens are keyed by a server-side secret the caller never sees; the result carries only the masked rows, column metadata and a "masking" block (version, masked columns).';
/** `mask` for zod-typed tool schemas. */
exports.maskZod = z
    .object({
    salt: z.string().describe('16–64 hex characters, the run salt.'),
    extra_fields: z
        .array(z.string())
        .optional()
        .describe('More field names to mask as personal.'),
})
    .optional()
    .describe(exports.MASK_DESCRIPTION);
/** `mask` for JSON-schema tool definitions. */
exports.MASK_JSON_SCHEMA = {
    type: 'object',
    description: exports.MASK_DESCRIPTION,
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
};
/**
 * Field → data element / domain of `table` on the connected system (the DEV system also
 * for a remote read: the same table is defined the same way; a field it does not know is
 * masked anyway).
 */
async function resolveTableDdic(connection, table, logger) {
    let body;
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
        const bridge = await (0, rfcBackend_1.callDdicTablRead)(connection, { name: table });
        if (bridge.subrc !== 0)
            throw new Error(`DDIC of ${table} not readable (ZMCP_ADT_DDIC_TABL_READ subrc=${bridge.subrc}): ${bridge.message}`);
        body = JSON.stringify(bridge.result);
    }
    else {
        const read = await (0, clients_1.createAdtClient)(connection, logger)
            .getTable()
            .read({ tableName: table }, 'active');
        const data = read?.readResult?.data;
        body = typeof data === 'string' ? data : JSON.stringify(data ?? '');
    }
    const ddic = (0, personalMask_1.ddicFromTableData)(body);
    if (!ddic)
        throw new Error(`DDIC of ${table} has no fields this server can read; rows are not returned`);
    return ddic;
}
/** Refuses a masked read of a personal / credential table (any of `tables`). */
function refuseMaskedTables(tables) {
    const refused = tables.filter(personalMask_1.isRefusedTable);
    if (refused.length)
        throw new Error(`mask: personal / credential table ${refused.join(', ')} — not read for test data`);
}
/**
 * The read result with its rows masked and a `masking` block. Rows must be objects
 * keyed by column name; anything else (array rows, no rows key) fails.
 */
function maskPayload(payload, spec, ddic, select, table, secret) {
    const rows = payload?.rows;
    if (!Array.isArray(rows))
        throw new Error('mask: the result has no row list; rows are not returned');
    if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r)))
        throw new Error('mask: rows without column names cannot be masked; rows are not returned');
    const sel = select && select.ok ? select : null;
    const result = (0, personalMask_1.maskRows)(rows, spec.salt, spec.extraFields, {
        ddic,
        columns: sel ? sel.columns : null,
        star: sel ? sel.star : false,
        table,
        secret,
    });
    // Only listed metadata keys go back: no other copy of the rows can ride along.
    const kept = {};
    for (const key of SAFE_KEYS)
        if (key in payload)
            kept[key] = payload[key];
    return {
        ...kept,
        rows: result.rows,
        masking: {
            version: personalMask_1.MASK_VERSION,
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
];
//# sourceMappingURL=maskedRead.js.map