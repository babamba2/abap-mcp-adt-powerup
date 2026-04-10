"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectsList = handleGetObjectsList;
const clients_1 = require("../../../lib/clients");
exports.TOOL_DEFINITION = {
    name: 'GetObjectsList',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Recursively retrieves all child ABAP repository objects for a given parent — programs (PROG), function groups (FUGR), classes (CLAS), packages (DEVC), and other composite objects — including nested includes and subcomponents.',
    inputSchema: {
        type: 'object',
        properties: {
            parent_name: {
                type: 'string',
                description: '[read-only] Parent object name',
            },
            parent_tech_name: {
                type: 'string',
                description: '[read-only] Parent technical name',
            },
            parent_type: {
                type: 'string',
                description: '[read-only] Parent object type (e.g. PROG/P, FUGR)',
            },
            with_short_descriptions: {
                type: 'boolean',
                description: '[read-only] Include short descriptions (default: true)',
            },
        },
        required: ['parent_name', 'parent_tech_name', 'parent_type'],
    },
};
// handleGetObjectsListStrict performs a recursive ADT node traversal starting from node_id '000000' like in the user example
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
/**
 * Parses every SEU_ADT_REPOSITORY_OBJ_NODE element from the XML and returns objects with the required fields
 */
function parseValidObjects(xmlData) {
    const nodes = [];
    try {
        const nodeRegex = /<SEU_ADT_REPOSITORY_OBJ_NODE>([\s\S]*?)<\/SEU_ADT_REPOSITORY_OBJ_NODE>/g;
        let match = nodeRegex.exec(xmlData);
        while (match !== null) {
            const nodeXml = match[1];
            const obj = {};
            // Pull out the fields we need
            const typeMatch = nodeXml.match(/<OBJECT_TYPE>([^<]+)<\/OBJECT_TYPE>/);
            const nameMatch = nodeXml.match(/<OBJECT_NAME>([^<]+)<\/OBJECT_NAME>/);
            const techNameMatch = nodeXml.match(/<TECH_NAME>([^<]+)<\/TECH_NAME>/);
            const uriMatch = nodeXml.match(/<OBJECT_URI>([^<]+)<\/OBJECT_URI>/);
            if (typeMatch && nameMatch && techNameMatch && uriMatch) {
                obj.OBJECT_TYPE = typeMatch[1];
                obj.OBJECT_NAME = nameMatch[1];
                obj.TECH_NAME = techNameMatch[1];
                obj.OBJECT_URI = uriMatch[1];
                nodes.push(obj);
            }
            match = nodeRegex.exec(xmlData);
        }
    }
    catch (_error) {
        // console.warn('Error parsing XML for valid objects:', error);
    }
    return nodes;
}
/**
 * Extracts every NODE_ID from the OBJECT_TYPES XML block
 */
function parseNodeIds(xmlData) {
    const nodeIds = [];
    try {
        const typeRegex = /<SEU_ADT_OBJECT_TYPE_INFO>([\s\S]*?)<\/SEU_ADT_OBJECT_TYPE_INFO>/g;
        let match = typeRegex.exec(xmlData);
        while (match !== null) {
            const block = match[1];
            const nodeIdMatch = block.match(/<NODE_ID>([^<]+)<\/NODE_ID>/);
            if (nodeIdMatch) {
                nodeIds.push(nodeIdMatch[1]);
            }
            match = typeRegex.exec(xmlData);
        }
    }
    catch (_error) {
        // console.warn('Error parsing XML for node ids:', error);
    }
    return nodeIds;
}
/**
 * Recursively walks the ADT node structure and returns only valid objects
 */
async function collectValidObjectsStrict(utils, parent_name, parent_type, node_id, with_short_descriptions, visited) {
    if (visited.has(node_id))
        return [];
    visited.add(node_id);
    const response = await utils.fetchNodeStructure(parent_type, parent_name, node_id, with_short_descriptions);
    const xml = response.data;
    // Keep only the nodes that represent valid objects
    const objects = parseValidObjects(xml);
    // Traverse child nodes recursively via NODE_ID
    const nodeIds = parseNodeIds(xml);
    for (const childNodeId of nodeIds) {
        const childObjects = await collectValidObjectsStrict(utils, parent_name, parent_type, childNodeId, with_short_descriptions, visited);
        objects.push(...childObjects);
    }
    return objects;
}
/**
 * Main handler for GetObjectsListStrict
 * @param args { parent_name, parent_tech_name, parent_type, with_short_descriptions }
 */
async function handleGetObjectsList(context, args) {
    const { connection, logger } = context;
    try {
        const { parent_name, parent_tech_name, parent_type, with_short_descriptions, } = args;
        if (!parent_name ||
            typeof parent_name !== 'string' ||
            parent_name.trim() === '') {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Parameter "parent_name" (string) is required and cannot be empty.');
        }
        if (!parent_tech_name ||
            typeof parent_tech_name !== 'string' ||
            parent_tech_name.trim() === '') {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Parameter "parent_tech_name" (string) is required and cannot be empty.');
        }
        if (!parent_type ||
            typeof parent_type !== 'string' ||
            parent_type.trim() === '') {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Parameter "parent_type" (string) is required and cannot be empty.');
        }
        const withDescriptions = with_short_descriptions !== undefined
            ? Boolean(with_short_descriptions)
            : true;
        // Create AdtClient and get utilities
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        // Begin traversal from node_id '000000' (the root node)
        const objects = await collectValidObjectsStrict(utils, parent_name.toUpperCase(), parent_type, '000000', withDescriptions, new Set());
        // Format the aggregated data as JSON
        const result = {
            parent_name,
            parent_tech_name,
            parent_type,
            total_objects: objects.length,
            objects,
        };
        // Persist the result inside the in-memory cache
        getObjectsListCache_1.objectsListCache.setCache(result);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
            // Expose the cache snapshot for potential reuse by other modules
            cache: getObjectsListCache_1.objectsListCache.getCache(),
        };
    }
    catch (error) {
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
}
//# sourceMappingURL=handleGetObjectsList.js.map