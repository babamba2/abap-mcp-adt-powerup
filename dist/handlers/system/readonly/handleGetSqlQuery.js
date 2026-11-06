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
exports.parseSqlQueryXml = parseSqlQueryXml;
exports.sqlResultToFile = sqlResultToFile;
exports.handleGetSqlQuery = handleGetSqlQuery;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const clients_1 = require("../../../lib/clients");
const legacyTableRead_1 = require("../../../lib/legacyTableRead");
const tableBlocklist_1 = require("../../../lib/policy/tableBlocklist");
const sourceOutput_1 = require("../../../lib/sourceOutput");
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
const xmlEntities_1 = require("../../../lib/xmlEntities");
exports.TOOL_DEFINITION = {
    name: 'GetSqlQuery',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Execute ABAP SQL SELECT queries on database tables and CDS views via SAP ADT Data Preview API. Use for ad-hoc data retrieval, row counts, and filtered queries.',
    inputSchema: {
        type: 'object',
        properties: {
            sql_query: {
                type: 'string',
                description: 'SQL query to execute',
            },
            row_number: {
                type: 'number',
                description: 'Maximum number of rows to return',
                default: 100,
            },
            output: {
                type: 'string',
                enum: ['inline', 'file'],
                default: 'inline',
                description: '"inline" (default) returns the rows. "file" writes the rows as JSON under the MCP output dir (sql/<table>-<time>.json) and returns only the path, row count, column names and the truncated flag. Prefer "file" for large result sets.',
            },
            acknowledge_risk: {
                type: 'boolean',
                description: "Set to true ONLY after the user has explicitly authorized row extraction from an 'ask'-tier protected table. The approval is logged to stderr for audit. Has no effect on 'deny'-tier tables.",
                default: false,
            },
        },
        required: ['sql_query'],
    },
};
/**
 * One cell per <dataPreview:data> element. ADT writes an empty cell as a
 * self-closing <dataPreview:data/>; that form must count as a cell, or every
 * later value in the column moves up one row.
 */
const CELL_RE = /<dataPreview:data\b[^>]*?(?:\/>|>([\s\S]*?)<\/dataPreview:data>)/g;
/**
 * Parse SAP ADT XML response from freestyle SQL query and convert to JSON format
 * @param xmlData - Raw XML response from ADT
 * @param sqlQuery - Original SQL query
 * @param rowNumber - Number of rows requested
 * @returns Parsed SQL query response
 */
function parseSqlQueryXml(xmlData, sqlQuery, rowNumber, logger) {
    try {
        // Extract basic information
        const totalRowsMatch = xmlData.match(/<dataPreview:totalRows>(\d+)<\/dataPreview:totalRows>/);
        const totalRows = totalRowsMatch ? parseInt(totalRowsMatch[1], 10) : 0;
        const queryTimeMatch = xmlData.match(/<dataPreview:queryExecutionTime>([\d.]+)<\/dataPreview:queryExecutionTime>/);
        const queryExecutionTime = queryTimeMatch
            ? parseFloat(queryTimeMatch[1])
            : 0;
        // Extract column metadata
        const columns = [];
        const columnMatches = xmlData.match(/<dataPreview:metadata[^>]*>/g);
        if (columnMatches) {
            columnMatches.forEach((match) => {
                const nameMatch = match.match(/dataPreview:name="([^"]+)"/);
                const typeMatch = match.match(/dataPreview:type="([^"]+)"/);
                const descMatch = match.match(/dataPreview:description="([^"]+)"/);
                const description = descMatch ? (0, xmlEntities_1.decodeXmlEntities)(descMatch[1]) : '';
                const lengthMatch = match.match(/dataPreview:length="(\d+)"/);
                if (nameMatch) {
                    columns.push({
                        name: nameMatch[1],
                        type: typeMatch ? typeMatch[1] : 'UNKNOWN',
                        description,
                        length: lengthMatch ? parseInt(lengthMatch[1], 10) : undefined,
                    });
                }
            });
        }
        // Extract row data
        const rows = [];
        let truncated = false;
        // Find all column sections
        const columnSections = xmlData.match(/<dataPreview:columns>.*?<\/dataPreview:columns>/gs);
        if (columnSections && columnSections.length > 0) {
            // Extract data for each column
            const columnData = {};
            columnSections.forEach((section, index) => {
                if (index < columns.length) {
                    const columnName = columns[index].name;
                    columnData[columnName] = Array.from(section.matchAll(CELL_RE), (m) => m[1] ? (0, xmlEntities_1.decodeXmlEntities)(m[1]) : null);
                }
            });
            // Convert column-based data to row-based data
            const maxRowCount = Math.max(...Object.values(columnData).map((arr) => arr.length), 0);
            // ADT's data preview can return one row more than rowNumber.
            const rowCount = Math.min(maxRowCount, rowNumber);
            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
                const row = {};
                columns.forEach((column) => {
                    const columnValues = columnData[column.name] || [];
                    row[column.name] = columnValues[rowIndex] ?? null;
                });
                rows.push(row);
            }
            truncated = maxRowCount > rowNumber;
        }
        return {
            sql_query: sqlQuery,
            row_number: rowNumber,
            execution_time: queryExecutionTime,
            total_rows: totalRows,
            columns,
            rows,
            ...(truncated ? { truncated } : {}),
        };
    }
    catch (parseError) {
        logger?.error('Failed to parse SQL query XML:', parseError);
        // Return basic structure on parse error
        return {
            sql_query: sqlQuery,
            row_number: rowNumber,
            columns: [],
            rows: [],
            error: 'Failed to parse XML response',
        };
    }
}
/**
 * output: "file" — write the parsed result under <output root>/sql/ and return
 * a short summary instead of the rows. Same file shape on every path
 * (ADT data preview and the legacy TABLE_READ fallback).
 */
function sqlResultToFile(parsed) {
    const table = ((0, tableBlocklist_1.extractTablesFromSql)(String(parsed.sql_query ?? ''))[0] ?? 'query')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 17);
    const rand = Math.random().toString(36).slice(2, 6);
    const target = (0, sourceOutput_1.safeOutputPath)(path.join('sql', `${table}-${stamp}-${rand}.json`));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(parsed), 'utf8');
    const rows = Array.isArray(parsed.rows) ? parsed.rows.length : 0;
    return {
        output: 'file',
        path: target,
        rows,
        columns: Array.isArray(parsed.columns)
            ? parsed.columns.map((c) => c?.name ?? c)
            : [],
        truncated: parsed.truncated === true,
        ...(parsed.path ? { source_path: parsed.path } : {}),
    };
}
const sqlText = (args, parsed) => JSON.stringify(args?.output === 'file' ? sqlResultToFile(parsed) : parsed);
/**
 * Handler to execute freestyle SQL queries via SAP ADT Data Preview API
 *
 * @param args - Tool arguments containing sql_query and optional row_number parameter
 * @returns Response with parsed SQL query results or error
 */
async function handleGetSqlQuery(context, args) {
    const { connection, logger } = context;
    try {
        logger?.info('handleGetSqlQuery called');
        if (!args?.sql_query) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'SQL query is required');
        }
        const sqlQuery = args.sql_query;
        const rowNumber = args.row_number || 100; // Default to 100 rows if not specified
        const tables = (0, tableBlocklist_1.extractTablesFromSql)(sqlQuery);
        if (tables.length > 0 && !(0, tableBlocklist_1.isAggregateOnly)(sqlQuery)) {
            const hits = (0, tableBlocklist_1.checkTables)(tables);
            const verdict = (0, tableBlocklist_1.evaluateHits)(hits, args.acknowledge_risk === true, (0, tableBlocklist_1.activeProfile)());
            if (verdict.kind === 'deny') {
                logger?.warn(`Blocked GetSqlQuery: ${tables.join(',')}`);
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidRequest, verdict.message);
            }
            if (verdict.kind === 'ask') {
                logger?.warn(`GetSqlQuery requires user acknowledgement: ${tables.join(',')}`);
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidRequest, verdict.message);
            }
            if (verdict.kind === 'approved') {
                process.stderr.write(`[mcp-abap-adt][blocklist] AUDIT: user-acknowledged GetSqlQuery on ${verdict.tables.join(',')}\n`);
                logger?.warn(`AUDIT: user-acknowledged GetSqlQuery on ${verdict.tables.join(',')}`);
            }
        }
        logger?.info(`Executing SQL query (rows=${rowNumber})`);
        const client = (0, clients_1.createAdtClient)(connection, logger);
        let response;
        try {
            response = await client
                .getUtils()
                .getSqlQuery({ sql_query: sqlQuery, row_number: rowNumber });
        }
        catch (e) {
            // BASIS < 7.50 has no freestyle data preview: answer a single-table
            // SELECT on an allow-listed table through ZMCP_ADT_DISPATCH TABLE_READ.
            if (!(0, legacyTableRead_1.isLegacyUnsupported)(e))
                throw e;
            const simple = (0, legacyTableRead_1.parseSimpleSelect)(sqlQuery);
            if (!simple) {
                throw new Error(`${e.message} Fallback (ZMCP_ADT_DISPATCH TABLE_READ) handles only single-table SELECT … FROM … WHERE … — no JOIN, UNION, GROUP BY or aggregates.`);
            }
            logger?.info(`Legacy fallback: TABLE_READ ${simple.table}`);
            const parsed = await (0, legacyTableRead_1.legacyTableRead)(connection, {
                ...simple,
                maxRows: rowNumber,
                sqlQuery,
            });
            return {
                isError: false,
                content: [
                    {
                        type: 'text',
                        text: sqlText(args, {
                            ...parsed,
                            path: 'ecc-dispatch-table-read',
                        }),
                    },
                ],
            };
        }
        if (response.status === 200 && response.data) {
            logger?.info('SQL query request completed successfully');
            // Parse the XML response
            const parsedData = parseSqlQueryXml(response.data, sqlQuery, rowNumber, logger);
            logger?.debug(`Parsed SQL query data: rows=${parsedData.rows.length}/${parsedData.total_rows ?? 0}, columns=${parsedData.columns.length}`);
            const result = {
                isError: false,
                content: [
                    {
                        type: 'text',
                        text: sqlText(args, parsedData),
                    },
                ],
            };
            if (args.filePath) {
                logger?.debug(`Writing SQL query result to file: ${args.filePath}`);
                (0, writeResultToFile_1.writeResultToFile)(result, args.filePath);
            }
            return result;
        }
        else {
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to execute SQL query. Status: ${response.status}`);
        }
    }
    catch (error) {
        logger?.error('Failed to execute SQL query', error);
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
//# sourceMappingURL=handleGetSqlQuery.js.map