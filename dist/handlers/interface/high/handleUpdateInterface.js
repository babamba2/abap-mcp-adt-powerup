"use strict";
/**
 * UpdateInterface Handler - Update existing ABAP Interface source code
 *
 * Uses InterfaceBuilder from @mcp-abap-adt/adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive version) -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateInterface = handleUpdateInterface;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateInterface',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update source code of an existing ABAP interface. Uses stateful session with proper lock/unlock mechanism. Lock handle and transport number are passed in URL parameters.',
    inputSchema: {
        type: 'object',
        properties: {
            interface_name: {
                type: 'string',
                description: 'Interface name (e.g., ZIF_MY_INTERFACE). Must exist in the system.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP interface source code with INTERFACE...ENDINTERFACE section.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional if object is local or already in transport.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate interface after update. Default: true.',
            },
        },
        required: ['interface_name', 'source_code'],
    },
};
/**
 * Main handler for UpdateInterface MCP tool
 *
 * Uses InterfaceBuilder from @mcp-abap-adt/adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleUpdateInterface(context, args) {
    const { connection, logger } = context;
    try {
        const { interface_name, source_code, transport_request, activate = true, } = args;
        // Validation
        if (!interface_name || !source_code) {
            return (0, utils_1.return_error)(new Error('interface_name and source_code are required'));
        }
        const interfaceName = interface_name.toUpperCase();
        logger?.info(`Starting interface source update: ${interfaceName}`);
        try {
            // Get configuration from environment variables
            // Create logger for connection (only logs when DEBUG_CONNECTORS is enabled)
            // Create connection directly for this handler call
            // Get connection from session context (set by ProtocolHandler)
            // Connection is managed and cached per session, with proper token refresh via AuthBroker
            logger?.debug(`[UpdateInterface] Created separate connection for handler call: ${interfaceName}`);
        }
        catch (connectionError) {
            const errorMessage = connectionError instanceof Error
                ? connectionError.message
                : String(connectionError);
            logger?.error(`[UpdateInterface] Failed to create connection: ${errorMessage}`);
            return (0, utils_1.return_error)(new Error(`Failed to create connection: ${errorMessage}`));
        }
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Build operation chain: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive version) -> (activate)
            // Note: No validation needed for update - interface must already exist
            const shouldActivate = activate !== false; // Default to true if not specified
            let activateResponse;
            let lockHandle;
            let checkWarnings = [];
            try {
                // Lock
                lockHandle = await client.getInterface().lock({ interfaceName });
                // Pre-write syntax check on the proposed source. If errors are
                // found we never PUT the broken code; the active interface
                // stays in its previous working state and the lock is released
                // by the finally block below.
                logger?.debug(`[UpdateInterface] Pre-write syntax check: ${interfaceName}`);
                const preCheckResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, {
                    kind: 'interface',
                    name: interfaceName,
                    sourceCode: source_code,
                });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(preCheckResult, 'Interface', interfaceName);
                checkWarnings = preCheckResult.warnings;
                logger?.info(`[UpdateInterface] Pre-write check passed: ${interfaceName}`);
                // Update
                logger?.info(`[UpdateInterface] Updating interface source code: ${interfaceName}`);
                await client
                    .getInterface()
                    .update({ interfaceName, sourceCode: source_code }, { lockHandle });
                logger?.info(`[UpdateInterface] Interface source code updated: ${interfaceName}`);
            }
            finally {
                if (lockHandle) {
                    try {
                        await client.getInterface().unlock({ interfaceName }, lockHandle);
                        logger?.info(`[UpdateInterface] Interface unlocked: ${interfaceName}`);
                    }
                    catch (unlockError) {
                        logger?.warn(`Failed to unlock interface ${interfaceName}: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            // Post-write inactive check — non-fatal: warnings flow into
            // check_warnings, transport/tooling issues are logged and ignored.
            logger?.debug(`[UpdateInterface] Checking inactive version: ${interfaceName}`);
            try {
                const postCheckResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'interface', name: interfaceName });
                if (postCheckResult.warnings.length > 0) {
                    checkWarnings = [...checkWarnings, ...postCheckResult.warnings];
                }
                logger?.info(`[UpdateInterface] Inactive version check completed: ${interfaceName}`);
            }
            catch (checkError) {
                logger?.warn(`[UpdateInterface] Inactive version check had issues: ${interfaceName} | ${checkError instanceof Error
                    ? checkError.message
                    : String(checkError)}`);
            }
            // Activate if requested
            if (shouldActivate) {
                const activateState = await client
                    .getInterface()
                    .activate({ interfaceName });
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
            logger?.info(`✅ UpdateInterface completed successfully: ${interfaceName}`);
            // Return success result
            const stepsCompleted = [
                'lock',
                'check_new_code',
                'update',
                'unlock',
                'check_inactive',
            ];
            if (shouldActivate) {
                stepsCompleted.push('activate');
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    interface_name: interfaceName,
                    transport_request: transport_request || 'local',
                    activated: shouldActivate,
                    message: `Interface ${interfaceName} updated successfully${shouldActivate ? ' and activated' : ''}`,
                    activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
                    check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
                    steps_completed: stepsCompleted,
                }),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating interface ${interfaceName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating interface source ${interfaceName}: ${error?.message || error}`);
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            return (0, utils_1.return_error)(new Error(`Failed to update interface: ${errorMessage}`));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateInterface.js.map