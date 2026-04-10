"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerProfileView = handleHandlerProfileView;
const handleRuntimeGetProfilerTraceData_1 = require("../../system/readonly/handleRuntimeGetProfilerTraceData");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerProfileView',
    available_in: ['onprem'],
    description: 'Runtime profiling view. object_type: not used. Required: trace_id_or_uri*, view*(hitlist|statements|db_accesses). Optional: with_system_events, id, with_details, auto_drill_down_threshold. Response: JSON.',
    inputSchema: compactSchemas_1.compactProfileViewSchema,
};
async function handleHandlerProfileView(context, args) {
    return (0, handleRuntimeGetProfilerTraceData_1.handleRuntimeGetProfilerTraceData)(context, args);
}
//# sourceMappingURL=handleHandlerProfileView.js.map