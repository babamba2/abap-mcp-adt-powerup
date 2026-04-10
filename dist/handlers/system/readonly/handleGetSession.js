"use strict";
/**
 * GetSession Handler - Get session ID and session state for reuse across multiple requests
 *
 * Returns session ID and session state (cookies, CSRF token) that can be passed
 * to other handlers to maintain the same session and lock handle across operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetSession = handleGetSession;
const sessionUtils_1 = require("../../../lib/sessionUtils");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetSession',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Get a new session ID and current session state (cookies, CSRF token) for reuse across multiple ADT operations. Use this to maintain the same session and lock handle across multiple requests.',
    inputSchema: {
        type: 'object',
        properties: {
            force_new: {
                type: 'boolean',
                description: 'Force creation of a new session even if one exists. Default: false',
            },
        },
        required: [],
    },
};
/**
 * Main handler for GetSession MCP tool
 *
 * Returns session ID and session state that can be reused in other handlers
 */
async function handleGetSession(context, args) {
    const { connection, logger } = context;
    try {
        const { force_new = false } = args;
        logger?.debug(`Connecting managed session${force_new ? ' (force new)' : ''}...`);
        // Ensure connection is established (get cookies and CSRF token)
        // Generate new session ID
        const sessionId = (0, sessionUtils_1.generateSessionId)();
        // Session state management is now handled by auth-broker
        logger?.info(`✅ GetSession completed: session ID ${sessionId.substring(0, 8)}...`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                session_id: sessionId,
                session_state: null, // Session state management is now handled by auth-broker
                message: `Session ID generated. Use this session_id in subsequent requests to maintain the same session.`,
            }, null, 2),
        });
    }
    catch (error) {
        logger?.error('Error getting session:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetSession.js.map