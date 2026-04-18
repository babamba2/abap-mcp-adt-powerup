"use strict";
/**
 * UnlockPackage Handler - Unlock ABAP Package
 *
 * Uses AdtClient.unlockPackage from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockPackage = handleUnlockPackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockPackageLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP package after modification. Requires lock handle from LockObject and superPackage. - must use the same session_id and lock_handle from LockObject.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_TEST_0002). Package must already exist.',
            },
            super_package: {
                type: 'string',
                description: 'Super package (parent package) name. Required for package operations.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject operation',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from LockObject operation. Must be the same as used in LockObject.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from LockObject (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['package_name', 'super_package', 'lock_handle', 'session_id'],
    },
};
/**
 * Main handler for UnlockPackage MCP tool
 *
 * Uses AdtClient.unlockPackage - low-level single method call
 */
async function handleUnlockPackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, super_package, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!package_name || !super_package || !lock_handle || !session_id) {
            return (0, utils_1.return_error)(new Error('package_name, super_package, lock_handle, and session_id are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_state) {
            // CRITICAL: Use restoreSessionInConnection to properly restore session
            // This will set sessionId in connection and enable stateful session mode
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const packageName = package_name.toUpperCase();
        const superPackage = super_package.toUpperCase();
        logger?.info(`Starting package unlock: ${packageName} (session: ${session_id.substring(0, 8)}...)`);
        try {
            // Unlock package using AdtClient (with proper session state restored)
            const unlockState = await client
                .getPackage()
                .unlock({ packageName, superPackage }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for package ${packageName}`);
            }
            // Get updated session state after unlock
            logger?.info(`✅ UnlockPackage completed: ${packageName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    package_name: packageName,
                    super_package: superPackage,
                    session_id: session_id,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Package ${packageName} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle or session. Make sure you're using the same session_id and lock_handle from LockObject.`;
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
//# sourceMappingURL=handleUnlockPackage.js.map