"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateServiceBinding = handleCreateServiceBinding;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const serviceBindingPayloadUtils_1 = require("./serviceBindingPayloadUtils");
exports.TOOL_DEFINITION = {
    name: 'CreateServiceBinding',
    available_in: ['onprem', 'cloud'],
    description: 'Create ABAP service binding via ADT Business Services endpoint. XML is generated from high-level parameters.',
    inputSchema: {
        type: 'object',
        properties: {
            service_binding_name: {
                type: 'string',
                description: 'Service binding name.',
            },
            service_definition_name: {
                type: 'string',
                description: 'Referenced service definition name.',
            },
            package_name: {
                type: 'string',
                description: 'ABAP package name.',
            },
            description: {
                type: 'string',
                description: 'Optional description. Defaults to service_binding_name when omitted.',
            },
            binding_type: {
                type: 'string',
                enum: ['ODataV2', 'ODataV4'],
                description: 'OData binding type.',
                default: 'ODataV4',
            },
            service_binding_version: {
                type: 'string',
                description: 'Service binding ADT version. Default inferred from type.',
            },
            service_name: {
                type: 'string',
                description: 'Published service name. Default: service_binding_name if omitted.',
            },
            service_version: {
                type: 'string',
                description: 'Published service version. Default: 0001.',
            },
            transport_request: {
                type: 'string',
                description: 'Optional transport request for transport checks.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate service binding after create. Default: true.',
                default: true,
            },
            response_format: {
                type: 'string',
                enum: ['xml', 'json', 'plain'],
                default: 'xml',
            },
        },
        required: [
            'service_binding_name',
            'service_definition_name',
            'package_name',
        ],
    },
};
async function handleCreateServiceBinding(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.service_binding_name) {
            throw new Error('service_binding_name is required');
        }
        if (!args?.service_definition_name) {
            throw new Error('service_definition_name is required');
        }
        if (!args?.package_name) {
            throw new Error('package_name is required');
        }
        const serviceBindingName = args.service_binding_name.trim().toUpperCase();
        const serviceDefinitionName = args.service_definition_name
            .trim()
            .toUpperCase();
        const packageName = args.package_name.trim().toUpperCase();
        const responseFormat = args.response_format ?? 'xml';
        const bindingType = args.binding_type === 'ODataV2' ? 'ODATA' : 'ODATA';
        const bindingVersion = args.service_binding_version ??
            (args.binding_type === 'ODataV2' ? 'V2' : 'V4');
        const serviceType = args.binding_type === 'ODataV2' ? 'odatav2' : 'odatav4';
        const serviceName = (args.service_name || serviceBindingName)
            .trim()
            .toUpperCase();
        const serviceVersion = (args.service_version || '0001').trim();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const state = await client.getServiceBinding().create({
            bindingName: serviceBindingName,
            packageName: packageName,
            description: (args.description || serviceBindingName).trim(),
            serviceDefinitionName,
            serviceName,
            serviceVersion,
            bindingType,
            bindingVersion,
            transportRequest: args.transport_request,
            serviceType,
        }, { activateOnCreate: args.activate !== false });
        const response = state.createResult;
        if (!response) {
            throw new Error(`Create did not return a response for service binding ${serviceBindingName}`);
        }
        const readPayload = state.readResult
            ? (0, serviceBindingPayloadUtils_1.parseServiceBindingPayload)(state.readResult.data, responseFormat)
            : undefined;
        const generatedPayload = state.generatedInfoResult
            ? (0, serviceBindingPayloadUtils_1.parseServiceBindingPayload)(state.generatedInfoResult.data, responseFormat)
            : undefined;
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                service_binding_name: serviceBindingName,
                service_definition_name: serviceDefinitionName,
                package_name: packageName,
                binding_type: args.binding_type ?? 'ODataV4',
                service_binding_version: bindingVersion,
                service_name: serviceName,
                service_version: serviceVersion,
                activated: args.activate !== false,
                response_format: responseFormat,
                status: response.status,
                payload: (0, serviceBindingPayloadUtils_1.parseServiceBindingPayload)(response.data, responseFormat),
                read_payload: readPayload,
                generated_info: generatedPayload,
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error creating service binding:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateServiceBinding.js.map