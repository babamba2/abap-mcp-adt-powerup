"use strict";
/**
 * UpdateScreen Handler (High-level) - Update ABAP Screen via RFC
 *
 * Locks program, deletes+re-inserts screen via RFC, unlocks, optionally activates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateScreen = handleUpdateScreen;
const fast_xml_parser_1 = require("fast-xml-parser");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'UpdateScreen',
    available_in: ['onprem', 'legacy'],
    description: 'Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON. Handles lock/unlock automatically.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: { type: 'string', description: 'Parent program name.' },
            screen_number: {
                type: 'string',
                description: 'Screen number (e.g., 0100).',
            },
            dynpro_data: {
                type: 'string',
                description: 'Complete screen definition as JSON (from GetScreen/ReadScreen).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: false.',
            },
        },
        required: ['program_name', 'screen_number', 'dynpro_data'],
    },
};
async function handleUpdateScreen(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.screen_number || !args.dynpro_data) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name, screen_number, and dynpro_data'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
    }
    const programName = args.program_name.toUpperCase();
    const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
    const shouldActivate = args.activate === true;
    logger?.info(`Updating screen: ${programName}/${args.screen_number}`);
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
        // Delete + re-insert screen via RFC
        try {
            await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_DELETE', {
                program: programName,
                dynpro: args.screen_number,
            });
        }
        catch {
            /* screen might not exist */
        }
        await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_INSERT', {
            program: programName,
            dynpro: args.screen_number,
            dynpro_data: args.dynpro_data,
        });
        // Post-write syntax check on the parent program tree. Dynpros
        // have no standalone check — flow-logic errors surface as errors
        // in the parent program's compile. Runs while still locked so the
        // unlock/activate path sees the same inactive version.
        const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'screen', name: programName, parentProgramName: programName });
        (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Screen', `${programName}/${args.screen_number}`);
        // Unlock
        if (lockHandle) {
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
            lockHandle = undefined;
        }
        // Activate
        if (shouldActivate) {
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUrl}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
        }
        logger?.info(`✅ Screen updated: ${programName}/${args.screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number: args.screen_number,
                type: 'DYNP',
                activated: shouldActivate,
                message: shouldActivate
                    ? `Screen ${programName}/${args.screen_number} updated and activated.`
                    : `Screen ${programName}/${args.screen_number} updated (not activated).`,
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
                /* ignore */
            }
        }
        // PreCheck syntax-check failures carry full structured diagnostics —
        // forward them as-is so the caller sees every error with line numbers.
        if (error?.isPreCheckFailure) {
            logger?.error(`Error updating screen: ${error.message}`);
            return (0, utils_1.return_error)(error);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error updating screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to update screen: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateScreen.js.map