"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerUnitTestStatus = handleHandlerUnitTestStatus;
const handleGetUnitTestStatus_1 = require("../../unit_test/high/handleGetUnitTestStatus");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerUnitTestStatus',
    available_in: ['onprem', 'cloud'],
    description: 'ABAP Unit status. object_type: not used. Required: run_id*. Optional: with_long_polling. Response: JSON.',
    inputSchema: compactSchemas_1.compactUnitTestStatusSchema,
};
async function handleHandlerUnitTestStatus(context, args) {
    return (0, handleGetUnitTestStatus_1.handleGetUnitTestStatus)(context, args);
}
//# sourceMappingURL=handleHandlerUnitTestStatus.js.map