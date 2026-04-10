"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerCheckRun = handleHandlerCheckRun;
const handleCheckObject_1 = require("../../common/low/handleCheckObject");
const compactLifecycleUtils_1 = require("./compactLifecycleUtils");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerCheckRun',
    available_in: ['onprem', 'cloud'],
    description: 'CheckRun operation (syntax, no activation). object_type required: CLASS(object_name*), PROGRAM(object_name*), INTERFACE(object_name*), FUNCTION_GROUP(object_name*), FUNCTION_MODULE(object_name*), TABLE(object_name*), STRUCTURE(object_name*), VIEW(object_name*), DOMAIN(object_name*), DATA_ELEMENT(object_name*), PACKAGE(object_name*), BEHAVIOR_DEFINITION(object_name*), BEHAVIOR_IMPLEMENTATION(object_name*), METADATA_EXTENSION(object_name*).',
    inputSchema: compactSchemas_1.compactCheckRunSchema,
};
async function handleHandlerCheckRun(context, args) {
    const lowType = (0, compactLifecycleUtils_1.toLowObjectType)(args.object_type);
    if (!lowType) {
        throw new Error(`CheckRun is not supported for object_type: ${args.object_type}`);
    }
    return (0, handleCheckObject_1.handleCheckObject)(context, {
        object_name: args.object_name,
        object_type: lowType,
        version: args.version,
        session_id: args.session_id,
        session_state: args.session_state,
    });
}
//# sourceMappingURL=handleHandlerCheckRun.js.map