"use strict";
/**
 * ValidateStructure Handler - Validate ABAP Structure Name
 *
 * Uses AdtClient.validateStructure from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateStructure = handleValidateStructure;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateStructureLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP structure name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name to validate (e.g., Z_MY_PROGRAM).',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.',
            },
            description: {
                type: 'string',
                description: 'Structure description. Required for validation.',
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
        required: ['structure_name', 'package_name', 'description'],
    },
};
/**
 * Main handler for ValidateStructure MCP tool
 *
 * Uses AdtClient.validateStructure - low-level single method call
 */
async function handleValidateStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, package_name, description, session_id, session_state, } = args;
        // Validation
        if (!structure_name || !package_name || !description) {
            return (0, utils_1.return_error)(new Error('structure_name, package_name, and description are required'));
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
        logger?.info(`Starting structure validation: ${structureName}`);
        try {
            // Validate structure
            const validationState = await client.getStructure().validate({
                structureName: structureName,
                packageName: package_name.toUpperCase(),
                description: description,
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateStructure completed: ${structureName}`);
            logger?.info(`   Valid: ${result.valid}, Message: ${result.message}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    structure_name: structureName,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Structure name ${structureName} is valid and available`
                        : `Structure name ${structureName} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating structure ${structureName}:`, error);
            // Parse error message
            let errorMessage = `Failed to validate structure: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleValidateStructure.js.map