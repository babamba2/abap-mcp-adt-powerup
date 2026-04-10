"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerServiceBindingValidate = handleHandlerServiceBindingValidate;
const handleValidateServiceBinding_1 = require("../../service_binding/high/handleValidateServiceBinding");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerServiceBindingValidate',
    available_in: ['onprem', 'cloud'],
    description: 'Service binding validate before create. object_type: not used. Required: service_binding_name*, service_definition_name*. Optional: service_binding_version, package_name, description. Response: JSON.',
    inputSchema: compactSchemas_1.compactServiceBindingValidateSchema,
};
async function handleHandlerServiceBindingValidate(context, args) {
    return (0, handleValidateServiceBinding_1.handleValidateServiceBinding)(context, args);
}
//# sourceMappingURL=handleHandlerServiceBindingValidate.js.map