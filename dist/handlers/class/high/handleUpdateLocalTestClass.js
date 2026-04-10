"use strict";
/**
 * UpdateLocalTestClass Handler - Update Local Test Class via AdtClient
 *
 * Uses AdtClient.getLocalTestClass().update() for high-level update operation.
 * Includes lock, check, update, unlock, and optional activation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateLocalTestClass = handleUpdateLocalTestClass;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateLocalTestClass',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update a local test class in an ABAP class. Manages lock, check, update, unlock, and optional activation of parent class.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            test_class_code: {
                type: 'string',
                description: 'Updated source code for the local test class.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable objects).',
            },
            activate_on_update: {
                type: 'boolean',
                description: 'Activate parent class after updating test class. Default: false',
                default: false,
            },
        },
        required: ['class_name', 'test_class_code'],
    },
};
/**
 * Main handler for UpdateLocalTestClass MCP tool
 *
 * Uses AdtClient.getLocalTestClass().update() - high-level update operation
 */
async function handleUpdateLocalTestClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, test_class_code, transport_request, activate_on_update = false, } = args;
        // Validation
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        if (!test_class_code) {
            return (0, utils_1.return_error)(new Error('test_class_code is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Updating local test class for ${className}`);
        try {
            // Update local test class using AdtClient
            const localTestClass = client.getLocalTestClass();
            const updateResult = await localTestClass.update({
                className,
                testClassCode: test_class_code,
                transportRequest: transport_request,
            }, { activateOnUpdate: activate_on_update });
            if (!updateResult) {
                throw new Error(`Update did not return a result for local test class in ${className}`);
            }
            logger?.info(`✅ UpdateLocalTestClass completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_update,
                    message: `Local test class updated successfully in ${className}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating local test class for ${className}: ${error?.message || error}`);
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update local test class in ${className}`);
            let errorMessage = `Failed to update local test class: ${detailedError}`;
            if (error.response?.status === 404) {
                errorMessage = `Local test class for ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Bad request. ${detailedError}`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateLocalTestClass.js.map