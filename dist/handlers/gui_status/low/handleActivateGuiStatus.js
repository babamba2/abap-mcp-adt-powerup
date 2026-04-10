"use strict";
/**
 * ActivateGuiStatus Handler - Activate parent program (includes GUI statuses)
 *
 * Activates the parent program via ADT activation endpoint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateGuiStatus = handleActivateGuiStatus;
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateGuiStatusLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Activate an ABAP program to make GUI Status changes active.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
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
        required: ['program_name'],
    },
};
async function handleActivateGuiStatus(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, session_id, session_state } = args;
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('GUI Statuses are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
        const programUri = `/sap/bc/adt/programs/programs/${encodedProgram}`;
        logger?.info(`Activating program for GUI status: ${programName}`);
        const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUri}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
            'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
        });
        logger?.info(`✅ Program activated: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                session_id: session_id || null,
                message: `Program ${programName} activated successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error activating program: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to activate: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleActivateGuiStatus.js.map