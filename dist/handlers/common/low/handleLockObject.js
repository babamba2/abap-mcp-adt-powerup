"use strict";
/**
 * LockObject Handler - Lock ABAP object for modification via ADT API
 *
 * Uses AdtClient lock methods for specific object types.
 * Returns lock handle that must be reused with the same session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockObject = handleLockObject;
const clients_1 = require("../../../lib/clients");
const sessionUtils_1 = require("../../../lib/sessionUtils");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'LockObjectLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Lock an ABAP object for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.',
    inputSchema: {
        type: 'object',
        properties: {
            object_name: {
                type: 'string',
                description: 'Object name (e.g., ZCL_MY_CLASS, Z_MY_PROGRAM, ZIF_MY_INTERFACE). For function modules, use format GROUP|FM_NAME',
            },
            object_type: {
                type: 'string',
                description: 'Object type',
                enum: [
                    'class',
                    'program',
                    'interface',
                    'function_group',
                    'function_module',
                    'table',
                    'structure',
                    'view',
                    'domain',
                    'data_element',
                    'package',
                    'behavior_definition',
                    'metadata_extension',
                ],
            },
            super_package: {
                type: 'string',
                description: 'Super package (required for package locking)',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['object_name', 'object_type'],
    },
};
async function handleLockObject(context, args) {
    const { connection, logger } = context;
    try {
        const { object_name, object_type, super_package, session_id, session_state, } = args;
        if (!object_name || !object_type) {
            return (0, utils_1.return_error)(new Error('object_name and object_type are required'));
        }
        const validTypes = [
            'class',
            'program',
            'interface',
            'function_group',
            'function_module',
            'table',
            'structure',
            'view',
            'domain',
            'data_element',
            'package',
            'behavior_definition',
            'metadata_extension',
        ];
        const objectType = object_type.toLowerCase();
        if (!validTypes.includes(objectType)) {
            return (0, utils_1.return_error)(new Error(`Invalid object_type. Must be one of: ${validTypes.join(', ')}`));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        const desiredSessionId = session_id || (0, sessionUtils_1.generateSessionId)();
        const objectName = object_name.toUpperCase();
        logger?.info(`Starting object lock: ${objectName} (type: ${objectType}, session: ${desiredSessionId.substring(0, 8)}...)`);
        try {
            let lockHandle;
            switch (objectType) {
                case 'class':
                    lockHandle = await client.getClass().lock({ className: objectName });
                    break;
                case 'program':
                    lockHandle = await client
                        .getProgram()
                        .lock({ programName: objectName });
                    break;
                case 'interface':
                    lockHandle = await client
                        .getInterface()
                        .lock({ interfaceName: objectName });
                    break;
                case 'function_group':
                    lockHandle = await client
                        .getFunctionGroup()
                        .lock({ functionGroupName: objectName });
                    break;
                case 'function_module':
                    return (0, utils_1.return_error)(new Error('Function module locking via LockObject is not supported. Use function-module-specific handler.'));
                case 'table':
                    lockHandle = await client.getTable().lock({ tableName: objectName });
                    break;
                case 'structure':
                    lockHandle = await client
                        .getStructure()
                        .lock({ structureName: objectName });
                    break;
                case 'view':
                    lockHandle = await client.getView().lock({ viewName: objectName });
                    break;
                case 'domain':
                    lockHandle = await client
                        .getDomain()
                        .lock({ domainName: objectName });
                    break;
                case 'data_element':
                    lockHandle = await client
                        .getDataElement()
                        .lock({ dataElementName: objectName });
                    break;
                case 'behavior_definition':
                    lockHandle = await client
                        .getBehaviorDefinition()
                        .lock({ name: objectName });
                    break;
                case 'metadata_extension':
                    lockHandle = await client
                        .getMetadataExtension()
                        .lock({ name: objectName });
                    break;
                case 'package':
                    if (!super_package) {
                        return (0, utils_1.return_error)(new Error('super_package is required for package locking.'));
                    }
                    lockHandle = await client.getPackage().lock({
                        packageName: objectName,
                        superPackage: super_package.toUpperCase(),
                    });
                    break;
                default:
                    return (0, utils_1.return_error)(new Error(`Unsupported object_type: ${object_type}`));
            }
            if (!lockHandle) {
                throw new Error(`Lock did not return a lock handle for object ${objectName}`);
            }
            logger?.info(`✅ LockObject completed: ${objectName}`);
            logger?.info(`   Lock handle: ${lockHandle.substring(0, 20)}...`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    object_name: objectName,
                    object_type: objectType,
                    session_id: desiredSessionId,
                    lock_handle: lockHandle,
                    session_state: null, // Session state management is now handled by auth-broker
                    message: `Object ${objectName} locked successfully. Use this lock_handle and session_id for subsequent update/unlock operations.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error locking object ${objectName}:`, error);
            let errorMessage = `Failed to lock object: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Object ${objectName} not found.`;
            }
            else if (error.response?.status === 409) {
                errorMessage = `Object ${objectName} is already locked by another user.`;
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
//# sourceMappingURL=handleLockObject.js.map