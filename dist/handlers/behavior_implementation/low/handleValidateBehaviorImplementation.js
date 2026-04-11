"use strict";
/**
 * ValidateBehaviorImplementation Handler - Validate ABAP Behavior Implementation Class Name
 *
 * Uses AdtClient.validateBehaviorImplementation from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateBehaviorImplementation = handleValidateBehaviorImplementation;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateBehaviorImplementationLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP behavior implementation class name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Behavior Implementation class name to validate (e.g., ZBP_MY_ENTITY).',
            },
            behavior_definition: {
                type: 'string',
                description: 'Behavior Definition name (e.g., ZI_MY_ENTITY). Required for validation.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.',
            },
            description: {
                type: 'string',
                description: 'Class description. Required for validation.',
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
            'class_name',
            'behavior_definition',
            'package_name',
            'description',
        ],
    },
};
/**
 * Main handler for ValidateBehaviorImplementation MCP tool
 *
 * Uses AdtClient.validateBehaviorImplementation - low-level single method call
 */
async function handleValidateBehaviorImplementation(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, behavior_definition, package_name, description, session_id, session_state, } = args;
        // Validation
        if (!class_name || !behavior_definition || !package_name || !description) {
            return (0, utils_1.return_error)(new Error('class_name, behavior_definition, package_name, and description are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const className = class_name.toUpperCase();
        const behaviorDefinition = behavior_definition.toUpperCase();
        logger?.info(`Starting behavior implementation validation: ${className} for ${behaviorDefinition}`);
        try {
            // Validate behavior implementation
            const validateConfig = {
                className: className,
                behaviorDefinition: behaviorDefinition,
                packageName: package_name.toUpperCase(),
                description: description,
            };
            const validationState = await client
                .getBehaviorImplementation()
                .validate(validateConfig);
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateBehaviorImplementation completed: ${className}`);
            logger?.info(`   Valid: ${result.valid}, Message: ${result.message}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    class_name: className,
                    behavior_definition: behaviorDefinition,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Behavior Implementation ${className} is valid and available`
                        : `Behavior Implementation ${className} validation failed: ${result.message}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating behavior implementation ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to validate behavior implementation: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Behavior Implementation ${className} not found.`;
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
//# sourceMappingURL=handleValidateBehaviorImplementation.js.map