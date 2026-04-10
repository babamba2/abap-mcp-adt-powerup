"use strict";
/**
 * GetUnitTestResult Handler - Read ABAP Unit test run result via AdtClient
 *
 * Uses AdtClient.getUnitTest().getResult() for result retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetUnitTestResult = handleGetUnitTestResult;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetUnitTestResult',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP Unit test run result for a run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by unit test run.',
            },
            with_navigation_uris: {
                type: 'boolean',
                description: 'Include navigation URIs in result if supported.',
                default: false,
            },
            format: {
                type: 'string',
                description: 'Result format: abapunit or junit.',
                enum: ['abapunit', 'junit'],
            },
        },
        required: ['run_id'],
    },
};
/**
 * Main handler for GetUnitTestResult MCP tool
 *
 * Uses AdtClient.getUnitTest().getResult()
 */
async function handleGetUnitTestResult(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id, with_navigation_uris, format } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Reading unit test result for run_id: ${run_id}`);
        try {
            const readResult = await unitTest.read({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    run_result: readResult?.runResult,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading unit test result ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetUnitTestResult.js.map