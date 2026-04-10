"use strict";
/**
 * UpdateLocalTypes Handler - Update Local Types via AdtClient
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateLocalTypes = handleUpdateLocalTypes;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateLocalTypes',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update local types in an ABAP class (implementations include). Manages lock, check, update, unlock, and optional activation.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            local_types_code: {
                type: 'string',
                description: 'Updated source code for local types.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate_on_update: {
                type: 'boolean',
                description: 'Activate parent class after updating. Default: false',
                default: false,
            },
        },
        required: ['class_name', 'local_types_code'],
    },
};
async function handleUpdateLocalTypes(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, local_types_code, transport_request, activate_on_update = false, } = args;
        if (!class_name || !local_types_code) {
            return (0, utils_1.return_error)(new Error('class_name and local_types_code are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Updating local types for ${className}`);
        try {
            const localTypes = client.getLocalTypes();
            const updateResult = await localTypes.update({
                className,
                localTypesCode: local_types_code,
                transportRequest: transport_request,
            }, { activateOnUpdate: activate_on_update });
            if (!updateResult) {
                throw new Error(`Update did not return a result for ${className}`);
            }
            logger?.info(`✅ UpdateLocalTypes completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_update,
                    message: `Local types updated successfully in ${className}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating local types for ${className}: ${error?.message || error}`);
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update local types in ${className}`);
            let errorMessage = `Failed to update local types: ${detailedError}`;
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
//# sourceMappingURL=handleUpdateLocalTypes.js.map