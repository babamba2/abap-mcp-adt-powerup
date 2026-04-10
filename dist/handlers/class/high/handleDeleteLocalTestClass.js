"use strict";
/**
 * DeleteLocalTestClass Handler - Delete Local Test Class via AdtClient
 *
 * Uses AdtClient.getLocalTestClass().delete() for high-level delete operation.
 * Deletes by updating with empty code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteLocalTestClass = handleDeleteLocalTestClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteLocalTestClass',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete a local test class from an ABAP class by clearing the testclasses include. Manages lock, update, unlock, and optional activation of parent class.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable objects).',
            },
            activate_on_delete: {
                type: 'boolean',
                description: 'Activate parent class after deleting test class. Default: false',
                default: false,
            },
        },
        required: ['class_name'],
    },
};
/**
 * Main handler for DeleteLocalTestClass MCP tool
 *
 * Uses AdtClient.getLocalTestClass().delete() - high-level delete operation
 */
async function handleDeleteLocalTestClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, transport_request, activate_on_delete = false, } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Deleting local test class for ${className}`);
        try {
            // Delete local test class using AdtClient (updates with empty code)
            const localTestClass = client.getLocalTestClass();
            const deleteResult = await localTestClass.delete({
                className,
                transportRequest: transport_request,
            });
            if (!deleteResult) {
                throw new Error(`Delete did not return a result for local test class in ${className}`);
            }
            // If activation requested, activate parent class
            if (activate_on_delete) {
                await client.getClass().activate({ className });
            }
            logger?.info(`✅ DeleteLocalTestClass completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_delete,
                    message: `Local test class deleted successfully from ${className}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting local test class for ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete local test class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Local test class for ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleDeleteLocalTestClass.js.map