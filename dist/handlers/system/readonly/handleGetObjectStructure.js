"use strict";
/**
 * Handler for retrieving ADT object structure and returning compact JSON tree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectStructure = handleGetObjectStructure;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
exports.TOOL_DEFINITION = {
    name: 'GetObjectStructure',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve ADT object structure as a compact JSON tree.',
    inputSchema: {
        type: 'object',
        properties: {
            objecttype: {
                type: 'string',
                description: 'ADT object type (e.g. DDLS/DF)',
            },
            objectname: {
                type: 'string',
                description: 'ADT object name (e.g. /CBY/ACQ_DDL)',
            },
        },
        required: ['objecttype', 'objectname'],
    },
};
function buildNestedTree(flatNodes) {
    const nodeMap = {};
    flatNodes.forEach((node) => {
        nodeMap[node.nodeid] = {
            objecttype: node.objecttype,
            objectname: node.objectname,
            children: [],
        };
    });
    const roots = [];
    flatNodes.forEach((node) => {
        if (node.parentid && nodeMap[node.parentid]) {
            nodeMap[node.parentid].children.push(nodeMap[node.nodeid]);
        }
        else {
            roots.push(nodeMap[node.nodeid]);
        }
    });
    return roots;
}
// Serialize tree to MCP-compatible text format ("tree:")
function serializeTree(tree, indent = '') {
    let result = '';
    for (const node of tree) {
        result += `${indent}- ${node.objecttype}: ${node.objectname}\n`;
        if (node.children && node.children.length > 0) {
            result += serializeTree(node.children, `${indent}  `);
        }
    }
    return result;
}
async function handleGetObjectStructure(context, args) {
    const { connection, logger } = context;
    try {
        const objectType = args.objecttype ?? args.object_type;
        const objectName = args.objectname ?? args.object_name;
        if (!objectType || !objectName) {
            throw new Error('objecttype/objectname (or object_type/object_name) are required');
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client
            .getUtils()
            .getObjectStructure(objectType, objectName);
        logger?.info(`Fetched object structure for ${objectType}/${objectName}`);
        // Parse XML response
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const parsed = parser.parse(response.data);
        // Get flat node list
        let nodes = parsed['projectexplorer:objectstructure']?.['projectexplorer:node'];
        if (!nodes) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'No nodes found in object structure response.',
                    },
                ],
            };
        }
        // Ensure nodes is always an array
        if (!Array.isArray(nodes))
            nodes = [nodes];
        // Build nested tree
        const tree = buildNestedTree(nodes);
        // Serialize to MCP-compatible text format
        const treeText = `tree:\n${serializeTree(tree)}`;
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: treeText,
                },
            ],
        };
    }
    catch (error) {
        logger?.error(`Failed to fetch object structure for ${args?.objecttype ?? args?.object_type}/${args?.objectname ?? args?.object_name}`, error);
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
//# sourceMappingURL=handleGetObjectStructure.js.map