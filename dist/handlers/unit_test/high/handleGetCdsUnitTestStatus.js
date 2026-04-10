"use strict";
/**
 * GetCdsUnitTestStatus Handler - Read CDS unit test run status via AdtClient
 *
 * Uses AdtClient.getCdsUnitTest().getStatus() for status retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetCdsUnitTestStatus = handleGetCdsUnitTestStatus;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetCdsUnitTestStatus',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve CDS unit test run status for a run_id.',
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
 * Main handler for GetCdsUnitTestStatus MCP tool
 *
 * Uses AdtClient.getCdsUnitTest().getStatus()
 */
async function handleGetCdsUnitTestStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const cdsUnitTest = client.getCdsUnitTest();
        logger?.info(`Reading CDS unit test status for run_id: ${run_id}`);
        try {
            const readResult = await cdsUnitTest.read({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    run_status: readResult?.runStatus,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading CDS unit test status ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetCdsUnitTestStatus.js.map