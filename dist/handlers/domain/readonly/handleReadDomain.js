"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadDomain = handleReadDomain;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadDomain',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP domain definition and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., Z_MY_DOMAIN).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['domain_name'],
    },
};
async function handleReadDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, version = 'active' } = args;
        if (!domain_name)
            return (0, utils_1.return_error)(new Error('domain_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const domainName = domain_name.toUpperCase();
        const obj = client.getDomain();
        let source_code = null;
        try {
            const readResult = await obj.read({ domainName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${domainName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ domainName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${domainName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                domain_name: domainName,
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
//# sourceMappingURL=handleReadDomain.js.map