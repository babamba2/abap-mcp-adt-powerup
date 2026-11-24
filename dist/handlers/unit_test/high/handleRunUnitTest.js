"use strict";
/**
 * RunUnitTest Handler - Start ABAP Unit test run via AdtClient
 *
 * Uses AdtClient.getUnitTest().create() for high-level test run operation.
 * Starts unit test execution and returns run_id for status/result queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.summarizeRunResult = summarizeRunResult;
exports.emptyRunWarning = emptyRunWarning;
exports.buildObjectRunXml = buildObjectRunXml;
exports.runUnitTestByObjects = runUnitTestByObjects;
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
        'On S/4HANA, PROG / FUGR containers also run synchronously (run_id "object-sync", result inline as run_result, ' +
        'every test class of the container runs); a batch with any PROG / FUGR container runs entirely this way, ' +
        'its CLAS containers included. A batch of CLAS containers only starts an asynchronous run.',
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
                            description: 'Type of container_class. Default CLAS. PROG / FUGR run synchronously with the result inline.',
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
            result_format: {
                type: 'string',
                enum: ['full', 'summary'],
                description: 'For a run that completes at once (programs / function groups, legacy systems): "full" (default) returns the raw run_result XML; "summary" returns run_summary = counts plus the failing methods and class-level alerts only (title + first details). Use "summary" when only pass / fail matters.',
            },
        },
        required: ['tests'],
    },
};
const XML_ENTITIES = {
    '&quot;': '"',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
};
const decodeXml = (s) => s.replace(/&(quot|apos|lt|gt|amp);/g, (m) => XML_ENTITIES[m] ?? m).trim();
const attr = (attrs, name) => decodeXml(new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? '');
function alertsIn(xml) {
    const out = [];
    const re = /<(?:\w+:)?alert\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?alert>/g;
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
        const details = [];
        const dre = /<(?:\w+:)?detail\b[^>]*?\btext="([^"]*)"/g;
        for (let d = dre.exec(m[2]); d && details.length < 3; d = dre.exec(m[2]))
            details.push(decodeXml(d[1]));
        out.push({
            kind: attr(m[1], 'kind'),
            severity: attr(m[1], 'severity'),
            title: decodeXml(/<(?:\w+:)?title>([\s\S]*?)<\/(?:\w+:)?title>/.exec(m[2])?.[1] ?? ''),
            details,
        });
    }
    return out;
}
/**
 * Compact form of an ABAP Unit runResult (result_format "summary"): counts and
 * the failing methods / class-level alerts only. A method fails when it has an
 * alert of severity "critical" or "fatal" (tolerable / warning alerts pass).
 */
function summarizeRunResult(runResult) {
    const xml = typeof runResult === 'string' ? runResult : JSON.stringify(runResult ?? '');
    // same rule as the sc4sap evidence ledger: only critical / fatal alerts fail
    const blocking = (a) => /^(critical|fatal)$/i.test(a.severity);
    const failures = [];
    let classes = 0;
    let methods = 0;
    let failed = 0;
    const cre = /<(?:\w+:)?testClass\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?testClass>)/g;
    for (let c = cre.exec(xml); c; c = cre.exec(xml)) {
        classes++;
        const cls = attr(c[1], 'adtcore:name');
        const body = c[2] ?? '';
        const mre = /<(?:\w+:)?testMethod\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?testMethod>)/g;
        for (let m = mre.exec(body); m; m = mre.exec(body)) {
            methods++;
            const bad = alertsIn(m[2] ?? '').filter(blocking);
            if (bad.length) {
                failed++;
                for (const a of bad)
                    failures.push({
                        class: cls,
                        method: attr(m[1], 'adtcore:name'),
                        ...a,
                    });
            }
        }
        // alerts of the class itself (setup / teardown, missing fixtures)
        const own = body.replace(/<(?:\w+:)?testMethods\b[\s\S]*?<\/(?:\w+:)?testMethods>/g, '');
        for (const a of alertsIn(own).filter(blocking))
            failures.push({ class: cls, method: '', ...a });
    }
    return { classes, methods, passed: methods - failed, failed, failures };
}
/** run_result as asked: the raw XML, or its summary. */
function runResultFields(runResult, format) {
    return format === 'summary'
        ? { run_summary: summarizeRunResult(runResult) }
        : { run_result: runResult };
}
const LEGACY_SYNC_RUN_ID = 'legacy-sync';
const OBJECT_SYNC_RUN_ID = 'object-sync';
/**
 * A run result without a single test method: SAP answers like this for a container that
 * does not exist, is not active, or has no FOR TESTING class — the same empty runResult,
 * so the caller is told instead of reading "success".
 */
function emptyRunWarning(runResult) {
    const xml = typeof runResult === 'string' ? runResult : JSON.stringify(runResult ?? '');
    // abapunit results list <testMethod>, junit results (GetUnitTestResult format "junit") <testcase>
    if (/<(?:\w+:)?(?:testMethod|testcase)\b/.test(xml))
        return undefined;
    return 'No test method ran: the container does not exist, is not active, or has no FOR TESTING class. Treat this run as NOT RUN, not as passed.';
}
const CONTAINER_URI_PREFIX = {
    CLAS: '/sap/bc/adt/oo/classes/',
    PROG: '/sap/bc/adt/programs/programs/',
    FUGR: '/sap/bc/adt/functions/groups/',
};
/**
 * Run configuration for the synchronous /abapunit/testruns endpoint: object references,
 * so programs and function groups can be addressed (the asynchronous /abapunit/runs
 * endpoint addresses tests by class name only).
 */
function buildObjectRunXml(tests) {
    const refs = tests
        .map((t) => {
        const prefix = CONTAINER_URI_PREFIX[t.container_type ?? 'CLAS'];
        if (!prefix) {
            throw new Error(`Unsupported container_type: ${t.container_type}`);
        }
        const uri = `${prefix}${(0, utils_1.encodeSapObjectName)(t.container_class).toLowerCase()}`;
        return `        <adtcore:objectReference adtcore:uri="${uri}"/>`;
    })
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false"/>
    <testRiskLevels harmless="true" dangerous="true" critical="true"/>
    <testDurations short="true" medium="true" long="true"/>
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
${refs}
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;
}
// Media types tried in order: plain XML first, then the versioned types Eclipse sends.
const OBJECT_RUN_MEDIA = [
    { contentType: 'application/xml', accept: 'application/xml' },
    {
        contentType: 'application/vnd.sap.adt.abapunit.testruns.config.v4+xml',
        accept: 'application/vnd.sap.adt.abapunit.testruns.result.v1+xml',
    },
];
/**
 * Synchronous ABAP Unit run by object reference on a modern system.
 * @returns the runResult XML
 */
async function runUnitTestByObjects(connection, tests) {
    const xml = buildObjectRunXml(tests);
    let lastError;
    for (const media of OBJECT_RUN_MEDIA) {
        try {
            const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/abapunit/testruns', 'POST', 'long', xml, undefined, { 'Content-Type': media.contentType, Accept: media.accept });
            return typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);
        }
        catch (e) {
            lastError = e;
            const status = e?.response?.status ?? e?.status;
            if (status !== 406 && status !== 415)
                throw e;
        }
    }
    throw lastError;
}
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
            // The asynchronous /abapunit/runs addresses tests by class only — run the whole set
            // through the synchronous object-reference endpoint instead and return the result inline.
            logger?.info(`Starting synchronous ABAP Unit run by object for ${tests.length} container(s)`);
            try {
                const runResult = await runUnitTestByObjects(connection, tests);
                return (0, utils_1.return_response)({
                    data: JSON.stringify({
                        success: true,
                        run_id: OBJECT_SYNC_RUN_ID,
                        message: 'ABAP Unit run completed (synchronous, by object). Result is in run_result (run_summary with result_format "summary").',
                        ...runResultFields(runResult, args.result_format),
                        ...(emptyRunWarning(runResult)
                            ? { methods: 0, warning: emptyRunWarning(runResult) }
                            : {}),
                    }, null, 2),
                });
            }
            catch (error) {
                logger?.error(`Error in synchronous ABAP Unit run: ${error?.message || error}`);
                return (0, utils_1.return_error)(new Error(error?.message || String(error)));
            }
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
                        message: 'ABAP Unit run completed (legacy, synchronous). Result is in run_result (run_summary with result_format "summary").',
                        ...runResultFields(createResult.runResult, args.result_format),
                        ...(emptyRunWarning(createResult.runResult)
                            ? {
                                methods: 0,
                                warning: emptyRunWarning(createResult.runResult),
                            }
                            : {}),
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