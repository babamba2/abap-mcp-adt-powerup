"use strict";
/**
 * UpdateView Handler - Update ABAP View DDL Source
 *
 * Uses AdtClient.updateView from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateView = handleUpdateView;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateViewLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Update DDL source code of an existing CDS View or Classic View. Requires lock handle from LockObject. - use UpdateView (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., ZOK_R_TEST_0002). View must already exist.',
            },
            ddl_source: {
                type: 'string',
                description: "Complete DDL source code. CDS: include @AbapCatalog.sqlViewName and other annotations. Classic: plain 'define view' statement.",
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
            },
            skip_check: {
                type: 'boolean',
                description: 'Skip pre-write syntax check on ddl_source. Default: false. When false, runs a syntax check on the proposed code BEFORE uploading it and surfaces any errors with line numbers — the broken source never lands on SAP.',
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
        required: ['view_name', 'ddl_source', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateView MCP tool
 *
 * Uses AdtClient.updateView - low-level single method call
 */
async function handleUpdateView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, ddl_source, lock_handle, skip_check, session_id, session_state, } = args;
        // Validation
        if (!view_name || !ddl_source || !lock_handle) {
            return (0, utils_1.return_error)(new Error('view_name, ddl_source, and lock_handle are required'));
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
        logger?.info(`Starting view update: ${viewName}`);
        try {
            // Pre-write syntax check on the proposed DDL source (unless
            // skipped). Surfaces ALL compile errors with line numbers via
            // the inline /checkruns path, so the broken source never lands
            // on SAP.
            if (skip_check !== true) {
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'view', name: viewName, sourceCode: ddl_source });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'View', viewName);
            }
            // Update view with DDL source
            const updateState = await client
                .getView()
                .update({ viewName: viewName, ddlSource: ddl_source }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for view ${viewName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateView completed: ${viewName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    view_name: viewName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `View ${viewName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating view ${viewName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update view: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `View ${viewName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `View ${viewName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateView.js.map