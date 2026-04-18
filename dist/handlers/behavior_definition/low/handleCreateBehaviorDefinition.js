"use strict";
/**
 * CreateBehaviorDefinition Handler - Create ABAP Behavior Definition
 *
 * Uses AdtClient.createBehaviorDefinition from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateBehaviorDefinition = handleCreateBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateBehaviorDefinitionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP Behavior Definition. - use CreateBehaviorDefinition (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Behavior Definition name (e.g., ZI_MY_BDEF).',
            },
            description: {
                type: 'string',
                description: 'Behavior Definition description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required.',
            },
            root_entity: {
                type: 'string',
                description: 'Root entity name (e.g., ZI_MY_ENTITY).',
            },
            implementation_type: {
                type: 'string',
                description: "Implementation type: 'Managed', 'Unmanaged', 'Abstract', or 'Projection'.",
                enum: ['Managed', 'Unmanaged', 'Abstract', 'Projection'],
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
        required: [
            'name',
            'description',
            'package_name',
            'root_entity',
            'implementation_type',
        ],
    },
};
/**
 * Main handler for CreateBehaviorDefinition MCP tool
 *
 * Uses AdtClient.createBehaviorDefinition - low-level single method call
 */
async function handleCreateBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { name, description, package_name, transport_request, root_entity, implementation_type, session_id, session_state, } = args;
        // Validation
        // Note: transport_request is optional (can be empty for local objects)
        if (!name ||
            !description ||
            !package_name ||
            !root_entity ||
            !implementation_type) {
            return (0, utils_1.return_error)(new Error('name, description, package_name, root_entity, and implementation_type are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const bdefName = name.toUpperCase();
        logger?.info(`Starting behavior definition creation: ${bdefName}`);
        try {
            // Create behavior definition - using types from adt-clients
            const createConfig = {
                name: bdefName,
                description,
                packageName: package_name,
                transportRequest: transport_request,
                rootEntity: root_entity,
                implementationType: implementation_type,
            };
            const createState = await client
                .getBehaviorDefinition()
                .create(createConfig);
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for behavior definition ${bdefName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateBehaviorDefinition completed: ${bdefName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: bdefName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request,
                    root_entity: root_entity,
                    implementation_type: implementation_type,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Behavior Definition ${bdefName} created successfully. Use LockBehaviorDefinition and UpdateBehaviorDefinition to add source code, then UnlockBehaviorDefinition and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating behavior definition ${bdefName}: ${error?.message || error}`);
            if (error.response?.data) {
                logger?.error(`Response body: ${typeof error.response.data === 'string' ? error.response.data.substring(0, 500) : JSON.stringify(error.response.data).substring(0, 500)}`);
            }
            // Parse error message
            let errorMessage = `Failed to create behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Behavior Definition ${bdefName} already exists.`;
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
//# sourceMappingURL=handleCreateBehaviorDefinition.js.map