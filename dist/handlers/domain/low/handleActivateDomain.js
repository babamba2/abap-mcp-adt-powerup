"use strict";
/**
 * ActivateDomain Handler - Activate ABAP Domain
 *
 * Uses AdtClient.activateDomain from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateDomain = handleActivateDomain;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateDomainLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Activate an ABAP domain. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., ZDM_MY_DOMAIN).',
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
        required: ['domain_name'],
    },
};
/**
 * Main handler for ActivateDomain MCP tool
 *
 * Uses AdtClient.activateDomain - low-level single method call
 */
async function handleActivateDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, session_id, session_state } = args;
        // Validation
        if (!domain_name) {
            return (0, utils_1.return_error)(new Error('domain_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const domainName = domain_name.toUpperCase();
        logger?.info(`Starting domain activation: ${domainName}`);
        try {
            // Activate domain
            const activateState = await client
                .getDomain()
                .activate({ domainName: domainName });
            const response = activateState.activateResult;
            if (!response) {
                throw new Error(`Activation did not return a response for domain ${domainName}`);
            }
            // Parse activation response
            const activationResult = (0, utils_1.parseActivationResponse)(response.data);
            const success = activationResult.activated && activationResult.checked;
            // Get updated session state after activation
            logger?.info(`✅ ActivateDomain completed: ${domainName}`);
            logger?.debug(`Activated: ${activationResult.activated}, Checked: ${activationResult.checked}, Messages: ${activationResult.messages.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success,
                    domain_name: domainName,
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
                        ? `Domain ${domainName} activated successfully`
                        : `Domain ${domainName} activation completed with ${activationResult.messages.length} message(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error activating domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to activate domain: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Domain ${domainName} not found.`;
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
//# sourceMappingURL=handleActivateDomain.js.map