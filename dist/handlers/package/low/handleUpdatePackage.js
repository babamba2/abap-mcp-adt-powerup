"use strict";
/**
 * UpdatePackage Handler - Update ABAP Package Description
 *
 * Uses AdtClient.updatePackage from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdatePackage = handleUpdatePackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdatePackageLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Update description of an existing ABAP package. Requires lock handle from LockObject and superPackage. - use UpdatePackageSource for full workflow with lock/unlock.',
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
            updated_description: {
                type: 'string',
                description: 'New description for the package.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
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
        required: [
            'package_name',
            'super_package',
            'updated_description',
            'lock_handle',
        ],
    },
};
/**
 * Main handler for UpdatePackage MCP tool
 *
 * Uses AdtClient.updatePackage - low-level single method call
 */
async function handleUpdatePackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, super_package, updated_description, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!package_name ||
            !super_package ||
            !updated_description ||
            !lock_handle) {
            return (0, utils_1.return_error)(new Error('package_name, super_package, updated_description, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            // CRITICAL: Use restoreSessionInConnection to properly restore session
            // This will set sessionId in connection and enable stateful session mode
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const packageName = package_name.toUpperCase();
        const superPackage = super_package.toUpperCase();
        logger?.info(`Starting package update: ${packageName}`);
        try {
            // Update package description
            const updateState = await client.getPackage().update({
                packageName,
                superPackage,
                updatedDescription: updated_description,
            }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for package ${packageName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdatePackage completed: ${packageName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    package_name: packageName,
                    super_package: superPackage,
                    updated_description,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Package ${packageName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Package ${packageName} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdatePackage.js.map