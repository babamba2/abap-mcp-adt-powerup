"use strict";
/**
 * ActivateProgram Handler - Activate ABAP Program
 *
 * Uses AdtClient.activateProgram from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateProgram = handleActivateProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateProgramLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Activate an ABAP program. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
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
        required: ['program_name'],
    },
};
/**
 * Main handler for ActivateProgram MCP tool
 *
 * Uses AdtClient.activateProgram - low-level single method call
 */
async function handleActivateProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, session_id, session_state } = args;
        // Validation
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
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
        logger?.info(`Starting program activation: ${programName}`);
        try {
            // Activate program
            const activateState = await client
                .getProgram()
                .activate({ programName: programName });
            const response = activateState.activateResult;
            if (!response) {
                throw new Error(`Activation did not return a response for program ${programName}`);
            }
            // Parse activation response
            const activationResult = (0, utils_1.parseActivationResponse)(response.data);
            const success = activationResult.activated && activationResult.checked;
            // Get updated session state after activation
            logger?.info(`✅ ActivateProgram completed: ${programName}`);
            logger?.debug(`Activated: ${activationResult.activated}, Checked: ${activationResult.checked}, Messages: ${activationResult.messages.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success,
                    program_name: programName,
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
                        ? `Program ${programName} activated successfully`
                        : `Program ${programName} activation completed with ${activationResult.messages.length} message(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error activating program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to activate program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found.`;
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
//# sourceMappingURL=handleActivateProgram.js.map