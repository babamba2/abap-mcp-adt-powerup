"use strict";
/**
 * UpdateServiceDefinition Handler - Update Existing ABAP Service Definition Source
 *
 * Uses AdtClient from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by client.
 *
 * Workflow: lock -> update -> check -> unlock -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateServiceDefinition = handleUpdateServiceDefinition;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateServiceDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Update source code of an existing ABAP service definition. Uses stateful session with proper lock/unlock mechanism.',
    inputSchema: {
        type: 'object',
        properties: {
            service_definition_name: {
                type: 'string',
                description: 'Service definition name (e.g., ZSD_MY_SERVICE). Must exist in the system.',
            },
            source_code: {
                type: 'string',
                description: 'Complete service definition source code.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional if object is local or already in transport.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate service definition after update. Default: true.',
            },
        },
        required: ['service_definition_name', 'source_code'],
    },
};
/**
 * Main handler for UpdateServiceDefinition MCP tool
 *
 * Uses AdtClient for all operations
 * Session and lock management handled internally by client
 */
async function handleUpdateServiceDefinition(context, args) {
    const { connection, logger } = context;
    try {
        const { service_definition_name, source_code, transport_request, activate = true, } = args;
        // Validation
        if (!service_definition_name || !source_code) {
            return (0, utils_1.return_error)(new Error('service_definition_name and source_code are required'));
        }
        // Get connection from session context (set by ProtocolHandler)
        // Connection is managed and cached per session, with proper token refresh via AuthBroker
        const serviceDefinitionName = service_definition_name.toUpperCase();
        logger?.info(`Starting service definition source update: ${serviceDefinitionName}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Build operation chain: lock -> update -> check -> unlock -> (activate)
            // Note: No validation needed for update - service definition must already exist
            const shouldActivate = activate !== false; // Default to true if not specified
            // Lock
            let lockHandle;
            let activateResponse;
            try {
                lockHandle = await client
                    .getServiceDefinition()
                    .lock({ serviceDefinitionName });
                // Update source code
                await client.getServiceDefinition().update({
                    serviceDefinitionName,
                    sourceCode: source_code,
                    transportRequest: args.transport_request,
                }, { lockHandle });
                // Post-write syntax check on the staged inactive version.
                // Surfaces ALL compile errors with structured diagnostics.
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'serviceDefinition', name: serviceDefinitionName });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Service Definition', serviceDefinitionName);
            }
            finally {
                if (lockHandle) {
                    try {
                        await client
                            .getServiceDefinition()
                            .unlock({ serviceDefinitionName }, lockHandle);
                        logger?.info(`[UpdateServiceDefinition] Service definition unlocked: ${serviceDefinitionName}`);
                    }
                    catch (unlockError) {
                        logger?.warn(`Failed to unlock service definition ${serviceDefinitionName}: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            // Activate if requested
            if (shouldActivate) {
                const activateState = await client
                    .getServiceDefinition()
                    .activate({ serviceDefinitionName });
                activateResponse = activateState.activateResult;
            }
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
            logger?.info(`✅ UpdateServiceDefinition completed successfully: ${serviceDefinitionName}`);
            // Return success result
            const stepsCompleted = ['lock', 'update', 'check', 'unlock'];
            if (shouldActivate) {
                stepsCompleted.push('activate');
            }
            const result = {
                success: true,
                service_definition_name: serviceDefinitionName,
                transport_request: transport_request || 'local',
                activated: shouldActivate,
                message: shouldActivate
                    ? `Service Definition ${serviceDefinitionName} updated and activated successfully`
                    : `Service Definition ${serviceDefinitionName} updated successfully (not activated)`,
                uri: `/sap/bc/adt/ddic/srvd/sources/${(0, utils_1.encodeSapObjectName)(serviceDefinitionName)}`,
                steps_completed: stepsCompleted,
                activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
                source_size_bytes: source_code.length,
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
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating service definition ${serviceDefinitionName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating service definition source ${serviceDefinitionName}:`, error);
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            return (0, utils_1.return_error)(new Error(`Failed to update service definition: ${errorMessage}`));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateServiceDefinition.js.map