"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerActivate = handleHandlerActivate;
const handleActivateObject_1 = require("../../common/low/handleActivateObject");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerActivate',
    available_in: ['onprem', 'cloud'],
    description: 'Activate operation. Single mode(object_name*, object_adt_type*). Batch mode(objects[].name*, objects[].type*).',
    inputSchema: compactSchemas_1.compactActivateSchema,
};
async function handleHandlerActivate(context, args) {
    if (args.objects && args.objects.length > 0) {
        return (0, handleActivateObject_1.handleActivateObject)(context, {
            objects: args.objects,
            preaudit: args.preaudit,
        });
    }
    if (!args.object_name || !args.object_adt_type) {
        throw new Error('Provide either objects[] or object_name + object_adt_type for activation');
    }
    return (0, handleActivateObject_1.handleActivateObject)(context, {
        objects: [{ name: args.object_name, type: args.object_adt_type }],
        preaudit: args.preaudit,
    });
}
//# sourceMappingURL=handleHandlerActivate.js.map