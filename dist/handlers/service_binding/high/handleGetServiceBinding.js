"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetServiceBinding = handleGetServiceBinding;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const serviceBindingPayloadUtils_1 = require("./serviceBindingPayloadUtils");
exports.TOOL_DEFINITION = {
    name: 'GetServiceBinding',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP service binding source/metadata by name via ADT Business Services endpoint.',
    inputSchema: {
        type: 'object',
        properties: {
            service_binding_name: {
                type: 'string',
                description: 'Service binding name (for example: ZUI_MY_BINDING). Case-insensitive.',
            },
            response_format: {
                type: 'string',
                enum: ['xml', 'json', 'plain'],
                description: 'Preferred response format. "json" requests JSON from endpoint, "xml" parses XML payload, "plain" returns raw text.',
                default: 'xml',
            },
        },
        required: ['service_binding_name'],
    },
};
async function handleGetServiceBinding(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.service_binding_name) {
            throw new Error('service_binding_name is required');
        }
        const serviceBindingName = args.service_binding_name.trim().toUpperCase();
        const responseFormat = args.response_format ?? 'xml';
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const state = await client.getServiceBinding().read({
            bindingName: serviceBindingName,
        });
        const response = state?.readResult;
        if (!response) {
            throw new Error(`Read did not return a response for service binding ${serviceBindingName}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                service_binding_name: serviceBindingName,
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
        logger?.error('Error reading service binding:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetServiceBinding.js.map