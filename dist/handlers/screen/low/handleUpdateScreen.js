"use strict";
/**
 * UpdateScreen Handler (Low-level) - Update ABAP Screen flow logic via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Deletes + re-inserts screen
 * since RPY_DYNPRO_INSERT is the standard update mechanism.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateScreen = handleUpdateScreen;
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateScreenLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON.',
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
                description: 'Complete screen definition as JSON (header, containers, fields_to_containers, flow_logic).',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockScreenLow.',
            },
            skip_check: {
                type: 'boolean',
                description: 'Skip post-write syntax check. Default: false. When false, runs a program-tree syntax check on the parent program after DYNPRO_INSERT and surfaces any flow-logic errors with line numbers.',
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
        required: ['program_name', 'screen_number', 'dynpro_data', 'lock_handle'],
    },
};
async function handleUpdateScreen(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, screen_number, dynpro_data, lock_handle, skip_check, session_id, session_state, } = args;
        if (!program_name || !screen_number || !dynpro_data || !lock_handle) {
            return (0, utils_1.return_error)(new Error('program_name, screen_number, dynpro_data, and lock_handle are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Updating screen: ${programName} / ${screen_number}`);
        // Delete existing screen first, then re-insert with new data
        try {
            await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_DELETE', {
                program: programName,
                dynpro: screen_number,
            });
        }
        catch {
            // Screen might not exist yet - that's ok for insert
        }
        await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_INSERT', {
            program: programName,
            dynpro: screen_number,
            dynpro_data: dynpro_data,
        });
        // Post-write syntax check on the parent program tree (unless skipped).
        if (skip_check !== true) {
            const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'screen', name: programName, parentProgramName: programName });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Screen', `${programName}/${screen_number}`);
        }
        logger?.info(`✅ Screen updated: ${programName}/${screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number,
                session_id: session_id || null,
                message: `Screen ${programName}/${screen_number} updated successfully. Remember to unlock and activate.`,
            }, null, 2),
        });
    }
    catch (error) {
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