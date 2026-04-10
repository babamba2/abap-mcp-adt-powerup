"use strict";
/**
 * UpdateBehaviorImplementation Handler - Update Existing ABAP Behavior Implementation
 *
 * Uses AdtClient from @mcp-abap-adt/adt-clients for all operations.
 * Session and lock management handled internally by client.
 *
 * Workflow: lock -> update main source -> update implementations -> check -> unlock -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateBehaviorImplementation = handleUpdateBehaviorImplementation;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateBehaviorImplementation',
    available_in: ['onprem', 'cloud'],
    description: 'Update source code of an existing ABAP behavior implementation class. Updates both main source (with FOR BEHAVIOR OF clause) and implementations include. Uses stateful session with proper lock/unlock mechanism.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Behavior Implementation class name (e.g., ZBP_MY_ENTITY). Must exist in the system.',
            },
            behavior_definition: {
                type: 'string',
                description: 'Behavior Definition name (e.g., ZI_MY_ENTITY). Must match the behavior definition used when creating the class.',
            },
            implementation_code: {
                type: 'string',
                description: 'Implementation code for the implementations include. Contains the actual behavior implementation methods.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional if object is local or already in transport.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate behavior implementation after update. Default: true.',
            },
        },
        required: ['class_name', 'behavior_definition', 'implementation_code'],
    },
};
/**
 * Main handler for UpdateBehaviorImplementation MCP tool
 *
 * Uses AdtClient for all operations
 * Session and lock management handled internally by client
 */
async function handleUpdateBehaviorImplementation(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, behavior_definition, implementation_code, transport_request, activate = true, } = args;
        // Validation
        if (!class_name || !behavior_definition || !implementation_code) {
            return (0, utils_1.return_error)(new Error('class_name, behavior_definition, and implementation_code are required'));
        }
        // Get connection from session context (set by ProtocolHandler)
        // Connection is managed and cached per session, with proper token refresh via AuthBroker
        const className = class_name.toUpperCase();
        const behaviorDefinition = behavior_definition.toUpperCase();
        logger?.info(`Starting behavior implementation source update: ${className} for ${behaviorDefinition}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Update behavior implementation using AdtClient chain
            const shouldActivate = activate !== false; // Default to true if not specified
            const updateState = await client.getBehaviorImplementation().update({
                className,
                behaviorDefinition,
                implementationCode: implementation_code,
                transportRequest: transport_request,
            }, { activateOnUpdate: shouldActivate });
            const activateResponse = updateState.activateResult;
            // Parse activation warnings if activation was performed
            let activationWarnings = [];
            if (shouldActivate &&
                activateResponse &&
                typeof activateResponse.data === 'string' &&
                activateResponse.data.includes('<chkl:messages')) {
                const parser = new fast_xml_parser_1.XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const result = parser.parse(activateResponse.data);
                const messages = result?.['chkl:messages']?.msg;
                if (messages) {
                    const msgArray = Array.isArray(messages) ? messages : [messages];
                    activationWarnings = msgArray.map((msg) => `${msg['@_type']}: ${msg.shortText?.txt || 'Unknown'}`);
                }
            }
            logger?.info(`✅ UpdateBehaviorImplementation completed successfully: ${className}`);
            // Return success result
            const stepsCompleted = [
                'lock',
                'update_main_source',
                'update_implementations',
                'check',
                'unlock',
            ];
            if (shouldActivate) {
                stepsCompleted.push('activate');
            }
            const result = {
                success: true,
                class_name: className,
                behavior_definition: behaviorDefinition,
                transport_request: transport_request || 'local',
                activated: shouldActivate,
                message: shouldActivate
                    ? `Behavior Implementation ${className} updated and activated successfully`
                    : `Behavior Implementation ${className} updated successfully (not activated)`,
                uri: `/sap/bc/adt/oo/classes/${(0, utils_1.encodeSapObjectName)(className).toLowerCase()}`,
                steps_completed: stepsCompleted,
                activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
            };
            return (0, utils_1.return_response)({
                data: JSON.stringify(result, null, 2),
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            });
        }
        catch (error) {
            logger?.error(`Error updating behavior implementation source ${className}: ${error?.message || error}`);
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            return (0, utils_1.return_error)(new Error(`Failed to update behavior implementation: ${errorMessage}`));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateBehaviorImplementation.js.map