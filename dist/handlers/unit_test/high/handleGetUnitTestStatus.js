"use strict";
/**
 * GetUnitTestStatus Handler - Read ABAP Unit test run status via AdtClient
 *
 * Uses AdtClient.getUnitTest().getStatus() for status retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetUnitTestStatus = handleGetUnitTestStatus;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetUnitTestStatus',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP Unit test run status for a run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by unit test run.',
            },
            with_long_polling: {
                type: 'boolean',
                description: 'Enable long polling while waiting for status.',
                default: true,
            },
        },
        required: ['run_id'],
    },
};
/**
 * Main handler for GetUnitTestStatus MCP tool
 *
 * Uses AdtClient.getUnitTest().getStatus()
 */
async function handleGetUnitTestStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Reading unit test status for run_id: ${run_id}`);
        try {
            const readResult = await unitTest.read({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    run_status: readResult?.runStatus,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading unit test status ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetUnitTestStatus.js.map