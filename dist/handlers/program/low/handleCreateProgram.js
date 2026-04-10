"use strict";
/**
 * CreateProgram Handler - Create ABAP Program
 *
 * Uses AdtClient.createProgram from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateProgram = handleCreateProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateProgramLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Create a new ABAP program. - use CreateProgram (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Program description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            program_type: {
                type: 'string',
                description: "Program type: 'executable', 'include', 'module_pool', 'function_group', 'class_pool', 'interface_pool' (optional).",
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
        required: ['program_name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateProgram MCP tool
 *
 * Uses AdtClient.createProgram - low-level single method call
 */
async function handleCreateProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, description, package_name, transport_request, program_type, application, session_id, session_state, } = args;
        // Validation
        if (!program_name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('program_name, description, and package_name are required'));
        }
        // Check if cloud - programs are not available on cloud systems
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Starting program creation: ${programName}`);
        try {
            // Create program
            const createState = await client.getProgram().create({
                programName,
                description,
                packageName: package_name,
                transportRequest: transport_request,
                programType: program_type,
                application,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for program ${programName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateProgram completed: ${programName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Program ${programName} created successfully. Use LockProgram and UpdateProgram to add source code, then UnlockProgram and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to create program: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Program ${programName} already exists.`;
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
//# sourceMappingURL=handleCreateProgram.js.map