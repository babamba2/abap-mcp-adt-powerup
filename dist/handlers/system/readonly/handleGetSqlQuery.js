"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.parseSqlQueryXml = parseSqlQueryXml;
exports.handleGetSqlQuery = handleGetSqlQuery;
const clients_1 = require("../../../lib/clients");
const tableBlocklist_1 = require("../../../lib/policy/tableBlocklist");
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
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
                description: '[read-only] Maximum number of rows to return',
                default: 100,
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
                const lengthMatch = match.match(/dataPreview:length="(\d+)"/);
                if (nameMatch) {
                    columns.push({
                        name: nameMatch[1],
                        type: typeMatch ? typeMatch[1] : 'UNKNOWN',
                        description: descMatch ? descMatch[1] : '',
                        length: lengthMatch ? parseInt(lengthMatch[1], 10) : undefined,
                    });
                }
            });
        }
        // Extract row data
        const rows = [];
        // Find all column sections
        const columnSections = xmlData.match(/<dataPreview:columns>.*?<\/dataPreview:columns>/gs);
        if (columnSections && columnSections.length > 0) {
            // Extract data for each column
            const columnData = {};
            columnSections.forEach((section, index) => {
                if (index < columns.length) {
                    const columnName = columns[index].name;
                    const dataMatches = section.match(/<dataPreview:data[^>]*>(.*?)<\/dataPreview:data>/g);
                    if (dataMatches) {
                        columnData[columnName] = dataMatches.map((match) => {
                            const content = match.replace(/<[^>]+>/g, '');
                            return content || null;
                        });
                    }
                    else {
                        columnData[columnName] = [];
                    }
                }
            });
            // Convert column-based data to row-based data
            const maxRowCount = Math.max(...Object.values(columnData).map((arr) => arr.length), 0);
            for (let rowIndex = 0; rowIndex < maxRowCount; rowIndex++) {
                const row = {};
                columns.forEach((column) => {
                    const columnValues = columnData[column.name] || [];
                    row[column.name] = columnValues[rowIndex] || null;
                });
                rows.push(row);
            }
        }
        return {
            sql_query: sqlQuery,
            row_number: rowNumber,
            execution_time: queryExecutionTime,
            total_rows: totalRows,
            columns,
            rows,
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
        const response = await client
            .getUtils()
            .getSqlQuery({ sql_query: sqlQuery, row_number: rowNumber });
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
                        text: JSON.stringify(parsedData, null, 2),
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