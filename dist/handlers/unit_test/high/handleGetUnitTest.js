"use strict";
/**
 * GetUnitTest Handler - Read ABAP Unit test status/result via AdtClient
 *
 * Uses AdtClient.getUnitTest().read() for high-level read operation.
 * Retrieves test run status and result for a previously started run.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetUnitTest = handleGetUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP Unit test run status and result for a previously started run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by RunUnitTest.',
            },
        },
        required: ['run_id'],
    },
};
/**
 * Main handler for GetUnitTest MCP tool
 *
 * Uses AdtClient.getUnitTest().read() - high-level read operation
 */
async function handleGetUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        // Validation
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Reading unit test run status/result for run_id: ${run_id}`);
        try {
            // Read test run using AdtClient
            const readResult = await unitTest.read({ runId: run_id });
            if (!readResult) {
                throw new Error(`Unit test run ${run_id} not found`);
            }
            logger?.info(`✅ GetUnitTest completed successfully for run_id: ${run_id}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id: readResult.runId,
                    run_status: readResult.runStatus,
                    run_result: readResult.runResult,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading unit test run ${run_id}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read unit test run: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Unit test run ${run_id} not found.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetUnitTest.js.map