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
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'UpdateGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: 'Update ABAP GUI Status definition. Provide modified CUA data (from GetGuiStatus). Handles lock/unlock automatically.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            cua_data: {
                type: 'string',
                description: 'Complete CUA data as JSON (from GetGuiStatus). Modify and pass back.',
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
        required: ['program_name', 'cua_data'],
    },
};
async function handleUpdateGuiStatus(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.cua_data) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and cua_data'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
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
        // Write CUA data via RFC
        await (0, rfcBackend_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: args.cua_data,
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