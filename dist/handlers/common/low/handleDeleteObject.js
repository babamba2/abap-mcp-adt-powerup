"use strict";
/**
 * DeleteObject Handler - Delete ABAP objects via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteObject = handleDeleteObject;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteObjectLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Delete an ABAP object via ADT deletion API. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            object_name: {
                type: 'string',
                description: 'Object name (e.g., ZCL_MY_CLASS)',
            },
            object_type: {
                type: 'string',
                description: 'Object type (class/program/interface/function_group/function_module/table/structure/view/domain/data_element/behavior_definition/metadata_extension)',
            },
            function_group_name: {
                type: 'string',
                description: 'Required only for function_module type',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number',
            },
        },
        required: ['object_name', 'object_type'],
    },
};
async function handleDeleteObject(context, args) {
    const { connection, logger } = context;
    try {
        const { object_name, object_type, function_group_name, transport_request } = args;
        if (!object_name || !object_type) {
            return (0, utils_1.return_error)(new Error('object_name and object_type are required'));
        }
        const crudClient = (0, clients_1.createAdtClient)(connection, logger);
        const objectName = object_name.toUpperCase();
        const objectType = object_type.toLowerCase();
        logger?.info(`Starting object deletion: ${objectName} (type: ${object_type})`);
        try {
            let response;
            switch (objectType) {
                case 'class':
                case 'clas/oc':
                    response = (await crudClient.getClass().delete({
                        className: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'program':
                case 'prog/p':
                    response = (await crudClient.getProgram().delete({
                        programName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'interface':
                case 'intf/oi':
                    response = (await crudClient.getInterface().delete({
                        interfaceName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'function_group':
                case 'fugr/f':
                    response = (await crudClient.getFunctionGroup().delete({
                        functionGroupName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'function_module':
                case 'fugr/ff':
                    if (!function_group_name) {
                        return (0, utils_1.return_error)(new Error('function_group_name is required for function_module deletion.'));
                    }
                    response = (await crudClient.getFunctionModule().delete({
                        functionGroupName: function_group_name.toUpperCase(),
                        functionModuleName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'table':
                case 'tabl/dt':
                    response = (await crudClient.getTable().delete({
                        tableName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'structure':
                case 'ttyp/st':
                    response = (await crudClient.getStructure().delete({
                        structureName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'view':
                case 'ddls/df':
                    response = (await crudClient.getView().delete({
                        viewName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'domain':
                case 'doma/dm':
                    response = (await crudClient.getDomain().delete({
                        domainName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'data_element':
                case 'dtel/de':
                    response = (await crudClient.getDataElement().delete({
                        dataElementName: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'behavior_definition':
                case 'bdef/bd':
                    response = (await crudClient.getBehaviorDefinition().delete({
                        name: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                case 'metadata_extension':
                case 'ddlx/ex':
                    response = (await crudClient.getMetadataExtension().delete({
                        name: objectName,
                        transportRequest: transport_request,
                    })).deleteResult;
                    break;
                default:
                    return (0, utils_1.return_error)(new Error(`Unsupported object_type: ${object_type}`));
            }
            if (!response) {
                throw new Error(`Delete did not return a response for object ${objectName}`);
            }
            logger?.info(`✅ DeleteObject completed successfully: ${objectName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    object_name: objectName,
                    object_type: objectType,
                    transport_request: transport_request || null,
                    message: `Object ${objectName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting object ${objectName}:`, error);
            let errorMessage = `Failed to delete object: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Object ${objectName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Object ${objectName} is locked by another user. Cannot delete.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Bad request. Check if transport request is required and valid.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
                try {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    const errorData = parser.parse(error.response.data);
                    const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                        errorData['exc:exception']?.message;
                    if (errorMsg) {
                        errorMessage = `SAP Error: ${errorMsg}`;
                    }
                }
                catch {
                    // ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleDeleteObject.js.map