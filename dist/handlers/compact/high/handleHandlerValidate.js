"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerValidate = handleHandlerValidate;
const handleValidateObject_1 = require("../../common/low/handleValidateObject");
const handleValidateServiceBinding_1 = require("../../service_binding/high/handleValidateServiceBinding");
const compactLifecycleUtils_1 = require("./compactLifecycleUtils");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerValidate',
    available_in: ['onprem', 'cloud'],
    description: 'Validate before create only. object_type required: CLASS(object_name*), PROGRAM(object_name*), INTERFACE(object_name*), FUNCTION_GROUP(object_name*), FUNCTION_MODULE(object_name*), TABLE(object_name*), STRUCTURE(object_name*), VIEW(object_name*), DOMAIN(object_name*), DATA_ELEMENT(object_name*), PACKAGE(object_name*), BEHAVIOR_DEFINITION(object_name*), BEHAVIOR_IMPLEMENTATION(object_name*), METADATA_EXTENSION(object_name*), SERVICE_BINDING(object_name*=service_binding_name*, service_definition_name*).',
    inputSchema: compactSchemas_1.compactValidateSchema,
};
async function handleHandlerValidate(context, args) {
    if (args.object_type === 'SERVICE_BINDING') {
        return (0, handleValidateServiceBinding_1.handleValidateServiceBinding)(context, {
            service_binding_name: args.object_name,
            service_definition_name: args.service_definition_name,
            service_binding_version: args.service_binding_version,
            package_name: args.package_name,
            description: args.description,
        });
    }
    const lowType = (0, compactLifecycleUtils_1.toLowObjectType)(args.object_type);
    if (!lowType) {
        throw new Error(`Validate is not supported for object_type: ${args.object_type}`);
    }
    return (0, handleValidateObject_1.handleValidateObject)(context, {
        object_name: args.object_name,
        object_type: lowType,
        package_name: args.package_name,
        description: args.description,
        behavior_definition: args.behavior_definition,
        root_entity: args.root_entity,
        implementation_type: args.implementation_type,
        session_id: args.session_id,
        session_state: args.session_state,
    });
}
//# sourceMappingURL=handleHandlerValidate.js.map