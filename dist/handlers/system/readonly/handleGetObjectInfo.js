"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectInfo = handleGetObjectInfo;
const fast_xml_parser_1 = require("fast-xml-parser");
const xml_js_1 = __importDefault(require("xml-js"));
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const handleSearchObject_1 = require("../../search/readonly/handleSearchObject");
exports.TOOL_DEFINITION = {
    name: 'GetObjectInfo',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Return ABAP object tree structure for packages (DEVC), classes (CLAS), programs (PROG), function groups (FUGR), and other objects. Shows root, group nodes, and terminal leaves up to maxDepth. Enrich each node with description and package via SearchObject if enrich=true.',
    inputSchema: {
        type: 'object',
        properties: {
            parent_type: {
                type: 'string',
                description: '[read-only] Parent object type (e.g. DEVC/K, CLAS/OC, PROG/P)',
            },
            parent_name: {
                type: 'string',
                description: '[read-only] Parent object name',
            },
            maxDepth: {
                type: 'integer',
                description: '[read-only] Maximum tree depth (default depends on type)',
                default: 1,
            },
            enrich: {
                type: 'boolean',
                description: '[read-only] Whether to add description and package via SearchObject (default true)',
                default: true,
            },
        },
        required: ['parent_type', 'parent_name'],
    },
};
// Determine default depth for various object types
function getDefaultDepth(parent_type) {
    const type = parent_type?.toUpperCase() || '';
    if (type.startsWith('PROG/') || type.startsWith('FUGR/'))
        return 2;
    return 1;
}
async function fetchNodeStructureRaw(context, parent_type, parent_name, node_id) {
    const { connection, logger } = context;
    const client = (0, clients_1.createAdtClient)(connection, logger);
    const utils = client.getUtils();
    const response = await utils.fetchNodeStructure(parent_type, parent_name, node_id || '0000', true);
    const result = xml_js_1.default.xml2js(response.data, { compact: true });
    let nodes = result['asx:abap']?.['asx:values']?.DATA?.TREE_CONTENT
        ?.SEU_ADT_REPOSITORY_OBJ_NODE || [];
    if (!Array.isArray(nodes))
        nodes = [nodes];
    return nodes;
}
async function enrichNodeWithSearchObject(context, objectType, objectName, fallbackDescription) {
    const { connection, logger } = context;
    let packageName;
    let description = fallbackDescription;
    let type = objectType;
    try {
        const searchResult = await (0, handleSearchObject_1.handleSearchObject)(context, {
            query: objectName,
            object_type: objectType,
            maxResults: 1,
        });
        if (!searchResult.isError && Array.isArray(searchResult.content)) {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '',
            });
            for (const entry of searchResult.content) {
                if ('text' in entry &&
                    typeof entry.text === 'string' &&
                    !entry.text.trim().startsWith('Error: <?xml')) {
                    const parsed = parser.parse(entry.text);
                    const refs = parsed?.['adtcore:objectReferences']?.['adtcore:objectReference'];
                    const objects = refs ? (Array.isArray(refs) ? refs : [refs]) : [];
                    for (const obj of objects) {
                        if (obj['adtcore:type'] &&
                            obj['adtcore:name'] &&
                            obj['adtcore:name'].toUpperCase() === objectName.toUpperCase()) {
                            packageName = obj['adtcore:packageName'];
                            description = obj['adtcore:description'] || description;
                            type = obj['adtcore:type'];
                            return { packageName, description, type };
                        }
                    }
                }
            }
        }
    }
    catch (_e) {
        // ignore
    }
    return { packageName, description, type };
}
function getText(node, key) {
    if (!node)
        return undefined;
    if (node[key] && typeof node[key] === 'object' && '_text' in node[key])
        return node[key]._text;
    if (typeof node[key] === 'string')
        return node[key];
    return undefined;
}
// Terminal leaf: has OBJECT_NAME and OBJECT_URI
function isTerminalLeaf(node) {
    return !!getText(node, 'OBJECT_NAME') && !!getText(node, 'OBJECT_URI');
}
// Group node: has NODE_ID, OBJECT_TYPE, but no OBJECT_URI
function isGroupNode(node) {
    return (!!getText(node, 'NODE_ID') &&
        !!getText(node, 'OBJECT_TYPE') &&
        !getText(node, 'OBJECT_URI'));
}
function _getNodeType(node, depth) {
    if (depth === 0)
        return 'root';
    if (isTerminalLeaf(node))
        return 'end';
    if (isGroupNode(node))
        return 'point';
    return 'point';
}
async function buildTree(context, objectType, objectName, depth, maxDepth, enrich, node_id = '') {
    // 1. Enrich root node
    let enrichment = {
        packageName: undefined,
        description: undefined,
        type: objectType,
    };
    if (enrich) {
        enrichment = await enrichNodeWithSearchObject(context, objectType, objectName);
    }
    // 2. Get children if depth < maxDepth
    const children = [];
    if (depth < maxDepth) {
        // Use node_id "0000" for the root; for others keep the actual NODE_ID
        const nodes = await fetchNodeStructureRaw(context, objectType, objectName, depth === 0 ? '0000' : node_id);
        for (const node of nodes) {
            // When the next level hits the maximum depth, only include terminal leaves
            if (depth + 1 === maxDepth) {
                if (isTerminalLeaf(node)) {
                    const terminalNode = {
                        OBJECT_TYPE: getText(node, 'OBJECT_TYPE'),
                        OBJECT_NAME: getText(node, 'OBJECT_NAME'),
                        PARENT_NODE_ID: getText(node, 'PARENT_NODE_ID'),
                    };
                    children.push(terminalNode);
                }
                // Skip group nodes at the maximum level
            }
            else {
                if (isGroupNode(node)) {
                    // Group node: recurse, attach its children
                    const groupChildren = await buildTree(context, getText(node, 'OBJECT_TYPE'), getText(node, 'OBJECT_NAME'), depth + 1, maxDepth, enrich, String(getText(node, 'NODE_ID') ?? ''));
                    const groupNode = {
                        OBJECT_TYPE: getText(node, 'OBJECT_TYPE'),
                        OBJECT_NAME: getText(node, 'OBJECT_NAME'),
                        PARENT_NODE_ID: getText(node, 'PARENT_NODE_ID'),
                    };
                    if (Array.isArray(groupChildren.CHILDREN) &&
                        groupChildren.CHILDREN.length > 0) {
                        groupNode.CHILDREN = groupChildren.CHILDREN;
                    }
                    children.push(groupNode);
                }
                else if (isTerminalLeaf(node)) {
                    // Terminal leaf: add as is
                    const terminalNode = {
                        OBJECT_TYPE: getText(node, 'OBJECT_TYPE'),
                        OBJECT_NAME: getText(node, 'OBJECT_NAME'),
                        PARENT_NODE_ID: getText(node, 'PARENT_NODE_ID'),
                    };
                    children.push(terminalNode);
                }
                // else: skip nodes that are neither group nor terminal leaf
            }
        }
    }
    const resultNode = {
        OBJECT_TYPE: enrichment.type || objectType,
        OBJECT_NAME: objectName,
        OBJECT_DESCRIPTION: enrichment.description,
        OBJECT_PACKAGE: enrichment.packageName,
    };
    if (children.length > 0) {
        resultNode.CHILDREN = children;
    }
    return resultNode;
}
async function handleGetObjectInfo(context, args) {
    const { logger } = context;
    try {
        if (!args?.parent_type || !args?.parent_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'parent_type and parent_name are required');
        }
        logger?.info(`Building object info tree for ${args.parent_type}/${args.parent_name}`);
        // Determine the default depth if none is provided
        const maxDepth = Number.isInteger(args.maxDepth)
            ? args.maxDepth
            : getDefaultDepth(args.parent_type);
        const enrich = typeof args.enrich === 'boolean' ? args.enrich : true;
        const result = await buildTree(context, args.parent_type, args.parent_name, 0, maxDepth ?? getDefaultDepth(args.parent_type), enrich);
        logger?.debug(`Object tree built with depth ${maxDepth} (enrich=${enrich})`);
        return {
            isError: false,
            content: [
                {
                    type: 'json',
                    json: result,
                },
            ],
        };
    }
    catch (error) {
        logger?.error(`Failed to build object info for ${args?.parent_type}/${args?.parent_name}`, error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetObjectInfo.js.map