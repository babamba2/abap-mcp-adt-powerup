"use strict";
/**
 * @TODO Migrate to infrastructure module
 * Endpoints: Multiple fallback chain:
 * - /sap/bc/adt/ddic/domains/{name}/source/main
 * - /sap/bc/adt/ddic/dataelements/{name}
 * - /sap/bc/adt/ddic/tabletypes/{name}
 * - /sap/bc/adt/repository/informationsystem/objectproperties/values
 * This handler uses makeAdtRequestWithTimeout directly and should be moved to adt-clients infrastructure module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetTypeInfo = handleGetTypeInfo;
const fast_xml_parser_1 = require("fast-xml-parser");
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetTypeInfo',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve ABAP type information for domains (DOMA), data elements (DTEL), table types, and structures. Returns field definitions, value ranges, fixed values, and DDIC metadata.',
    inputSchema: {
        type: 'object',
        properties: {
            type_name: {
                type: 'string',
                description: 'Name of the ABAP type',
            },
            include_structure_fallback: {
                type: 'boolean',
                description: 'When true (default), tries DDIC structure lookup only if type lookup returns 404/empty.',
                default: true,
            },
        },
        required: ['type_name'],
    },
};
function parseTypeInfoXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true,
    });
    const result = parser.parse(xml);
    // Data Element (DTEL/DE)
    if (result['blue:wbobj']?.['dtel:dataElement']) {
        const wb = result['blue:wbobj'];
        const dtel = wb['dtel:dataElement'];
        return {
            name: wb['adtcore:name'],
            objectType: 'data_element',
            description: wb['adtcore:description'],
            dataType: dtel['dtel:dataType'],
            length: parseInt(dtel['dtel:dataTypeLength'], 10),
            decimals: parseInt(dtel['dtel:dataTypeDecimals'], 10),
            domain: dtel['dtel:typeName'],
            package: wb['adtcore:packageRef']?.['adtcore:name'] || null,
            labels: {
                short: dtel['dtel:shortFieldLabel'],
                medium: dtel['dtel:mediumFieldLabel'],
                long: dtel['dtel:longFieldLabel'],
                heading: dtel['dtel:headingFieldLabel'],
            },
        };
    }
    // Domain (DOMA/DD) via repository informationsystem
    if (result['opr:objectProperties']?.['opr:object']) {
        const obj = result['opr:objectProperties']['opr:object'];
        return {
            name: obj.name,
            objectType: 'domain',
            description: obj.text,
            package: obj.package,
            type: obj.type,
        };
    }
    // Table Type (not implemented, fallback)
    return { raw: result };
}
function parseStructureInfoXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true,
        trimValues: true,
    });
    const result = parser.parse(xml);
    const wb = result['blue:wbobj'] || {};
    return {
        name: wb['adtcore:name'] || null,
        objectType: 'structure',
        description: wb['adtcore:description'] || null,
        package: wb['adtcore:packageRef']?.['adtcore:name'] || null,
        resolved_as: 'structure_fallback',
        raw: result,
    };
}
function hasUsableResult(value) {
    if (value == null) {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        if ('raw' in value) {
            const raw = value.raw;
            return !!raw && typeof raw === 'object' && Object.keys(raw).length > 0;
        }
        return Object.keys(value).length > 0;
    }
    return true;
}
function isNotFoundError(error) {
    return error?.response?.status === 404;
}
async function tryLookup(connection, url, parseFn) {
    try {
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, url, 'GET', 'default');
        if (!hasUsableResult(response?.data)) {
            return { status: 'not_found_or_empty' };
        }
        const payload = parseFn(response.data);
        if (!hasUsableResult(payload)) {
            return { status: 'not_found_or_empty' };
        }
        return { status: 'ok', payload };
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return { status: 'not_found_or_empty' };
        }
        throw error;
    }
}
async function handleGetTypeInfo(context, args) {
    const { connection, logger } = context;
    const includeStructureFallback = args?.include_structure_fallback !== false;
    try {
        if (!args?.type_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Type name is required');
        }
    }
    catch (error) {
        logger?.error('Invalid parameters for GetTypeInfo', error);
        // MCP-compliant error response: always return content[] with type "text"
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
    try {
        const typeName = args.type_name;
        const encodedTypeName = (0, utils_1.encodeSapObjectName)(typeName);
        const uri = encodeURIComponent(`/sap/bc/adt/ddic/domains/${typeName.toLowerCase()}`);
        const lookups = [
            {
                label: 'domain',
                url: `/sap/bc/adt/ddic/domains/${encodedTypeName}/source/main`,
                parseFn: parseTypeInfoXml,
            },
            {
                label: 'data element',
                url: `/sap/bc/adt/ddic/dataelements/${encodedTypeName}`,
                parseFn: parseTypeInfoXml,
            },
            {
                label: 'table type',
                url: `/sap/bc/adt/ddic/tabletypes/${encodedTypeName}`,
                parseFn: parseTypeInfoXml,
            },
            {
                label: 'repository information system',
                url: `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${uri}`,
                parseFn: parseTypeInfoXml,
            },
        ];
        for (const lookup of lookups) {
            logger?.debug(`Trying ${lookup.label} lookup for ${typeName}`);
            const result = await tryLookup(connection, lookup.url, lookup.parseFn);
            if (result.status === 'ok') {
                const mcpResult = {
                    isError: false,
                    content: [{ type: 'json', json: result.payload }],
                };
                getObjectsListCache_1.objectsListCache.setCache(mcpResult);
                return mcpResult;
            }
        }
        if (includeStructureFallback) {
            logger?.debug(`Type lookups returned 404/empty for ${typeName}, trying structure fallback`);
            const structureResult = await tryLookup(connection, `/sap/bc/adt/ddic/structures/${encodedTypeName}`, parseStructureInfoXml);
            if (structureResult.status === 'ok') {
                const mcpResult = {
                    isError: false,
                    content: [{ type: 'json', json: structureResult.payload }],
                };
                getObjectsListCache_1.objectsListCache.setCache(mcpResult);
                return mcpResult;
            }
        }
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Type ${typeName} was not found as domain, data element, table type, or structure.`,
                },
            ],
        };
    }
    catch (error) {
        logger?.error(`Failed to resolve type info for ${args.type_name}`, error);
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
//# sourceMappingURL=handleGetTypeInfo.js.map