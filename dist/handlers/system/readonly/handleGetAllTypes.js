"use strict";
/**
 * Handler for retrieving all valid ADT object types and validating a type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetAdtTypes = handleGetAdtTypes;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
exports.TOOL_DEFINITION = {
    name: 'GetAdtTypes',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve all valid ADT object types (CLAS, TABL, PROG, DEVC, FUGR, INTF, DDLS, DTEL, DOMA, SRVD, SRVB, BDEF, DDLX, etc.) or validate a specific type name.',
    inputSchema: {
        type: 'object',
        properties: {
            validate_type: {
                type: 'string',
                description: 'Type name to validate (optional)',
            },
        },
        required: [],
    },
};
function _parseObjectTypesXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true,
    });
    const result = parser.parse(xml);
    const types = [];
    const objects = result['opr:objectTypes']?.['opr:objectType'];
    if (Array.isArray(objects)) {
        for (const obj of objects) {
            types.push({
                name: obj.name,
                description: obj.text,
                provider: obj.provider,
            });
        }
    }
    else if (objects) {
        types.push({
            name: objects.name,
            description: objects.text,
            provider: objects.provider,
        });
    }
    return types;
}
function extractNamedItems(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true,
    });
    const result = parser.parse(xml);
    const items = [];
    const namedItems = result['nameditem:namedItemList']?.['nameditem:namedItem'];
    if (Array.isArray(namedItems)) {
        for (const item of namedItems) {
            items.push({
                name: item['nameditem:name'],
                description: item['nameditem:description'],
            });
        }
    }
    else if (namedItems) {
        items.push({
            name: namedItems['nameditem:name'],
            description: namedItems['nameditem:description'],
        });
    }
    return items;
}
async function handleGetAdtTypes(context, _args) {
    const { connection, logger } = context;
    try {
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client
            .getUtils()
            .getAllTypes(999, '*', 'usedByProvider');
        logger?.info('Fetched ADT object types list');
        const items = extractNamedItems(response.data);
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(items),
                },
            ],
        };
    }
    catch (error) {
        logger?.error('Failed to fetch ADT object types', error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `ADT error: ${String(error)}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetAllTypes.js.map