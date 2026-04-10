"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactRouterMap = void 0;
exports.routeCompactOperation = routeCompactOperation;
const utils_1 = require("../../../lib/utils");
const handleCreateBehaviorDefinition_1 = require("../../behavior_definition/high/handleCreateBehaviorDefinition");
const handleDeleteBehaviorDefinition_1 = require("../../behavior_definition/high/handleDeleteBehaviorDefinition");
const handleGetBehaviorDefinition_1 = require("../../behavior_definition/high/handleGetBehaviorDefinition");
const handleUpdateBehaviorDefinition_1 = require("../../behavior_definition/high/handleUpdateBehaviorDefinition");
const handleCreateBehaviorImplementation_1 = require("../../behavior_implementation/high/handleCreateBehaviorImplementation");
const handleDeleteBehaviorImplementation_1 = require("../../behavior_implementation/high/handleDeleteBehaviorImplementation");
const handleGetBehaviorImplementation_1 = require("../../behavior_implementation/high/handleGetBehaviorImplementation");
const handleUpdateBehaviorImplementation_1 = require("../../behavior_implementation/high/handleUpdateBehaviorImplementation");
const handleCreateClass_1 = require("../../class/high/handleCreateClass");
const handleDeleteClass_1 = require("../../class/high/handleDeleteClass");
const handleDeleteLocalDefinitions_1 = require("../../class/high/handleDeleteLocalDefinitions");
const handleDeleteLocalMacros_1 = require("../../class/high/handleDeleteLocalMacros");
const handleDeleteLocalTestClass_1 = require("../../class/high/handleDeleteLocalTestClass");
const handleDeleteLocalTypes_1 = require("../../class/high/handleDeleteLocalTypes");
const handleGetClass_1 = require("../../class/high/handleGetClass");
const handleGetLocalDefinitions_1 = require("../../class/high/handleGetLocalDefinitions");
const handleGetLocalMacros_1 = require("../../class/high/handleGetLocalMacros");
const handleGetLocalTestClass_1 = require("../../class/high/handleGetLocalTestClass");
const handleGetLocalTypes_1 = require("../../class/high/handleGetLocalTypes");
const handleUpdateClass_1 = require("../../class/high/handleUpdateClass");
const handleUpdateLocalDefinitions_1 = require("../../class/high/handleUpdateLocalDefinitions");
const handleUpdateLocalMacros_1 = require("../../class/high/handleUpdateLocalMacros");
const handleUpdateLocalTestClass_1 = require("../../class/high/handleUpdateLocalTestClass");
const handleUpdateLocalTypes_1 = require("../../class/high/handleUpdateLocalTypes");
const handleCreateDataElement_1 = require("../../data_element/high/handleCreateDataElement");
const handleDeleteDataElement_1 = require("../../data_element/high/handleDeleteDataElement");
const handleGetDataElement_1 = require("../../data_element/high/handleGetDataElement");
const handleUpdateDataElement_1 = require("../../data_element/high/handleUpdateDataElement");
const handleCreateMetadataExtension_1 = require("../../ddlx/high/handleCreateMetadataExtension");
const handleUpdateMetadataExtension_1 = require("../../ddlx/high/handleUpdateMetadataExtension");
const handleCreateDomain_1 = require("../../domain/high/handleCreateDomain");
const handleDeleteDomain_1 = require("../../domain/high/handleDeleteDomain");
const handleGetDomain_1 = require("../../domain/high/handleGetDomain");
const handleUpdateDomain_1 = require("../../domain/high/handleUpdateDomain");
const handleCreateFunctionGroup_1 = require("../../function/high/handleCreateFunctionGroup");
const handleCreateFunctionModule_1 = require("../../function/high/handleCreateFunctionModule");
const handleUpdateFunctionGroup_1 = require("../../function/high/handleUpdateFunctionGroup");
const handleUpdateFunctionModule_1 = require("../../function/high/handleUpdateFunctionModule");
const handleDeleteFunctionGroup_1 = require("../../function_group/high/handleDeleteFunctionGroup");
const handleGetFunctionGroup_1 = require("../../function_group/high/handleGetFunctionGroup");
const handleDeleteFunctionModule_1 = require("../../function_module/high/handleDeleteFunctionModule");
const handleGetFunctionModule_1 = require("../../function_module/high/handleGetFunctionModule");
const handleCreateInterface_1 = require("../../interface/high/handleCreateInterface");
const handleDeleteInterface_1 = require("../../interface/high/handleDeleteInterface");
const handleGetInterface_1 = require("../../interface/high/handleGetInterface");
const handleUpdateInterface_1 = require("../../interface/high/handleUpdateInterface");
const handleDeleteMetadataExtension_1 = require("../../metadata_extension/high/handleDeleteMetadataExtension");
const handleGetMetadataExtension_1 = require("../../metadata_extension/high/handleGetMetadataExtension");
const handleCreatePackage_1 = require("../../package/high/handleCreatePackage");
const handleGetPackage_1 = require("../../package/high/handleGetPackage");
const handleCreateProgram_1 = require("../../program/high/handleCreateProgram");
const handleDeleteProgram_1 = require("../../program/high/handleDeleteProgram");
const handleGetProgram_1 = require("../../program/high/handleGetProgram");
const handleUpdateProgram_1 = require("../../program/high/handleUpdateProgram");
const handleCreateServiceBinding_1 = require("../../service_binding/high/handleCreateServiceBinding");
const handleDeleteServiceBinding_1 = require("../../service_binding/high/handleDeleteServiceBinding");
const handleGetServiceBinding_1 = require("../../service_binding/high/handleGetServiceBinding");
const handleUpdateServiceBinding_1 = require("../../service_binding/high/handleUpdateServiceBinding");
const handleCreateServiceDefinition_1 = require("../../service_definition/high/handleCreateServiceDefinition");
const handleDeleteServiceDefinition_1 = require("../../service_definition/high/handleDeleteServiceDefinition");
const handleGetServiceDefinition_1 = require("../../service_definition/high/handleGetServiceDefinition");
const handleUpdateServiceDefinition_1 = require("../../service_definition/high/handleUpdateServiceDefinition");
const handleCreateStructure_1 = require("../../structure/high/handleCreateStructure");
const handleDeleteStructure_1 = require("../../structure/high/handleDeleteStructure");
const handleGetStructure_1 = require("../../structure/high/handleGetStructure");
const handleUpdateStructure_1 = require("../../structure/high/handleUpdateStructure");
const handleCreateTable_1 = require("../../table/high/handleCreateTable");
const handleDeleteTable_1 = require("../../table/high/handleDeleteTable");
const handleGetTable_1 = require("../../table/high/handleGetTable");
const handleUpdateTable_1 = require("../../table/high/handleUpdateTable");
const handleCreateTransport_1 = require("../../transport/high/handleCreateTransport");
const handleCreateCdsUnitTest_1 = require("../../unit_test/high/handleCreateCdsUnitTest");
const handleCreateUnitTest_1 = require("../../unit_test/high/handleCreateUnitTest");
const handleDeleteCdsUnitTest_1 = require("../../unit_test/high/handleDeleteCdsUnitTest");
const handleDeleteUnitTest_1 = require("../../unit_test/high/handleDeleteUnitTest");
const handleGetCdsUnitTest_1 = require("../../unit_test/high/handleGetCdsUnitTest");
const handleGetUnitTest_1 = require("../../unit_test/high/handleGetUnitTest");
const handleUpdateCdsUnitTest_1 = require("../../unit_test/high/handleUpdateCdsUnitTest");
const handleUpdateUnitTest_1 = require("../../unit_test/high/handleUpdateUnitTest");
const handleCreateView_1 = require("../../view/high/handleCreateView");
const handleDeleteView_1 = require("../../view/high/handleDeleteView");
const handleGetView_1 = require("../../view/high/handleGetView");
const handleUpdateView_1 = require("../../view/high/handleUpdateView");
const compactMatrix_1 = require("./compactMatrix");
exports.compactRouterMap = {
    PACKAGE: {
        create: handleCreatePackage_1.handleCreatePackage,
        get: handleGetPackage_1.handleGetPackage,
    },
    DOMAIN: {
        create: handleCreateDomain_1.handleCreateDomain,
        get: handleGetDomain_1.handleGetDomain,
        update: handleUpdateDomain_1.handleUpdateDomain,
        delete: handleDeleteDomain_1.handleDeleteDomain,
    },
    DATA_ELEMENT: {
        create: handleCreateDataElement_1.handleCreateDataElement,
        get: handleGetDataElement_1.handleGetDataElement,
        update: handleUpdateDataElement_1.handleUpdateDataElement,
        delete: handleDeleteDataElement_1.handleDeleteDataElement,
    },
    TRANSPORT: {
        create: handleCreateTransport_1.handleCreateTransport,
    },
    TABLE: {
        create: handleCreateTable_1.handleCreateTable,
        get: handleGetTable_1.handleGetTable,
        update: handleUpdateTable_1.handleUpdateTable,
        delete: handleDeleteTable_1.handleDeleteTable,
    },
    STRUCTURE: {
        create: handleCreateStructure_1.handleCreateStructure,
        get: handleGetStructure_1.handleGetStructure,
        update: handleUpdateStructure_1.handleUpdateStructure,
        delete: handleDeleteStructure_1.handleDeleteStructure,
    },
    VIEW: {
        create: handleCreateView_1.handleCreateView,
        get: handleGetView_1.handleGetView,
        update: handleUpdateView_1.handleUpdateView,
        delete: handleDeleteView_1.handleDeleteView,
    },
    SERVICE_DEFINITION: {
        create: handleCreateServiceDefinition_1.handleCreateServiceDefinition,
        get: handleGetServiceDefinition_1.handleGetServiceDefinition,
        update: handleUpdateServiceDefinition_1.handleUpdateServiceDefinition,
        delete: handleDeleteServiceDefinition_1.handleDeleteServiceDefinition,
    },
    SERVICE_BINDING: {
        create: handleCreateServiceBinding_1.handleCreateServiceBinding,
        get: handleGetServiceBinding_1.handleGetServiceBinding,
        update: handleUpdateServiceBinding_1.handleUpdateServiceBinding,
        delete: handleDeleteServiceBinding_1.handleDeleteServiceBinding,
    },
    CLASS: {
        create: handleCreateClass_1.handleCreateClass,
        get: handleGetClass_1.handleGetClass,
        update: handleUpdateClass_1.handleUpdateClass,
        delete: handleDeleteClass_1.handleDeleteClass,
    },
    UNIT_TEST: {
        create: handleCreateUnitTest_1.handleCreateUnitTest,
        get: handleGetUnitTest_1.handleGetUnitTest,
        update: handleUpdateUnitTest_1.handleUpdateUnitTest,
        delete: handleDeleteUnitTest_1.handleDeleteUnitTest,
    },
    CDS_UNIT_TEST: {
        create: handleCreateCdsUnitTest_1.handleCreateCdsUnitTest,
        get: handleGetCdsUnitTest_1.handleGetCdsUnitTest,
        update: handleUpdateCdsUnitTest_1.handleUpdateCdsUnitTest,
        delete: handleDeleteCdsUnitTest_1.handleDeleteCdsUnitTest,
    },
    LOCAL_TEST_CLASS: {
        get: handleGetLocalTestClass_1.handleGetLocalTestClass,
        update: handleUpdateLocalTestClass_1.handleUpdateLocalTestClass,
        delete: handleDeleteLocalTestClass_1.handleDeleteLocalTestClass,
    },
    LOCAL_TYPES: {
        get: handleGetLocalTypes_1.handleGetLocalTypes,
        update: handleUpdateLocalTypes_1.handleUpdateLocalTypes,
        delete: handleDeleteLocalTypes_1.handleDeleteLocalTypes,
    },
    LOCAL_DEFINITIONS: {
        get: handleGetLocalDefinitions_1.handleGetLocalDefinitions,
        update: handleUpdateLocalDefinitions_1.handleUpdateLocalDefinitions,
        delete: handleDeleteLocalDefinitions_1.handleDeleteLocalDefinitions,
    },
    LOCAL_MACROS: {
        get: handleGetLocalMacros_1.handleGetLocalMacros,
        update: handleUpdateLocalMacros_1.handleUpdateLocalMacros,
        delete: handleDeleteLocalMacros_1.handleDeleteLocalMacros,
    },
    PROGRAM: {
        create: handleCreateProgram_1.handleCreateProgram,
        get: handleGetProgram_1.handleGetProgram,
        update: handleUpdateProgram_1.handleUpdateProgram,
        delete: handleDeleteProgram_1.handleDeleteProgram,
    },
    INTERFACE: {
        create: handleCreateInterface_1.handleCreateInterface,
        get: handleGetInterface_1.handleGetInterface,
        update: handleUpdateInterface_1.handleUpdateInterface,
        delete: handleDeleteInterface_1.handleDeleteInterface,
    },
    FUNCTION_GROUP: {
        create: handleCreateFunctionGroup_1.handleCreateFunctionGroup,
        get: handleGetFunctionGroup_1.handleGetFunctionGroup,
        update: handleUpdateFunctionGroup_1.handleUpdateFunctionGroup,
        delete: handleDeleteFunctionGroup_1.handleDeleteFunctionGroup,
    },
    FUNCTION_MODULE: {
        create: handleCreateFunctionModule_1.handleCreateFunctionModule,
        get: handleGetFunctionModule_1.handleGetFunctionModule,
        update: handleUpdateFunctionModule_1.handleUpdateFunctionModule,
        delete: handleDeleteFunctionModule_1.handleDeleteFunctionModule,
    },
    BEHAVIOR_DEFINITION: {
        create: handleCreateBehaviorDefinition_1.handleCreateBehaviorDefinition,
        get: handleGetBehaviorDefinition_1.handleGetBehaviorDefinition,
        update: handleUpdateBehaviorDefinition_1.handleUpdateBehaviorDefinition,
        delete: handleDeleteBehaviorDefinition_1.handleDeleteBehaviorDefinition,
    },
    BEHAVIOR_IMPLEMENTATION: {
        create: handleCreateBehaviorImplementation_1.handleCreateBehaviorImplementation,
        get: handleGetBehaviorImplementation_1.handleGetBehaviorImplementation,
        update: handleUpdateBehaviorImplementation_1.handleUpdateBehaviorImplementation,
        delete: handleDeleteBehaviorImplementation_1.handleDeleteBehaviorImplementation,
    },
    METADATA_EXTENSION: {
        create: handleCreateMetadataExtension_1.handleCreateMetadataExtension,
        get: handleGetMetadataExtension_1.handleGetMetadataExtension,
        update: handleUpdateMetadataExtension_1.handleUpdateMetadataExtension,
        delete: handleDeleteMetadataExtension_1.handleDeleteMetadataExtension,
    },
    RUNTIME_PROFILE: {},
    RUNTIME_DUMP: {},
};
function validateCompactRouterAgainstMatrix() {
    for (const [objectType, expectedCrud] of Object.entries(compactMatrix_1.COMPACT_CRUD_MATRIX)) {
        const actualCrud = Object.keys(exports.compactRouterMap[objectType] || {}).sort();
        const expected = [...expectedCrud].sort();
        if (JSON.stringify(actualCrud) !== JSON.stringify(expected)) {
            throw new Error(`compactRouterMap mismatch for ${objectType}. Expected CRUD: [${expected.join(', ')}], got: [${actualCrud.join(', ')}]`);
        }
    }
}
validateCompactRouterAgainstMatrix();
async function routeCompactOperation(context, operation, args) {
    context.logger?.info?.(`[compact-router] route operation=${operation} object_type=${args?.object_type ?? 'undefined'}`);
    if (!args?.object_type) {
        context.logger?.warn?.(`[compact-router] object_type is required for operation=${operation}`);
        return (0, utils_1.return_error)(new Error('object_type is required'));
    }
    const handler = exports.compactRouterMap[args.object_type]?.[operation];
    if (!handler) {
        context.logger?.warn?.(`[compact-router] unsupported operation=${operation} object_type=${args.object_type}`);
        return (0, utils_1.return_error)(new Error(`Unsupported ${operation} for object_type: ${args.object_type}`));
    }
    return handler(context, args);
}
//# sourceMappingURL=compactRouter.js.map