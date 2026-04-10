"use strict";
/**
 * UpdateUnitTest Handler - Update ABAP Unit test run via AdtClient
 *
 * Uses AdtClient.getUnitTest().update() for high-level update operation.
 * Note: ADT does not support update for unit test runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateUnitTest = handleUpdateUnitTest;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update an ABAP Unit test run. Note: ADT does not support updating unit test runs and will return an error.',
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
 * Main handler for UpdateUnitTest MCP tool
 *
 * Uses AdtClient.getUnitTest().update() - high-level update operation
 */
async function handleUpdateUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Updating unit test run: ${run_id}`);
        try {
            await unitTest.update({ runId: run_id });
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id,
                    message: `Unit test run ${run_id} updated successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update unit test run ${run_id}`);
            logger?.error(`Error updating unit test run ${run_id}: ${detailedError}`);
            return (0, utils_1.return_error)(new Error(detailedError));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateUnitTest.js.map