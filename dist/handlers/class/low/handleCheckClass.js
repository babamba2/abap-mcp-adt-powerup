"use strict";
/**
 * CheckClass Handler - Syntax check for ABAP class via ADT API
 *
 * Uses checkClass from @mcp-abap-adt/adt-clients/core/class for class-specific checking.
 * Supports checking existing classes or hypothetical source code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckClass = handleCheckClass;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckClassLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Perform syntax check on an ABAP class. Can check existing class (active/inactive) or hypothetical source code. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS)',
            },
            version: {
                type: 'string',
                description: "Version to check: 'active' (last activated) or 'inactive' (current unsaved). Default: active",
                enum: ['active', 'inactive'],
            },
            source_code: {
                type: 'string',
                description: 'Optional: source code to validate. If provided, validates hypothetical code without creating object. Must include complete CLASS DEFINITION and IMPLEMENTATION sections.',
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
        required: ['class_name'],
    },
};
/**
 * Main handler for CheckClass MCP tool
 */
async function handleCheckClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, version = 'active', source_code, session_id, session_state, } = args;
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const checkVersion = version && ['active', 'inactive'].includes(version.toLowerCase())
            ? version.toLowerCase()
            : 'active';
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const className = class_name.toUpperCase();
        logger?.info(`Starting class check: ${className} (version: ${checkVersion}, has source: ${!!source_code})`);
        try {
            const client = (0, clients_1.createAdtClient)(connection, logger);
            const checkState = await client
                .getClass()
                .check({ className, sourceCode: source_code }, checkVersion);
            const response = checkState.checkResult;
            if (!response) {
                throw new Error('Class check did not return a response');
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckClass completed: ${className}`);
            logger?.info(`   Status: ${checkResult.status}`);
            logger?.info(`   Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    class_name: className,
                    version: checkVersion,
                    check_result: checkResult,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Class ${className} has no syntax errors`
                        : `Class ${className} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking class ${className}: ${error?.message || error}`);
            let errorMessage = `Failed to check class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Class ${className} not found.`;
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
//# sourceMappingURL=handleCheckClass.js.map