"use strict";
/**
 * CheckView Handler - Syntax check for ABAP View
 *
 * Uses AdtClient.checkView from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckView = handleCheckView;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckViewLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Perform syntax check on an ABAP view. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session. If ddl_source is provided, validates new/unsaved code (will be base64 encoded in request).',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., Z_MY_PROGRAM).',
            },
            ddl_source: {
                type: 'string',
                description: 'Optional DDL source code to validate (for checking new/unsaved code). If provided, code will be base64 encoded and sent in check request body.',
            },
            version: {
                type: 'string',
                description: "Version to check: 'active' (last activated) or 'inactive' (current unsaved). Default: inactive",
                enum: ['active', 'inactive'],
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
        required: ['view_name'],
    },
};
/**
 * Main handler for CheckView MCP tool
 *
 * Uses AdtClient.checkView - low-level single method call
 */
async function handleCheckView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, ddl_source, version = 'inactive', session_id, session_state, } = args;
        // Validation
        if (!view_name) {
            return (0, utils_1.return_error)(new Error('view_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const viewName = view_name.toUpperCase();
        const validVersions = ['active', 'inactive'];
        const checkVersion = version && validVersions.includes(version.toLowerCase())
            ? version.toLowerCase()
            : 'inactive';
        logger?.info(`Starting view check: ${viewName} (version: ${checkVersion}) ${ddl_source ? '(with new code)' : '(saved version)'}`);
        try {
            // Check view with optional source code (for validating new/unsaved code)
            // If ddl_source is provided, it will be base64 encoded in the request body
            const checkState = await client
                .getView()
                .check({ viewName: viewName, ddlSource: ddl_source }, checkVersion);
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for view ${viewName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckView completed: ${viewName}`);
            logger?.info(`   Status: ${checkResult.status}`);
            logger?.info(`   Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    view_name: viewName,
                    version: checkVersion,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `View ${viewName} has no syntax errors`
                        : `View ${viewName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to check view: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `View ${viewName} not found.`;
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
//# sourceMappingURL=handleCheckView.js.map