"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerUnitTestRun = handleHandlerUnitTestRun;
const handleRunUnitTest_1 = require("../../unit_test/high/handleRunUnitTest");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerUnitTestRun',
    available_in: ['onprem', 'cloud'],
    description: 'ABAP Unit run. object_type: not used. Required: tests[]{container_class*, test_class*}. Optional: title, context, scope, risk_level, duration. Response: JSON.',
    inputSchema: compactSchemas_1.compactUnitTestRunSchema,
};
async function handleHandlerUnitTestRun(context, args) {
    return (0, handleRunUnitTest_1.handleRunUnitTest)(context, args);
}
//# sourceMappingURL=handleHandlerUnitTestRun.js.map