"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighLevelHandlersGroup = void 0;
const handleCreateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/high/handleCreateBehaviorDefinition");
const handleDeleteBehaviorDefinition_1 = require("../../../handlers/behavior_definition/high/handleDeleteBehaviorDefinition");
const handleGetBehaviorDefinition_1 = require("../../../handlers/behavior_definition/high/handleGetBehaviorDefinition");
const handleUpdateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/high/handleUpdateBehaviorDefinition");
const handleCreateBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/high/handleCreateBehaviorImplementation");
const handleDeleteBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/high/handleDeleteBehaviorImplementation");
const handleGetBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/high/handleGetBehaviorImplementation");
const handleUpdateBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/high/handleUpdateBehaviorImplementation");
const handleCreateClass_1 = require("../../../handlers/class/high/handleCreateClass");
const handleDeleteClass_1 = require("../../../handlers/class/high/handleDeleteClass");
const handleDeleteLocalDefinitions_1 = require("../../../handlers/class/high/handleDeleteLocalDefinitions");
const handleDeleteLocalMacros_1 = require("../../../handlers/class/high/handleDeleteLocalMacros");
const handleDeleteLocalTestClass_1 = require("../../../handlers/class/high/handleDeleteLocalTestClass");
const handleDeleteLocalTypes_1 = require("../../../handlers/class/high/handleDeleteLocalTypes");
const handleGetClass_1 = require("../../../handlers/class/high/handleGetClass");
const handleGetLocalDefinitions_1 = require("../../../handlers/class/high/handleGetLocalDefinitions");
const handleGetLocalMacros_1 = require("../../../handlers/class/high/handleGetLocalMacros");
const handleGetLocalTestClass_1 = require("../../../handlers/class/high/handleGetLocalTestClass");
const handleGetLocalTypes_1 = require("../../../handlers/class/high/handleGetLocalTypes");
const handleUpdateClass_1 = require("../../../handlers/class/high/handleUpdateClass");
const handleUpdateLocalDefinitions_1 = require("../../../handlers/class/high/handleUpdateLocalDefinitions");
const handleUpdateLocalMacros_1 = require("../../../handlers/class/high/handleUpdateLocalMacros");
const handleUpdateLocalTestClass_1 = require("../../../handlers/class/high/handleUpdateLocalTestClass");
const handleUpdateLocalTypes_1 = require("../../../handlers/class/high/handleUpdateLocalTypes");
const handleCreateDataElement_1 = require("../../../handlers/data_element/high/handleCreateDataElement");
const handleDeleteDataElement_1 = require("../../../handlers/data_element/high/handleDeleteDataElement");
const handleGetDataElement_1 = require("../../../handlers/data_element/high/handleGetDataElement");
const handleUpdateDataElement_1 = require("../../../handlers/data_element/high/handleUpdateDataElement");
const handleCreateMetadataExtension_1 = require("../../../handlers/ddlx/high/handleCreateMetadataExtension");
const handleUpdateMetadataExtension_1 = require("../../../handlers/ddlx/high/handleUpdateMetadataExtension");
const handleCreateDomain_1 = require("../../../handlers/domain/high/handleCreateDomain");
const handleDeleteDomain_1 = require("../../../handlers/domain/high/handleDeleteDomain");
const handleGetDomain_1 = require("../../../handlers/domain/high/handleGetDomain");
const handleUpdateDomain_1 = require("../../../handlers/domain/high/handleUpdateDomain");
const handleCreateFunctionGroup_1 = require("../../../handlers/function/high/handleCreateFunctionGroup");
const handleCreateFunctionModule_1 = require("../../../handlers/function/high/handleCreateFunctionModule");
const handleUpdateFunctionGroup_1 = require("../../../handlers/function/high/handleUpdateFunctionGroup");
const handleUpdateFunctionModule_1 = require("../../../handlers/function/high/handleUpdateFunctionModule");
const handleDeleteFunctionGroup_1 = require("../../../handlers/function_group/high/handleDeleteFunctionGroup");
const handleGetFunctionGroup_1 = require("../../../handlers/function_group/high/handleGetFunctionGroup");
const handleDeleteFunctionModule_1 = require("../../../handlers/function_module/high/handleDeleteFunctionModule");
const handleGetFunctionModule_1 = require("../../../handlers/function_module/high/handleGetFunctionModule");
// Import high-level handlers - GUI Status
const handleCreateGuiStatus_1 = require("../../../handlers/gui_status/high/handleCreateGuiStatus");
const handleDeleteGuiStatus_1 = require("../../../handlers/gui_status/high/handleDeleteGuiStatus");
const handleGetGuiStatus_1 = require("../../../handlers/gui_status/high/handleGetGuiStatus");
const handleUpdateGuiStatus_1 = require("../../../handlers/gui_status/high/handleUpdateGuiStatus");
const handleCreateInclude_1 = require("../../../handlers/include/high/handleCreateInclude");
const handleDeleteInclude_1 = require("../../../handlers/include/high/handleDeleteInclude");
const handleUpdateInclude_1 = require("../../../handlers/include/high/handleUpdateInclude");
const handleCreateInterface_1 = require("../../../handlers/interface/high/handleCreateInterface");
const handleDeleteInterface_1 = require("../../../handlers/interface/high/handleDeleteInterface");
const handleGetInterface_1 = require("../../../handlers/interface/high/handleGetInterface");
const handleUpdateInterface_1 = require("../../../handlers/interface/high/handleUpdateInterface");
const handleDeleteMetadataExtension_1 = require("../../../handlers/metadata_extension/high/handleDeleteMetadataExtension");
const handleGetMetadataExtension_1 = require("../../../handlers/metadata_extension/high/handleGetMetadataExtension");
// Import high-level handlers
// Import TOOL_DEFINITION from handlers
const handleCreatePackage_1 = require("../../../handlers/package/high/handleCreatePackage");
const handleGetPackage_1 = require("../../../handlers/package/high/handleGetPackage");
const handleCreateProgram_1 = require("../../../handlers/program/high/handleCreateProgram");
const handleDeleteProgram_1 = require("../../../handlers/program/high/handleDeleteProgram");
const handleGetProgram_1 = require("../../../handlers/program/high/handleGetProgram");
const handleUpdateProgram_1 = require("../../../handlers/program/high/handleUpdateProgram");
// Import high-level handlers - Screen (Dynpro)
const handleCreateScreen_1 = require("../../../handlers/screen/high/handleCreateScreen");
const handleDeleteScreen_1 = require("../../../handlers/screen/high/handleDeleteScreen");
const handleGetScreen_1 = require("../../../handlers/screen/high/handleGetScreen");
const handleUpdateScreen_1 = require("../../../handlers/screen/high/handleUpdateScreen");
const handleCreateServiceBinding_1 = require("../../../handlers/service_binding/high/handleCreateServiceBinding");
const handleDeleteServiceBinding_1 = require("../../../handlers/service_binding/high/handleDeleteServiceBinding");
const handleGetServiceBinding_1 = require("../../../handlers/service_binding/high/handleGetServiceBinding");
const handleListServiceBindingTypes_1 = require("../../../handlers/service_binding/high/handleListServiceBindingTypes");
const handleUpdateServiceBinding_1 = require("../../../handlers/service_binding/high/handleUpdateServiceBinding");
const handleValidateServiceBinding_1 = require("../../../handlers/service_binding/high/handleValidateServiceBinding");
const handleCreateServiceDefinition_1 = require("../../../handlers/service_definition/high/handleCreateServiceDefinition");
const handleDeleteServiceDefinition_1 = require("../../../handlers/service_definition/high/handleDeleteServiceDefinition");
const handleGetServiceDefinition_1 = require("../../../handlers/service_definition/high/handleGetServiceDefinition");
const handleUpdateServiceDefinition_1 = require("../../../handlers/service_definition/high/handleUpdateServiceDefinition");
const handleCreateStructure_1 = require("../../../handlers/structure/high/handleCreateStructure");
const handleDeleteStructure_1 = require("../../../handlers/structure/high/handleDeleteStructure");
const handleGetStructure_1 = require("../../../handlers/structure/high/handleGetStructure");
const handleUpdateStructure_1 = require("../../../handlers/structure/high/handleUpdateStructure");
const handleCreateTable_1 = require("../../../handlers/table/high/handleCreateTable");
const handleDeleteTable_1 = require("../../../handlers/table/high/handleDeleteTable");
const handleGetTable_1 = require("../../../handlers/table/high/handleGetTable");
const handleUpdateTable_1 = require("../../../handlers/table/high/handleUpdateTable");
// Import high-level handlers - Text Element (TEXTPOOL)
const handleCreateTextElement_1 = require("../../../handlers/text_element/high/handleCreateTextElement");
const handleDeleteTextElement_1 = require("../../../handlers/text_element/high/handleDeleteTextElement");
const handleGetTextElement_1 = require("../../../handlers/text_element/high/handleGetTextElement");
const handleUpdateTextElement_1 = require("../../../handlers/text_element/high/handleUpdateTextElement");
const handleCreateTransport_1 = require("../../../handlers/transport/high/handleCreateTransport");
const handleCreateCdsUnitTest_1 = require("../../../handlers/unit_test/high/handleCreateCdsUnitTest");
const handleCreateUnitTest_1 = require("../../../handlers/unit_test/high/handleCreateUnitTest");
const handleDeleteCdsUnitTest_1 = require("../../../handlers/unit_test/high/handleDeleteCdsUnitTest");
const handleDeleteUnitTest_1 = require("../../../handlers/unit_test/high/handleDeleteUnitTest");
const handleGetCdsUnitTest_1 = require("../../../handlers/unit_test/high/handleGetCdsUnitTest");
const handleGetCdsUnitTestResult_1 = require("../../../handlers/unit_test/high/handleGetCdsUnitTestResult");
const handleGetCdsUnitTestStatus_1 = require("../../../handlers/unit_test/high/handleGetCdsUnitTestStatus");
const handleGetUnitTest_1 = require("../../../handlers/unit_test/high/handleGetUnitTest");
const handleGetUnitTestResult_1 = require("../../../handlers/unit_test/high/handleGetUnitTestResult");
const handleGetUnitTestStatus_1 = require("../../../handlers/unit_test/high/handleGetUnitTestStatus");
const handleRunUnitTest_1 = require("../../../handlers/unit_test/high/handleRunUnitTest");
const handleUpdateCdsUnitTest_1 = require("../../../handlers/unit_test/high/handleUpdateCdsUnitTest");
const handleUpdateUnitTest_1 = require("../../../handlers/unit_test/high/handleUpdateUnitTest");
const handleCreateView_1 = require("../../../handlers/view/high/handleCreateView");
const handleDeleteView_1 = require("../../../handlers/view/high/handleDeleteView");
const handleGetView_1 = require("../../../handlers/view/high/handleGetView");
const handleUpdateView_1 = require("../../../handlers/view/high/handleUpdateView");
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
/**
 * Handler group for all high-level handlers
 * Contains handlers that perform CRUD operations using high-level APIs
 */
class HighLevelHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'HighLevelHandlers';
    /**
     * Gets all high-level handler entries
     */
    getHandlers() {
        const withContext = (handler) => {
            return (args) => handler(this.context, args);
        };
        return [
            {
                toolDefinition: handleCreatePackage_1.TOOL_DEFINITION,
                handler: withContext(handleCreatePackage_1.handleCreatePackage),
            },
            {
                toolDefinition: handleGetPackage_1.TOOL_DEFINITION,
                handler: withContext(handleGetPackage_1.handleGetPackage),
            },
            {
                toolDefinition: handleCreateDomain_1.TOOL_DEFINITION,
                handler: withContext(handleCreateDomain_1.handleCreateDomain),
            },
            {
                toolDefinition: handleGetDomain_1.TOOL_DEFINITION,
                handler: withContext(handleGetDomain_1.handleGetDomain),
            },
            {
                toolDefinition: handleUpdateDomain_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateDomain_1.handleUpdateDomain),
            },
            {
                toolDefinition: handleDeleteDomain_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteDomain_1.handleDeleteDomain),
            },
            {
                toolDefinition: handleCreateDataElement_1.TOOL_DEFINITION,
                handler: withContext(handleCreateDataElement_1.handleCreateDataElement),
            },
            {
                toolDefinition: handleGetDataElement_1.TOOL_DEFINITION,
                handler: withContext(handleGetDataElement_1.handleGetDataElement),
            },
            {
                toolDefinition: handleUpdateDataElement_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateDataElement_1.handleUpdateDataElement),
            },
            {
                toolDefinition: handleDeleteDataElement_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteDataElement_1.handleDeleteDataElement),
            },
            {
                toolDefinition: handleCreateTransport_1.TOOL_DEFINITION,
                handler: withContext(handleCreateTransport_1.handleCreateTransport),
            },
            {
                toolDefinition: handleCreateTable_1.TOOL_DEFINITION,
                handler: withContext(handleCreateTable_1.handleCreateTable),
            },
            {
                toolDefinition: handleGetTable_1.TOOL_DEFINITION,
                handler: withContext(handleGetTable_1.handleGetTable),
            },
            {
                toolDefinition: handleUpdateTable_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateTable_1.handleUpdateTable),
            },
            {
                toolDefinition: handleDeleteTable_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteTable_1.handleDeleteTable),
            },
            {
                toolDefinition: handleCreateStructure_1.TOOL_DEFINITION,
                handler: withContext(handleCreateStructure_1.handleCreateStructure),
            },
            {
                toolDefinition: handleGetStructure_1.TOOL_DEFINITION,
                handler: withContext(handleGetStructure_1.handleGetStructure),
            },
            {
                toolDefinition: handleUpdateStructure_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateStructure_1.handleUpdateStructure),
            },
            {
                toolDefinition: handleDeleteStructure_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteStructure_1.handleDeleteStructure),
            },
            {
                toolDefinition: handleCreateView_1.TOOL_DEFINITION,
                handler: withContext(handleCreateView_1.handleCreateView),
            },
            {
                toolDefinition: handleGetView_1.TOOL_DEFINITION,
                handler: withContext(handleGetView_1.handleGetView),
            },
            {
                toolDefinition: handleUpdateView_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateView_1.handleUpdateView),
            },
            {
                toolDefinition: handleDeleteView_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteView_1.handleDeleteView),
            },
            {
                toolDefinition: handleCreateServiceDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleCreateServiceDefinition_1.handleCreateServiceDefinition),
            },
            {
                toolDefinition: handleGetServiceDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleGetServiceDefinition_1.handleGetServiceDefinition),
            },
            {
                toolDefinition: handleUpdateServiceDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateServiceDefinition_1.handleUpdateServiceDefinition),
            },
            {
                toolDefinition: handleDeleteServiceDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteServiceDefinition_1.handleDeleteServiceDefinition),
            },
            {
                toolDefinition: handleCreateServiceBinding_1.TOOL_DEFINITION,
                handler: withContext(handleCreateServiceBinding_1.handleCreateServiceBinding),
            },
            {
                toolDefinition: handleListServiceBindingTypes_1.TOOL_DEFINITION,
                handler: withContext(handleListServiceBindingTypes_1.handleListServiceBindingTypes),
            },
            {
                toolDefinition: handleGetServiceBinding_1.TOOL_DEFINITION,
                handler: withContext(handleGetServiceBinding_1.handleGetServiceBinding),
            },
            {
                toolDefinition: handleUpdateServiceBinding_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateServiceBinding_1.handleUpdateServiceBinding),
            },
            {
                toolDefinition: handleValidateServiceBinding_1.TOOL_DEFINITION,
                handler: withContext(handleValidateServiceBinding_1.handleValidateServiceBinding),
            },
            {
                toolDefinition: handleDeleteServiceBinding_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteServiceBinding_1.handleDeleteServiceBinding),
            },
            {
                toolDefinition: handleGetClass_1.TOOL_DEFINITION,
                handler: withContext(handleGetClass_1.handleGetClass),
            },
            {
                toolDefinition: handleCreateClass_1.TOOL_DEFINITION,
                handler: withContext(handleCreateClass_1.handleCreateClass),
            },
            {
                toolDefinition: handleUpdateClass_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateClass_1.handleUpdateClass),
            },
            {
                toolDefinition: handleDeleteClass_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteClass_1.handleDeleteClass),
            },
            {
                toolDefinition: handleCreateUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleCreateUnitTest_1.handleCreateUnitTest),
            },
            {
                toolDefinition: handleRunUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleRunUnitTest_1.handleRunUnitTest),
            },
            {
                toolDefinition: handleGetUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleGetUnitTest_1.handleGetUnitTest),
            },
            {
                toolDefinition: handleGetUnitTestStatus_1.TOOL_DEFINITION,
                handler: withContext(handleGetUnitTestStatus_1.handleGetUnitTestStatus),
            },
            {
                toolDefinition: handleGetUnitTestResult_1.TOOL_DEFINITION,
                handler: withContext(handleGetUnitTestResult_1.handleGetUnitTestResult),
            },
            {
                toolDefinition: handleUpdateUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateUnitTest_1.handleUpdateUnitTest),
            },
            {
                toolDefinition: handleDeleteUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteUnitTest_1.handleDeleteUnitTest),
            },
            {
                toolDefinition: handleCreateCdsUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleCreateCdsUnitTest_1.handleCreateCdsUnitTest),
            },
            {
                toolDefinition: handleGetCdsUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleGetCdsUnitTest_1.handleGetCdsUnitTest),
            },
            {
                toolDefinition: handleGetCdsUnitTestStatus_1.TOOL_DEFINITION,
                handler: withContext(handleGetCdsUnitTestStatus_1.handleGetCdsUnitTestStatus),
            },
            {
                toolDefinition: handleGetCdsUnitTestResult_1.TOOL_DEFINITION,
                handler: withContext(handleGetCdsUnitTestResult_1.handleGetCdsUnitTestResult),
            },
            {
                toolDefinition: handleUpdateCdsUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateCdsUnitTest_1.handleUpdateCdsUnitTest),
            },
            {
                toolDefinition: handleDeleteCdsUnitTest_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteCdsUnitTest_1.handleDeleteCdsUnitTest),
            },
            {
                toolDefinition: handleGetLocalTestClass_1.TOOL_DEFINITION,
                handler: withContext(handleGetLocalTestClass_1.handleGetLocalTestClass),
            },
            {
                toolDefinition: handleUpdateLocalTestClass_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateLocalTestClass_1.handleUpdateLocalTestClass),
            },
            {
                toolDefinition: handleDeleteLocalTestClass_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteLocalTestClass_1.handleDeleteLocalTestClass),
            },
            {
                toolDefinition: handleGetLocalTypes_1.TOOL_DEFINITION,
                handler: withContext(handleGetLocalTypes_1.handleGetLocalTypes),
            },
            {
                toolDefinition: handleUpdateLocalTypes_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateLocalTypes_1.handleUpdateLocalTypes),
            },
            {
                toolDefinition: handleDeleteLocalTypes_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteLocalTypes_1.handleDeleteLocalTypes),
            },
            {
                toolDefinition: handleGetLocalDefinitions_1.TOOL_DEFINITION,
                handler: withContext(handleGetLocalDefinitions_1.handleGetLocalDefinitions),
            },
            {
                toolDefinition: handleUpdateLocalDefinitions_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateLocalDefinitions_1.handleUpdateLocalDefinitions),
            },
            {
                toolDefinition: handleDeleteLocalDefinitions_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteLocalDefinitions_1.handleDeleteLocalDefinitions),
            },
            {
                toolDefinition: handleGetLocalMacros_1.TOOL_DEFINITION,
                handler: withContext(handleGetLocalMacros_1.handleGetLocalMacros),
            },
            {
                toolDefinition: handleUpdateLocalMacros_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateLocalMacros_1.handleUpdateLocalMacros),
            },
            {
                toolDefinition: handleDeleteLocalMacros_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteLocalMacros_1.handleDeleteLocalMacros),
            },
            {
                toolDefinition: handleCreateInclude_1.TOOL_DEFINITION,
                handler: withContext(handleCreateInclude_1.handleCreateInclude),
            },
            {
                toolDefinition: handleUpdateInclude_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateInclude_1.handleUpdateInclude),
            },
            {
                toolDefinition: handleDeleteInclude_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteInclude_1.handleDeleteInclude),
            },
            {
                toolDefinition: handleCreateProgram_1.TOOL_DEFINITION,
                handler: withContext(handleCreateProgram_1.handleCreateProgram),
            },
            {
                toolDefinition: handleGetProgram_1.TOOL_DEFINITION,
                handler: withContext(handleGetProgram_1.handleGetProgram),
            },
            {
                toolDefinition: handleUpdateProgram_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateProgram_1.handleUpdateProgram),
            },
            {
                toolDefinition: handleDeleteProgram_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteProgram_1.handleDeleteProgram),
            },
            {
                toolDefinition: handleCreateInterface_1.TOOL_DEFINITION,
                handler: withContext(handleCreateInterface_1.handleCreateInterface),
            },
            {
                toolDefinition: handleGetInterface_1.TOOL_DEFINITION,
                handler: withContext(handleGetInterface_1.handleGetInterface),
            },
            {
                toolDefinition: handleUpdateInterface_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateInterface_1.handleUpdateInterface),
            },
            {
                toolDefinition: handleDeleteInterface_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteInterface_1.handleDeleteInterface),
            },
            {
                toolDefinition: handleCreateFunctionGroup_1.TOOL_DEFINITION,
                handler: withContext(handleCreateFunctionGroup_1.handleCreateFunctionGroup),
            },
            {
                toolDefinition: handleGetFunctionGroup_1.TOOL_DEFINITION,
                handler: withContext(handleGetFunctionGroup_1.handleGetFunctionGroup),
            },
            {
                toolDefinition: handleUpdateFunctionGroup_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateFunctionGroup_1.handleUpdateFunctionGroup),
            },
            {
                toolDefinition: handleDeleteFunctionGroup_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteFunctionGroup_1.handleDeleteFunctionGroup),
            },
            {
                toolDefinition: handleCreateFunctionModule_1.TOOL_DEFINITION,
                handler: withContext(handleCreateFunctionModule_1.handleCreateFunctionModule),
            },
            {
                toolDefinition: handleGetFunctionModule_1.TOOL_DEFINITION,
                handler: withContext(handleGetFunctionModule_1.handleGetFunctionModule),
            },
            {
                toolDefinition: handleUpdateFunctionModule_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateFunctionModule_1.handleUpdateFunctionModule),
            },
            {
                toolDefinition: handleDeleteFunctionModule_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteFunctionModule_1.handleDeleteFunctionModule),
            },
            {
                toolDefinition: handleCreateBehaviorDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleCreateBehaviorDefinition_1.handleCreateBehaviorDefinition),
            },
            {
                toolDefinition: handleGetBehaviorDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleGetBehaviorDefinition_1.handleGetBehaviorDefinition),
            },
            {
                toolDefinition: handleUpdateBehaviorDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateBehaviorDefinition_1.handleUpdateBehaviorDefinition),
            },
            {
                toolDefinition: handleDeleteBehaviorDefinition_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteBehaviorDefinition_1.handleDeleteBehaviorDefinition),
            },
            {
                toolDefinition: handleCreateBehaviorImplementation_1.TOOL_DEFINITION,
                handler: withContext(handleCreateBehaviorImplementation_1.handleCreateBehaviorImplementation),
            },
            {
                toolDefinition: handleGetBehaviorImplementation_1.TOOL_DEFINITION,
                handler: withContext(handleGetBehaviorImplementation_1.handleGetBehaviorImplementation),
            },
            {
                toolDefinition: handleUpdateBehaviorImplementation_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateBehaviorImplementation_1.handleUpdateBehaviorImplementation),
            },
            {
                toolDefinition: handleDeleteBehaviorImplementation_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteBehaviorImplementation_1.handleDeleteBehaviorImplementation),
            },
            {
                toolDefinition: handleCreateMetadataExtension_1.TOOL_DEFINITION,
                handler: withContext(handleCreateMetadataExtension_1.handleCreateMetadataExtension),
            },
            {
                toolDefinition: handleGetMetadataExtension_1.TOOL_DEFINITION,
                handler: withContext(handleGetMetadataExtension_1.handleGetMetadataExtension),
            },
            {
                toolDefinition: handleUpdateMetadataExtension_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateMetadataExtension_1.handleUpdateMetadataExtension),
            },
            {
                toolDefinition: handleDeleteMetadataExtension_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteMetadataExtension_1.handleDeleteMetadataExtension),
            },
            // Screen (Dynpro) high-level handlers
            {
                toolDefinition: handleCreateScreen_1.TOOL_DEFINITION,
                handler: withContext(handleCreateScreen_1.handleCreateScreen),
            },
            {
                toolDefinition: handleGetScreen_1.TOOL_DEFINITION,
                handler: withContext(handleGetScreen_1.handleGetScreen),
            },
            {
                toolDefinition: handleUpdateScreen_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateScreen_1.handleUpdateScreen),
            },
            {
                toolDefinition: handleDeleteScreen_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteScreen_1.handleDeleteScreen),
            },
            // GUI Status high-level handlers
            {
                toolDefinition: handleCreateGuiStatus_1.TOOL_DEFINITION,
                handler: withContext(handleCreateGuiStatus_1.handleCreateGuiStatus),
            },
            {
                toolDefinition: handleGetGuiStatus_1.TOOL_DEFINITION,
                handler: withContext(handleGetGuiStatus_1.handleGetGuiStatus),
            },
            {
                toolDefinition: handleUpdateGuiStatus_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateGuiStatus_1.handleUpdateGuiStatus),
            },
            {
                toolDefinition: handleDeleteGuiStatus_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteGuiStatus_1.handleDeleteGuiStatus),
            },
            // Text Element (TEXTPOOL) high-level handlers
            {
                toolDefinition: handleGetTextElement_1.TOOL_DEFINITION,
                handler: withContext(handleGetTextElement_1.handleGetTextElement),
            },
            {
                toolDefinition: handleCreateTextElement_1.TOOL_DEFINITION,
                handler: withContext(handleCreateTextElement_1.handleCreateTextElement),
            },
            {
                toolDefinition: handleUpdateTextElement_1.TOOL_DEFINITION,
                handler: withContext(handleUpdateTextElement_1.handleUpdateTextElement),
            },
            {
                toolDefinition: handleDeleteTextElement_1.TOOL_DEFINITION,
                handler: withContext(handleDeleteTextElement_1.handleDeleteTextElement),
            },
        ];
    }
}
exports.HighLevelHandlersGroup = HighLevelHandlersGroup;
//# sourceMappingURL=HighLevelHandlersGroup.js.map