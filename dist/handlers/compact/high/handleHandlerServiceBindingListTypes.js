"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerServiceBindingListTypes = handleHandlerServiceBindingListTypes;
const handleListServiceBindingTypes_1 = require("../../service_binding/high/handleListServiceBindingTypes");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerServiceBindingListTypes',
    available_in: ['onprem', 'cloud'],
    description: 'Service binding types list. object_type: not used. Required: none. Optional: response_format(xml|json|plain). Response: XML/JSON/plain by response_format.',
    inputSchema: compactSchemas_1.compactServiceBindingListTypesSchema,
};
async function handleHandlerServiceBindingListTypes(context, args) {
    return (0, handleListServiceBindingTypes_1.handleListServiceBindingTypes)(context, args);
}
//# sourceMappingURL=handleHandlerServiceBindingListTypes.js.map