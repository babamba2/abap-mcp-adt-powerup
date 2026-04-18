"use strict";
/**
 * UpdateDataElement Handler - Update ABAP Data Element Properties
 *
 * Uses AdtClient.updateDataElement from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateDataElement = handleUpdateDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Update properties of an existing ABAP data element. Requires lock handle from LockObject. - use UpdateDataElement (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name (e.g., ZOK_E_TEST_0001). Data element must already exist.',
            },
            properties: {
                type: 'object',
                description: 'Data element properties object. Can include: description, type_name, type_kind, data_type, field_label_short, field_label_medium, field_label_long, etc.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. Required for update operation.',
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
        required: ['data_element_name', 'properties', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateDataElement MCP tool
 *
 * Uses AdtClient.updateDataElement - low-level single method call
 */
async function handleUpdateDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, properties, lock_handle, session_id, session_state, } = args;
        // Validation
        if (!data_element_name || !properties || !lock_handle) {
            return (0, utils_1.return_error)(new Error('data_element_name, properties, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element update: ${dataElementName}`);
        // Validate required properties
        const packageName = properties.package_name || properties.packageName;
        if (!packageName) {
            const errorMsg = 'Package name is required in properties';
            logger?.error(errorMsg);
            return (0, utils_1.return_error)(new Error(errorMsg));
        }
        try {
            // Map properties to DataElementBuilderConfig format
            // Convert snake_case to camelCase and handle all properties
            const updateConfig = {
                dataElementName,
                packageName: packageName,
                description: properties.description || properties.description || undefined,
                typeKind: properties.type_kind || properties.typeKind,
                typeName: properties.type_name || properties.typeName,
                dataType: properties.data_type || properties.dataType,
                length: properties.length,
                decimals: properties.decimals,
                shortLabel: properties.field_label_short ||
                    properties.short_label ||
                    properties.shortLabel,
                mediumLabel: properties.field_label_medium ||
                    properties.medium_label ||
                    properties.mediumLabel,
                longLabel: properties.field_label_long ||
                    properties.long_label ||
                    properties.longLabel,
                headingLabel: properties.field_label_heading ||
                    properties.heading_label ||
                    properties.headingLabel,
                transportRequest: properties.transport_request || properties.transportRequest,
            };
            // Remove undefined values
            Object.keys(updateConfig).forEach((key) => {
                if (updateConfig[key] === undefined || updateConfig[key] === '') {
                    delete updateConfig[key];
                }
            });
            // Update data element with properties
            const updateState = await client
                .getDataElement()
                .update(updateConfig, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                logger?.error(`Update did not return a response for data element ${dataElementName}`);
                throw new Error(`Update did not return a response for data element ${dataElementName}`);
            }
            // Get updated session state after update
            logger?.info(`✅ UpdateDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Data element ${dataElementName} updated successfully. Remember to unlock using UnlockObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error updating data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Data element ${dataElementName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Data element ${dataElementName} is locked by another user or lock handle is invalid.`;
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
                catch (_parseError) {
                    // Ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateDataElement.js.map