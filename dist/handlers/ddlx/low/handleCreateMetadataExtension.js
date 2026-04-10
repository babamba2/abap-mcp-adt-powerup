"use strict";
/**
 * CreateMetadataExtension Handler - Create ABAP Metadata Extension
 *
 * Uses AdtClient.createMetadataExtension from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateMetadataExtension = handleCreateMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateMetadataExtensionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP Metadata Extension. - use CreateMetadataExtension (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Metadata Extension name (e.g., ZI_MY_DDLX).',
            },
            description: {
                type: 'string',
                description: 'Metadata Extension description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional for local objects.',
            },
            master_language: {
                type: 'string',
                description: "Master language (optional, e.g., 'EN').",
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
        required: ['name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateMetadataExtension MCP tool
 *
 * Uses AdtClient.createMetadataExtension - low-level single method call
 */
async function handleCreateMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { name, description, package_name, transport_request, master_language, session_id, session_state, } = args;
        // Validation
        if (!name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('name, description, and package_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const ddlxName = name.toUpperCase();
        logger?.info(`Starting metadata extension creation: ${ddlxName}`);
        try {
            // Create metadata extension
            const createState = await client.getMetadataExtension().create({
                name: ddlxName,
                description,
                packageName: package_name,
                transportRequest: transport_request,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for metadata extension ${ddlxName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateMetadataExtension completed: ${ddlxName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    name: ddlxName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Metadata Extension ${ddlxName} created successfully. Use LockMetadataExtension and UpdateMetadataExtension to add source code, then UnlockMetadataExtension and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating metadata extension ${ddlxName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to create metadata extension: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Metadata Extension ${ddlxName} already exists.`;
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
//# sourceMappingURL=handleCreateMetadataExtension.js.map