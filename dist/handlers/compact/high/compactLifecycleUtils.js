"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLowObjectType = toLowObjectType;
const compactToLowMap = {
    CLASS: 'class',
    PROGRAM: 'program',
    INTERFACE: 'interface',
    FUNCTION_GROUP: 'function_group',
    FUNCTION_MODULE: 'function_module',
    TABLE: 'table',
    STRUCTURE: 'structure',
    VIEW: 'view',
    DOMAIN: 'domain',
    DATA_ELEMENT: 'data_element',
    PACKAGE: 'package',
    BEHAVIOR_DEFINITION: 'behavior_definition',
    BEHAVIOR_IMPLEMENTATION: 'behavior_implementation',
    METADATA_EXTENSION: 'metadata_extension',
};
function toLowObjectType(objectType) {
    return compactToLowMap[objectType] || null;
}
//# sourceMappingURL=compactLifecycleUtils.js.map