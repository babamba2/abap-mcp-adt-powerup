"use strict";
/**
 * CheckDomain Handler - Syntax check for ABAP Domain
 *
 * Uses AdtClient.checkDomain from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCheckDomain = handleCheckDomain;
const checkRunParser_1 = require("../../../lib/checkRunParser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CheckDomainLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Perform syntax check on an ABAP domain. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., Z_MY_PROGRAM).',
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
 * Main handler for CheckDomain MCP tool
 *
 * Uses AdtClient.checkDomain - low-level single method call
 */
async function handleCheckDomain(context, args) {
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
        logger?.info(`Starting domain check: ${domainName}`);
        try {
            // Check domain
            const checkState = await client
                .getDomain()
                .check({ domainName: domainName });
            const response = checkState.checkResult;
            if (!response) {
                throw new Error(`Check did not return a response for domain ${domainName}`);
            }
            // Parse check results
            const checkResult = (0, checkRunParser_1.parseCheckRunResponse)(response);
            // Get updated session state after check
            logger?.info(`✅ CheckDomain completed: ${domainName}`);
            logger?.debug(`Status: ${checkResult.status} | Errors: ${checkResult.errors.length}, Warnings: ${checkResult.warnings.length}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: checkResult.success,
                    domain_name: domainName,
                    check_result: checkResult,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: checkResult.success
                        ? `Domain ${domainName} has no syntax errors`
                        : `Domain ${domainName} has ${checkResult.errors.length} error(s) and ${checkResult.warnings.length} warning(s)`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error checking domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to check domain: ${error.message || String(error)}`;
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
//# sourceMappingURL=handleCheckDomain.js.map