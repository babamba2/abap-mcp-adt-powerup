"use strict";
/**
 * CreateStructure Handler - Create ABAP Structure
 *
 * Uses AdtClient.createStructure from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateStructure = handleCreateStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP structure. - use CreateStructure (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Structure description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            structure_type: {
                type: 'string',
                description: "Structure type: 'executable', 'include', 'module_pool', 'function_group', 'class_pool', 'interface_pool' (optional).",
            },
            application: {
                type: 'string',
                description: "Application area (optional, default: '*').",
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
        required: ['structure_name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateStructure MCP tool
 *
 * Uses AdtClient.createStructure - low-level single method call
 */
async function handleCreateStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, description, package_name, transport_request, session_id, session_state, } = args;
        // Validation
        if (!structure_name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('structure_name, description, and package_name are required'));
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
        logger?.info(`Starting structure creation: ${structureName}`);
        try {
            // Create structure
            const createState = await client.getStructure().create({
                structureName,
                description,
                packageName: package_name,
                ddlCode: '',
                transportRequest: transport_request,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for structure ${structureName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateStructure completed: ${structureName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Structure ${structureName} created successfully. Use LockStructure and UpdateStructure to add source code, then UnlockStructure and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating structure ${structureName}:`, error);
            // Parse error message
            let errorMessage = `Failed to create structure: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Structure ${structureName} already exists.`;
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
//# sourceMappingURL=handleCreateStructure.js.map