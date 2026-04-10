"use strict";
/**
 * CheckTable Handler - Syntax check for ABAP table via ADT API
 *
 * Uses runTableCheckRun from @mcp-abap-adt/adt-clients/core/table for table-specific checking.
 * Requires session_id for stateful operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckTable = handleCheckTable;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const sessionUtils_1 = require("../../../lib/sessionUtils");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckTableLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Perform syntax check on an ABAP table. Returns syntax errors, warnings, and messages. Requires session_id for stateful operations. Can use session_id and session_state from GetSession to maintain the same session. If ddl_code is provided, validates new/unsaved code (will be base64 encoded in request).',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., Z_MY_TABLE)',
            },
            ddl_code: {
                type: 'string',
                description: 'Optional DDL source code to validate (for checking new/unsaved code). If provided, code will be base64 encoded and sent in check request body.',
            },
            version: {
                type: 'string',
                description: "Version to check: 'active' (last activated), 'inactive' (current unsaved), or 'new' (for new code validation). Default: new",
                enum: ['active', 'inactive', 'new'],
            },
            reporter: {
                type: 'string',
                description: "Check reporter: 'tableStatusCheck' or 'abapCheckRun'. Default: abapCheckRun",
                enum: ['tableStatusCheck', 'abapCheckRun'],
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['table_name'],
    },
};
/**
 * Main handler for CheckTable MCP tool
 */
async function handleCheckTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, ddl_code, version = 'new', reporter = 'abapCheckRun', session_id, session_state, } = args;
        if (!table_name) {
            return (0, utils_1.return_error)(new Error('table_name is required'));
        }
        const validReporters = ['tableStatusCheck', 'abapCheckRun'];
        const checkReporter = reporter && validReporters.includes(reporter)
            ? reporter
            : 'abapCheckRun';
        const validVersions = ['active', 'inactive', 'new'];
        const checkVersion = version && validVersions.includes(version.toLowerCase())
            ? version.toLowerCase()
            : 'new';
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        // Use provided session_id or generate new one (required for table check)
        const sessionId = session_id || (0, sessionUtils_1.generateSessionId)();
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table check: ${tableName} (reporter: ${checkReporter}, version: ${checkVersion}, session: ${sessionId.substring(0, 8)}..., ${ddl_code ? 'with new code' : 'saved version'})`);
        try {
            const builder = (0, clients_1.createAdtClient)(connection);
            // Check table with optional source code (for validating new/unsaved code)
            // If ddl_code is provided, it will be base64 encoded in the request body
            const checkState = await builder
                .getTable()
                .check({ tableName, ddlCode: ddl_code }, checkVersion);
            const response = checkState.checkResult;
            if (!response) {
                throw new Error('Table check did not return a response');
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckTable completed: ${tableName}`);
            logger?.info(`   Status: ${checkResult.status}`);
            logger?.info(`   Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    table_name: tableName,
                    version: checkVersion,
                    reporter: checkReporter,
                    check_result: checkResult,
                    session_id: sessionId,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Table ${tableName} has no syntax errors`
                        : `Table ${tableName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking table ${tableName}:`, error);
            let errorMessage = `Failed to check table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
                try {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    const errorData = parser.parse(error.response.data);
                    const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                        errorData['exc:exception']?.message;
                    if (errorMsg) {
                        errorMessage = `SAP Error: ${errorMsg}`;
                    }
                }
                catch (_parseError) {
                    // Ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCheckTable.js.map