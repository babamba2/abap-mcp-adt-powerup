"use strict";
/**
 * DeleteGuiStatus Handler - Delete an ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_DELETE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteGuiStatus = handleDeleteGuiStatus;
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteGuiStatusLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Delete an ABAP GUI Status from a program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            status_name: {
                type: 'string',
                description: 'GUI Status name to delete. Use "*" to delete all.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockGuiStatusLow.',
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
        required: ['program_name', 'status_name', 'lock_handle'],
    },
};
async function handleDeleteGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, status_name, lock_handle, session_id, session_state, } = args;
        if (!program_name || !status_name || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, status_name, and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const statusName = status_name.toUpperCase();
        logger?.info(`Deleting GUI status: ${programName} / ${statusName}`);
        // Source-level delete: RS_CUA_DELETE only removes the runtime load
        // from RS38L_INCL; it does NOT edit rsmpe_stat/rsmpe_titt. So we
        // fetch, drop the matching STA/TIT/SET rows, and CUA_WRITE back.
        // status_name === '*' means "delete all statuses" (source wipe).
        const { result: cuaResult } = await (0, soapRfc_1.callDispatch)(connection, 'CUA_FETCH', { program: programName });
        if (!cuaResult || typeof cuaResult !== 'object') {
            throw new Error(`Could not fetch CUA data for program ${programName} prior to delete.`);
        }
        const cua = { ...cuaResult };
        const staBefore = Array.isArray(cua.STA) ? cua.STA : [];
        const titBefore = Array.isArray(cua.TIT) ? cua.TIT : [];
        const setBefore = Array.isArray(cua.SET) ? cua.SET : [];
        if (statusName === '*') {
            cua.STA = [];
            cua.TIT = [];
            cua.SET = [];
        }
        else {
            cua.STA = staBefore.filter((row) => row?.CODE !== statusName);
            cua.TIT = titBefore.filter((row) => row?.CODE !== statusName);
            cua.SET = setBefore.filter((row) => row?.STATUS !== statusName);
            if (cua.STA.length === staBefore.length) {
                throw new Error(`GUI Status ${statusName} not found in program ${programName}.`);
            }
        }
        await (0, soapRfc_1.callDispatch)(connection, 'CUA_WRITE', {
            program: programName,
            cua_data: JSON.stringify(cua),
        });
        logger?.info(`✅ GUI status deleted: ${programName}/${statusName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                status_name: statusName,
                session_id: session_id || null,
                message: `GUI Status ${programName}/${statusName} deleted successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error deleting GUI status: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to delete GUI status: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleDeleteGuiStatus.js.map