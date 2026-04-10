"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateServiceBinding = handleValidateServiceBinding;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const serviceBindingPayloadUtils_1 = require("./serviceBindingPayloadUtils");
exports.TOOL_DEFINITION = {
    name: 'ValidateServiceBinding',
    available_in: ['onprem', 'cloud'],
    description: 'Validate service binding parameters (name, service definition, package, version) via ADT validation endpoint.',
    inputSchema: {
        type: 'object',
        properties: {
            service_binding_name: {
                type: 'string',
                description: 'Service binding name to validate.',
            },
            description: {
                type: 'string',
                description: 'Optional description used during validation.',
            },
            service_definition_name: {
                type: 'string',
                description: 'Service definition linked to binding.',
            },
            package_name: {
                type: 'string',
                description: 'ABAP package for the binding.',
            },
            service_binding_version: {
                type: 'string',
                description: 'Service binding version (for example: 1.0).',
            },
        },
        required: ['service_binding_name', 'service_definition_name'],
    },
};
async function handleValidateServiceBinding(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.service_binding_name) {
            throw new Error('service_binding_name is required');
        }
        if (!args?.service_definition_name) {
            throw new Error('service_definition_name is required');
        }
        const serviceBindingName = args.service_binding_name.trim().toUpperCase();
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client.getServiceBinding().validateServiceBinding({
            objname: serviceBindingName,
            serviceDefinition: args.service_definition_name.trim().toUpperCase(),
            serviceBindingVersion: args.service_binding_version?.trim() || undefined,
            description: args.description?.trim() || undefined,
            package: args.package_name?.trim().toUpperCase() || undefined,
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                service_binding_name: serviceBindingName,
                status: response.status,
                payload: (0, serviceBindingPayloadUtils_1.parseServiceBindingPayload)(response.data, 'xml'),
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error validating service binding:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleValidateServiceBinding.js.map