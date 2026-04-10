"use strict";
/**
 * CreateScreen Handler (Low-level) - Create a new ABAP Screen via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_INSERT.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateScreen = handleCreateScreen;
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateScreenLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Create a new ABAP Screen (Dynpro) on an existing program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: { type: 'string', description: 'Parent program name.' },
            screen_number: {
                type: 'string',
                description: 'Screen number to create (e.g., 0100).',
            },
            description: { type: 'string', description: 'Screen description.' },
            dynpro_data: {
                type: 'string',
                description: 'Full screen definition as JSON (header, containers, fields_to_containers, flow_logic). If omitted, creates a minimal empty screen.',
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
        required: ['program_name', 'screen_number'],
    },
};
async function handleCreateScreen(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, screen_number, description, dynpro_data, session_id, session_state, } = args;
        if (!program_name || !screen_number) {
            return (0, utils_1.return_error)(new Error('program_name and screen_number are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Creating screen: ${programName} / ${screen_number}`);
        // Build dynpro data - either from provided data or minimal defaults
        const screenData = dynpro_data ||
            JSON.stringify({
                header: {
                    PROGRAM: programName,
                    SCREEN: screen_number,
                    LANGUAGE: 'E',
                    DESSION: description || `Screen ${screen_number}`,
                    TYPE: 'N',
                    LINES: '20',
                    COLUMNS: '83',
                },
                containers: [],
                fields_to_containers: [],
                flow_logic: [
                    { LINE: `PROCESS BEFORE OUTPUT.` },
                    { LINE: `* MODULE STATUS_${screen_number}.` },
                    { LINE: `` },
                    { LINE: `PROCESS AFTER INPUT.` },
                    { LINE: `* MODULE USER_COMMAND_${screen_number}.` },
                ],
            });
        await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_INSERT', {
            program: programName,
            dynpro: screen_number,
            dynpro_data: screenData,
        });
        logger?.info(`✅ Screen created: ${programName}/${screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number,
                session_id: session_id || null,
                message: `Screen ${programName}/${screen_number} created successfully.`,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error creating screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create screen: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateScreen.js.map