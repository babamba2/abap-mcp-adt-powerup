"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadPackage = handleReadPackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadPackage',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Read ABAP package definition and metadata (super-package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., Z_MY_PACKAGE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['package_name'],
    },
};
async function handleReadPackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, version = 'active' } = args;
        if (!package_name)
            return (0, utils_1.return_error)(new Error('package_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const packageName = package_name.toUpperCase();
        const obj = client.getPackage();
        let source_code = null;
        try {
            const readResult = await obj.read({ packageName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${packageName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ packageName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${packageName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                package_name: packageName,
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
//# sourceMappingURL=handleReadPackage.js.map