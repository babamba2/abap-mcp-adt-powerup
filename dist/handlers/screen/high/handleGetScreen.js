"use strict";
/**
 * GetScreen Handler - Get ABAP Screen (Dynpro) with metadata and flow logic
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_READ.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetScreen = handleGetScreen;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetScreen',
    available_in: ['onprem', 'legacy'],
    description: 'Get ABAP Screen (Dynpro) definition including metadata, fields, and flow logic source code.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name (e.g., SAPMV45A).',
            },
            screen_number: {
                type: 'string',
                description: 'Screen number (e.g., 0100).',
            },
        },
        required: ['program_name', 'screen_number'],
    },
};
async function handleGetScreen(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.screen_number) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and screen_number'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
    }
    const programName = args.program_name.toUpperCase();
    logger?.info(`Getting screen: ${programName} / ${args.screen_number}`);
    try {
        const { result } = await (0, rfcBackend_1.callDispatch)(connection, 'DYNPRO_READ', {
            program: programName,
            dynpro: args.screen_number,
        });
        // /ui2/cl_json=>serialize default keeps ABAP field names UPPERCASE.
        const flowLogicArr = result?.FLOW_LOGIC ?? result?.flow_logic;
        let flowLogic = null;
        if (Array.isArray(flowLogicArr)) {
            flowLogic = flowLogicArr
                .map((line) => line.LINE ?? line.line ?? '')
                .join('\n');
        }
        logger?.info(`✅ GetScreen completed: ${programName}/${args.screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number: args.screen_number,
                type: 'DYNP',
                flow_logic: flowLogic,
                metadata: result?.HEADER ?? result?.header ?? null,
                containers: result?.CONTAINERS ?? result?.containers ?? [],
                fields_to_containers: result?.FIELDS_TO_CONTAINERS ?? result?.fields_to_containers ?? [],
                steps_completed: ['get_metadata', 'get_flow_logic'],
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error getting screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to get screen: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleGetScreen.js.map