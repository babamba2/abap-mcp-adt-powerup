"use strict";
/**
 * CheckStructure Handler - Syntax check for ABAP Structure
 *
 * Uses AdtClient.checkStructure from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckStructure = handleCheckStructure;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Perform syntax check on an ABAP structure. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session. If ddl_code is provided, validates new/unsaved code (will be base64 encoded in request).',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., Z_MY_PROGRAM).',
            },
            ddl_code: {
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
        required: ['structure_name'],
    },
};
/**
 * Main handler for CheckStructure MCP tool
 *
 * Uses AdtClient.checkStructure - low-level single method call
 */
async function handleCheckStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, ddl_code, version = 'inactive', session_id, session_state, } = args;
        // Validation
        if (!structure_name) {
            return (0, utils_1.return_error)(new Error('structure_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const structureName = structure_name.toUpperCase();
        const validVersions = ['active', 'inactive'];
        const checkVersion = version && validVersions.includes(version.toLowerCase())
            ? version.toLowerCase()
            : 'inactive';
        logger?.info(`Starting structure check: ${structureName} (version: ${checkVersion}) ${ddl_code ? '(with new code)' : '(saved version)'}`);
        try {
            // Check structure with optional source code (for validating new/unsaved code)
            // If ddl_code is provided, it will be base64 encoded in the request body
            const checkState = await client
                .getStructure()
                .check({ structureName, ddlCode: ddl_code }, checkVersion);
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for structure ${structureName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckStructure completed: ${structureName}`);
            logger?.info(`   Status: ${checkResult.status}`);
            logger?.info(`   Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    structure_name: structureName,
                    version: checkVersion,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Structure ${structureName} has no syntax errors`
                        : `Structure ${structureName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking structure ${structureName}:`, error);
            // Parse error message
            let errorMessage = `Failed to check structure: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Structure ${structureName} not found.`;
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
//# sourceMappingURL=handleCheckStructure.js.map