"use strict";
/**
 * DeleteLocalTypes Handler - Delete Local Types via AdtClient
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteLocalTypes = handleDeleteLocalTypes;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteLocalTypes',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete local types from an ABAP class by clearing the implementations include. Manages lock, update, unlock, and optional activation.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate_on_delete: {
                type: 'boolean',
                description: 'Activate parent class after deleting. Default: false',
                default: false,
            },
        },
        required: ['class_name'],
    },
};
async function handleDeleteLocalTypes(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, transport_request, activate_on_delete = false, } = args;
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Deleting local types for ${className}`);
        try {
            const localTypes = client.getLocalTypes();
            const deleteResult = await localTypes.delete({
                className,
                transportRequest: transport_request,
            });
            if (!deleteResult) {
                throw new Error(`Delete did not return a result for ${className}`);
            }
            if (activate_on_delete) {
                await client.getClass().activate({ className });
            }
            logger?.info(`✅ DeleteLocalTypes completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_delete,
                    message: `Local types deleted successfully from ${className}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting local types for ${className}: ${error?.message || error}`);
            let errorMessage = `Failed to delete local types: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Local types for ${className} not found.`;
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
//# sourceMappingURL=handleDeleteLocalTypes.js.map