"use strict";
/**
 * RunClassUnitTests Handler - Start ABAP Unit run for class-based tests
 *
 * Uses AdtClient.runClassUnitTests from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRunClassUnitTests = handleRunClassUnitTests;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RunClassUnitTestsLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Start an ABAP Unit test run for provided class test definitions. Returns run_id extracted from SAP response headers.',
    inputSchema: {
        type: 'object',
        properties: {
            tests: {
                type: 'array',
                description: 'List of container/test class pairs to execute.',
                items: {
                    type: 'object',
                    properties: {
                        container_class: {
                            type: 'string',
                            description: 'Class that owns the test include (e.g., ZCL_MAIN_CLASS).',
                        },
                        test_class: {
                            type: 'string',
                            description: 'Test class name inside the include (e.g., LTCL_MAIN_CLASS).',
                        },
                    },
                    required: ['container_class', 'test_class'],
                },
            },
            title: {
                type: 'string',
                description: 'Optional title for the ABAP Unit run.',
            },
            context: {
                type: 'string',
                description: 'Optional context string shown in SAP tools.',
            },
            scope: {
                type: 'object',
                properties: {
                    own_tests: { type: 'boolean' },
                    foreign_tests: { type: 'boolean' },
                    add_foreign_tests_as_preview: { type: 'boolean' },
                },
            },
            risk_level: {
                type: 'object',
                properties: {
                    harmless: { type: 'boolean' },
                    dangerous: { type: 'boolean' },
                    critical: { type: 'boolean' },
                },
            },
            duration: {
                type: 'object',
                properties: {
                    short: { type: 'boolean' },
                    medium: { type: 'boolean' },
                    long: { type: 'boolean' },
                },
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
        required: ['tests'],
    },
};
async function handleRunClassUnitTests(context, args) {
    const { connection, logger } = context;
    try {
        const { tests, title, context, scope, risk_level, duration, session_id, session_state, } = args;
        if (!Array.isArray(tests) || tests.length === 0) {
            return (0, utils_1.return_error)(new Error('tests array with at least one entry is required'));
        }
        const formattedTests = tests.map((test, index) => {
            if (!test?.container_class || !test?.test_class) {
                throw new Error(`tests[${index}] must include container_class and test_class`);
            }
            return {
                containerClass: test.container_class.toUpperCase(),
                testClass: test.test_class.toUpperCase(),
            };
        });
        const client = (0, clients_1.createAdtClient)(connection, logger);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        const mappedScope = scope
            ? {
                ownTests: scope.own_tests,
                foreignTests: scope.foreign_tests,
                addForeignTestsAsPreview: scope.add_foreign_tests_as_preview,
            }
            : undefined;
        const options = {
            title,
            context,
            scope: mappedScope,
            riskLevel: risk_level,
            duration,
        };
        logger?.info(`Starting ABAP Unit run for ${formattedTests.length} definitions`);
        try {
            const unitTest = client.getUnitTest();
            const runId = await unitTest.run(formattedTests, options);
            const runResponse = unitTest.getStatusResponse?.();
            if (!runId) {
                throw new Error('Failed to obtain ABAP Unit run identifier from SAP response headers');
            }
            logger?.info(`✅ RunClassUnitTests started. Run ID: ${runId}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id: runId,
                    status_code: runResponse?.status,
                    location: runResponse?.headers?.location ||
                        runResponse?.headers?.['content-location'] ||
                        null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `ABAP Unit run started. Use GetClassUnitTestStatusLow and GetClassUnitTestResultLow with run_id ${runId}.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error starting ABAP Unit run: ${error?.message || error}`);
            return (0, utils_1.return_error)(new Error(error?.message || String(error)));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRunClassUnitTests.js.map