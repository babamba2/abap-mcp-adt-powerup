"use strict";
/**
 * ActivateBehaviorDefinition Handler - Activate ABAP Behavior Definition
 *
 * Uses AdtClient.activateBehaviorDefinition from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateBehaviorDefinition = handleActivateBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateBehaviorDefinitionLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Activate an ABAP behavior definition. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Behavior definition name (root entity, e.g., ZI_MY_ENTITY).',
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
        required: ['name'],
    },
};
/**
 * Main handler for ActivateBehaviorDefinition MCP tool
 *
 * Uses AdtClient.activateBehaviorDefinition - low-level single method call
 */
async function handleActivateBehaviorDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { name, session_id, session_state } = args;
        // Validation
        if (!name) {
            return (0, utils_1.return_error)(new Error('name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const behaviorDefinitionName = name.toUpperCase();
        logger?.info(`Starting behavior definition activation: ${behaviorDefinitionName}`);
        try {
            // Activate behavior definition - using types from adt-clients
            const activateConfig = {
                name: behaviorDefinitionName,
            };
            const activateState = await client
                .getBehaviorDefinition()
                .activate(activateConfig);
            const response = activateState.activateResult;
            if (!response) {
                throw new Error(`Activation did not return a response for behavior definition ${behaviorDefinitionName}`);
            }
            // Parse activation response
            const activationResult = (0, utils_1.parseActivationResponse)(response.data);
            const success = activationResult.activated && activationResult.checked;
            // Get updated session state after activation
            logger?.info(`✅ ActivateBehaviorDefinition completed: ${behaviorDefinitionName}`);
            logger?.info(`   Activated: ${activationResult.activated}, Checked: ${activationResult.checked}`);
            logger?.info(`   Messages: ${activationResult.messages.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success,
                    name: behaviorDefinitionName,
                    activation: {
                        activated: activationResult.activated,
                        checked: activationResult.checked,
                        generated: activationResult.generated,
                    },
                    messages: activationResult.messages,
                    warnings: activationResult.messages.filter((m) => m.type === 'warning' || m.type === 'W'),
                    errors: activationResult.messages.filter((m) => m.type === 'error' || m.type === 'E'),
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: success
                        ? `Behavior definition ${behaviorDefinitionName} activated successfully`
                        : `Behavior definition ${behaviorDefinitionName} activation completed with ${activationResult.messages.length} message(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error activating behavior definition ${behaviorDefinitionName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to activate behavior definition: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Behavior definition ${behaviorDefinitionName} not found.`;
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
//# sourceMappingURL=handleActivateBehaviorDefinition.js.map