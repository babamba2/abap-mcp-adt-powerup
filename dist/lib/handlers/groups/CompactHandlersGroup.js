"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompactHandlersGroup = void 0;
const handleHandlerActivate_1 = require("../../../handlers/compact/high/handleHandlerActivate");
const handleHandlerCdsUnitTestResult_1 = require("../../../handlers/compact/high/handleHandlerCdsUnitTestResult");
const handleHandlerCdsUnitTestStatus_1 = require("../../../handlers/compact/high/handleHandlerCdsUnitTestStatus");
const handleHandlerCheckRun_1 = require("../../../handlers/compact/high/handleHandlerCheckRun");
const handleHandlerCreate_1 = require("../../../handlers/compact/high/handleHandlerCreate");
const handleHandlerDelete_1 = require("../../../handlers/compact/high/handleHandlerDelete");
const handleHandlerDumpList_1 = require("../../../handlers/compact/high/handleHandlerDumpList");
const handleHandlerDumpView_1 = require("../../../handlers/compact/high/handleHandlerDumpView");
const handleHandlerGet_1 = require("../../../handlers/compact/high/handleHandlerGet");
const handleHandlerLock_1 = require("../../../handlers/compact/high/handleHandlerLock");
const handleHandlerProfileList_1 = require("../../../handlers/compact/high/handleHandlerProfileList");
const handleHandlerProfileRun_1 = require("../../../handlers/compact/high/handleHandlerProfileRun");
const handleHandlerProfileView_1 = require("../../../handlers/compact/high/handleHandlerProfileView");
const handleHandlerServiceBindingListTypes_1 = require("../../../handlers/compact/high/handleHandlerServiceBindingListTypes");
const handleHandlerServiceBindingValidate_1 = require("../../../handlers/compact/high/handleHandlerServiceBindingValidate");
const handleHandlerTransportCreate_1 = require("../../../handlers/compact/high/handleHandlerTransportCreate");
const handleHandlerUnitTestResult_1 = require("../../../handlers/compact/high/handleHandlerUnitTestResult");
const handleHandlerUnitTestRun_1 = require("../../../handlers/compact/high/handleHandlerUnitTestRun");
const handleHandlerUnitTestStatus_1 = require("../../../handlers/compact/high/handleHandlerUnitTestStatus");
const handleHandlerUnlock_1 = require("../../../handlers/compact/high/handleHandlerUnlock");
const handleHandlerUpdate_1 = require("../../../handlers/compact/high/handleHandlerUpdate");
const handleHandlerValidate_1 = require("../../../handlers/compact/high/handleHandlerValidate");
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
/**
 * Handler group for compact facade handlers.
 * Provides unified CRUD router tools by object_type.
 */
class CompactHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'CompactHandlers';
    getHandlers() {
        const withContext = (handler) => {
            return (args) => handler(this.context, args);
        };
        return [
            {
                toolDefinition: handleHandlerValidate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerValidate_1.handleHandlerValidate),
            },
            {
                toolDefinition: handleHandlerActivate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerActivate_1.handleHandlerActivate),
            },
            {
                toolDefinition: handleHandlerLock_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerLock_1.handleHandlerLock),
            },
            {
                toolDefinition: handleHandlerUnlock_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerUnlock_1.handleHandlerUnlock),
            },
            {
                toolDefinition: handleHandlerCheckRun_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerCheckRun_1.handleHandlerCheckRun),
            },
            {
                toolDefinition: handleHandlerUnitTestRun_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerUnitTestRun_1.handleHandlerUnitTestRun),
            },
            {
                toolDefinition: handleHandlerUnitTestStatus_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerUnitTestStatus_1.handleHandlerUnitTestStatus),
            },
            {
                toolDefinition: handleHandlerUnitTestResult_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerUnitTestResult_1.handleHandlerUnitTestResult),
            },
            {
                toolDefinition: handleHandlerCdsUnitTestStatus_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerCdsUnitTestStatus_1.handleHandlerCdsUnitTestStatus),
            },
            {
                toolDefinition: handleHandlerCdsUnitTestResult_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerCdsUnitTestResult_1.handleHandlerCdsUnitTestResult),
            },
            {
                toolDefinition: handleHandlerProfileRun_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerProfileRun_1.handleHandlerProfileRun),
            },
            {
                toolDefinition: handleHandlerProfileList_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerProfileList_1.handleHandlerProfileList),
            },
            {
                toolDefinition: handleHandlerProfileView_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerProfileView_1.handleHandlerProfileView),
            },
            {
                toolDefinition: handleHandlerDumpList_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerDumpList_1.handleHandlerDumpList),
            },
            {
                toolDefinition: handleHandlerDumpView_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerDumpView_1.handleHandlerDumpView),
            },
            {
                toolDefinition: handleHandlerServiceBindingListTypes_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerServiceBindingListTypes_1.handleHandlerServiceBindingListTypes),
            },
            {
                toolDefinition: handleHandlerServiceBindingValidate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerServiceBindingValidate_1.handleHandlerServiceBindingValidate),
            },
            {
                toolDefinition: handleHandlerTransportCreate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerTransportCreate_1.handleHandlerTransportCreate),
            },
            {
                toolDefinition: handleHandlerCreate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerCreate_1.handleHandlerCreate),
            },
            {
                toolDefinition: handleHandlerGet_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerGet_1.handleHandlerGet),
            },
            {
                toolDefinition: handleHandlerUpdate_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerUpdate_1.handleHandlerUpdate),
            },
            {
                toolDefinition: handleHandlerDelete_1.TOOL_DEFINITION,
                handler: withContext(handleHandlerDelete_1.handleHandlerDelete),
            },
        ];
    }
}
exports.CompactHandlersGroup = CompactHandlersGroup;
//# sourceMappingURL=CompactHandlersGroup.js.map