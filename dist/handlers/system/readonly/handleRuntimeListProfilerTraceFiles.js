"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeListProfilerTraceFiles = handleRuntimeListProfilerTraceFiles;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeListProfilerTraceFiles',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] List ABAP profiler trace files available in ADT runtime. Returns parsed JSON payload.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
async function handleRuntimeListProfilerTraceFiles(context) {
    const { connection, logger } = context;
    try {
        const runtimeClient = new adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.listProfilerTraceFiles();
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
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
        logger?.error('Error listing profiler trace files:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeListProfilerTraceFiles.js.map