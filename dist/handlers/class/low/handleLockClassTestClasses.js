"use strict";
/**
 * LockClassTestClasses Handler - Lock ABAP Unit test include for a class
 *
 * Uses AdtClient.lockTestClasses from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockClassTestClasses = handleLockClassTestClasses;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockClassTestClassesLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Lock ABAP Unit test classes include (CLAS/OC testclasses) for the specified class. Returns a test_classes_lock_handle for subsequent update/unlock operations using the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
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
        required: ['class_name'],
    },
};
async function handleLockClassTestClasses(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, session_id, session_state } = args;
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        const className = class_name.toUpperCase();
        logger?.info(`Starting test classes lock for: ${className}`);
        try {
            const classClient = client.getClass();
            const lockHandle = await classClient.lockTestClasses({ className });
            if (!lockHandle) {
                throw new Error(`Lock did not return a test classes lock handle for class ${className}`);
            }
            logger?.info(`✅ LockClassTestClasses completed: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    session_id: session_id || null,
                    test_classes_lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Test classes for ${className} locked successfully. Use this test_classes_lock_handle for update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking test classes for ${className}: ${error?.message || error}`);
            const reason = error?.response?.status === 404
                ? `Class ${className} not found.`
                : error?.response?.status === 409
                    ? `Test classes for ${className} are already locked by another user.`
                    : error?.message || String(error);
            return (0, utils_1.return_error)(new Error(reason));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleLockClassTestClasses.js.map