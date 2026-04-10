"use strict";
/**
 * DeleteUnitTest Handler - Delete ABAP Unit test run via AdtClient
 *
 * Uses AdtClient.getUnitTest().delete() for high-level delete operation.
 * Note: ADT does not support deleting unit test runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteUnitTest = handleDeleteUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Delete an ABAP Unit test run. Note: ADT does not support deleting unit test runs and will return an error.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by CreateUnitTest/RunUnitTest.',
            },
        },
        required: ['run_id'],
    },
};
/**
 * Main handler for DeleteUnitTest MCP tool
 *
 * Uses AdtClient.getUnitTest().delete() - high-level delete operation
 */
async function handleDeleteUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Deleting unit test run: ${run_id}`);
        try {
            await unitTest.delete({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    message: `Unit test run ${run_id} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting unit test run ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleDeleteUnitTest.js.map