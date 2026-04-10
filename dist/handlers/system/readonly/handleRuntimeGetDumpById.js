"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeGetDumpById = handleRuntimeGetDumpById;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeGetDumpById',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Read a specific ABAP runtime dump by dump ID. Returns parsed JSON payload.',
    inputSchema: {
        type: 'object',
        properties: {
            dump_id: {
                type: 'string',
                description: 'Runtime dump ID (for example: 694AB694097211F1929806D06D234D38).',
            },
            view: {
                type: 'string',
                enum: ['default', 'summary', 'formatted'],
                description: 'Dump view mode: default payload, summary section, or formatted long text.',
                default: 'default',
            },
        },
        required: ['dump_id'],
    },
};
async function handleRuntimeGetDumpById(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.dump_id) {
            throw new Error('Parameter "dump_id" is required');
        }
        const view = args.view ?? 'default';
        const runtimeClient = new adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.getRuntimeDumpById(args.dump_id, {
            view,
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                dump_id: args.dump_id,
                view,
                status: response.status,
                payload: (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data),
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error reading runtime dump by ID:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeGetDumpById.js.map