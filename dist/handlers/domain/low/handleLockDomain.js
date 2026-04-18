"use strict";
/**
 * LockDomain Handler - Lock ABAP Domain
 *
 * Uses AdtClient.lockDomain from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockDomain = handleLockDomain;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockDomainLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Lock an ABAP domain for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
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
 * Main handler for LockDomain MCP tool
 *
 * Uses AdtClient.lockDomain - low-level single method call
 */
async function handleLockDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, session_id, session_state } = args;
        // Validation
        if (!domain_name) {
            return (0, utils_1.return_error)(new Error('domain_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const domainName = domain_name.toUpperCase();
        logger?.info(`Starting domain lock: ${domainName}`);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        try {
            // Lock domain
            const lockHandle = await client.getDomain().lock({ domainName });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for domain ${domainName}`);
            }
            // Get actual session ID from connection (may be different from input if new session was created)
            const actualSessionId = connection.getSessionId() || session_id || null;
            logger?.info(`✅ LockDomain completed: ${domainName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    session_id: actualSessionId,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Domain ${domainName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock domain: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Domain ${domainName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Domain ${domainName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockDomain.js.map