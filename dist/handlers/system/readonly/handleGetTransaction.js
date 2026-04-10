"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetTransaction = handleGetTransaction;
// import { McpError, ErrorCode } from '../../../lib/utils';
const fast_xml_parser_1 = require("fast-xml-parser");
// import { createAdtClient } from '../../../lib/clients';
exports.TOOL_DEFINITION = {
    name: 'GetTransaction',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve ABAP transaction (t-code) details — program, screen, authorization object, and transaction type (dialog, report, OO).',
    inputSchema: {
        type: 'object',
        properties: {
            transaction_name: {
                type: 'string',
                description: 'Name of the ABAP transaction',
            },
        },
        required: ['transaction_name'],
    },
};
function _parseTransactionXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true,
    });
    const result = parser.parse(xml);
    // ADT Transaction XML (opr:objectProperties)
    if (result['opr:objectProperties']?.['opr:object']) {
        const obj = result['opr:objectProperties']['opr:object'];
        return {
            name: obj.name,
            objectType: 'transaction',
            description: obj.text,
            package: obj.package,
            type: obj.type,
        };
    }
    // fallback: return raw
    return { raw: result };
}
async function handleGetTransaction(context, _args) {
    const { connection, logger } = context;
    // try {
    //     if (!args?.transaction_name) {
    //         throw new McpError(ErrorCode.InvalidParams, 'Transaction name is required');
    //     }
    //     logger?.info(`Fetching transaction info for ${args.transaction_name}`);
    //     const client = createAdtClient(connection);
    //     const result = await client.readTransaction(args.transaction_name);
    //     return result;
    // } catch (error) {
    //     logger?.error(`Failed to fetch transaction ${args?.transaction_name}`, error as any);
    //     // MCP-compliant error response: always return content[] with type "text"
    //     return {
    //         isError: true,
    //         content: [
    //             {
    //                 type: "text",
    //                 text: `ADT error: ${String(error)}`
    //             }
    //         ]
    //     };
    // }
    return {
        isError: false,
        content: [{ type: 'json', json: { message: 'Not implemented' } }],
    };
}
//# sourceMappingURL=handleGetTransaction.js.map