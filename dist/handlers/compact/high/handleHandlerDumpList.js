"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerDumpList = handleHandlerDumpList;
const handleRuntimeListDumps_1 = require("../../system/readonly/handleRuntimeListDumps");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerDumpList',
    available_in: ['onprem'],
    description: 'Runtime dump list. object_type: not used. Required: none. Optional: user, inlinecount, top, skip, orderby. Response: JSON.',
    inputSchema: compactSchemas_1.compactDumpListSchema,
};
async function handleHandlerDumpList(context, args) {
    return (0, handleRuntimeListDumps_1.handleRuntimeListDumps)(context, args);
}
//# sourceMappingURL=handleHandlerDumpList.js.map