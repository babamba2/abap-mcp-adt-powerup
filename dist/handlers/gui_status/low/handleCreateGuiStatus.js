"use strict";
/**
 * CreateGuiStatus Handler - Create a new ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Fetches existing CUA data,
 * adds the new status entry, and writes back.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateGuiStatus = handleCreateGuiStatus;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateGuiStatusLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Create a new ABAP GUI Status on an existing program.',
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
                description: 'Status type: "N" (normal/dialog), "P" (popup/dialog box), "C" (context menu). Default: "N".',
                enum: ['N', 'P', 'C'],
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['program_name', 'status_name'],
    },
};
async function handleCreateGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, status_name, description, status_type, session_id, session_state, } = args;
        if (!program_name || !status_name) {
            return (0, utils_1.return_error)(new Error('program_name and status_name are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const sName = status_name.toUpperCase();
        logger?.info(`Creating GUI status: ${programName} / ${sName}`);
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
            const { result } = await (0, rfcBackend_1.callDispatch)(connection, 'CUA_FETCH', {
                program: programName,
            });
            if (result && typeof result === 'object') {
                cuaData = { ...cuaData, ...result };
            }
        }
        catch {
            // No existing CUA data - start fresh
        }
        // Add new status entry. Note: rsmpe_stat does not have a TXT column —
        // status descriptions live in the TIT table (rsmpe_titt). Here we only
        // add the status row itself; a richer create path should also append
        // to TIT for localized text.
        const newStatus = {
            CODE: sName,
            MODAL: status_type || 'D',
        };
        cuaData.STA = Array.isArray(cuaData.STA) ? cuaData.STA : [];
        cuaData.STA.push(newStatus);
        if (description) {
            cuaData.TIT = Array.isArray(cuaData.TIT) ? cuaData.TIT : [];
            cuaData.TIT.push({ CODE: sName, TEXT: description });
        }
        // Write back
        await (0, rfcBackend_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: JSON.stringify(cuaData),
        });
        logger?.info(`✅ GUI status created: ${programName}/${sName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                status_name: sName,
                status_type: status_type || 'N',
                session_id: session_id || null,
                message: `GUI Status ${programName}/${sName} created successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error creating GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateGuiStatus.js.map