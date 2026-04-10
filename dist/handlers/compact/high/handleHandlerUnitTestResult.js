"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerUnitTestResult = handleHandlerUnitTestResult;
const handleGetUnitTestResult_1 = require("../../unit_test/high/handleGetUnitTestResult");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerUnitTestResult',
    available_in: ['onprem', 'cloud'],
    description: 'ABAP Unit result. object_type: not used. Required: run_id*. Optional: with_navigation_uris, format(abapunit|junit). Response: JSON.',
    inputSchema: compactSchemas_1.compactUnitTestResultSchema,
};
async function handleHandlerUnitTestResult(context, args) {
    return (0, handleGetUnitTestResult_1.handleGetUnitTestResult)(context, args);
}
//# sourceMappingURL=handleHandlerUnitTestResult.js.map