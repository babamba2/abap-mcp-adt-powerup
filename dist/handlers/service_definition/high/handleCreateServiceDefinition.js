"use strict";
/**
 * CreateServiceDefinition Handler - ABAP Service Definition Creation via ADT API
 *
 * Uses AdtClient from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by client.
 *
 * Workflow: validate -> create -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateServiceDefinition = handleCreateServiceDefinition;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateServiceDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP service definition for OData services. Service definitions define the structure and behavior of OData services. Uses stateful session for proper lock management.',
    inputSchema: {
        type: 'object',
        properties: {
            service_definition_name: {
                type: 'string',
                description: 'Service definition name (e.g., ZSD_MY_SERVICE). Must follow SAP naming conventions (start with Z or Y).',
            },
            description: {
                type: 'string',
                description: 'Service definition description. If not provided, service_definition_name will be used.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            source_code: {
                type: 'string',
                description: 'Service definition source code (optional). If not provided, a minimal template will be created.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate service definition after creation. Default: true.',
            },
        },
        required: ['service_definition_name', 'package_name'],
    },
};
/**
 * Main handler for CreateServiceDefinition MCP tool
 *
 * Uses AdtClient.createServiceDefinition
 */
async function handleCreateServiceDefinition(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.service_definition_name) {
            return (0, utils_1.return_error)(new Error('service_definition_name is required'));
        }
        if (!args?.package_name) {
            return (0, utils_1.return_error)(new Error('package_name is required'));
        }
        // Validate transport_request: required for non-$TMP packages
        try {
            (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
        }
        catch (error) {
            return (0, utils_1.return_error)(error);
        }
        const typedArgs = args;
        // Get connection from session context (set by ProtocolHandler)
        // Connection is managed and cached per session, with proper token refresh via AuthBroker
        const serviceDefinitionName = typedArgs.service_definition_name.toUpperCase();
        logger?.info(`Starting service definition creation: ${serviceDefinitionName}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            const shouldActivate = typedArgs.activate !== false; // Default to true if not specified
            let activateResponse;
            // Validate
            await client.getServiceDefinition().validate({
                serviceDefinitionName,
                description: typedArgs.description || serviceDefinitionName,
            });
            // Create
            const createConfig = {
                serviceDefinitionName,
                description: typedArgs.description || serviceDefinitionName,
                packageName: typedArgs.package_name.toUpperCase(),
                transportRequest: typedArgs.transport_request,
                ...(typedArgs.source_code && { sourceCode: typedArgs.source_code }),
            };
            const createState = await client
                .getServiceDefinition()
                .create(createConfig);
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for service definition ${serviceDefinitionName}`);
            }
            // Post-create syntax check on the staged inactive version.
            // Surfaces ALL compile errors with structured diagnostics.
            const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'serviceDefinition', name: serviceDefinitionName });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Service Definition', serviceDefinitionName);
            // Activate if requested
            if (shouldActivate) {
                const activateState = await client
                    .getServiceDefinition()
                    .activate({ serviceDefinitionName });
                activateResponse = activateState.activateResult;
            }
            // Parse activation warnings if activation was performed
            let activationWarnings = [];
            if (shouldActivate &&
                activateResponse &&
                typeof activateResponse.data === 'string' &&
                activateResponse.data.includes('<chkl:messages')) {
                const parser = new fast_xml_parser_1.XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const result = parser.parse(activateResponse.data);
                const messages = result?.['chkl:messages']?.msg;
                if (messages) {
                    const msgArray = Array.isArray(messages) ? messages : [messages];
                    activationWarnings = msgArray.map((msg) => `${msg['@_type']}: ${msg.shortText?.txt || 'Unknown'}`);
                }
            }
            logger?.info(`✅ CreateServiceDefinition completed successfully: ${serviceDefinitionName}`);
            // Return success result
            const stepsCompleted = ['validate', 'create'];
            if (shouldActivate) {
                stepsCompleted.push('activate');
            }
            const result = {
                success: true,
                service_definition_name: serviceDefinitionName,
                package_name: typedArgs.package_name.toUpperCase(),
                transport_request: typedArgs.transport_request || null,
                type: 'SRVD/SRV',
                message: shouldActivate
                    ? `Service Definition ${serviceDefinitionName} created and activated successfully`
                    : `Service Definition ${serviceDefinitionName} created successfully (not activated)`,
                uri: `/sap/bc/adt/ddic/srvd/sources/${(0, utils_1.encodeSapObjectName)(serviceDefinitionName)}`,
                steps_completed: stepsCompleted,
                activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
            };
            return (0, utils_1.return_response)({
                data: JSON.stringify(result, null, 2),
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error creating service definition ${serviceDefinitionName}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error creating service definition ${serviceDefinitionName}:`, error);
            // Check if service definition already exists
            if (error.message?.includes('already exists') ||
                error.response?.status === 409) {
                return (0, utils_1.return_error)(new Error(`Service Definition ${serviceDefinitionName} already exists. Please delete it first or use a different name.`));
            }
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            return (0, utils_1.return_error)(new Error(`Failed to create service definition: ${errorMessage}`));
        }
    }
    catch (error) {
        logger?.error('CreateServiceDefinition handler error:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateServiceDefinition.js.map