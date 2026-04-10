"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadServiceBinding = handleReadServiceBinding;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadServiceBinding',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP service binding source/payload and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            service_binding_name: {
                type: 'string',
                description: 'Service binding name (e.g., ZUI_MY_BINDING).',
            },
        },
        required: ['service_binding_name'],
    },
};
async function handleReadServiceBinding(context, args) {
    const { connection, logger } = context;
    try {
        const { service_binding_name } = args;
        if (!service_binding_name)
            return (0, utils_1.return_error)(new Error('service_binding_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const bindingName = service_binding_name.trim().toUpperCase();
        const obj = client.getServiceBinding();
        let source_code = null;
        try {
            const readResult = await obj.read({ bindingName });
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${bindingName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ bindingName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${bindingName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                service_binding_name: bindingName,
                source_code,
                metadata,
            }, null, 2),
        });
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
function safeStringify(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return String(data);
    }
}
//# sourceMappingURL=handleReadServiceBinding.js.map