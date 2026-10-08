"use strict";
/**
 * RunUnitTest Handler - Start ABAP Unit test run via AdtClient
 *
 * Uses AdtClient.getUnitTest().create() for high-level test run operation.
 * Starts unit test execution and returns run_id for status/result queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRunUnitTest = handleRunUnitTest;
const clients_1 = require("../../../lib/clients");
const systemContext_1 = require("../../../lib/systemContext");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RunUnitTest',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Start an ABAP Unit test run for provided test definitions. Returns run_id for status/result queries. ' +
        'On legacy systems (ECC / BASIS < 7.50) the run is synchronous: the result is returned inline as run_result ' +
        '(run_id "legacy-sync" cannot be queried later), every test class of the container runs (test_class is not a filter), ' +
        'and container_type PROG/FUGR runs local test classes of a program / function group. ' +
        'On S/4HANA only CLAS containers are supported.',
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
                            description: 'Object that owns the test classes: class (e.g., ZCL_MAIN_CLASS), or program / function group when container_type is set.',
                        },
                        test_class: {
                            type: 'string',
                            description: 'Test class name inside the include (e.g., LTCL_MAIN_CLASS).',
                        },
                        container_type: {
                            type: 'string',
                            enum: ['CLAS', 'PROG', 'FUGR'],
                            description: 'Type of container_class. Default CLAS. PROG/FUGR: legacy systems only.',
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
        },
        required: ['tests'],
    },
};
const LEGACY_SYNC_RUN_ID = 'legacy-sync';
/**
 * Main handler for RunUnitTest MCP tool
 *
 * Uses AdtClient.getUnitTest().create() - high-level test run operation
 */
async function handleRunUnitTest(context, args) {
    const { connection, logger } = context;
    try {
        const { tests, title, context: contextStr, scope, risk_level, duration, } = args;
        // Validation
        if (!Array.isArray(tests) || tests.length === 0) {
            return (0, utils_1.return_error)(new Error('tests array with at least one entry is required'));
        }
        // The modern run (/abapunit/runs) addresses tests by containerClass only.
        // Reject non-class containers there instead of running a nonexistent class.
        const nonClass = tests.find((test) => test.container_type && test.container_type !== 'CLAS');
        if (nonClass && !(0, systemContext_1.getSystemContext)().isLegacy) {
            return (0, utils_1.return_error)(new Error(`container_type ${nonClass.container_type} is not supported on S/4HANA yet; only CLAS containers can be run`));
        }
        // Format tests for AdtClient
        const formattedTests = tests.map((test) => ({
            containerClass: test.container_class.toUpperCase(),
            testClass: test.test_class.toUpperCase(),
            containerType: test.container_type,
        }));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const unitTest = client.getUnitTest();
        logger?.info(`Starting ABAP Unit run for ${formattedTests.length} test definition(s)`);
        try {
            // Create test run using AdtClient
            const createResult = await unitTest.create({
                tests: formattedTests,
                options: {
                    title,
                    context: contextStr,
                    scope: scope
                        ? {
                            ownTests: scope.own_tests,
                            foreignTests: scope.foreign_tests,
                            addForeignTestsAsPreview: scope.add_foreign_tests_as_preview,
                        }
                        : undefined,
                    riskLevel: risk_level,
                    duration,
                },
            });
            if (!createResult.runId) {
                throw new Error('Failed to start unit test run: run_id not returned');
            }
            logger?.info(`✅ RunUnitTest started. Run ID: ${createResult.runId}`);
            // Legacy runs synchronously and the result lives only on this client
            // instance, so it must be returned now — a later GetUnitTestResult
            // call creates a new client and cannot see it.
            if (createResult.runId === LEGACY_SYNC_RUN_ID) {
                return (0, utils_1.return_response)({
                    data: JSON.stringify({
                        success: true,
                        run_id: createResult.runId,
                        message: 'ABAP Unit run completed (legacy, synchronous). Result is in run_result.',
                        run_result: createResult.runResult,
                    }, null, 2),
                });
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    run_id: createResult.runId,
                    message: `ABAP Unit run started. Use GetUnitTest with run_id ${createResult.runId} to get status and results.`,
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
//# sourceMappingURL=handleRunUnitTest.js.map