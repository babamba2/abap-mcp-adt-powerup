"use strict";
/**
 * GetClassUnitTestResult Handler - Fetch ABAP Unit run result
 *
 * Uses AdtClient.getUnitTest().getResult from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetClassUnitTestResult = handleGetClassUnitTestResult;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetClassUnitTestResultLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Retrieve ABAP Unit run result (ABAPUnit or JUnit XML) for a completed run_id.',
    inputSchema: {
        type: 'object',
        properties: {
            run_id: {
                type: 'string',
                description: 'Run identifier returned by RunClassUnitTestsLow.',
            },
            with_navigation_uris: {
                type: 'boolean',
                description: 'Optional flag to request navigation URIs in SAP response (default true).',
            },
            format: {
                type: 'string',
                enum: ['abapunit', 'junit'],
                description: "Preferred response format. Defaults to 'abapunit'.",
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
async function handleGetClassUnitTestResult(context, args) {
    const { connection, logger } = context;
    try {
        const { run_id, with_navigation_uris, format, session_id, session_state } = args;
        if (!run_id) {
            return (0, utils_1.return_error)(new Error('run_id is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        logger?.info(`Fetching ABAP Unit result for run ${run_id}`);
        try {
            const unitTest = client.getUnitTest();
            const resultResponse = await unitTest.getResult(run_id, {
                withNavigationUris: with_navigation_uris,
                format,
            });
            if (!resultResponse) {
                throw new Error('SAP did not return ABAP Unit result response');
            }
            return (0, utils_1.return_response)(resultResponse);
        }
        catch (error) {
            logger?.error(`Error retrieving ABAP Unit result for run ${run_id}: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetClassUnitTestResult.js.map