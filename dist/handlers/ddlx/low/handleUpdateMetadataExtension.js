"use strict";
/**
 * UpdateMetadataExtension Handler - Update ABAP Metadata Extension Source Code
 *
 * Uses AdtClient.updateMetadataExtension from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateMetadataExtension = handleUpdateMetadataExtension;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateMetadataExtensionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Update source code of an existing ABAP metadata extension. Requires lock handle from LockObject. - use UpdateMetadataExtension (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Metadata extension name (e.g., ZOK_C_TEST_0001). Metadata extension must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete metadata extension source code.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
            },
            skip_check: {
                type: 'boolean',
                description: "Skip post-write syntax check. Default: false. NOTE: SAP's /checkruns reporter is weak for DDLX — may return empty results for some error classes.",
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
        required: ['name', 'source_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateMetadataExtension MCP tool
 *
 * Uses AdtClient.updateMetadataExtension - low-level single method call
 */
async function handleUpdateMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { name, source_code, lock_handle, skip_check, session_id, session_state, } = args;
        // Validation
        if (!name || !source_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('name, source_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const metadataExtensionName = name.toUpperCase();
        logger?.info(`Starting metadata extension update: ${metadataExtensionName}`);
        try {
            // Update metadata extension with source code
            const updateState = await client.getMetadataExtension().update({
                name: metadataExtensionName,
                sourceCode: source_code,
            }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for metadata extension ${metadataExtensionName}`);
            }
            // Post-write syntax check (unless skipped). Surfaces ALL compile
            // errors with structured diagnostics. NOTE: SAP's /checkruns
            // reporter is weak for DDLX — may return empty for some errors.
            if (skip_check !== true) {
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'metadataExtension', name: metadataExtensionName });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Metadata Extension', metadataExtensionName);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateMetadataExtension completed: ${metadataExtensionName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: metadataExtensionName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Metadata extension ${metadataExtensionName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating metadata extension ${metadataExtensionName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating metadata extension ${metadataExtensionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update metadata extension: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Metadata extension ${metadataExtensionName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Metadata extension ${metadataExtensionName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateMetadataExtension.js.map