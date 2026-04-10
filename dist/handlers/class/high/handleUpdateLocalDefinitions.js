"use strict";
/**
 * UpdateLocalDefinitions Handler - Update Local Definitions via AdtClient
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateLocalDefinitions = handleUpdateLocalDefinitions;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateLocalDefinitions',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update local definitions in an ABAP class (definitions include). Manages lock, check, update, unlock, and optional activation.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            definitions_code: {
                type: 'string',
                description: 'Updated source code for local definitions.',
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
        required: ['class_name', 'definitions_code'],
    },
};
async function handleUpdateLocalDefinitions(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, definitions_code, transport_request, activate_on_update = false, } = args;
        if (!class_name || !definitions_code) {
            return (0, utils_1.return_error)(new Error('class_name and definitions_code are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Updating local definitions for ${className}`);
        try {
            const localDefinitions = client.getLocalDefinitions();
            const updateResult = await localDefinitions.update({
                className,
                definitionsCode: definitions_code,
                transportRequest: transport_request,
            }, { activateOnUpdate: activate_on_update });
            if (!updateResult) {
                throw new Error(`Update did not return a result for ${className}`);
            }
            logger?.info(`✅ UpdateLocalDefinitions completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_update,
                    message: `Local definitions updated successfully in ${className}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating local definitions for ${className}: ${error?.message || error}`);
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update local definitions in ${className}`);
            let errorMessage = `Failed to update local definitions: ${detailedError}`;
            if (error.response?.status === 404) {
                errorMessage = `Local definitions for ${className} not found.`;
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
//# sourceMappingURL=handleUpdateLocalDefinitions.js.map