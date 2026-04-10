"use strict";
/**
 * LockPackage Handler - Lock ABAP Package
 *
 * Uses AdtClient.lockPackage from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockPackage = handleLockPackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockPackageLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Lock an ABAP package for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id. Requires super_package.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_TEST_0002).',
            },
            super_package: {
                type: 'string',
                description: 'Super package (parent package) name (e.g., ZOK_PACKAGE). Required.',
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
        required: ['package_name', 'super_package'],
    },
};
/**
 * Main handler for LockPackage MCP tool
 *
 * Uses AdtClient.lockPackage - low-level single method call
 */
async function handleLockPackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, super_package, session_id, session_state } = args;
        // Validation
        if (!package_name || !super_package) {
            return (0, utils_1.return_error)(new Error('package_name and super_package are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            // CRITICAL: Use restoreSessionInConnection to properly restore session
            // This will set sessionId in connection and enable stateful session mode
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const packageName = package_name.toUpperCase();
        const superPackage = super_package.toUpperCase();
        logger?.info(`Starting package lock: ${packageName} in ${superPackage}`);
        try {
            // Lock package
            const lockHandle = await client
                .getPackage()
                .lock({ packageName, superPackage });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for package ${packageName}`);
            }
            // Get updated session state after lock
            const actualSessionId = connection.getSessionId() || session_id || null;
            // Session state is passed through from input - auth-broker manages it
            const actualSessionState = session_state || null;
            logger?.info(`✅ LockPackage completed: ${packageName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    package_name: packageName,
                    super_package: superPackage,
                    session_id: actualSessionId,
                    lock_handle: lockHandle,
                    session_state: actualSessionState,
                    message: `Package ${packageName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Package ${packageName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockPackage.js.map