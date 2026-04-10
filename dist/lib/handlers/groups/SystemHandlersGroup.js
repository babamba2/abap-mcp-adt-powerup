"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemHandlersGroup = void 0;
const handleGetPackageTree_1 = require("../../../handlers/system/high/handleGetPackageTree");
const handleGetNodeStructure_1 = require("../../../handlers/system/low/handleGetNodeStructure");
const handleGetObjectStructure_1 = require("../../../handlers/system/low/handleGetObjectStructure");
const handleGetVirtualFolders_1 = require("../../../handlers/system/low/handleGetVirtualFolders");
const handleDescribeByList_1 = require("../../../handlers/system/readonly/handleDescribeByList");
const handleDescribeByList_js_1 = require("../../../handlers/system/readonly/handleDescribeByList.js");
const handleGetAbapAST_1 = require("../../../handlers/system/readonly/handleGetAbapAST");
const handleGetAbapSemanticAnalysis_1 = require("../../../handlers/system/readonly/handleGetAbapSemanticAnalysis");
const handleGetAbapSystemSymbols_1 = require("../../../handlers/system/readonly/handleGetAbapSystemSymbols");
const handleGetAllTypes_1 = require("../../../handlers/system/readonly/handleGetAllTypes");
const handleGetInactiveObjects_1 = require("../../../handlers/system/readonly/handleGetInactiveObjects");
const handleGetObjectInfo_1 = require("../../../handlers/system/readonly/handleGetObjectInfo");
const handleGetObjectNodeFromCache_1 = require("../../../handlers/system/readonly/handleGetObjectNodeFromCache");
const handleGetObjectNodeFromCache_js_1 = require("../../../handlers/system/readonly/handleGetObjectNodeFromCache.js");
const handleGetObjectStructure_2 = require("../../../handlers/system/readonly/handleGetObjectStructure");
const handleGetObjectStructure_js_1 = require("../../../handlers/system/readonly/handleGetObjectStructure.js");
const handleGetSession_1 = require("../../../handlers/system/readonly/handleGetSession");
const handleGetSqlQuery_1 = require("../../../handlers/system/readonly/handleGetSqlQuery");
const handleGetTransaction_1 = require("../../../handlers/system/readonly/handleGetTransaction");
// Import system handlers
// Import TOOL_DEFINITION from handlers
const handleGetTypeInfo_1 = require("../../../handlers/system/readonly/handleGetTypeInfo");
const handleGetWhereUsed_1 = require("../../../handlers/system/readonly/handleGetWhereUsed");
const handleRuntimeAnalyzeDump_1 = require("../../../handlers/system/readonly/handleRuntimeAnalyzeDump");
const handleRuntimeAnalyzeProfilerTrace_1 = require("../../../handlers/system/readonly/handleRuntimeAnalyzeProfilerTrace");
const handleRuntimeCreateProfilerTraceParameters_1 = require("../../../handlers/system/readonly/handleRuntimeCreateProfilerTraceParameters");
const handleRuntimeGetDumpById_1 = require("../../../handlers/system/readonly/handleRuntimeGetDumpById");
const handleRuntimeGetProfilerTraceData_1 = require("../../../handlers/system/readonly/handleRuntimeGetProfilerTraceData");
const handleRuntimeListDumps_1 = require("../../../handlers/system/readonly/handleRuntimeListDumps");
const handleRuntimeListProfilerTraceFiles_1 = require("../../../handlers/system/readonly/handleRuntimeListProfilerTraceFiles");
const handleRuntimeRunClassWithProfiling_1 = require("../../../handlers/system/readonly/handleRuntimeRunClassWithProfiling");
const handleRuntimeRunProgramWithProfiling_1 = require("../../../handlers/system/readonly/handleRuntimeRunProgramWithProfiling");
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
/**
 * Handler group for all system-related handlers
 * Contains handlers for system information, analysis, and metadata operations
 */
class SystemHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'SystemHandlers';
    /**
     * Gets all system handler entries
     */
    getHandlers() {
        return [
            {
                toolDefinition: handleGetTypeInfo_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetTypeInfo_1.handleGetTypeInfo)(this.context, args),
            },
            {
                toolDefinition: handleGetTransaction_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetTransaction_1.handleGetTransaction)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeCreateProfilerTraceParameters_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeCreateProfilerTraceParameters_1.handleRuntimeCreateProfilerTraceParameters)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeListProfilerTraceFiles_1.TOOL_DEFINITION,
                handler: () => (0, handleRuntimeListProfilerTraceFiles_1.handleRuntimeListProfilerTraceFiles)(this.context),
            },
            {
                toolDefinition: handleRuntimeGetProfilerTraceData_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeGetProfilerTraceData_1.handleRuntimeGetProfilerTraceData)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeListDumps_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeListDumps_1.handleRuntimeListDumps)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeGetDumpById_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeGetDumpById_1.handleRuntimeGetDumpById)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeRunClassWithProfiling_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeRunClassWithProfiling_1.handleRuntimeRunClassWithProfiling)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeRunProgramWithProfiling_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeRunProgramWithProfiling_1.handleRuntimeRunProgramWithProfiling)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeAnalyzeProfilerTrace_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeAnalyzeProfilerTrace_1.handleRuntimeAnalyzeProfilerTrace)(this.context, args),
            },
            {
                toolDefinition: handleRuntimeAnalyzeDump_1.TOOL_DEFINITION,
                handler: (args) => (0, handleRuntimeAnalyzeDump_1.handleRuntimeAnalyzeDump)(this.context, args),
            },
            {
                toolDefinition: handleGetSqlQuery_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetSqlQuery_1.handleGetSqlQuery)(this.context, args),
            },
            {
                toolDefinition: handleGetWhereUsed_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetWhereUsed_1.handleGetWhereUsed)(this.context, args),
            },
            {
                toolDefinition: handleGetObjectInfo_1.TOOL_DEFINITION,
                handler: async (args) => {
                    if (!args || typeof args !== 'object') {
                        throw new Error('Missing or invalid arguments for GetObjectInfo');
                    }
                    return await (0, handleGetObjectInfo_1.handleGetObjectInfo)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetAbapAST_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetAbapAST_1.handleGetAbapAST)(this.context, args),
            },
            {
                toolDefinition: handleGetAbapSemanticAnalysis_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetAbapSemanticAnalysis_1.handleGetAbapSemanticAnalysis)(this.context, args),
            },
            {
                toolDefinition: handleGetAbapSystemSymbols_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetAbapSystemSymbols_1.handleGetAbapSystemSymbols)(this.context, args),
            },
            {
                toolDefinition: handleGetSession_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetSession_1.handleGetSession)(this.context, args),
            },
            {
                toolDefinition: handleGetInactiveObjects_1.TOOL_DEFINITION,
                handler: (args) => (0, handleGetInactiveObjects_1.handleGetInactiveObjects)(this.context, args),
            },
            // Dynamic import handlers
            {
                toolDefinition: handleGetAllTypes_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetAllTypes_1.handleGetAdtTypes)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetObjectStructure_2.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetObjectStructure_js_1.handleGetObjectStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetObjectNodeFromCache_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetObjectNodeFromCache_js_1.handleGetObjectNodeFromCache)(this.context, args);
                },
            },
            {
                toolDefinition: handleDescribeByList_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleDescribeByList_js_1.handleDescribeByList)(this.context, args);
                },
            },
            // Low-level handlers for virtual folders, node structure, and object structure
            {
                toolDefinition: handleGetVirtualFolders_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetVirtualFolders_1.handleGetVirtualFolders)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetNodeStructure_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetNodeStructure_1.handleGetNodeStructure)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetObjectStructure_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetObjectStructure_1.handleGetObjectStructure)(this.context, args);
                },
            },
            // High-level handler for package tree
            {
                toolDefinition: handleGetPackageTree_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetPackageTree_1.handleGetPackageTree)(this.context, args);
                },
            },
        ];
    }
}
exports.SystemHandlersGroup = SystemHandlersGroup;
//# sourceMappingURL=SystemHandlersGroup.js.map