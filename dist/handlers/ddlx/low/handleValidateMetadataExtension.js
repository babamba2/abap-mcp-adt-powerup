"use strict";
/**
 * ValidateMetadataExtension Handler - Validate ABAP MetadataExtension Name
 *
 * Uses AdtClient.validateMetadataExtension from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateMetadataExtension = handleValidateMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateMetadataExtensionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP metadata extension name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'MetadataExtension name to validate (e.g., ZI_MY_DDLX).',
            },
            description: {
                type: 'string',
                description: 'MetadataExtension description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
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
 * Main handler for ValidateMetadataExtension MCP tool
 *
 * Uses AdtClient.validateMetadataExtension - low-level single method call
 */
async function handleValidateMetadataExtension(context, args) {
    const { connection, logger } = context;
    try {
        const { name, description, package_name, session_id, session_state } = args;
        // Validation
        if (!name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('name, description, and package_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const ddlxName = name.toUpperCase();
        logger?.info(`Starting metadata extension validation: ${ddlxName}`);
        try {
            // Validate metadata extension
            const validationState = await client.getMetadataExtension().validate({
                name: ddlxName,
                description: description || '',
                packageName: package_name || '',
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateMetadataExtension completed: ${ddlxName} (valid=${result.valid})`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    name: ddlxName,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `MetadataExtension ${ddlxName} is valid and available`
                        : `MetadataExtension ${ddlxName} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating metadata extension ${ddlxName}:`, error);
            // Parse error message
            let errorMessage = `Failed to validate metadata extension: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `MetadataExtension ${ddlxName} not found.`;
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
//# sourceMappingURL=handleValidateMetadataExtension.js.map