"use strict";
/**
 * PatchGuiStatus — safer alternative to UpdateGuiStatus.
 *
 * Fetches the current active CUA for the program, row-level merges the
 * caller-supplied `changes` into it, and writes the merged result back.
 * Rows and fields the caller didn't touch are preserved verbatim — so
 * sending `{ FUN: [{ CODE: 'BACK', ICON_ID: '@03@' }] }` only updates the
 * BACK function's icon and leaves everything else intact.
 *
 * This is the footgun-proof equivalent of UpdateGuiStatus for targeted
 * edits. UpdateGuiStatus remains available for callers that genuinely
 * need full-replace semantics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handlePatchGuiStatus = handlePatchGuiStatus;
const fast_xml_parser_1 = require("fast-xml-parser");
const cuaSchema_1 = require("../../../lib/cuaSchema");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'PatchGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: 'Row-level merge into an existing ABAP GUI Status definition. Fetches current CUA → merges the caller-supplied changes (by natural key) → writes merged result back. Rows / fields you omit are preserved. Safer default for targeted edits; use UpdateGuiStatus only when you truly want to replace the whole CUA.\n\nMerge keys per table:\n  STA=CODE, FUN=CODE, PFK=CODE+PFNO, BUT=PFK_CODE+CODE+NO, TIT=CODE,\n  MEN=CODE+NO, MTX=CODE, ACT=CODE+NO, SET=STATUS+FUNCTION,\n  DOC=OBJ_TYPE+OBJ_CODE, BIV=CODE+POS.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            changes: {
                description: 'Partial CUA data to merge into the current definition. Same shape as cua_data (ADM / STA / FUN / MEN / MTX / ACT / BUT / PFK / SET / DOC / TIT / BIV). Accepts JSON string or object. Rows matched by natural key are field-merged (changes win). New rows are appended. Omitted tables are left untouched.',
                oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after patch. Default: false.',
            },
            skip_validation: {
                type: 'boolean',
                description: 'Skip client-side validation of the merged result. Default: false.',
            },
        },
        required: ['program_name', 'changes'],
    },
};
/**
 * Normalize the case of keys in a ReadGuiStatus result so merging works.
 * `ReadGuiStatus` returns `{success, program_name, definition: {ADM, STA, ...}}`
 * where the inner keys are already uppercase (ABAP /ui2/cl_json output), so
 * no extra work needed beyond extracting `definition`.
 */
function extractCurrentCua(readResponse) {
    const text = readResponse?.content?.find((c) => c.type === 'text')?.text;
    if (!text)
        throw new Error('ReadGuiStatus returned empty body');
    const parsed = JSON.parse(text);
    if (parsed?.success === false) {
        throw new Error(`ReadGuiStatus reported failure: ${parsed?.message ?? ''}`);
    }
    const def = parsed?.definition;
    if (!def || typeof def !== 'object') {
        throw new Error('ReadGuiStatus response missing "definition"');
    }
    return def;
}
async function handlePatchGuiStatus(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name ||
        args.changes === undefined ||
        args.changes === null) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and changes'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
    }
    let changes;
    try {
        changes = (0, cuaSchema_1.normalizeCuaInput)(args.changes);
    }
    catch (e) {
        return (0, utils_1.return_error)(new Error(`Invalid changes: ${e?.message || String(e)}`));
    }
    const programName = args.program_name.toUpperCase();
    const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
    const shouldActivate = args.activate === true;
    logger?.info(`Patching GUI status: ${programName}`);
    let lockHandle;
    const stepsCompleted = [];
    try {
        // 1) Fetch current active CUA
        const fetchResp = await (0, rfcBackend_1.callDispatch)(connection, 'CUA_FETCH', {
            program: programName,
        });
        let current;
        try {
            // callDispatch returns { result, subrc, message }; result is already parsed JSON
            const result = fetchResp?.result;
            if (result && typeof result === 'object') {
                current = result;
            }
            else if (typeof result === 'string') {
                current = (0, cuaSchema_1.normalizeCuaInput)(result);
            }
            else {
                current = {};
            }
        }
        catch (e) {
            throw new Error(`Failed to parse current CUA for ${programName}: ${e?.message || e}`);
        }
        stepsCompleted.push('fetch_current');
        // 2) Row-level merge
        const merged = (0, cuaSchema_1.mergeCuaData)(current, changes);
        stepsCompleted.push('merge');
        // 3) Validate merged result
        if (args.skip_validation !== true) {
            const problems = (0, cuaSchema_1.validateCuaData)(merged);
            const hard = problems.filter((p) => p.field !== 'PFKCODE' && p.field !== 'PFK_CODE');
            if (hard.length > 0) {
                const summary = hard.map((p) => `- ${p.message}`).join('\n');
                throw new Error(`PatchGuiStatus rejected — merged cua has ${hard.length} validation problem(s). Fix changes (or pass skip_validation=true):\n${summary}`);
            }
            if (problems.length > 0) {
                logger?.warn(`Merged cua has ${problems.length} cross-reference warning(s): ${problems
                    .map((p) => p.message)
                    .join(' | ')}`);
            }
        }
        // 4) Lock program
        const lockResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=LOCK&accessMode=MODIFY`, 'POST', 'default', null, undefined, { Accept: ACCEPT_LOCK });
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const parsed = parser.parse(lockResponse.data || '');
        lockHandle =
            parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
                lockResponse.headers?.['x-sap-adt-lock-handle'];
        if (!lockHandle) {
            throw new Error(`Failed to obtain lock handle for ${programName}`);
        }
        stepsCompleted.push('lock');
        // 5) Write merged CUA
        await (0, rfcBackend_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: (0, cuaSchema_1.serializeCuaForRfc)(merged),
        });
        stepsCompleted.push('write');
        // 6) Unlock
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
        lockHandle = undefined;
        stepsCompleted.push('unlock');
        // 7) Optional activate
        if (shouldActivate) {
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUrl}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
            stepsCompleted.push('activate');
        }
        logger?.info(`✅ GUI status patched: ${programName}`);
        const countRows = (arr) => Array.isArray(arr) ? arr.length : 0;
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                type: 'CUAD',
                activated: shouldActivate,
                steps_completed: stepsCompleted,
                summary: {
                    sta: countRows(merged.STA),
                    fun: countRows(merged.FUN),
                    pfk: countRows(merged.PFK),
                    but: countRows(merged.BUT),
                    tit: countRows(merged.TIT),
                    men: countRows(merged.MEN),
                    mtx: countRows(merged.MTX),
                    act: countRows(merged.ACT),
                    set: countRows(merged.SET),
                    doc: countRows(merged.DOC),
                },
                message: shouldActivate
                    ? `GUI Status for ${programName} patched and activated.`
                    : `GUI Status for ${programName} patched (not activated).`,
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        if (lockHandle) {
            try {
                await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
            }
            catch {
                /* ignore unlock error */
            }
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error patching GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to patch GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handlePatchGuiStatus.js.map