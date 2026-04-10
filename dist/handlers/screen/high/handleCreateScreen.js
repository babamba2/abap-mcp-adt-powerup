"use strict";
/**
 * CreateScreen Handler (High-level) - Create a new ABAP Screen via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_INSERT.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateScreen = handleCreateScreen;
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateScreen',
    available_in: ['onprem', 'legacy'],
    description: 'Create a new ABAP Screen (Dynpro) on an existing program. Optionally activates.',
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
                description: 'Full screen definition as JSON. If omitted, creates minimal screen.',
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
        required: ['program_name', 'screen_number'],
    },
};
async function handleCreateScreen(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.screen_number) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and screen_number'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
    }
    const programName = args.program_name.toUpperCase();
    const shouldActivate = args.activate === true;
    logger?.info(`Creating screen: ${programName} / ${args.screen_number}`);
    try {
        // /ui2/cl_json=>deserialize default requires UPPERCASE JSON keys to
        // map into ABAP structure fields (HEADER, CONTAINERS, ...).
        const screenData = args.dynpro_data ||
            JSON.stringify({
                HEADER: {
                    PROGRAM: programName,
                    SCREEN: args.screen_number,
                    LANGUAGE: 'E',
                    DESCRIPT: args.description || `Screen ${args.screen_number}`,
                    TYPE: 'N',
                    LINES: 20,
                    COLUMNS: 83,
                },
                CONTAINERS: [],
                FIELDS_TO_CONTAINERS: [],
                FLOW_LOGIC: [
                    { LINE: 'PROCESS BEFORE OUTPUT.' },
                    { LINE: `* MODULE STATUS_${args.screen_number}.` },
                    { LINE: '' },
                    { LINE: 'PROCESS AFTER INPUT.' },
                    { LINE: `* MODULE USER_COMMAND_${args.screen_number}.` },
                ],
            });
        await (0, soapRfc_1.callDispatch)(connection, 'DYNPRO_INSERT', {
            program: programName,
            dynpro: args.screen_number,
            dynpro_data: screenData,
        });
        logger?.info(`Screen created: ${programName}/${args.screen_number}`);
        if (shouldActivate) {
            const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
            const programUri = `/sap/bc/adt/programs/programs/${encodedProgram}`;
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUri}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number: args.screen_number,
                type: 'DYNP',
                activated: shouldActivate,
                message: shouldActivate
                    ? `Screen ${programName}/${args.screen_number} created and activated.`
                    : `Screen ${programName}/${args.screen_number} created (not activated).`,
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
        logger?.error(`Error creating screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create screen: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateScreen.js.map