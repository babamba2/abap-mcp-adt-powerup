"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadDataElement = handleReadDataElement;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadDataElement',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP data element definition and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name (e.g., Z_MY_DATA_ELEMENT).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['data_element_name'],
    },
};
async function handleReadDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, version = 'active' } = args;
        if (!data_element_name)
            return (0, utils_1.return_error)(new Error('data_element_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const dataElementName = data_element_name.toUpperCase();
        const obj = client.getDataElement();
        let source_code = null;
        try {
            const readResult = await obj.read({ dataElementName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${dataElementName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ dataElementName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${dataElementName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                data_element_name: dataElementName,
                version,
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
//# sourceMappingURL=handleReadDataElement.js.map