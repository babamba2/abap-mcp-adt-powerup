"use strict";
/**
 * UpdateCdsUnitTest Handler - Update CDS unit test class via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().update() for CDS-specific update operation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateCdsUnitTest = handleUpdateCdsUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateCdsUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update a CDS unit test class local test class source code.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Global test class name (e.g., ZCL_CDS_TEST).',
            },
            test_class_source: {
                type: 'string',
                description: 'Updated local test class ABAP source code.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
            },
        },
        required: ['class_name', 'test_class_source'],
    },
};
/**
 * Main handler for UpdateCdsUnitTest MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().update() - CDS-specific update operation
 */
async function handleUpdateCdsUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, test_class_source, transport_request } = args;
        if (!class_name || !test_class_source) {
            return (0, utils_1.return_error)(new Error('Missing required parameters: class_name, test_class_source'));
        }
        const className = class_name.toUpperCase();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Updating CDS unit test class source: ${className}`);
        try {
            const updateResult = await cdsUnitTest.update({
                className,
                testClassSource: test_class_source,
                transportRequest: transport_request,
            });
            if (!updateResult?.testClassState) {
                throw new Error(`Update did not return a response for CDS unit test class ${className}`);
            }
            logger?.info(`✅ UpdateCdsUnitTest completed successfully: ${className}`);
            // Extract safe fields — testClassState contains AxiosResponse objects
            // with circular references that cannot be JSON.stringified
            const safeState = {
                testClassCode: updateResult.testClassState?.testClassCode,
                lockHandle: updateResult.testClassState?.lockHandle,
                errors: updateResult.testClassState?.errors,
            };
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    test_class_state: safeState,
                    message: `CDS unit test class ${className} updated successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update CDS unit test class ${className}`);
            logger?.error(`Error updating CDS unit test class ${className}: ${detailedError}`);
            return (0, utils_1.return_error)(new Error(detailedError));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateCdsUnitTest.js.map