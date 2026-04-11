"use strict";
/**
 * UnlockClassTestClasses Handler - Unlock ABAP Unit test include for a class
 *
 * Uses AdtClient.unlockTestClasses from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockClassTestClasses = handleUnlockClassTestClasses;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockClassTestClassesLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock ABAP Unit test classes include for a class using the test_classes_lock_handle obtained from LockClassTestClassesLow.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle returned by LockClassTestClassesLow.',
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
        required: ['class_name', 'lock_handle'],
    },
};
async function handleUnlockClassTestClasses(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, lock_handle, session_id, session_state } = args;
        if (!class_name || !lock_handle) {
            return (0, utils_1.return_error)(new Error('class_name and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        const className = class_name.toUpperCase();
        logger?.info(`Starting test classes unlock for: ${className}`);
        try {
            const classClient = client.getClass();
            await classClient.unlockTestClasses({ className }, lock_handle);
            logger?.info(`✅ UnlockClassTestClasses completed: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Test classes for ${className} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking test classes for ${className}: ${error?.message || error}`);
            const reason = error?.response?.status === 404
                ? `Class ${className} or the provided lock handle was not found.`
                : error?.message || String(error);
            return (0, utils_1.return_error)(new Error(reason));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUnlockClassTestClasses.js.map