"use strict";
/**
 * CreateInclude Handler - Create a new ABAP Include Program (Type I)
 *
 * Uses direct ADT REST API since AdtClient doesn't have a dedicated include client.
 * ADT endpoint: POST /sap/bc/adt/programs/includes
 *
 * Creates the include object in initial state (no source code) and registers it
 * in D010INC under the specified main program. Optionally auto-inserts an
 * `INCLUDE <name>.` statement into the main program source.
 *
 * Note: CreateProgram with program_type='include' creates a PROG/P (report) object,
 * NOT a PROG/I include. This handler creates a proper PROG/I include.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateInclude = handleCreateInclude;
const fast_xml_parser_1 = require("fast-xml-parser");
const preflightCheck_1 = require("../../../lib/preflightCheck");
const utils_1 = require("../../../lib/utils");
const CT_INCLUDE = 'application/vnd.sap.adt.programs.includes.v2+xml, application/vnd.sap.adt.programs.includes+xml';
const CT_INCLUDE_POST = 'application/vnd.sap.adt.programs.includes+xml';
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'CreateInclude',
    available_in: ['onprem', 'legacy'],
    description: 'Create a new ABAP Include program (Type I, PROG/I) in SAP system. Creates the include object and registers it under the main program in D010INC. By default also auto-inserts an `INCLUDE <name>.` statement into the main program source so the include is actually used. Use UpdateInclude to set source code afterwards. Unlike CreateProgram with program_type=include (which creates PROG/P), this creates a proper PROG/I include.',
    inputSchema: {
        type: 'object',
        properties: {
            include_name: {
                type: 'string',
                description: 'Include program name (e.g., ZPAEK_TEST_INC01). Must follow SAP naming conventions (start with Z or Y).',
            },
            main_program: {
                type: 'string',
                description: 'Name of the main/master program that will contain this include (e.g., ZPAEK_TEST003). Required for proper include registration and activation.',
            },
            description: {
                type: 'string',
                description: 'Include description (max 60 chars). If not provided, include_name will be used.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LAB, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., S4HK904224). Required for transportable packages. Optional for local ($TMP) objects.',
            },
            insert_into_main: {
                type: 'boolean',
                description: 'Auto-insert `INCLUDE <name>.` statement into the main program source. Default: true. Set false to skip main-program modification.',
            },
        },
        required: ['include_name', 'main_program', 'package_name'],
    },
};
function limitDescription(description) {
    return description.length > 60 ? description.substring(0, 60) : description;
}
/**
 * Insert an `INCLUDE <name>.` statement into main program source.
 * Strategy: append after the last existing INCLUDE statement. If no INCLUDE
 * statements exist, append after the REPORT/PROGRAM statement.
 */
function insertIncludeStatement(mainSource, includeName) {
    const lowerInclude = includeName.toLowerCase();
    // Normalize line endings for processing
    const usesCrlf = mainSource.includes('\r\n');
    const newline = usesCrlf ? '\r\n' : '\n';
    const lines = mainSource.split(/\r?\n/);
    // Check if INCLUDE statement already exists (case-insensitive, ignore comments)
    const includeRegex = new RegExp(`^\\s*INCLUDE\\s+${lowerInclude}\\s*\\.`, 'i');
    for (const line of lines) {
        // Skip comment lines
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('"')) {
            continue;
        }
        if (includeRegex.test(line)) {
            return { newSource: mainSource, inserted: false, alreadyPresent: true };
        }
    }
    // Find last line that starts with INCLUDE (case-insensitive, not in comment)
    let lastIncludeIdx = -1;
    const existingIncludeRegex = /^\s*INCLUDE\s+\w+/i;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        if (trimmed.startsWith('*') || trimmed.startsWith('"'))
            continue;
        if (existingIncludeRegex.test(lines[i])) {
            lastIncludeIdx = i;
        }
    }
    const newIncludeLine = `INCLUDE ${lowerInclude}.`;
    if (lastIncludeIdx >= 0) {
        // Insert after the last INCLUDE line
        lines.splice(lastIncludeIdx + 1, 0, newIncludeLine);
    }
    else {
        // No existing INCLUDEs — find REPORT/PROGRAM statement and insert after it
        let reportIdx = -1;
        const reportRegex = /^\s*(REPORT|PROGRAM)\s+/i;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trimStart();
            if (trimmed.startsWith('*') || trimmed.startsWith('"'))
                continue;
            if (reportRegex.test(lines[i])) {
                reportIdx = i;
                break;
            }
        }
        if (reportIdx >= 0) {
            lines.splice(reportIdx + 1, 0, '', newIncludeLine);
        }
        else {
            // Fallback: prepend
            lines.unshift(newIncludeLine);
        }
    }
    return {
        newSource: lines.join(newline),
        inserted: true,
        alreadyPresent: false,
    };
}
/**
 * Extract SAP error message from an axios error response body
 */
function extractSapError(error) {
    try {
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });
        const errorData = error?.response?.data
            ? parser.parse(error.response.data)
            : null;
        const errorMsg = errorData?.['exc:exception']?.message?.['#text'] ||
            errorData?.['exc:exception']?.message;
        return errorMsg ? `SAP Error: ${errorMsg}` : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Read main program source, insert INCLUDE statement, and write back.
 * Uses direct ADT HTTP calls with stateful session for lock/update/unlock/activate.
 * Returns a human-readable note describing what happened.
 */
async function insertIntoMainProgram(connection, mainProgram, includeName, transportRequest, logger, stepsCompleted) {
    const encodedMain = (0, utils_1.encodeSapObjectName)(mainProgram);
    const programBaseUrl = `/sap/bc/adt/programs/programs/${encodedMain}`;
    const sourceUrl = `${programBaseUrl}/source/main`;
    // 1. Read current source
    logger?.debug(`Reading main program source: ${mainProgram}`);
    const readResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, sourceUrl, 'GET', 'default');
    const currentSource = typeof readResponse.data === 'string'
        ? readResponse.data
        : String(readResponse.data ?? '');
    if (!currentSource) {
        throw new Error('Main program source is empty or unreadable');
    }
    // 2. Compute new source
    const { newSource, inserted, alreadyPresent } = insertIncludeStatement(currentSource, includeName);
    if (alreadyPresent) {
        stepsCompleted.push('skip_insert_already_present');
        const note = `INCLUDE ${includeName} already present in ${mainProgram} — skipped insert.`;
        logger?.info(note);
        return note;
    }
    if (!inserted) {
        return `Insert into ${mainProgram} skipped (no change).`;
    }
    // 3. Lock main program (stateful)
    logger?.debug(`Locking main program: ${mainProgram}`);
    connection.setSessionType('stateful');
    const lockResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programBaseUrl}?_action=LOCK&accessMode=MODIFY`, 'POST', 'default', null, undefined, { Accept: ACCEPT_LOCK });
    connection.setSessionType('stateless');
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsed = parser.parse(lockResponse.data || '');
    const lockHandle = parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
        lockResponse.headers?.['x-sap-adt-lock-handle'];
    if (!lockHandle) {
        throw new Error(`Failed to obtain lock handle for main program ${mainProgram}`);
    }
    try {
        // 4. PUT new source
        let updateUrl = `${sourceUrl}?lockHandle=${encodeURIComponent(String(lockHandle))}`;
        if (transportRequest) {
            updateUrl += `&corrNr=${transportRequest}`;
        }
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, updateUrl, 'PUT', 'default', newSource, undefined, { 'Content-Type': 'text/plain; charset=utf-8' });
        stepsCompleted.push('insert_into_main');
        logger?.info(`Inserted INCLUDE ${includeName} statement into ${mainProgram}`);
    }
    finally {
        // 5. Unlock (stateful)
        try {
            connection.setSessionType('stateful');
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programBaseUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(String(lockHandle))}`, 'POST', 'default', null);
            connection.setSessionType('stateless');
        }
        catch (unlockErr) {
            connection.setSessionType('stateless');
            logger?.warn(`Failed to unlock main program ${mainProgram}: ${unlockErr instanceof Error ? unlockErr.message : String(unlockErr)}`);
        }
    }
    // 6. Activate main program (best-effort)
    try {
        const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programBaseUrl}" adtcore:name="${mainProgram}"/></adtcore:objectReferences>`;
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
            'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
        });
        stepsCompleted.push('activate_main');
        logger?.info(`Main program ${mainProgram} activated`);
    }
    catch (activateErr) {
        logger?.warn(`Main program activation warning: ${activateErr instanceof Error ? activateErr.message : String(activateErr)}`);
    }
    return `INCLUDE ${includeName}. inserted into ${mainProgram}.`;
}
async function handleCreateInclude(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.include_name || !args.main_program || !args.package_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: include_name, main_program, and package_name'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Include programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
    }
    const includeName = args.include_name.toUpperCase();
    const mainProgram = args.main_program.toUpperCase();
    const description = limitDescription(args.description || includeName);
    const encodedName = (0, utils_1.encodeSapObjectName)(includeName);
    const encodedMain = (0, utils_1.encodeSapObjectName)(mainProgram).toLowerCase();
    const mainProgramUri = `/sap/bc/adt/programs/programs/${encodedMain}`;
    const shouldInsertIntoMain = args.insert_into_main !== false; // default true
    logger?.info(`Starting include creation: ${includeName} (main program: ${mainProgram})`);
    const stepsCompleted = [];
    let insertNote;
    let checkWarnings = [];
    try {
        // ---- Step 1: Create the include object via POST ----
        const queryParams = [];
        if (args.transport_request) {
            queryParams.push(`corrNr=${args.transport_request}`);
        }
        queryParams.push(`contextUri=${encodeURIComponent(mainProgramUri)}`);
        const url = `/sap/bc/adt/programs/includes?${queryParams.join('&')}`;
        const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${includeName}" adtcore:type="PROG/I" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
  <adtcore:containerRef adtcore:uri="${mainProgramUri}" adtcore:type="PROG/P" adtcore:name="${mainProgram}"/>
</include:abapInclude>`;
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, url, 'POST', 'default', metadataXml, undefined, {
            Accept: CT_INCLUDE,
            'Content-Type': CT_INCLUDE_POST,
        });
        stepsCompleted.push('create');
        logger?.info(`✅ Include created: ${includeName}`);
        // ---- Step 2: Optionally insert INCLUDE statement into main program ----
        if (shouldInsertIntoMain) {
            try {
                const note = await insertIntoMainProgram(connection, mainProgram, includeName, args.transport_request, logger, stepsCompleted);
                insertNote = note;
            }
            catch (insertErr) {
                // Include was created successfully; insert failed as a soft error
                const sapErrorMsg = extractSapError(insertErr);
                insertNote = `Include created, but insert into main program failed: ${sapErrorMsg || (insertErr instanceof Error ? insertErr.message : String(insertErr))}`;
                logger?.warn(insertNote);
            }
        }
        // ---- Step 3: Preflight syntax check on the main program tree ----
        // Runs after any insert+activate on the main program so we catch:
        //   (a) a pre-existing broken state of the main program that we
        //       exposed by touching it,
        //   (b) a bad INCLUDE insertion that corrupted the source,
        //   (c) the include object is broken (empty at create time, but the
        //       `programTree` check is still useful as a sanity pass).
        //
        // If the check fails, the include object AND the main-program insert
        // are already written to SAP — we cannot roll them back from here.
        // We surface the full error and leave the state as-is so the caller
        // can fix the main program, UpdateInclude the body, or DeleteInclude
        // to roll back.
        try {
            logger?.debug(`Running program-tree syntax check after include create: ${mainProgram}`);
            const checkResult = await (0, preflightCheck_1.runSyntaxCheck)({ connection, logger }, { kind: 'programTree', name: mainProgram });
            (0, preflightCheck_1.assertNoCheckErrors)(checkResult, 'Program tree', mainProgram);
            checkWarnings = checkResult.warnings;
            stepsCompleted.push('check_new_code');
            logger?.info(`Program-tree syntax check passed: ${mainProgram} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`);
        }
        catch (checkErr) {
            // Include WAS created and main program WAS modified — cannot roll
            // back from here. Surface the error with a clear note.
            if (checkErr?.isPreflightCheckFailure) {
                const wrapped = new Error(`Include ${includeName} was created and main program ${mainProgram} was modified, but the resulting program tree has syntax errors. ` +
                    `${checkErr.message}. ` +
                    `Fix the main program or call DeleteInclude to roll back.`);
                wrapped.isPreflightCheckFailure = true;
                wrapped.checkErrors = checkErr.checkErrors;
                wrapped.checkWarnings = checkErr.checkWarnings;
                wrapped.include_name = includeName;
                wrapped.main_program = mainProgram;
                wrapped.steps_completed = stepsCompleted;
                throw wrapped;
            }
            throw checkErr;
        }
        const result = {
            success: true,
            include_name: includeName,
            main_program: mainProgram,
            package_name: args.package_name,
            transport_request: args.transport_request || null,
            type: 'PROG/I',
            message: insertNote
                ? `Include ${includeName} created. ${insertNote}`
                : `Include ${includeName} created successfully under main program ${mainProgram}. Use UpdateInclude to set source code.`,
            uri: `/sap/bc/adt/programs/includes/${encodedName.toLowerCase()}`,
            steps_completed: stepsCompleted,
            insert_note: insertNote || null,
            check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
        };
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        // Preflight syntax-check failures carry a full, pre-formatted message
        // and structured checkErrors/checkWarnings — surface them as-is.
        if (error?.isPreflightCheckFailure) {
            logger?.error(`Error creating include ${includeName}: ${error.message}`);
            return (0, utils_1.return_error)(error);
        }
        let errorMessage = error instanceof Error ? error.message : String(error);
        // Always try to extract the real SAP error message first
        try {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
            });
            const errorData = error?.response?.data
                ? parser.parse(error.response.data)
                : null;
            const errorMsg = errorData?.['exc:exception']?.message?.['#text'] ||
                errorData?.['exc:exception']?.message;
            if (errorMsg) {
                errorMessage = `SAP Error: ${errorMsg}`;
            }
        }
        catch {
            // ignore parse errors
        }
        // Add status-specific hints if not already a SAP error
        if (!errorMessage.startsWith('SAP Error:')) {
            if (error.response?.status === 409) {
                errorMessage = `Include ${includeName} already exists.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Bad request (400). Check include name, package name, and transport request.`;
            }
        }
        logger?.error(`Error creating include ${includeName}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create include ${includeName}: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateInclude.js.map