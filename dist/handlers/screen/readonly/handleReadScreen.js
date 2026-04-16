"use strict";
/**
 * ReadScreen Handler - Read ABAP Screen (Dynpro) flow logic and metadata
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_READ.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadScreen = handleReadScreen;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadScreen',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Read ABAP Screen (Dynpro) flow logic source code, fields, and metadata.',
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
async function handleReadScreen(context, args) {
    const { connection, logger } = context;
    try {
        if (!args.program_name || !args.screen_number) {
            return (0, utils_1.return_error)(new Error('program_name and screen_number are required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        const programName = args.program_name.toUpperCase();
        logger?.info(`Reading screen: ${programName} / ${args.screen_number}`);
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
        logger?.info(`✅ ReadScreen completed: ${programName}/${args.screen_number}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number: args.screen_number,
                flow_logic: flowLogic,
                metadata: result?.HEADER ?? result?.header ?? null,
                containers: result?.CONTAINERS ?? result?.containers ?? [],
                fields_to_containers: result?.FIELDS_TO_CONTAINERS ?? result?.fields_to_containers ?? [],
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error reading screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleReadScreen.js.map