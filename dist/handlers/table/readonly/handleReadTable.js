"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadTable = handleReadTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadTable',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Read ABAP table definition and metadata (package, responsible, description, etc.).',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., Z_MY_TABLE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['table_name'],
    },
};
async function handleReadTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, version = 'active' } = args;
        if (!table_name)
            return (0, utils_1.return_error)(new Error('table_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const tableName = table_name.toUpperCase();
        const obj = client.getTable();
        let source_code = null;
        try {
            const readResult = await obj.read({ tableName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${tableName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ tableName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${tableName}: ${e?.message}`);
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                table_name: tableName,
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
//# sourceMappingURL=handleReadTable.js.map