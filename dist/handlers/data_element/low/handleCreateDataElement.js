"use strict";
/**
 * CreateDataElement Handler - Create ABAP DataElement
 *
 * Uses AdtClient.createDataElement from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateDataElement = handleCreateDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateDataElementLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP data element. - use CreateDataElement (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'DataElement name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'DataElement description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            data_type: {
                type: 'string',
                description: "Data type (e.g., CHAR, NUMC) or domain name when type_kind is 'E' or 'domain'.",
            },
            type_kind: {
                type: 'string',
                description: "Type kind: 'E' for domain-based, 'P' for predefined type, etc.",
            },
            type_name: {
                type: 'string',
                description: "Type name: domain name (when type_kind is 'domain'), data element name (when type_kind is 'refToDictionaryType'), or class name (when type_kind is 'refToClifType')",
            },
            length: {
                type: 'number',
                description: 'Data type length (for predefinedAbapType or refToPredefinedAbapType)',
            },
            decimals: {
                type: 'number',
                description: 'Decimal places (for predefinedAbapType or refToPredefinedAbapType)',
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
        required: ['data_element_name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateDataElement MCP tool
 *
 * Uses AdtClient.createDataElement - low-level single method call
 */
async function handleCreateDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, description, package_name, transport_request, data_type, type_kind, type_name, length, decimals, session_id, session_state, } = args;
        // Validation
        if (!data_element_name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('data_element_name, description, and package_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const dataElementName = data_element_name.toUpperCase();
        logger?.info(`Starting data element creation: ${dataElementName}`);
        try {
            // Determine typeKind based on type_kind parameter
            // Supports both short form ('E', 'P') and full form ('domain', 'predefinedAbapType')
            const typeKindMap = {
                // Short forms
                E: 'domain',
                P: 'predefinedAbapType',
                R: 'refToPredefinedAbapType',
                D: 'refToDictionaryType',
                C: 'refToClifType',
                // Full forms
                domain: 'domain',
                predefinedAbapType: 'predefinedAbapType',
                refToPredefinedAbapType: 'refToPredefinedAbapType',
                refToDictionaryType: 'refToDictionaryType',
                refToClifType: 'refToClifType',
            };
            const rawTypeKind = type_kind || 'E';
            const typeKind = typeKindMap[rawTypeKind] || 'domain';
            // Create data element
            const createConfig = {
                dataElementName,
                description,
                packageName: package_name,
                typeKind,
                dataType: data_type,
                typeName: type_name,
                length: length,
                decimals: decimals,
                transportRequest: transport_request,
            };
            const createState = await client.getDataElement().create(createConfig);
            const createResult = createState.createResult;
            if (!createResult) {
                logger?.error(`Create did not return a response for data element ${dataElementName}`);
                throw new Error(`Create did not return a response for data element ${dataElementName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateDataElement completed: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `DataElement ${dataElementName} created successfully. Use LockDataElement and UpdateDataElement to add source code, then UnlockDataElement and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to create data element: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `DataElement ${dataElementName} already exists.`;
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
//# sourceMappingURL=handleCreateDataElement.js.map