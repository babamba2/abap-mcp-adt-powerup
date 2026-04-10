"use strict";
/**
 * CreateGuiStatus Handler (High-level) - Create a new ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Fetches existing CUA data,
 * adds the new status entry, writes back, and optionally activates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateGuiStatus = handleCreateGuiStatus;
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateGuiStatus',
    available_in: ['onprem', 'legacy'],
    description: 'Create a new ABAP GUI Status on an existing program. Optionally activates after creation.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name (e.g., Z_MY_PROGRAM).',
            },
            status_name: {
                type: 'string',
                description: 'GUI Status name to create (e.g., MAIN_STATUS).',
            },
            description: {
                type: 'string',
                description: 'GUI Status description.',
            },
            status_type: {
                type: 'string',
                description: 'Status type: "N" (normal/dialog), "P" (popup), "C" (context menu). Default: "N".',
                enum: ['N', 'P', 'C'],
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after creation. Default: false.',
            },
        },
        required: ['program_name', 'status_name'],
    },
};
async function handleCreateGuiStatus(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.status_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and status_name'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
    }
    const programName = args.program_name.toUpperCase();
    const statusName = args.status_name.toUpperCase();
    const shouldActivate = args.activate === true;
    logger?.info(`Creating GUI status: ${programName} / ${statusName}`);
    try {
        // Fetch existing CUA data (may not exist yet).
        // /ui2/cl_json=>serialize/deserialize default keeps ABAP field names
        // UPPERCASE, so both the fetched result and the payload must use
        // UPPERCASE keys (STA, FUN, ..., ADM).
        let cuaData = {
            ADM: {},
            STA: [],
            FUN: [],
            MEN: [],
            MTX: [],
            ACT: [],
            BUT: [],
            PFK: [],
            SET: [],
            DOC: [],
            TIT: [],
            BIV: [],
        };
        try {
            const { result } = await (0, soapRfc_1.callDispatch)(connection, 'CUA_FETCH', {
                program: programName,
            });
            if (result && typeof result === 'object') {
                cuaData = { ...cuaData, ...result };
            }
        }
        catch {
            // No existing CUA data - start fresh
        }
        // Add new status entry. rsmpe_stat has no TXT column — status
        // descriptions live in the TIT table (rsmpe_titt).
        const newStatus = {
            CODE: statusName,
            MODAL: args.status_type || 'D',
        };
        cuaData.STA = Array.isArray(cuaData.STA) ? cuaData.STA : [];
        cuaData.STA.push(newStatus);
        if (args.description) {
            cuaData.TIT = Array.isArray(cuaData.TIT) ? cuaData.TIT : [];
            cuaData.TIT.push({ CODE: statusName, TEXT: args.description });
        }
        // Write back
        await (0, soapRfc_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: JSON.stringify(cuaData),
        });
        logger?.info(`GUI status created: ${programName}/${statusName}`);
        // Activate if requested
        if (shouldActivate) {
            const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
            const programUri = `/sap/bc/adt/programs/programs/${encodedProgram}`;
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUri}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
            logger?.info(`Program activated: ${programName}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                status_name: statusName,
                status_type: args.status_type || 'N',
                type: 'CUAD',
                activated: shouldActivate,
                message: shouldActivate
                    ? `GUI Status ${programName}/${statusName} created and activated.`
                    : `GUI Status ${programName}/${statusName} created (not activated).`,
                steps_completed: ['create', ...(shouldActivate ? ['activate'] : [])],
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error creating GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateGuiStatus.js.map