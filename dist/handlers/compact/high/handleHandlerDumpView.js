"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerDumpView = handleHandlerDumpView;
const handleRuntimeGetDumpById_1 = require("../../system/readonly/handleRuntimeGetDumpById");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerDumpView',
    available_in: ['onprem'],
    description: 'Runtime dump view. object_type: not used. Required: dump_id*. Optional: view(default|summary|formatted). Response: JSON.',
    inputSchema: compactSchemas_1.compactDumpViewSchema,
};
async function handleHandlerDumpView(context, args) {
    return (0, handleRuntimeGetDumpById_1.handleRuntimeGetDumpById)(context, args);
}
//# sourceMappingURL=handleHandlerDumpView.js.map