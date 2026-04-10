"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerTransportCreate = handleHandlerTransportCreate;
const handleCreateTransport_1 = require("../../transport/high/handleCreateTransport");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerTransportCreate',
    available_in: ['onprem', 'cloud'],
    description: 'Transport create. object_type: not used. Required: description*. Optional: transport_type(workbench|customizing), target_system, owner. Response: JSON.',
    inputSchema: compactSchemas_1.compactTransportCreateSchema,
};
async function handleHandlerTransportCreate(context, args) {
    return (0, handleCreateTransport_1.handleCreateTransport)(context, args);
}
//# sourceMappingURL=handleHandlerTransportCreate.js.map