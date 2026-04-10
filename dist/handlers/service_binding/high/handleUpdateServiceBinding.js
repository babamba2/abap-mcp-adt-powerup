"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateServiceBinding = handleUpdateServiceBinding;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const serviceBindingPayloadUtils_1 = require("./serviceBindingPayloadUtils");
exports.TOOL_DEFINITION = {
    name: 'UpdateServiceBinding',
    available_in: ['onprem', 'cloud'],
    description: 'Update publication state for ABAP service binding via AdtServiceBinding workflow.',
    inputSchema: {
        type: 'object',
        properties: {
            service_binding_name: {
                type: 'string',
                description: 'Service binding name to update.',
            },
            desired_publication_state: {
                type: 'string',
                enum: ['published', 'unpublished', 'unchanged'],
                description: 'Target publication state.',
            },
            service_type: {
                type: 'string',
                enum: ['ODataV2', 'ODataV4'],
                description: 'OData service type for publish/unpublish action routing.',
                default: 'ODataV4',
            },
            service_name: {
                type: 'string',
                description: 'Published service name.',
            },
            service_version: {
                type: 'string',
                description: 'Published service version. Optional.',
            },
            response_format: {
                type: 'string',
                enum: ['xml', 'json', 'plain'],
                default: 'xml',
            },
        },
        required: [
            'service_binding_name',
            'desired_publication_state',
            'service_type',
            'service_name',
        ],
    },
};
async function handleUpdateServiceBinding(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.service_binding_name) {
            throw new Error('service_binding_name is required');
        }
        if (!args?.desired_publication_state) {
            throw new Error('desired_publication_state is required');
        }
        if (!args?.service_name) {
            throw new Error('service_name is required');
        }
        const serviceBindingName = args.service_binding_name.trim().toUpperCase();
        const responseFormat = args.response_format ?? 'xml';
        const serviceType = args.service_type === 'ODataV2' ? 'odatav2' : 'odatav4';
        const serviceName = args.service_name.trim().toUpperCase();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client.getServiceBinding().updateServiceBinding({
            bindingName: serviceBindingName,
            desiredPublicationState: args.desired_publication_state,
            serviceType,
            serviceName,
            serviceVersion: args.service_version?.trim() || undefined,
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                service_binding_name: serviceBindingName,
                desired_publication_state: args.desired_publication_state,
                service_type: args.service_type,
                service_name: serviceName,
                service_version: args.service_version || null,
                response_format: responseFormat,
                status: response.status,
                payload: (0, serviceBindingPayloadUtils_1.parseServiceBindingPayload)(response.data, responseFormat),
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error updating service binding:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateServiceBinding.js.map