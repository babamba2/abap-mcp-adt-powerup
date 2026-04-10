"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleListServiceBindingTypes = handleListServiceBindingTypes;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const serviceBindingPayloadUtils_1 = require("./serviceBindingPayloadUtils");
exports.TOOL_DEFINITION = {
    name: 'ListServiceBindingTypes',
    available_in: ['onprem', 'cloud'],
    description: 'List available service binding types (for example ODataV2/ODataV4) from ADT Business Services endpoint.',
    inputSchema: {
        type: 'object',
        properties: {
            response_format: {
                type: 'string',
                enum: ['xml', 'json', 'plain'],
                default: 'xml',
            },
        },
    },
};
async function handleListServiceBindingTypes(context, args = {}) {
    const { connection, logger } = context;
    try {
        const responseFormat = args.response_format ?? 'xml';
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client.getServiceBinding().getServiceBindingTypes();
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
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
        logger?.error('Error listing service binding types:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleListServiceBindingTypes.js.map