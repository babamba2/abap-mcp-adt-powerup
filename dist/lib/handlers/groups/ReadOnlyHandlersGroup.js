"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyHandlersGroup = void 0;
const handleReadBehaviorDefinition_1 = require("../../../handlers/behavior_definition/readonly/handleReadBehaviorDefinition");
const handleReadBehaviorImplementation_1 = require("../../../handlers/behavior_implementation/readonly/handleReadBehaviorImplementation");
const handleReadClass_1 = require("../../../handlers/class/readonly/handleReadClass");
const handleReadDataElement_1 = require("../../../handlers/data_element/readonly/handleReadDataElement");
const handleReadDomain_1 = require("../../../handlers/domain/readonly/handleReadDomain");
const handleGetBadiImplementations_1 = require("../../../handlers/enhancement/readonly/handleGetBadiImplementations");
const handleGetEnhancementImpl_1 = require("../../../handlers/enhancement/readonly/handleGetEnhancementImpl");
const handleGetEnhancementSpot_1 = require("../../../handlers/enhancement/readonly/handleGetEnhancementSpot");
const handleGetEnhancements_1 = require("../../../handlers/enhancement/readonly/handleGetEnhancements");
const handleReadFunctionGroup_1 = require("../../../handlers/function_group/readonly/handleReadFunctionGroup");
const handleReadFunctionModule_1 = require("../../../handlers/function_module/readonly/handleReadFunctionModule");
// Import readonly handlers - GUI Status
const handleGetGuiStatusList_1 = require("../../../handlers/gui_status/readonly/handleGetGuiStatusList");
const handleReadGuiStatus_1 = require("../../../handlers/gui_status/readonly/handleReadGuiStatus");
const handleGetInclude_1 = require("../../../handlers/include/readonly/handleGetInclude");
const handleGetIncludesList_1 = require("../../../handlers/include/readonly/handleGetIncludesList");
const handleReadInterface_1 = require("../../../handlers/interface/readonly/handleReadInterface");
const handleReadMetadataExtension_1 = require("../../../handlers/metadata_extension/readonly/handleReadMetadataExtension");
const handleGetPackageContents_1 = require("../../../handlers/package/readonly/handleGetPackageContents");
const handleReadPackage_1 = require("../../../handlers/package/readonly/handleReadPackage");
const handleGetProgFullCode_1 = require("../../../handlers/program/readonly/handleGetProgFullCode");
const handleReadProgram_1 = require("../../../handlers/program/readonly/handleReadProgram");
// Import readonly handlers - Screen (Dynpro)
const handleGetScreensList_1 = require("../../../handlers/screen/readonly/handleGetScreensList");
const handleReadScreen_1 = require("../../../handlers/screen/readonly/handleReadScreen");
const handleReadServiceBinding_1 = require("../../../handlers/service_binding/readonly/handleReadServiceBinding");
const handleReadServiceDefinition_1 = require("../../../handlers/service_definition/readonly/handleReadServiceDefinition");
const handleReadStructure_1 = require("../../../handlers/structure/readonly/handleReadStructure");
const handleGetTableContents_1 = require("../../../handlers/table/readonly/handleGetTableContents");
const handleReadTable_1 = require("../../../handlers/table/readonly/handleReadTable");
const handleGetTransport_1 = require("../../../handlers/transport/readonly/handleGetTransport");
const handleListTransports_1 = require("../../../handlers/transport/readonly/handleListTransports");
const handleReadView_1 = require("../../../handlers/view/readonly/handleReadView");
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
/**
 * Handler group for all readonly (read-only) handlers.
 * Contains handlers that only read data without modifying the ABAP system.
 */
class ReadOnlyHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'ReadOnlyHandlers';
    /**
     * Gets all readonly handler entries
     */
    getHandlers() {
        return [
            // Existing readonly handlers
            {
                toolDefinition: handleGetTableContents_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetTableContents_1.handleGetTableContents)(this.context, args),
            },
            {
                toolDefinition: handleGetPackageContents_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetPackageContents_1.handleGetPackageContents)(this.context, args),
            },
            {
                toolDefinition: handleGetInclude_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetInclude_1.handleGetInclude)(this.context, args),
            },
            {
                toolDefinition: handleGetIncludesList_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetIncludesList_1.handleGetIncludesList)(this.context, args),
            },
            {
                toolDefinition: handleGetEnhancements_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetEnhancements_1.handleGetEnhancements)(this.context, args),
            },
            {
                toolDefinition: handleGetEnhancementSpot_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetEnhancementSpot_1.handleGetEnhancementSpot)(this.context, args),
            },
            {
                toolDefinition: handleGetEnhancementImpl_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetEnhancementImpl_1.handleGetEnhancementImpl)(this.context, args),
            },
            {
                toolDefinition: handleGetBadiImplementations_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetBadiImplementations_1.handleGetBadiImplementations)(this.context, args),
            },
            {
                toolDefinition: handleGetTransport_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetTransport_1.handleGetTransport)(this.context, args),
            },
            {
                toolDefinition: handleListTransports_1.TOOL_DEFINITION,
                handler: (args) => (0, handleListTransports_1.handleListTransports)(this.context, args),
            },
            {
                toolDefinition: handleGetProgFullCode_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetProgFullCode_1.handleGetProgFullCode)(this.context, args),
            },
            // Read object source + metadata handlers
            {
                toolDefinition: handleReadClass_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadClass_1.handleReadClass)(this.context, args),
            },
            {
                toolDefinition: handleReadInterface_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadInterface_1.handleReadInterface)(this.context, args),
            },
            {
                toolDefinition: handleReadProgram_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadProgram_1.handleReadProgram)(this.context, args),
            },
            {
                toolDefinition: handleReadTable_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadTable_1.handleReadTable)(this.context, args),
            },
            {
                toolDefinition: handleReadStructure_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadStructure_1.handleReadStructure)(this.context, args),
            },
            {
                toolDefinition: handleReadView_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadView_1.handleReadView)(this.context, args),
            },
            {
                toolDefinition: handleReadDomain_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadDomain_1.handleReadDomain)(this.context, args),
            },
            {
                toolDefinition: handleReadDataElement_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadDataElement_1.handleReadDataElement)(this.context, args),
            },
            {
                toolDefinition: handleReadFunctionModule_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadFunctionModule_1.handleReadFunctionModule)(this.context, args),
            },
            {
                toolDefinition: handleReadFunctionGroup_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadFunctionGroup_1.handleReadFunctionGroup)(this.context, args),
            },
            {
                toolDefinition: handleReadPackage_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadPackage_1.handleReadPackage)(this.context, args),
            },
            {
                toolDefinition: handleReadServiceDefinition_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadServiceDefinition_1.handleReadServiceDefinition)(this.context, args),
            },
            {
                toolDefinition: handleReadMetadataExtension_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadMetadataExtension_1.handleReadMetadataExtension)(this.context, args),
            },
            {
                toolDefinition: handleReadBehaviorDefinition_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadBehaviorDefinition_1.handleReadBehaviorDefinition)(this.context, args),
            },
            {
                toolDefinition: handleReadBehaviorImplementation_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadBehaviorImplementation_1.handleReadBehaviorImplementation)(this.context, args),
            },
            {
                toolDefinition: handleReadServiceBinding_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadServiceBinding_1.handleReadServiceBinding)(this.context, args),
            },
            // Screen (Dynpro) readonly handlers
            {
                toolDefinition: handleReadScreen_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadScreen_1.handleReadScreen)(this.context, args),
            },
            {
                toolDefinition: handleGetScreensList_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetScreensList_1.handleGetScreensList)(this.context, args),
            },
            // GUI Status readonly handlers
            {
                toolDefinition: handleReadGuiStatus_1.TOOL_DEFINITION,
                handler: (args) => (0, handleReadGuiStatus_1.handleReadGuiStatus)(this.context, args),
            },
            {
                toolDefinition: handleGetGuiStatusList_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetGuiStatusList_1.handleGetGuiStatusList)(this.context, args),
            },
        ];
    }
}
exports.ReadOnlyHandlersGroup = ReadOnlyHandlersGroup;
//# sourceMappingURL=ReadOnlyHandlersGroup.js.map