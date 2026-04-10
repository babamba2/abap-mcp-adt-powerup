"use strict";
/**
 * GetClassUnitTestStatus Handler - Fetch ABAP Unit run status
 *
 * Uses AdtClient.getClassUnitTestRunStatus from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetClassUnitTestStatus = handleGetClassUnitTestStatus;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetClassUnitTestStatusLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Retrieve ABAP Unit run status XML for a previously started run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by RunClassUnitTestsLow.',
            },
            with_long_polling: {
                type: 'boolean',
                description: 'Optional flag to enable SAP long-polling (default true).',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['run_id'],
    },
};
async function handleGetClassUnitTestStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id, with_long_polling = true, session_id, session_state, } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        logger?.info(`Fetching ABAP Unit status for run ${run_id}`);
        try {
            const unitTest = client.getUnitTest();
            const statusResponse = await unitTest.getStatus(run_id, with_long_polling);
            if (!statusResponse) {
                throw new Error('SAP did not return ABAP Unit status response');
            }
            return (0, utils_1.return_response)(statusResponse);
        }
        catch (error) {
            logger?.error(`Error retrieving ABAP Unit status for run ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetClassUnitTestStatus.js.map