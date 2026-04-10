"use strict";
/**
 * CreateCdsUnitTest Handler - Create CDS unit test class via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().validate() and .create() for CDS-specific lifecycle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateCdsUnitTest = handleCreateCdsUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateCdsUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Create a CDS unit test class with CDS validation. Creates the test class in initial state.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Global test class name (e.g., ZCL_CDS_TEST).',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_TEST_PKG_01, $TMP).',
            },
            cds_view_name: {
                type: 'string',
                description: 'CDS view name to validate for unit test doubles.',
            },
            description: {
                type: 'string',
                description: 'Optional description for the global test class.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
            },
        },
        required: ['class_name', 'package_name', 'cds_view_name'],
    },
};
/**
 * Main handler for CreateCdsUnitTest MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().validate() and .create()
 */
async function handleCreateCdsUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, package_name, cds_view_name, class_template, test_class_source, description, transport_request, } = args;
        if (!class_name || !package_name || !cds_view_name) {
            return (0, utils_1.return_error)(new Error('Missing required parameters: class_name, package_name, cds_view_name'));
        }
        const className = class_name.toUpperCase();
        const cdsViewName = cds_view_name.toUpperCase();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Creating CDS unit test class ${className} for CDS view ${cdsViewName}`);
        try {
            const createResult = await cdsUnitTest.create({
                className,
                packageName: package_name,
                cdsViewName,
                classTemplate: class_template || '',
                testClassSource: test_class_source || '',
                description,
                transportRequest: transport_request,
            });
            if (!createResult?.testClassState) {
                throw new Error(`Create did not return a response for CDS unit test class ${className}`);
            }
            logger?.info(`✅ CreateCdsUnitTest completed successfully: ${className}`);
            // Extract safe fields — testClassState contains AxiosResponse objects
            // with circular references that cannot be JSON.stringified
            const safeState = {
                testClassCode: createResult.testClassState?.testClassCode,
                lockHandle: createResult.testClassState?.lockHandle,
                errors: createResult.testClassState?.errors,
            };
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    cds_view_name: cdsViewName,
                    test_class_state: safeState,
                    message: `CDS unit test class ${className} created successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating CDS unit test class ${className}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateCdsUnitTest.js.map