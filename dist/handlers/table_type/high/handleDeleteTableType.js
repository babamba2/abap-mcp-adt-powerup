"use strict";
/**
 * DeleteTableType — DDIC table type (TTYP).
 * S/4HANA via ADT (client library); ECC via ZMCP_ADT_DDIC_TTYP DELETE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteTableType = handleDeleteTableType;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteTableType',
    available_in: ['onprem', 'cloud'],
    description: 'Delete a DDIC table type (TTYP). Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            table_type_name: { type: 'string', description: 'Table type name.' },
            transport_request: {
                type: 'string',
                description: 'Transport request. Required unless the object is local ($TMP).',
            },
        },
        required: ['table_type_name'],
    },
};
async function handleDeleteTableType(context, args) {
    const { connection, logger } = context;
    const name = (args?.table_type_name ?? '').toUpperCase();
    if (!name)
        return (0, utils_1.return_error)(new Error('table_type_name is required'));
    try {
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            await (0, rfcBackend_1.callDdicTtyp)(connection, 'DELETE', {
                name,
                transport: args.transport_request,
            });
        }
        else {
            const client = (0, clients_1.createAdtClient)(connection, logger);
            await client.getTableType().delete({
                tableTypeName: name,
                transportRequest: args.transport_request,
            });
        }
        const ecc = process.env.SAP_VERSION?.toUpperCase() === 'ECC';
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                table_type_name: name,
                transport_request: args.transport_request || null,
                message: `Table type ${name} deleted successfully${ecc ? ` (ECC fallback via ${(0, rfcBackend_1.eccBridgeVia)()})` : ''}.`,
                ...(ecc ? { path: (0, rfcBackend_1.eccBridgePath)() } : {}),
            }, null, 2),
        });
    }
    catch (error) {
        return (0, utils_1.return_error)(new Error(`Failed to delete table type ${name}: ${error?.message || String(error)}`));
    }
}
//# sourceMappingURL=handleDeleteTableType.js.map