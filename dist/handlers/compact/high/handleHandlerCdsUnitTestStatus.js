"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerCdsUnitTestStatus = handleHandlerCdsUnitTestStatus;
const handleGetCdsUnitTestStatus_1 = require("../../unit_test/high/handleGetCdsUnitTestStatus");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerCdsUnitTestStatus',
    available_in: ['onprem', 'cloud'],
    description: 'CDS unit test status. object_type: not used. Required: run_id*. Optional: with_long_polling. Response: JSON.',
    inputSchema: compactSchemas_1.compactCdsUnitTestStatusSchema,
};
async function handleHandlerCdsUnitTestStatus(context, args) {
    return (0, handleGetCdsUnitTestStatus_1.handleGetCdsUnitTestStatus)(context, args);
}
//# sourceMappingURL=handleHandlerCdsUnitTestStatus.js.map