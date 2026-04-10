"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerProfileList = handleHandlerProfileList;
const handleRuntimeListProfilerTraceFiles_1 = require("../../system/readonly/handleRuntimeListProfilerTraceFiles");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerProfileList',
    available_in: ['onprem'],
    description: 'Runtime profiling list. object_type: not used. Required: none. Response: JSON.',
    inputSchema: compactSchemas_1.compactProfileListSchema,
};
async function handleHandlerProfileList(context) {
    return (0, handleRuntimeListProfilerTraceFiles_1.handleRuntimeListProfilerTraceFiles)(context);
}
//# sourceMappingURL=handleHandlerProfileList.js.map