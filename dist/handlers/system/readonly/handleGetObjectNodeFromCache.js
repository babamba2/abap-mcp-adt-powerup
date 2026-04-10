"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectNodeFromCache = handleGetObjectNodeFromCache;
exports.TOOL_DEFINITION = {
    name: 'GetObjectNodeFromCache',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Returns a node from the in-memory objects list cache by OBJECT_TYPE, OBJECT_NAME, TECH_NAME, and expands OBJECT_URI if present.',
    inputSchema: {
        type: 'object',
        properties: {
            object_type: { type: 'string', description: '[read-only] Object type' },
            object_name: { type: 'string', description: '[read-only] Object name' },
            tech_name: { type: 'string', description: '[read-only] Technical name' },
        },
        required: ['object_type', 'object_name', 'tech_name'],
    },
};
// handleGetObjectNodeFromCache returns a cached node by OBJECT_TYPE, OBJECT_NAME, and TECH_NAME, expanding OBJECT_URI when available
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
/**
 * @param args { object_type, object_name, tech_name }
 * @returns cached node including object_uri_response when OBJECT_URI exists
 */
async function handleGetObjectNodeFromCache(context, args) {
    const { connection, logger } = context;
    const { object_type, object_name, tech_name } = args;
    if (!object_type || !object_name || !tech_name) {
        return {
            isError: true,
            content: [
                { type: 'text', text: 'object_type, object_name, tech_name required' },
            ],
        };
    }
    const cache = getObjectsListCache_1.objectsListCache.getCache();
    let node = null;
    if (cache && Array.isArray(cache.objects)) {
        node =
            cache.objects.find((obj) => obj.OBJECT_TYPE === object_type &&
                obj.OBJECT_NAME === object_name &&
                obj.TECH_NAME === tech_name) || null;
    }
    if (!node) {
        logger?.debug(`Node ${object_type}/${object_name}/${tech_name} not found in cache`);
        return {
            isError: true,
            content: [{ type: 'text', text: 'Node not found in cache' }],
        };
    }
    if (node.OBJECT_URI && !node.object_uri_response) {
        const buildEndpoint = (uri) => {
            if (uri.startsWith('http')) {
                try {
                    const parsed = new URL(uri);
                    return `${parsed.pathname}${parsed.search}`;
                }
                catch {
                    // fall back to original if parsing fails
                    return uri;
                }
            }
            return uri;
        };
        try {
            const endpoint = buildEndpoint(node.OBJECT_URI);
            const resp = await (0, utils_1.makeAdtRequest)(connection, endpoint, 'GET', 15000);
            node.object_uri_response =
                typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
            // Persist the fetched OBJECT_URI payload back into the cache entry
            const idx = cache.objects.findIndex((obj) => obj.OBJECT_TYPE === object_type &&
                obj.OBJECT_NAME === object_name &&
                obj.TECH_NAME === tech_name);
            if (idx >= 0) {
                cache.objects[idx] = {
                    ...cache.objects[idx],
                    object_uri_response: node.object_uri_response,
                };
                getObjectsListCache_1.objectsListCache.setCache(cache);
            }
        }
        catch (e) {
            logger?.error('Failed to expand OBJECT_URI from cache', e);
            node.object_uri_response = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    logger?.info(`Returning cached node for ${object_type}/${object_name}/${tech_name}`);
    return {
        content: [{ type: 'json', json: node }],
    };
}
//# sourceMappingURL=handleGetObjectNodeFromCache.js.map