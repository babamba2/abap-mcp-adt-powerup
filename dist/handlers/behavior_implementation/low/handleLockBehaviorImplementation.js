"use strict";
/**
 * LockBehaviorImplementation Handler - Lock ABAP Behavior Implementation Class
 *
 * Uses AdtClient.lockClass from @babamba2/mcp-abap-adt-clients (BehaviorImplementation extends ClassBuilder).
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockBehaviorImplementation = handleLockBehaviorImplementation;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockBehaviorImplementationLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Lock an ABAP behavior implementation class for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Behavior Implementation class name (e.g., ZBP_MY_ENTITY).',
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
/**
 * Main handler for LockBehaviorImplementation MCP tool
 *
 * Uses AdtClient.lockClass - BehaviorImplementation extends ClassBuilder
 */
async function handleLockBehaviorImplementation(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, session_id, session_state } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const className = class_name.toUpperCase();
        logger?.info(`Starting behavior implementation lock: ${className}`);
        try {
            // Lock class (BehaviorImplementation extends ClassBuilder)
            const lockHandle = await client.getClass().lock({ className });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for behavior implementation ${className}`);
            }
            // Get updated session state after lock
            logger?.info(`✅ LockBehaviorImplementation completed: ${className}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    lock_handle: lockHandle,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Behavior Implementation ${className} locked successfully. Use lock_handle in subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking behavior implementation ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock behavior implementation: ${error.message || String(error)}`;
            if (error.response?.data && typeof error.response.data === 'string') {
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
//# sourceMappingURL=handleLockBehaviorImplementation.js.map