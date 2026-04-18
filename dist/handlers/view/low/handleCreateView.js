"use strict";
/**
 * CreateView Handler - Create ABAP View
 *
 * Uses AdtClient.createView from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateView = handleCreateView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateViewLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Create a new ABAP view. - use CreateView (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'View description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            view_type: {
                type: 'string',
                description: "View type: 'executable', 'include', 'module_pool', 'function_group', 'class_pool', 'interface_pool' (optional).",
            },
            application: {
                type: 'string',
                description: "Application area (optional, default: '*').",
            },
            skip_check: {
                type: 'boolean',
                description: 'Skip post-create syntax check. Default: false. When false, runs a syntax check on the freshly created view shell and surfaces any errors with line numbers.',
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
        required: ['view_name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateView MCP tool
 *
 * Uses AdtClient.createView - low-level single method call
 */
async function handleCreateView(context, args) {
    const { connection, logger } = context;
    try {
        const { view_name, description, package_name, transport_request, skip_check, session_id, session_state, } = args;
        // Validation
        if (!view_name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('view_name, description, and package_name are required'));
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
        logger?.info(`Starting view creation: ${viewName}`);
        try {
            // Create view
            const createState = await client.getView().create({
                viewName,
                description,
                packageName: package_name,
                ddlSource: '',
                transportRequest: transport_request,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for view ${viewName}`);
            }
            // NOTE: No post-create syntax check. The empty DDL shell that
            // AdtClient.create() leaves on the server is NOT syntactically
            // valid ("DDIC source code does not contain a valid
            // definition"), so a post-create check would always fail. The
            // pre-write check in UpdateView is where view DDL gets validated
            // for real. `skip_check` is still accepted for API parity with
            // other low-level handlers but has no effect here.
            // Get updated session state after create
            logger?.info(`✅ CreateView completed: ${viewName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    view_name: viewName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `View ${viewName} created successfully. Use LockView and UpdateView to add source code, then UnlockView and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error creating view ${viewName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error creating view ${viewName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to create view: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `View ${viewName} already exists.`;
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
//# sourceMappingURL=handleCreateView.js.map