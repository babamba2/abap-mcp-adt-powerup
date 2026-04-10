"use strict";
/**
 * DeleteCdsUnitTest Handler - Delete CDS unit test class via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().delete() for CDS-specific delete operation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteCdsUnitTest = handleDeleteCdsUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteCdsUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete a CDS unit test class (global class).',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Global test class name (e.g., ZCL_CDS_TEST).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
            },
        },
        required: ['class_name'],
    },
};
/**
 * Main handler for DeleteCdsUnitTest MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().delete() - CDS-specific delete operation
 */
async function handleDeleteCdsUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, transport_request } = args;
        if (!class_name) {
            return (0, utils_1.return_error)(new Error('class_name is required'));
        }
        const className = class_name.toUpperCase();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Deleting CDS unit test class: ${className}`);
        try {
            const deleteResult = await cdsUnitTest.delete({
                className,
                transportRequest: transport_request,
            });
            if (!deleteResult?.testClassState) {
                throw new Error(`Delete did not return a response for CDS unit test class ${className}`);
            }
            logger?.info(`✅ DeleteCdsUnitTest completed successfully: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    message: `CDS unit test class ${className} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting CDS unit test class ${className}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleDeleteCdsUnitTest.js.map