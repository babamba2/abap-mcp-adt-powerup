"use strict";
/**
 * LockClass Handler - Lock ABAP Class
 *
 * Uses AdtClient.lockClass from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockClass = handleLockClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockClassLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Lock an ABAP class for modification. Uses session from HandlerContext. Returns lock handle that must be used in subsequent update/unlock operations.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
            },
        },
        required: ['class_name'],
    },
};
/**
 * Main handler for LockClass MCP tool
 *
 * Uses AdtClient.lockClass - low-level single method call
 */
async function handleLockClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Starting class lock: ${className}`);
        try {
            // Lock class
            const lockHandle = await client.getClass().lock({ className });
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for class ${className}`);
            }
            logger?.info(`✅ LockClass completed: ${className}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    lock_handle: lockHandle,
                    message: `Class ${className} locked successfully. Use this lock_handle for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking class ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to lock class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Class ${className} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Class ${className} is already locked by another user.`;
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
//# sourceMappingURL=handleLockClass.js.map