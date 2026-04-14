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
exports.TOOL_DEFINITION = void 0;
exports.handleGetTableContents = handleGetTableContents;
const z = __importStar(require("zod"));
const clients_1 = require("../../../lib/clients");
const tableBlocklist_1 = require("../../../lib/policy/tableBlocklist");
const utils_1 = require("../../../lib/utils");
const handleGetSqlQuery_1 = require("../../system/readonly/handleGetSqlQuery");
exports.TOOL_DEFINITION = {
    name: 'GetTableContents',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve contents (data preview) of an ABAP database table or CDS view. Returns rows of data like SE16/SE16N.',
    inputSchema: {
        table_name: z.string().describe('Name of the ABAP table'),
        max_rows: z
            .number()
            .optional()
            .describe('Maximum number of rows to retrieve'),
        acknowledge_risk: z
            .boolean()
            .optional()
            .describe("Set to true ONLY after the user has explicitly authorized row extraction from an 'ask'-tier protected table. The approval is logged to stderr for audit. Has no effect on 'deny'-tier tables."),
    },
};
async function handleGetTableContents(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.table_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Table name is required');
        }
        const tableName = args.table_name;
        const maxRows = args.max_rows || 100;
        const hits = (0, tableBlocklist_1.checkTables)([tableName]);
        const verdict = (0, tableBlocklist_1.evaluateHits)(hits, args.acknowledge_risk === true, (0, tableBlocklist_1.activeProfile)());
        if (verdict.kind === 'deny') {
            logger?.warn(`Blocked GetTableContents: ${tableName}`);
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidRequest, verdict.message);
        }
        if (verdict.kind === 'ask') {
            logger?.warn(`GetTableContents requires user acknowledgement: ${tableName}`);
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidRequest, verdict.message);
        }
        if (verdict.kind === 'approved') {
            process.stderr.write(`[mcp-abap-adt][blocklist] AUDIT: user-acknowledged GetTableContents on ${verdict.tables.join(',')}\n`);
            logger?.warn(`AUDIT: user-acknowledged GetTableContents on ${verdict.tables.join(',')}`);
        }
        logger?.info(`Reading table contents: ${tableName} (max_rows=${maxRows})`);
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client
            .getUtils()
            .getTableContents({ table_name: tableName, max_rows: maxRows });
        if (response.status === 200 && response.data) {
            logger?.info('Table contents request completed successfully');
            const parsedData = (0, handleGetSqlQuery_1.parseSqlQueryXml)(response.data, `SELECT * FROM ${tableName}`, maxRows, logger);
            logger?.debug(`Parsed table data: rows=${parsedData.rows.length}/${parsedData.total_rows ?? 0}, columns=${parsedData.columns.length}`);
            return {
                isError: false,
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(parsedData, null, 2),
                    },
                ],
            };
        }
        else {
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to read table contents. Status: ${response.status}`);
        }
    }
    catch (error) {
        logger?.error('Failed to read table contents', error);
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
//# sourceMappingURL=handleGetTableContents.js.map