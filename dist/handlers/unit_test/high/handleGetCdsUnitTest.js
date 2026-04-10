"use strict";
/**
 * GetCdsUnitTest Handler - Read CDS unit test run status/result via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().read() for high-level read operation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetCdsUnitTest = handleGetCdsUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetCdsUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve CDS unit test run status and result for a previously started run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by unit test run.',
            },
        },
        required: ['run_id'],
    },
};
/**
 * Main handler for GetCdsUnitTest MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().read() - high-level read operation
 */
async function handleGetCdsUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Reading CDS unit test run status/result for run_id: ${run_id}`);
        try {
            const readResult = await cdsUnitTest.read({ runId: run_id });
            if (!readResult) {
                throw new Error(`CDS unit test run ${run_id} not found`);
            }
            logger?.info(`✅ GetCdsUnitTest completed successfully for run_id: ${run_id}`);
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
            logger?.error(`Error reading CDS unit test run ${run_id}: ${error?.message || error}`);
            let errorMessage = `Failed to read CDS unit test run: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `CDS unit test run ${run_id} not found.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetCdsUnitTest.js.map