"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerUnlock = handleHandlerUnlock;
const handleUnlockObject_1 = require("../../common/low/handleUnlockObject");
const compactLifecycleUtils_1 = require("./compactLifecycleUtils");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerUnlock',
    available_in: ['onprem', 'cloud'],
    description: 'Unlock operation. object_type required: CLASS(object_name*, lock_handle*, session_id*), PROGRAM(object_name*, lock_handle*, session_id*), INTERFACE(object_name*, lock_handle*, session_id*), FUNCTION_GROUP(object_name*, lock_handle*, session_id*), FUNCTION_MODULE(object_name*, lock_handle*, session_id*), TABLE(object_name*, lock_handle*, session_id*), STRUCTURE(object_name*, lock_handle*, session_id*), VIEW(object_name*, lock_handle*, session_id*), DOMAIN(object_name*, lock_handle*, session_id*), DATA_ELEMENT(object_name*, lock_handle*, session_id*), PACKAGE(object_name*, lock_handle*, session_id*), BEHAVIOR_DEFINITION(object_name*, lock_handle*, session_id*), BEHAVIOR_IMPLEMENTATION(object_name*, lock_handle*, session_id*), METADATA_EXTENSION(object_name*, lock_handle*, session_id*).',
    inputSchema: compactSchemas_1.compactUnlockSchema,
};
async function handleHandlerUnlock(context, args) {
    const lowType = (0, compactLifecycleUtils_1.toLowObjectType)(args.object_type);
    if (!lowType) {
        throw new Error(`Unlock is not supported for object_type: ${args.object_type}`);
    }
    return (0, handleUnlockObject_1.handleUnlockObject)(context, {
        object_name: args.object_name,
        object_type: lowType,
        lock_handle: args.lock_handle,
        session_id: args.session_id,
        session_state: args.session_state,
    });
}
//# sourceMappingURL=handleHandlerUnlock.js.map