"use strict";
/**
 * UnlockClass Handler - Unlock ABAP Class
 *
 * Uses AdtClient.unlockClass from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUnlockClass = handleUnlockClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UnlockClassLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Unlock an ABAP class after modification. Uses session from HandlerContext. Must use the same lock_handle from LockClass operation.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockClass operation.',
            },
        },
        required: ['class_name', 'lock_handle'],
    },
};
/**
 * Main handler for UnlockClass MCP tool
 *
 * Uses AdtClient.unlockClass - low-level single method call
 */
async function handleUnlockClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, lock_handle } = args;
        // Validation
        if (!class_name || !lock_handle) {
            return (0, utils_1.return_error)(new Error('class_name and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        const className = class_name.toUpperCase();
        logger?.info(`Starting class unlock: ${className}`);
        try {
            // Unlock class
            const unlockState = await client
                .getClass()
                .unlock({ className }, lock_handle);
            const unlockResult = unlockState.unlockResult;
            if (!unlockResult) {
                throw new Error(`Unlock did not return a response for class ${className}`);
            }
            logger?.info(`✅ UnlockClass completed: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    message: `Class ${className} unlocked successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error unlocking class ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to unlock class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Class ${className} not found.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Invalid lock handle. Make sure you're using the same lock_handle from LockClass.`;
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
//# sourceMappingURL=handleUnlockClass.js.map