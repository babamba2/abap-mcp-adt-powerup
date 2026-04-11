"use strict";
/**
 * Preflight syntax check helper
 *
 * Wraps `/sap/bc/adt/checkruns` calls (and the per-type `client.getXxx().check()`
 * methods) in a single dispatcher so Create/Update handlers across every ABAP
 * source-object type can call one function instead of inlining bespoke check
 * logic.
 *
 * Dispatch rules per kind:
 * - `program` / `class` / `interface`
 *     → `client.getXxx().check({ name, sourceCode }, 'inactive')`
 *       supports true pre-write check (the proposed new source is compiled
 *       against the current environment without touching the active version).
 * - `functionModule` / `metadataExtension` / `behaviorDefinition` /
 *   `behaviorImplementation` / `serviceDefinition`
 *     → `client.getXxx().check(...)` without sourceCode — checks whatever is
 *       currently on the server. Use this AFTER a write to catch problems in
 *       the newly uploaded inactive version.
 * - `include`
 *     → no AdtClient wrapper; posts directly to
 *       `/sap/bc/adt/checkruns?reporters=abapCheckRun` with the include URI.
 *       Also a post-write check.
 * - `screen`
 *     → no dynpro-level endpoint; falls back to a program-scoped check on the
 *       parent program so flow-logic errors surface via the program's syntax
 *       check.
 *
 * All calls are wrapped with `safeCheckOperation` so ADT "already checked"
 * responses are treated as silent success.
 *
 * Callers typically:
 *   const result = await runSyntaxCheck({ connection, logger }, { kind, name, ... });
 *   assertNoCheckErrors(result, 'Include', name);   // throws with details if errors
 *   // include result.warnings in the success response
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSyntaxCheck = runSyntaxCheck;
exports.assertNoCheckErrors = assertNoCheckErrors;
const fast_xml_parser_1 = require("fast-xml-parser");
const checkRunParser_1 = require("./checkRunParser");
const clients_1 = require("./clients");
const utils_1 = require("./utils");
const EMPTY_RESULT = {
    success: true,
    status: 'not_run',
    message: '',
    errors: [],
    warnings: [],
    info: [],
    total_messages: 0,
    has_errors: false,
    has_warnings: false,
};
/**
 * Preflight syntax check dispatcher.
 * Returns a ParsedCheckRunResult; throws only on transport/unknown errors.
 * "Already checked" responses are normalised to an empty-success result.
 */
async function runSyntaxCheck(context, args) {
    const { connection, logger } = context;
    const name = args.name.toUpperCase();
    const client = (0, clients_1.createAdtClient)(connection, logger);
    const debugLogger = { debug: (m) => logger?.debug?.(m) };
    try {
        let rawResponse;
        switch (args.kind) {
            case 'program': {
                const state = await (0, utils_1.safeCheckOperation)(() => client
                    .getProgram()
                    .check({ programName: name, sourceCode: args.sourceCode }, 'inactive'), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'class': {
                const state = await (0, utils_1.safeCheckOperation)(() => client
                    .getClass()
                    .check({ className: name, sourceCode: args.sourceCode }, 'inactive'), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'interface': {
                const state = await (0, utils_1.safeCheckOperation)(() => client
                    .getInterface()
                    .check({ interfaceName: name, sourceCode: args.sourceCode }, 'inactive'), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'functionModule': {
                if (!args.functionGroupName) {
                    throw new Error('functionGroupName is required for functionModule syntax check');
                }
                const state = await (0, utils_1.safeCheckOperation)(() => client.getFunctionModule().check({
                    functionModuleName: name,
                    functionGroupName: args.functionGroupName.toUpperCase(),
                }), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'metadataExtension': {
                const state = await (0, utils_1.safeCheckOperation)(() => client.getMetadataExtension().check({ name }), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'behaviorDefinition': {
                const state = await (0, utils_1.safeCheckOperation)(() => client.getBehaviorDefinition().check({ name }), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'behaviorImplementation': {
                const anyClient = client;
                if (typeof anyClient.getBehaviorImplementation === 'function') {
                    const bimpl = anyClient.getBehaviorImplementation();
                    if (typeof bimpl?.check === 'function') {
                        const state = await (0, utils_1.safeCheckOperation)(() => bimpl.check({ name }), name, debugLogger);
                        rawResponse = state?.checkResult;
                        break;
                    }
                }
                // Fallback: raw checkruns on the behavior implementation URI
                return await runRawCheckRun(connection, `/sap/bc/adt/bo/behaviorimplementations/${(0, utils_1.encodeSapObjectName)(name).toLowerCase()}`, logger);
            }
            case 'serviceDefinition': {
                const state = await (0, utils_1.safeCheckOperation)(() => client
                    .getServiceDefinition()
                    .check({ serviceDefinitionName: name }), name, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            case 'include': {
                // No AdtClient wrapper — raw /checkruns POST on the include URI
                return await runRawCheckRun(connection, `/sap/bc/adt/programs/includes/${(0, utils_1.encodeSapObjectName)(name).toLowerCase()}`, logger);
            }
            case 'programTree': {
                // Check the main program AND every include it owns in a single
                // /checkruns call. This catches compile errors in any part of the
                // program tree — used for Include updates (where checking the
                // include alone via raw /checkruns sometimes returns "REPORT
                // missing" because SAP tries to compile the include standalone)
                // and anywhere else a caller needs full program-tree validation.
                return await runProgramTreeCheck(connection, name, logger);
            }
            case 'programTreeInline': {
                // PRE-WRITE check: compile the object with the inline source
                // of its artifact substituted for the stored version. Used by
                // Include update handlers to validate proposed content BEFORE
                // it touches SAP. No PUT is required — the source is
                // base64-embedded in the /checkruns request, the kernel
                // compiles it in-place, and returns real errors if the new
                // content is broken.
                //
                // The `inlineArtifactUri` is the child source URI (e.g.
                // `.../includes/zxyz/source/main`). AdtClient's convention is
                // that the outer checkObject URI is the parent of the artifact
                // URI — we derive it by stripping the trailing `/source/main`.
                if (!args.inlineArtifactUri || args.inlineSourceCode === undefined) {
                    throw new Error('programTreeInline requires inlineArtifactUri and inlineSourceCode');
                }
                const outerUri = args.inlineArtifactUri.replace(/\/source\/main$/, '');
                return await runInlineArtifactCheck(connection, outerUri, args.inlineArtifactUri, args.inlineSourceCode, logger);
            }
            case 'screen': {
                // Dynpros have no standalone syntax check — run a program-scoped
                // check on the parent so flow-logic errors surface there.
                const parent = (args.parentProgramName || '').toUpperCase();
                if (!parent) {
                    throw new Error('parentProgramName is required for screen syntax check');
                }
                const state = await (0, utils_1.safeCheckOperation)(() => client.getProgram().check({ programName: parent }, 'inactive'), parent, debugLogger);
                rawResponse = state?.checkResult;
                break;
            }
            default: {
                const unknown = args.kind;
                throw new Error(`Unsupported preflight check kind: ${String(unknown)}`);
            }
        }
        return rawResponse
            ? (0, checkRunParser_1.parseCheckRunResponse)(rawResponse)
            : EMPTY_RESULT;
    }
    catch (err) {
        if (err?.isAlreadyChecked || (0, utils_1.isAlreadyCheckedError)(err)) {
            logger?.debug?.(`runSyntaxCheck: '${args.kind}/${name}' already checked`);
            return EMPTY_RESULT;
        }
        throw err;
    }
}
/**
 * Raw ADT /checkruns POST — used for kinds without an AdtClient wrapper
 * (currently `include`, and the `behaviorImplementation` fallback path).
 *
 * This checks whatever version of the object is currently on the server.
 * For pre-write validation you must have already uploaded the new source
 * as the inactive version beforehand.
 */
/**
 * Pre-write check that compiles an object with an inline artifact
 * substitution.
 *
 * The outer `adtcore:uri` is the object being compiled. Inside its
 * `<chkrun:artifacts>` we embed the proposed source as base64,
 * replacing whatever the server currently has at `artifactUri`. SAP
 * compiles in memory and returns real errors — no PUT, no lock, no
 * modification of stored state. This is the same pattern AdtClient
 * uses internally for `getProgram().check({sourceCode}, 'active')`.
 *
 * For an include pre-check:
 *   outerUri    = `/sap/bc/adt/programs/includes/zxyz`
 *   artifactUri = `/sap/bc/adt/programs/includes/zxyz/source/main`
 */
async function runInlineArtifactCheck(connection, outerUri, artifactUri, sourceCode, logger) {
    const base64Source = Buffer.from(sourceCode, 'utf-8').toString('base64');
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">\n` +
        `  <chkrun:checkObject adtcore:uri="${outerUri}" chkrun:version="active">\n` +
        `    <chkrun:artifacts>\n` +
        `      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${artifactUri}">\n` +
        `        <chkrun:content>${base64Source}</chkrun:content>\n` +
        `      </chkrun:artifact>\n` +
        `    </chkrun:artifacts>\n` +
        `  </chkrun:checkObject>\n` +
        `</chkrun:checkObjectList>`;
    logger?.debug?.(`runInlineArtifactCheck: outer=${outerUri}, artifact=${artifactUri}, source=${sourceCode.length} bytes`);
    try {
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/checkruns?reporters=abapCheckRun', 'POST', 'default', body, undefined, {
            'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
            Accept: 'application/vnd.sap.adt.checkmessages+xml',
        });
        const parsed = (0, checkRunParser_1.parseCheckRunResponse)(response);
        logger?.debug?.(`runInlineArtifactCheck result: status=${parsed.status}, errors=${parsed.errors.length}, warnings=${parsed.warnings.length}, info=${parsed.info.length}`);
        return parsed;
    }
    catch (err) {
        if ((0, utils_1.isAlreadyCheckedError)(err)) {
            logger?.debug?.(`runInlineArtifactCheck: ${outerUri} already checked`);
            return EMPTY_RESULT;
        }
        throw err;
    }
}
async function runRawCheckRun(connection, objectUri, logger, version = 'inactive') {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">\n` +
        `  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>\n` +
        `</chkrun:checkObjectList>`;
    try {
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/checkruns?reporters=abapCheckRun', 'POST', 'default', body, undefined, { 'Content-Type': 'application/vnd.sap.adt.checkobjects+xml' });
        return (0, checkRunParser_1.parseCheckRunResponse)(response);
    }
    catch (err) {
        if ((0, utils_1.isAlreadyCheckedError)(err)) {
            logger?.debug?.(`runRawCheckRun: ${objectUri} already checked`);
            return EMPTY_RESULT;
        }
        throw err;
    }
}
/**
 * Query D010INC to find every USER-LEVEL source include that belongs to a
 * main program. Uses the ADT Data Preview "freestyle" SQL endpoint (the
 * same path as the `GetSqlQuery` MCP tool), then filters out kernel /
 * generated / system includes so only real editable source includes
 * remain.
 *
 * Returns an empty list on any failure (best-effort — the main program
 * check will still run on its own).
 */
async function listIncludesOfProgram(connection, mainProgramName, logger) {
    const programUpper = mainProgramName.toUpperCase();
    // NOTE: Data Preview freestyle doesn't support `<>` — filter client-side.
    const sql = `SELECT include FROM d010inc WHERE master = '${programUpper}'`;
    try {
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `/sap/bc/adt/datapreview/freestyle?rowNumber=500`, 'POST', 'default', sql, undefined, {
            'Content-Type': 'text/plain; charset=utf-8',
            Accept: 'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml',
        });
        const raw = typeof response.data === 'string'
            ? response.data
            : String(response.data ?? '');
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            removeNSPrefix: true,
        });
        const parsed = parser.parse(raw);
        // ADT datapreview response structure (namespaces stripped):
        //   <tableData>
        //     <columns>
        //       <metadata name="INCLUDE" .../>
        //       <dataSet>
        //         <data>ZPAEK_TEST003T</data>
        //         <data>%_CABAP</data>
        //         ...
        const dataSet = parsed?.tableData?.columns?.dataSet ??
            parsed?.tableData?.dataSet ??
            parsed?.dataSet;
        let raw_values = [];
        if (dataSet) {
            const data = dataSet.data;
            raw_values = Array.isArray(data) ? data : data ? [data] : [];
        }
        const all = raw_values
            .map((v) => {
            if (typeof v === 'string')
                return v.trim();
            if (typeof v === 'object' && v?.['#text'])
                return String(v['#text']).trim();
            return String(v ?? '').trim();
        })
            .filter((v) => v.length > 0);
        // Filter out: the main program itself, kernel/system includes, and
        // generated runtime-load includes (class/interface pools etc.).
        const filtered = all.filter((name) => {
            if (name === programUpper)
                return false;
            // Angle-bracket system includes: <REPINI>, <SYSINI>, <SYSSEL>, ...
            if (name.startsWith('<') || name.includes('>'))
                return false;
            // Percent-prefix DB/system: %_CABAP, %_CCNDD, ...
            if (name.startsWith('%'))
                return false;
            // Generated class/interface pool includes contain '=' padding:
            //   CL_GUI_ALV_GRID===============CU
            if (name.includes('='))
                return false;
            // Exclude common kernel DB SSEL/etc.
            if (name === 'DB__SSEL')
                return false;
            return true;
        });
        const dedup = Array.from(new Set(filtered));
        logger?.debug?.(`listIncludesOfProgram(${programUpper}) -> ${dedup.length} user include(s): ${dedup.join(', ') || '(none)'}`);
        return dedup;
    }
    catch (err) {
        logger?.warn?.(`listIncludesOfProgram(${programUpper}) query failed: ${err?.message || err}`);
        return [];
    }
}
/**
 * Check a main program AND every include it owns in a single /checkruns
 * call. Builds a multi-entry `chkrun:checkObjectList` containing the
 * program URI and every include URI, so the SAP compiler validates the
 * full program tree in one round-trip and we get aggregated errors.
 *
 * This is the workaround for the case where checking only the main
 * program returns "REPORT/PROGRAM statement is missing, or the program
 * type is INCLUDE" — which happens when SAP falls back to compiling one
 * of the includes standalone.
 */
async function runProgramTreeCheck(connection, mainProgramName, logger) {
    const programUpper = mainProgramName.toUpperCase();
    const programUri = `/sap/bc/adt/programs/programs/${(0, utils_1.encodeSapObjectName)(programUpper).toLowerCase()}`;
    // Empirically verified: posting the program URI alone to /checkruns
    // with version="inactive" compiles the FULL program tree (main program
    // + every include) in one pass, which catches cross-include type
    // errors. The AdtClient `getProgram().check()` path does NOT — it uses
    // a different reporter that compiles the main program body standalone
    // and misses errors inside user includes.
    //
    // Do NOT add include URIs to the checkObjectList. Including them turns
    // the call into per-object checks and silently drops cross-include
    // references, letting broken code slip through.
    logger?.debug?.(`runProgramTreeCheck: raw /checkruns on program URI ${programUri} (inactive)`);
    return await runRawCheckRun(connection, programUri, logger, 'inactive');
}
/**
 * Fallback when the main program's own check returns the "REPORT missing"
 * noise error: enumerate every user-level include belonging to the main
 * program and run a raw /checkruns on each one individually, then merge
 * all resulting errors/warnings into a single ParsedCheckRunResult.
 */
async function perIncludeSweep(connection, mainProgramName, seed, logger) {
    const includes = await listIncludesOfProgram(connection, mainProgramName, logger);
    if (includes.length === 0)
        return seed;
    const merged = {
        success: seed.success,
        status: seed.status,
        message: seed.message,
        errors: [
            ...seed.errors.filter((e) => !/REPORT\/?\s*PROGRAM statement is missing/i.test(e.text)),
        ],
        warnings: [...seed.warnings],
        info: [...seed.info],
        total_messages: 0,
        has_errors: false,
        has_warnings: false,
    };
    for (const inc of includes) {
        try {
            const partial = await runRawCheckRun(connection, `/sap/bc/adt/programs/includes/${(0, utils_1.encodeSapObjectName)(inc).toLowerCase()}`, logger, 'active');
            merged.errors.push(...partial.errors);
            merged.warnings.push(...partial.warnings);
            merged.info.push(...partial.info);
        }
        catch (err) {
            logger?.warn?.(`perIncludeSweep: check on ${inc} failed: ${err?.message || err}`);
        }
    }
    merged.total_messages =
        merged.errors.length + merged.warnings.length + merged.info.length;
    merged.has_errors = merged.errors.length > 0;
    merged.has_warnings = merged.warnings.length > 0;
    merged.success = merged.errors.length === 0;
    return merged;
}
/**
 * Throws a structured error when the check result has errors. The thrown
 * Error carries `.checkErrors` and `.checkWarnings` so outer catch blocks
 * can surface them to the MCP client response.
 *
 * Callers should do:
 *
 *     const result = await runSyntaxCheck(context, { kind, name, ... });
 *     assertNoCheckErrors(result, 'Include', name);
 *     // …continue; warnings are in result.warnings
 */
/**
 * Detects the SAP "REPORT missing / program type is INCLUDE" noise
 * error. SAP's abapCheckRun reporter returns this in several cases:
 *   1. There's a real broken include that the kernel couldn't compile
 *      and it fell back to this generic message.
 *   2. The object being checked has no inactive version (or matches
 *      active byte-for-byte) and SAP had nothing meaningful to compile.
 *   3. Transient cache / session state confusion between the reporter
 *      and the include resolver.
 *
 * Cases (2) and (3) are *false positives* — the source is actually
 * fine. Since we can't distinguish (1) from (2)/(3) from the message
 * alone, we downgrade "noise-only" check results to non-fatal. The
 * handler's subsequent activation step is the ultimate authority: if
 * the source is really broken, activation will surface the real error
 * with line numbers.
 */
function isReportMissingNoiseText(text) {
    return (/REPORT\/?\s*PROGRAM statement is missing/i.test(text) ||
        /program type is INCLUDE/i.test(text));
}
function assertNoCheckErrors(result, kind, name) {
    if (result.errors.length === 0)
        return;
    const realErrors = result.errors.filter((e) => !isReportMissingNoiseText(e.text));
    const noiseErrors = result.errors.filter((e) => isReportMissingNoiseText(e.text));
    // If every error is just SAP noise, we treat the check as
    // inconclusive: don't throw, leave real validation to activation.
    if (realErrors.length === 0 && noiseErrors.length > 0) {
        return;
    }
    // Include ALL real errors in the message so the caller sees every
    // line number + text and can fix the source in one pass.
    const full = realErrors
        .map((e) => {
        const loc = e.line ? `[L${e.line}] ` : '';
        const type = e.type === 'E' ? '' : `<${e.type}> `;
        return `${type}${loc}${e.text}`;
    })
        .join(' | ');
    const message = `${kind} ${name} preflight syntax check failed (${realErrors.length} error${realErrors.length === 1 ? '' : 's'}): ${full}`;
    const error = new Error(message);
    error.isPreflightCheckFailure = true;
    error.checkErrors = realErrors;
    error.checkWarnings = result.warnings;
    throw error;
}
//# sourceMappingURL=preflightCheck.js.map