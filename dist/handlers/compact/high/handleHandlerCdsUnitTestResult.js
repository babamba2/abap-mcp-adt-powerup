"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerCdsUnitTestResult = handleHandlerCdsUnitTestResult;
const handleGetCdsUnitTestResult_1 = require("../../unit_test/high/handleGetCdsUnitTestResult");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerCdsUnitTestResult',
    available_in: ['onprem', 'cloud'],
    description: 'CDS unit test result. object_type: not used. Required: run_id*. Optional: with_navigation_uris, format(abapunit|junit). Response: JSON.',
    inputSchema: compactSchemas_1.compactCdsUnitTestResultSchema,
};
async function handleHandlerCdsUnitTestResult(context, args) {
    return (0, handleGetCdsUnitTestResult_1.handleGetCdsUnitTestResult)(context, args);
}
//# sourceMappingURL=handleHandlerCdsUnitTestResult.js.map