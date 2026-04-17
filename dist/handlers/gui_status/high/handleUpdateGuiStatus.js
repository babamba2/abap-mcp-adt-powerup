"use strict";
/**
 * UpdateGuiStatus Handler (High-level) - Update ABAP GUI Status definition
 *
 * Locks program, writes CUA data via RFC, unlocks, optionally activates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateGuiStatus = handleUpdateGuiStatus;
const fast_xml_parser_1 = require("fast-xml-parser");
const cuaSchema_1 = require("../../../lib/cuaSchema");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'UpdateGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: '⚠️ FULL REPLACE — overwrites the entire GUI Status definition (all 12 CUA tables) for the program. Any row or field you omit is DROPPED. Always Read (ReadGuiStatus) → modify → Update, or use PatchGuiStatus for row-level merges. cua_data must include complete STA / FUN / PFK / BUT / TIT rows with all required fields (CODE, PFNO, FUNCODE, ...). Handles lock/unlock automatically.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            cua_data: {
                description: 'Complete CUA data — accepts either a JSON string or a structured object with ADM / STA / FUN / MEN / MTX / ACT / BUT / PFK / SET / DOC / TIT / BIV. Required row fields: STA.CODE, FUN.CODE, PFK.{CODE,PFNO,FUNCODE}, BUT.{PFK_CODE,CODE,NO,PFNO}, TIT.CODE. Missing rows are dropped — this is full-replace semantics.',
                oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: false.',
            },
            skip_validation: {
                type: 'boolean',
                description: 'Skip client-side schema validation. Default: false. Only set true if you know the CUA payload is intentionally partial and SAP will accept it.',
            },
        },
        required: ['program_name', 'cua_data'],
    },
};
async function handleUpdateGuiStatus(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name ||
        args.cua_data === undefined ||
        args.cua_data === null) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and cua_data'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
    }
    // Normalize cua_data to a typed object and validate row-level required
    // fields before any SAP round-trip. This prevents the "sent half a CUA
    // JSON → production GUI status is wiped" failure mode.
    let cuaObject;
    try {
        cuaObject = (0, cuaSchema_1.normalizeCuaInput)(args.cua_data);
    }
    catch (e) {
        return (0, utils_1.return_error)(new Error(`Invalid cua_data: ${e?.message || String(e)}`));
    }
    if (args.skip_validation !== true) {
        const problems = (0, cuaSchema_1.validateCuaData)(cuaObject);
        const hard = problems.filter((p) => p.field !== 'PFKCODE' && p.field !== 'PFK_CODE');
        if (hard.length > 0) {
            const summary = hard.map((p) => `- ${p.message}`).join('\n');
            return (0, utils_1.return_error)(new Error(`UpdateGuiStatus rejected — cua_data has ${hard.length} validation problem(s). Fix these (or pass skip_validation=true to bypass):\n${summary}`));
        }
        if (problems.length > 0) {
            logger?.warn(`cua_data has ${problems.length} cross-reference warning(s): ${problems
                .map((p) => p.message)
                .join(' | ')}`);
        }
    }
    const programName = args.program_name.toUpperCase();
    const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
    const shouldActivate = args.activate === true;
    logger?.info(`Updating GUI status data: ${programName}`);
    let lockHandle;
    try {
        // Lock program
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
            throw new Error(`Failed to obtain lock handle for program ${programName}`);
        }
        // Write CUA data via RFC. ABAP expects a single JSON string; we
        // serialize the normalized object ourselves so field ordering /
        // casing are consistent and a structured input object works the
        // same as a raw JSON string.
        await (0, rfcBackend_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: (0, cuaSchema_1.serializeCuaForRfc)(cuaObject),
        });
        // Unlock program
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
        lockHandle = undefined;
        // Activate if requested
        if (shouldActivate) {
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUrl}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
        }
        logger?.info(`✅ GUI status updated: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                type: 'CUAD',
                activated: shouldActivate,
                message: shouldActivate
                    ? `GUI Status data for ${programName} updated and activated.`
                    : `GUI Status data for ${programName} updated (not activated).`,
                steps_completed: [
                    'lock',
                    'update',
                    'unlock',
                    ...(shouldActivate ? ['activate'] : []),
                ],
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
        logger?.error(`Error updating GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to update GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateGuiStatus.js.map