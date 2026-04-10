"use strict";
/**
 * GetCdsUnitTestResult Handler - Read CDS unit test run result via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().getResult() for result retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetCdsUnitTestResult = handleGetCdsUnitTestResult;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetCdsUnitTestResult',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve CDS unit test run result for a run_id.',
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
 * Main handler for GetCdsUnitTestResult MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().getResult()
 */
async function handleGetCdsUnitTestResult(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id, with_navigation_uris, format } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Reading CDS unit test result for run_id: ${run_id}`);
        try {
            const readResult = await cdsUnitTest.read({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    run_result: readResult?.runResult,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading CDS unit test result ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetCdsUnitTestResult.js.map