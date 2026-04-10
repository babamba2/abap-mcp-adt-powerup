"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowLevelHandlersGroup = void 0;
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
// // Import common low-level handlers
// import { handleActivateObject } from "../../../handlers/common/low/handleActivateObject";
// import { handleDeleteObject } from "../../../handlers/common/low/handleDeleteObject";
// import { handleCheckObject } from "../../../handlers/common/low/handleCheckObject";
// import { handleValidateObject } from "../../../handlers/common/low/handleValidateObject";
// import { handleLockObject } from "../../../handlers/common/low/handleLockObject";
// import { handleUnlockObject } from "../../../handlers/common/low/handleUnlockObject";
const handleActivateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleActivateBehaviorDefinition");
// Import low-level handlers - BehaviorDefinition
const handleCheckBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleCheckBehaviorDefinition");
const handleCreateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleCreateBehaviorDefinition");
const handleDeleteBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleDeleteBehaviorDefinition");
const handleLockBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleLockBehaviorDefinition");
const handleUnlockBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleUnlockBehaviorDefinition");
const handleUpdateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleUpdateBehaviorDefinition");
const handleValidateBehaviorDefinition_1 = require("../../../handlers/behavior_definition/low/handleValidateBehaviorDefinition");
// Import low-level handlers - BehaviorImplementation
const handleCreateBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/low/handleCreateBehaviorImplementation");
const handleLockBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/low/handleLockBehaviorImplementation");
const handleValidateBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/low/handleValidateBehaviorImplementation");
const handleActivateClass_1 = require("../../../handlers/class/low/handleActivateClass");
const handleActivateClassTestClasses_1 = require("../../../handlers/class/low/handleActivateClassTestClasses");
const handleCheckClass_1 = require("../../../handlers/class/low/handleCheckClass");
const handleCreateClass_1 = require("../../../handlers/class/low/handleCreateClass");
const handleDeleteClass_1 = require("../../../handlers/class/low/handleDeleteClass");
const handleGetClassUnitTestResult_1 = require("../../../handlers/class/low/handleGetClassUnitTestResult");
const handleGetClassUnitTestStatus_1 = require("../../../handlers/class/low/handleGetClassUnitTestStatus");
const handleLockClass_1 = require("../../../handlers/class/low/handleLockClass");
const handleLockClassTestClasses_1 = require("../../../handlers/class/low/handleLockClassTestClasses");
const handleRunClassUnitTests_1 = require("../../../handlers/class/low/handleRunClassUnitTests");
const handleUnlockClass_1 = require("../../../handlers/class/low/handleUnlockClass");
const handleUnlockClassTestClasses_1 = require("../../../handlers/class/low/handleUnlockClassTestClasses");
// Import low-level handlers - Class
const handleUpdateClass_1 = require("../../../handlers/class/low/handleUpdateClass");
const handleUpdateClassTestClasses_1 = require("../../../handlers/class/low/handleUpdateClassTestClasses");
const handleValidateClass_1 = require("../../../handlers/class/low/handleValidateClass");
const handleActivateDataElement_1 = require("../../../handlers/data_element/low/handleActivateDataElement");
const handleCheckDataElement_1 = require("../../../handlers/data_element/low/handleCheckDataElement");
const handleCreateDataElement_1 = require("../../../handlers/data_element/low/handleCreateDataElement");
const handleDeleteDataElement_1 = require("../../../handlers/data_element/low/handleDeleteDataElement");
const handleLockDataElement_1 = require("../../../handlers/data_element/low/handleLockDataElement");
const handleUnlockDataElement_1 = require("../../../handlers/data_element/low/handleUnlockDataElement");
// Import low-level handlers - DataElement
const handleUpdateDataElement_1 = require("../../../handlers/data_element/low/handleUpdateDataElement");
const handleValidateDataElement_1 = require("../../../handlers/data_element/low/handleValidateDataElement");
const handleActivateMetadataExtension_1 = require("../../../handlers/ddlx/low/handleActivateMetadataExtension");
// Import low-level handlers - MetadataExtension (DDLX)
const handleCheckMetadataExtension_1 = require("../../../handlers/ddlx/low/handleCheckMetadataExtension");
const handleCreateMetadataExtension_1 = require("../../../handlers/ddlx/low/handleCreateMetadataExtension");
const handleDeleteMetadataExtension_1 = require("../../../handlers/ddlx/low/handleDeleteMetadataExtension");
const handleLockMetadataExtension_1 = require("../../../handlers/ddlx/low/handleLockMetadataExtension");
const handleUnlockMetadataExtension_1 = require("../../../handlers/ddlx/low/handleUnlockMetadataExtension");
const handleUpdateMetadataExtension_1 = require("../../../handlers/ddlx/low/handleUpdateMetadataExtension");
const handleValidateMetadataExtension_1 = require("../../../handlers/ddlx/low/handleValidateMetadataExtension");
const handleActivateDomain_1 = require("../../../handlers/domain/low/handleActivateDomain");
const handleCheckDomain_1 = require("../../../handlers/domain/low/handleCheckDomain");
const handleCreateDomain_1 = require("../../../handlers/domain/low/handleCreateDomain");
const handleDeleteDomain_1 = require("../../../handlers/domain/low/handleDeleteDomain");
const handleLockDomain_1 = require("../../../handlers/domain/low/handleLockDomain");
const handleUnlockDomain_1 = require("../../../handlers/domain/low/handleUnlockDomain");
// Import low-level handlers - Domain
const handleUpdateDomain_1 = require("../../../handlers/domain/low/handleUpdateDomain");
const handleValidateDomain_1 = require("../../../handlers/domain/low/handleValidateDomain");
const handleActivateFunctionGroup_1 = require("../../../handlers/function/low/handleActivateFunctionGroup");
const handleActivateFunctionModule_1 = require("../../../handlers/function/low/handleActivateFunctionModule");
// Import low-level handlers - Function
const handleCheckFunctionGroup_1 = require("../../../handlers/function/low/handleCheckFunctionGroup");
const handleCheckFunctionModule_1 = require("../../../handlers/function/low/handleCheckFunctionModule");
const handleCreateFunctionGroup_1 = require("../../../handlers/function/low/handleCreateFunctionGroup");
const handleCreateFunctionModule_1 = require("../../../handlers/function/low/handleCreateFunctionModule");
const handleDeleteFunctionGroup_1 = require("../../../handlers/function/low/handleDeleteFunctionGroup");
const handleDeleteFunctionModule_1 = require("../../../handlers/function/low/handleDeleteFunctionModule");
const handleLockFunctionGroup_1 = require("../../../handlers/function/low/handleLockFunctionGroup");
const handleLockFunctionModule_1 = require("../../../handlers/function/low/handleLockFunctionModule");
const handleUnlockFunctionGroup_1 = require("../../../handlers/function/low/handleUnlockFunctionGroup");
const handleUnlockFunctionModule_1 = require("../../../handlers/function/low/handleUnlockFunctionModule");
const handleUpdateFunctionModule_1 = require("../../../handlers/function/low/handleUpdateFunctionModule");
const handleValidateFunctionGroup_1 = require("../../../handlers/function/low/handleValidateFunctionGroup");
const handleValidateFunctionModule_1 = require("../../../handlers/function/low/handleValidateFunctionModule");
// Import low-level handlers - GUI Status
const handleActivateGuiStatus_1 = require("../../../handlers/gui_status/low/handleActivateGuiStatus");
const handleCreateGuiStatus_1 = require("../../../handlers/gui_status/low/handleCreateGuiStatus");
const handleDeleteGuiStatus_1 = require("../../../handlers/gui_status/low/handleDeleteGuiStatus");
const handleLockGuiStatus_1 = require("../../../handlers/gui_status/low/handleLockGuiStatus");
const handleUnlockGuiStatus_1 = require("../../../handlers/gui_status/low/handleUnlockGuiStatus");
const handleUpdateGuiStatus_1 = require("../../../handlers/gui_status/low/handleUpdateGuiStatus");
const handleActivateInterface_1 = require("../../../handlers/interface/low/handleActivateInterface");
const handleCheckInterface_1 = require("../../../handlers/interface/low/handleCheckInterface");
const handleCreateInterface_1 = require("../../../handlers/interface/low/handleCreateInterface");
const handleDeleteInterface_1 = require("../../../handlers/interface/low/handleDeleteInterface");
const handleLockInterface_1 = require("../../../handlers/interface/low/handleLockInterface");
const handleUnlockInterface_1 = require("../../../handlers/interface/low/handleUnlockInterface");
// Import low-level handlers - Interface
const handleUpdateInterface_1 = require("../../../handlers/interface/low/handleUpdateInterface");
const handleValidateInterface_1 = require("../../../handlers/interface/low/handleValidateInterface");
const handleCheckPackage_1 = require("../../../handlers/package/low/handleCheckPackage");
const handleCreatePackage_1 = require("../../../handlers/package/low/handleCreatePackage");
const handleDeletePackage_1 = require("../../../handlers/package/low/handleDeletePackage");
const handleLockPackage_1 = require("../../../handlers/package/low/handleLockPackage");
const handleUnlockPackage_1 = require("../../../handlers/package/low/handleUnlockPackage");
// Import low-level handlers - Package
const handleUpdatePackage_1 = require("../../../handlers/package/low/handleUpdatePackage");
const handleValidatePackage_1 = require("../../../handlers/package/low/handleValidatePackage");
const handleActivateProgram_1 = require("../../../handlers/program/low/handleActivateProgram");
const handleCheckProgram_1 = require("../../../handlers/program/low/handleCheckProgram");
const handleCreateProgram_1 = require("../../../handlers/program/low/handleCreateProgram");
const handleDeleteProgram_1 = require("../../../handlers/program/low/handleDeleteProgram");
const handleLockProgram_1 = require("../../../handlers/program/low/handleLockProgram");
const handleUnlockProgram_1 = require("../../../handlers/program/low/handleUnlockProgram");
// Import low-level handlers - Program
const handleUpdateProgram_1 = require("../../../handlers/program/low/handleUpdateProgram");
const handleValidateProgram_1 = require("../../../handlers/program/low/handleValidateProgram");
// Import low-level handlers - Screen (Dynpro)
const handleActivateScreen_1 = require("../../../handlers/screen/low/handleActivateScreen");
const handleCreateScreen_1 = require("../../../handlers/screen/low/handleCreateScreen");
const handleDeleteScreen_1 = require("../../../handlers/screen/low/handleDeleteScreen");
const handleLockScreen_1 = require("../../../handlers/screen/low/handleLockScreen");
const handleUnlockScreen_1 = require("../../../handlers/screen/low/handleUnlockScreen");
const handleUpdateScreen_1 = require("../../../handlers/screen/low/handleUpdateScreen");
const handleActivateStructure_1 = require("../../../handlers/structure/low/handleActivateStructure");
const handleCheckStructure_1 = require("../../../handlers/structure/low/handleCheckStructure");
const handleCreateStructure_1 = require("../../../handlers/structure/low/handleCreateStructure");
const handleDeleteStructure_1 = require("../../../handlers/structure/low/handleDeleteStructure");
const handleLockStructure_1 = require("../../../handlers/structure/low/handleLockStructure");
const handleUnlockStructure_1 = require("../../../handlers/structure/low/handleUnlockStructure");
// Import low-level handlers - Structure
const handleUpdateStructure_1 = require("../../../handlers/structure/low/handleUpdateStructure");
const handleValidateStructure_1 = require("../../../handlers/structure/low/handleValidateStructure");
const handleActivateTable_1 = require("../../../handlers/table/low/handleActivateTable");
const handleCheckTable_1 = require("../../../handlers/table/low/handleCheckTable");
const handleCreateTable_1 = require("../../../handlers/table/low/handleCreateTable");
const handleDeleteTable_1 = require("../../../handlers/table/low/handleDeleteTable");
const handleLockTable_1 = require("../../../handlers/table/low/handleLockTable");
const handleUnlockTable_1 = require("../../../handlers/table/low/handleUnlockTable");
// Import low-level handlers - Table
const handleUpdateTable_1 = require("../../../handlers/table/low/handleUpdateTable");
const handleValidateTable_1 = require("../../../handlers/table/low/handleValidateTable");
// Import low-level handlers - Transport
const handleCreateTransport_1 = require("../../../handlers/transport/low/handleCreateTransport");
const handleActivateView_1 = require("../../../handlers/view/low/handleActivateView");
const handleCheckView_1 = require("../../../handlers/view/low/handleCheckView");
const handleCreateView_1 = require("../../../handlers/view/low/handleCreateView");
const handleDeleteView_1 = require("../../../handlers/view/low/handleDeleteView");
const handleLockView_1 = require("../../../handlers/view/low/handleLockView");
const handleUnlockView_1 = require("../../../handlers/view/low/handleUnlockView");
// Import low-level handlers - View
const handleUpdateView_1 = require("../../../handlers/view/low/handleUpdateView");
const handleValidateView_1 = require("../../../handlers/view/low/handleValidateView");
// // Import TOOL_DEFINITION from common low handlers
// import { TOOL_DEFINITION as ActivateObject_Tool } from "../../../handlers/common/low/handleActivateObject";
// import { TOOL_DEFINITION as DeleteObject_Tool } from "../../../handlers/common/low/handleDeleteObject";
// import { TOOL_DEFINITION as CheckObject_Tool } from "../../../handlers/common/low/handleCheckObject";
// import { TOOL_DEFINITION as ValidateObject_Tool } from "../../../handlers/common/low/handleValidateObject";
// import { TOOL_DEFINITION as LockObject_Tool } from "../../../handlers/common/low/handleLockObject";
// import { TOOL_DEFINITION as UnlockObject_Tool } from "../../../handlers/common/low/handleUnlockObject";
const handleActivateBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleActivateBehaviorDefinition");
// Import TOOL_DEFINITION from behavior_definition low handlers
const handleCheckBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleCheckBehaviorDefinition");
const handleCreateBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleCreateBehaviorDefinition");
const handleDeleteBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleDeleteBehaviorDefinition");
const handleLockBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleLockBehaviorDefinition");
const handleUnlockBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleUnlockBehaviorDefinition");
const handleUpdateBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleUpdateBehaviorDefinition");
const handleValidateBehaviorDefinition_2 = require("../../../handlers/behavior_definition/low/handleValidateBehaviorDefinition");
// Import TOOL_DEFINITION from behavior_implementation low handlers
const handleCreateBehaviorImplementation_2 = require("../../../handlers/behavior_implementation/low/handleCreateBehaviorImplementation");
const handleLockBehaviorImplementation_2 = require("../../../handlers/behavior_implementation/low/handleLockBehaviorImplementation");
const handleValidateBehaviorImplementation_2 = require("../../../handlers/behavior_implementation/low/handleValidateBehaviorImplementation");
const handleActivateClass_2 = require("../../../handlers/class/low/handleActivateClass");
const handleActivateClassTestClasses_2 = require("../../../handlers/class/low/handleActivateClassTestClasses");
const handleCheckClass_2 = require("../../../handlers/class/low/handleCheckClass");
const handleCreateClass_2 = require("../../../handlers/class/low/handleCreateClass");
const handleDeleteClass_2 = require("../../../handlers/class/low/handleDeleteClass");
const handleGetClassUnitTestResult_2 = require("../../../handlers/class/low/handleGetClassUnitTestResult");
const handleGetClassUnitTestStatus_2 = require("../../../handlers/class/low/handleGetClassUnitTestStatus");
const handleLockClass_2 = require("../../../handlers/class/low/handleLockClass");
const handleLockClassTestClasses_2 = require("../../../handlers/class/low/handleLockClassTestClasses");
const handleRunClassUnitTests_2 = require("../../../handlers/class/low/handleRunClassUnitTests");
const handleUnlockClass_2 = require("../../../handlers/class/low/handleUnlockClass");
const handleUnlockClassTestClasses_2 = require("../../../handlers/class/low/handleUnlockClassTestClasses");
// Import TOOL_DEFINITION from class low handlers
const handleUpdateClass_2 = require("../../../handlers/class/low/handleUpdateClass");
const handleUpdateClassTestClasses_2 = require("../../../handlers/class/low/handleUpdateClassTestClasses");
const handleValidateClass_2 = require("../../../handlers/class/low/handleValidateClass");
const handleActivateDataElement_2 = require("../../../handlers/data_element/low/handleActivateDataElement");
const handleCheckDataElement_2 = require("../../../handlers/data_element/low/handleCheckDataElement");
const handleCreateDataElement_2 = require("../../../handlers/data_element/low/handleCreateDataElement");
const handleDeleteDataElement_2 = require("../../../handlers/data_element/low/handleDeleteDataElement");
const handleLockDataElement_2 = require("../../../handlers/data_element/low/handleLockDataElement");
const handleUnlockDataElement_2 = require("../../../handlers/data_element/low/handleUnlockDataElement");
// Import TOOL_DEFINITION from data_element low handlers
const handleUpdateDataElement_2 = require("../../../handlers/data_element/low/handleUpdateDataElement");
const handleValidateDataElement_2 = require("../../../handlers/data_element/low/handleValidateDataElement");
const handleActivateMetadataExtension_2 = require("../../../handlers/ddlx/low/handleActivateMetadataExtension");
// Import TOOL_DEFINITION from ddlx low handlers
const handleCheckMetadataExtension_2 = require("../../../handlers/ddlx/low/handleCheckMetadataExtension");
const handleCreateMetadataExtension_2 = require("../../../handlers/ddlx/low/handleCreateMetadataExtension");
const handleDeleteMetadataExtension_2 = require("../../../handlers/ddlx/low/handleDeleteMetadataExtension");
const handleLockMetadataExtension_2 = require("../../../handlers/ddlx/low/handleLockMetadataExtension");
const handleUnlockMetadataExtension_2 = require("../../../handlers/ddlx/low/handleUnlockMetadataExtension");
const handleUpdateMetadataExtension_2 = require("../../../handlers/ddlx/low/handleUpdateMetadataExtension");
const handleValidateMetadataExtension_2 = require("../../../handlers/ddlx/low/handleValidateMetadataExtension");
const handleActivateDomain_2 = require("../../../handlers/domain/low/handleActivateDomain");
const handleCheckDomain_2 = require("../../../handlers/domain/low/handleCheckDomain");
const handleCreateDomain_2 = require("../../../handlers/domain/low/handleCreateDomain");
const handleDeleteDomain_2 = require("../../../handlers/domain/low/handleDeleteDomain");
const handleLockDomain_2 = require("../../../handlers/domain/low/handleLockDomain");
const handleUnlockDomain_2 = require("../../../handlers/domain/low/handleUnlockDomain");
// Import TOOL_DEFINITION from domain low handlers
const handleUpdateDomain_2 = require("../../../handlers/domain/low/handleUpdateDomain");
const handleValidateDomain_2 = require("../../../handlers/domain/low/handleValidateDomain");
const handleActivateFunctionGroup_2 = require("../../../handlers/function/low/handleActivateFunctionGroup");
const handleActivateFunctionModule_2 = require("../../../handlers/function/low/handleActivateFunctionModule");
// Import TOOL_DEFINITION from function low handlers
const handleCheckFunctionGroup_2 = require("../../../handlers/function/low/handleCheckFunctionGroup");
const handleCheckFunctionModule_2 = require("../../../handlers/function/low/handleCheckFunctionModule");
const handleCreateFunctionGroup_2 = require("../../../handlers/function/low/handleCreateFunctionGroup");
const handleCreateFunctionModule_2 = require("../../../handlers/function/low/handleCreateFunctionModule");
const handleDeleteFunctionGroup_2 = require("../../../handlers/function/low/handleDeleteFunctionGroup");
const handleDeleteFunctionModule_2 = require("../../../handlers/function/low/handleDeleteFunctionModule");
const handleLockFunctionGroup_2 = require("../../../handlers/function/low/handleLockFunctionGroup");
const handleLockFunctionModule_2 = require("../../../handlers/function/low/handleLockFunctionModule");
const handleUnlockFunctionGroup_2 = require("../../../handlers/function/low/handleUnlockFunctionGroup");
const handleUnlockFunctionModule_2 = require("../../../handlers/function/low/handleUnlockFunctionModule");
const handleUpdateFunctionModule_2 = require("../../../handlers/function/low/handleUpdateFunctionModule");
const handleValidateFunctionGroup_2 = require("../../../handlers/function/low/handleValidateFunctionGroup");
const handleValidateFunctionModule_2 = require("../../../handlers/function/low/handleValidateFunctionModule");
// Import TOOL_DEFINITION from gui_status low handlers
const handleActivateGuiStatus_2 = require("../../../handlers/gui_status/low/handleActivateGuiStatus");
const handleCreateGuiStatus_2 = require("../../../handlers/gui_status/low/handleCreateGuiStatus");
const handleDeleteGuiStatus_2 = require("../../../handlers/gui_status/low/handleDeleteGuiStatus");
const handleLockGuiStatus_2 = require("../../../handlers/gui_status/low/handleLockGuiStatus");
const handleUnlockGuiStatus_2 = require("../../../handlers/gui_status/low/handleUnlockGuiStatus");
const handleUpdateGuiStatus_2 = require("../../../handlers/gui_status/low/handleUpdateGuiStatus");
const handleActivateInterface_2 = require("../../../handlers/interface/low/handleActivateInterface");
const handleCheckInterface_2 = require("../../../handlers/interface/low/handleCheckInterface");
const handleCreateInterface_2 = require("../../../handlers/interface/low/handleCreateInterface");
const handleDeleteInterface_2 = require("../../../handlers/interface/low/handleDeleteInterface");
const handleLockInterface_2 = require("../../../handlers/interface/low/handleLockInterface");
const handleUnlockInterface_2 = require("../../../handlers/interface/low/handleUnlockInterface");
// Import TOOL_DEFINITION from interface low handlers
const handleUpdateInterface_2 = require("../../../handlers/interface/low/handleUpdateInterface");
const handleValidateInterface_2 = require("../../../handlers/interface/low/handleValidateInterface");
const handleCheckPackage_2 = require("../../../handlers/package/low/handleCheckPackage");
const handleCreatePackage_2 = require("../../../handlers/package/low/handleCreatePackage");
const handleDeletePackage_2 = require("../../../handlers/package/low/handleDeletePackage");
const handleLockPackage_2 = require("../../../handlers/package/low/handleLockPackage");
const handleUnlockPackage_2 = require("../../../handlers/package/low/handleUnlockPackage");
// Import TOOL_DEFINITION from package low handlers
const handleUpdatePackage_2 = require("../../../handlers/package/low/handleUpdatePackage");
const handleValidatePackage_2 = require("../../../handlers/package/low/handleValidatePackage");
const handleActivateProgram_2 = require("../../../handlers/program/low/handleActivateProgram");
const handleCheckProgram_2 = require("../../../handlers/program/low/handleCheckProgram");
const handleCreateProgram_2 = require("../../../handlers/program/low/handleCreateProgram");
const handleDeleteProgram_2 = require("../../../handlers/program/low/handleDeleteProgram");
const handleLockProgram_2 = require("../../../handlers/program/low/handleLockProgram");
const handleUnlockProgram_2 = require("../../../handlers/program/low/handleUnlockProgram");
// Import TOOL_DEFINITION from program low handlers
const handleUpdateProgram_2 = require("../../../handlers/program/low/handleUpdateProgram");
const handleValidateProgram_2 = require("../../../handlers/program/low/handleValidateProgram");
// Import TOOL_DEFINITION from screen low handlers
const handleActivateScreen_2 = require("../../../handlers/screen/low/handleActivateScreen");
const handleCreateScreen_2 = require("../../../handlers/screen/low/handleCreateScreen");
const handleDeleteScreen_2 = require("../../../handlers/screen/low/handleDeleteScreen");
const handleLockScreen_2 = require("../../../handlers/screen/low/handleLockScreen");
const handleUnlockScreen_2 = require("../../../handlers/screen/low/handleUnlockScreen");
const handleUpdateScreen_2 = require("../../../handlers/screen/low/handleUpdateScreen");
const handleActivateStructure_2 = require("../../../handlers/structure/low/handleActivateStructure");
const handleCheckStructure_2 = require("../../../handlers/structure/low/handleCheckStructure");
const handleCreateStructure_2 = require("../../../handlers/structure/low/handleCreateStructure");
const handleDeleteStructure_2 = require("../../../handlers/structure/low/handleDeleteStructure");
const handleLockStructure_2 = require("../../../handlers/structure/low/handleLockStructure");
const handleUnlockStructure_2 = require("../../../handlers/structure/low/handleUnlockStructure");
// Import TOOL_DEFINITION from structure low handlers
const handleUpdateStructure_2 = require("../../../handlers/structure/low/handleUpdateStructure");
const handleValidateStructure_2 = require("../../../handlers/structure/low/handleValidateStructure");
const handleActivateTable_2 = require("../../../handlers/table/low/handleActivateTable");
const handleCheckTable_2 = require("../../../handlers/table/low/handleCheckTable");
const handleCreateTable_2 = require("../../../handlers/table/low/handleCreateTable");
const handleDeleteTable_2 = require("../../../handlers/table/low/handleDeleteTable");
const handleLockTable_2 = require("../../../handlers/table/low/handleLockTable");
const handleUnlockTable_2 = require("../../../handlers/table/low/handleUnlockTable");
// Import TOOL_DEFINITION from table low handlers
const handleUpdateTable_2 = require("../../../handlers/table/low/handleUpdateTable");
const handleValidateTable_2 = require("../../../handlers/table/low/handleValidateTable");
// Import TOOL_DEFINITION from transport low handlers
const handleCreateTransport_2 = require("../../../handlers/transport/low/handleCreateTransport");
const handleActivateView_2 = require("../../../handlers/view/low/handleActivateView");
const handleCheckView_2 = require("../../../handlers/view/low/handleCheckView");
const handleCreateView_2 = require("../../../handlers/view/low/handleCreateView");
const handleDeleteView_2 = require("../../../handlers/view/low/handleDeleteView");
const handleLockView_2 = require("../../../handlers/view/low/handleLockView");
const handleUnlockView_2 = require("../../../handlers/view/low/handleUnlockView");
// Import TOOL_DEFINITION from view low handlers
const handleUpdateView_2 = require("../../../handlers/view/low/handleUpdateView");
const handleValidateView_2 = require("../../../handlers/view/low/handleValidateView");
/**
 * Handler group for all low-level handlers
 * Contains handlers that perform low-level operations (lock, unlock, activate, delete, check, validate, etc.)
 */
class LowLevelHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'LowLevelHandlers';
    /**
     * Gets all low-level handler entries
     */
    getHandlers() {
        return [
            // // Common low-level handlers
            // {
            //   toolDefinition: {
            //     name: ActivateObject_Tool.name,
            //     description: ActivateObject_Tool.description,
            //     inputSchema: ActivateObject_Tool.inputSchema,
            //   },
            //   handler: (args: any) => { return handleActivateObject(this.context, args) },
            // },
            // {
            //   toolDefinition: {
            //     name: CheckObject_Tool.name,
            //     description: CheckObject_Tool.description,
            //     inputSchema: CheckObject_Tool.inputSchema,
            //   },
            //   handler: (args: any) => { return handleCheckObject(this.context, args) },
            // },
            // {
            //   toolDefinition: {
            //     name: ValidateObject_Tool.name,
            //     description: ValidateObject_Tool.description,
            //     inputSchema: ValidateObject_Tool.inputSchema,
            //   },
            //   handler: (args: any) => { return handleValidateObject(this.context, args) },
            // },
            // {
            //   toolDefinition: {
            //     name: LockObject_Tool.name,
            //     description: LockObject_Tool.description,
            //     inputSchema: LockObject_Tool.inputSchema,
            //   },
            //   handler: (args: any) => { return handleLockObject(this.context, args) },
            // },
            // {
            //   toolDefinition: {
            //     name: UnlockObject_Tool.name,
            //     description: UnlockObject_Tool.description,
            //     inputSchema: UnlockObject_Tool.inputSchema,
            //   },
            //   handler: (args: any) => { return handleUnlockObject(this.context, args) },
            // },
            // Package low-level handlers
            {
                toolDefinition: handleUpdatePackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdatePackage_1.handleUpdatePackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockPackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockPackage_1.handleUnlockPackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckPackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckPackage_1.handleCheckPackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeletePackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeletePackage_1.handleDeletePackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockPackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockPackage_1.handleLockPackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidatePackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidatePackage_1.handleValidatePackage)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreatePackage_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreatePackage_1.handleCreatePackage)(this.context, args);
                },
            },
            // Domain low-level handlers
            {
                toolDefinition: handleUpdateDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateDomain_1.handleUpdateDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckDomain_1.handleCheckDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteDomain_1.handleDeleteDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockDomain_1.handleLockDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockDomain_1.handleUnlockDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateDomain_1.handleValidateDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateDomain_1.handleCreateDomain)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateDomain_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateDomain_1.handleActivateDomain)(this.context, args);
                },
            },
            // DataElement low-level handlers
            {
                toolDefinition: handleUpdateDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateDataElement_1.handleUpdateDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckDataElement_1.handleCheckDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteDataElement_1.handleDeleteDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockDataElement_1.handleLockDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockDataElement_1.handleUnlockDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateDataElement_1.handleValidateDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateDataElement_1.handleCreateDataElement)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateDataElement_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateDataElement_1.handleActivateDataElement)(this.context, args);
                },
            },
            // Transport low-level handlers
            {
                toolDefinition: handleCreateTransport_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateTransport_1.handleCreateTransport)(this.context, args);
                },
            },
            // Table low-level handlers
            {
                toolDefinition: handleUpdateTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateTable_1.handleUpdateTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteTable_1.handleDeleteTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockTable_1.handleLockTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockTable_1.handleUnlockTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateTable_1.handleCreateTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckTable_1.handleCheckTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateTable_1.handleValidateTable)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateTable_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateTable_1.handleActivateTable)(this.context, args);
                },
            },
            // Structure low-level handlers
            {
                toolDefinition: handleUpdateStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateStructure_1.handleUpdateStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckStructure_1.handleCheckStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteStructure_1.handleDeleteStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockStructure_1.handleLockStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockStructure_1.handleUnlockStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateStructure_1.handleValidateStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateStructure_1.handleCreateStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateStructure_1.handleActivateStructure)(this.context, args);
                },
            },
            // View low-level handlers
            {
                toolDefinition: handleUpdateView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateView_1.handleUpdateView)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckView_1.handleCheckView)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteView_1.handleDeleteView)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockView_1.handleLockView)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockView_1.handleUnlockView)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateView_1.handleValidateView)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateView_1.handleCreateView)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateView_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateView_1.handleActivateView)(this.context, args);
                },
            },
            // Class low-level handlers
            {
                toolDefinition: handleUpdateClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateClass_1.handleUpdateClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteClass_1.handleDeleteClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockClass_1.handleLockClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockClass_1.handleUnlockClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateClass_1.handleCreateClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateClass_1.handleValidateClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckClass_1.handleCheckClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateClass_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateClass_1.handleActivateClass)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockClassTestClasses_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockClassTestClasses_1.handleLockClassTestClasses)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockClassTestClasses_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockClassTestClasses_1.handleUnlockClassTestClasses)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateClassTestClasses_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateClassTestClasses_1.handleUpdateClassTestClasses)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateClassTestClasses_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateClassTestClasses_1.handleActivateClassTestClasses)(this.context, args);
                },
            },
            {
                toolDefinition: handleRunClassUnitTests_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleRunClassUnitTests_1.handleRunClassUnitTests)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetClassUnitTestStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetClassUnitTestStatus_1.handleGetClassUnitTestStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetClassUnitTestResult_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetClassUnitTestResult_1.handleGetClassUnitTestResult)(this.context, args);
                },
            },
            // Program low-level handlers
            {
                toolDefinition: handleUpdateProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateProgram_1.handleUpdateProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckProgram_1.handleCheckProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteProgram_1.handleDeleteProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockProgram_1.handleLockProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockProgram_1.handleUnlockProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateProgram_1.handleValidateProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateProgram_1.handleCreateProgram)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateProgram_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateProgram_1.handleActivateProgram)(this.context, args);
                },
            },
            // Interface low-level handlers
            {
                toolDefinition: handleUpdateInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateInterface_1.handleUpdateInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckInterface_1.handleCheckInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteInterface_1.handleDeleteInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockInterface_1.handleLockInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockInterface_1.handleUnlockInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateInterface_1.handleValidateInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateInterface_1.handleCreateInterface)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateInterface_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateInterface_1.handleActivateInterface)(this.context, args);
                },
            },
            // Function low-level handlers
            {
                toolDefinition: handleCheckFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckFunctionGroup_1.handleCheckFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteFunctionGroup_1.handleDeleteFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteFunctionModule_1.handleDeleteFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockFunctionGroup_1.handleLockFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockFunctionModule_1.handleLockFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockFunctionGroup_1.handleUnlockFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockFunctionModule_1.handleUnlockFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateFunctionGroup_1.handleValidateFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateFunctionGroup_1.handleCreateFunctionGroup)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateFunctionModule_1.handleCreateFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateFunctionModule_1.handleUpdateFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateFunctionModule_1.handleValidateFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleCheckFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckFunctionModule_1.handleCheckFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateFunctionModule_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateFunctionModule_1.handleActivateFunctionModule)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateFunctionGroup_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateFunctionGroup_1.handleActivateFunctionGroup)(this.context, args);
                },
            },
            // BehaviorDefinition low-level handlers
            {
                toolDefinition: handleCheckBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckBehaviorDefinition_1.handleCheckBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteBehaviorDefinition_1.handleDeleteBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockBehaviorDefinition_1.handleLockBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockBehaviorDefinition_1.handleUnlockBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateBehaviorDefinition_1.handleValidateBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateBehaviorDefinition_1.handleCreateBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateBehaviorDefinition_1.handleUpdateBehaviorDefinition)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateBehaviorDefinition_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateBehaviorDefinition_1.handleActivateBehaviorDefinition)(this.context, args);
                },
            },
            // BehaviorImplementation low-level handlers
            {
                toolDefinition: handleValidateBehaviorImplementation_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateBehaviorImplementation_1.handleValidateBehaviorImplementation)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateBehaviorImplementation_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateBehaviorImplementation_1.handleCreateBehaviorImplementation)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockBehaviorImplementation_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockBehaviorImplementation_1.handleLockBehaviorImplementation)(this.context, args);
                },
            },
            // MetadataExtension low-level handlers
            {
                toolDefinition: handleCheckMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCheckMetadataExtension_1.handleCheckMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteMetadataExtension_1.handleDeleteMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleLockMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockMetadataExtension_1.handleLockMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockMetadataExtension_1.handleUnlockMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleValidateMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleValidateMetadataExtension_1.handleValidateMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateMetadataExtension_1.handleCreateMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateMetadataExtension_1.handleUpdateMetadataExtension)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateMetadataExtension_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateMetadataExtension_1.handleActivateMetadataExtension)(this.context, args);
                },
            },
            // Screen (Dynpro) low-level handlers
            {
                toolDefinition: handleLockScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockScreen_1.handleLockScreen)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockScreen_1.handleUnlockScreen)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateScreen_1.handleUpdateScreen)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateScreen_1.handleCreateScreen)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteScreen_1.handleDeleteScreen)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateScreen_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateScreen_1.handleActivateScreen)(this.context, args);
                },
            },
            // GUI Status low-level handlers
            {
                toolDefinition: handleLockGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleLockGuiStatus_1.handleLockGuiStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleUnlockGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUnlockGuiStatus_1.handleUnlockGuiStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleUpdateGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleUpdateGuiStatus_1.handleUpdateGuiStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleCreateGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleCreateGuiStatus_1.handleCreateGuiStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleDeleteGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDeleteGuiStatus_1.handleDeleteGuiStatus)(this.context, args);
                },
            },
            {
                toolDefinition: handleActivateGuiStatus_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleActivateGuiStatus_1.handleActivateGuiStatus)(this.context, args);
                },
            },
        ];
    }
}
exports.LowLevelHandlersGroup = LowLevelHandlersGroup;
//# sourceMappingURL=LowLevelHandlersGroup.js.map