"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleSearchObject = handleSearchObject;
const clients_1 = require("../../../lib/clients");
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'SearchObject',
    available_in: ['onprem', 'cloud'],
    description: "[read-only] Find, search, locate, or check if an ABAP repository object exists by name or wildcard pattern (e.g. 'ZOK*'). Use this tool to answer questions like 'is there a program named...', 'find all objects starting with...', 'does this class exist?', 'list objects matching...'. Supports all repository object types — optionally filter by type (PROG, CLAS, INTF, DEVC, TABL, DDLS, DTEL, FUGR, SRVD, SRVB, BDEF, DDLX, etc.).",
    inputSchema: {
        type: 'object',
        properties: {
            object_name: {
                type: 'string',
                description: "[read-only] Object name or mask (e.g. 'MARA*')",
            },
            object_type: {
                type: 'string',
                description: "[read-only] Optional ABAP object type (e.g. 'TABL', 'CLAS/OC')",
            },
            maxResults: {
                type: 'number',
                description: '[read-only] Maximum number of results to return',
                default: 100,
            },
        },
        required: ['object_name'],
    },
};
// --- New function for ADT error handling ---
function detectAdtSearchError(response) {
    if (!response)
        return null;
    const status = response.status || response?.response?.status;
    if (status !== 200) {
        let msg = `ADT request failed (status ${status})`;
        if (status === 406)
            msg = 'Invalid object_type (406 Not Acceptable)';
        if (status === 400)
            msg = 'Bad request (400)';
        return {
            isError: true,
            content: [{ type: 'text', text: msg }],
        };
    }
    return null;
}
async function handleSearchObject(context, args) {
    const { connection, logger } = context;
    try {
        const { object_name, object_type, maxResults } = args;
        if (!object_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'object_name is required');
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        const searchParams = {
            query: object_name,
            maxResults: maxResults || 100,
        };
        if (object_type) {
            searchParams.objectType = object_type;
        }
        logger?.info(`Searching objects: query=${object_name}${object_type ? ` type=${object_type}` : ''}`);
        const response = await utils.searchObjects(searchParams);
        if (!response) {
            throw new Error('Search failed: no response received');
        }
        // --- Error handling using new function ---
        const adtError = detectAdtSearchError(response);
        if (adtError)
            return adtError;
        const result = (0, utils_1.return_response)(response);
        const { isError, ...rest } = result;
        // Detect empty XML (<adtcore:objectReferences/>) results
        const xmlText = rest.content?.[0]?.text || '';
        if (!xmlText.includes('<adtcore:objectReference ')) {
            // Return an empty result (not an error) when ADT finds nothing
            return {
                isError: false,
                content: [],
            };
        }
        // Parse every <adtcore:objectReference .../> entry from the XML
        const matches = Array.from(xmlText.matchAll(/<adtcore:objectReference\s+([^>]*)\/>/g));
        if (!matches || matches.length === 0) {
            // Return an empty result (not an error) when ADT finds nothing
            return {
                isError: false,
                content: [],
            };
        }
        const resultsArr = [];
        for (const m of matches) {
            const attrs = m[1];
            function extract(attr, def = '') {
                const mm = attrs.match(new RegExp(`${attr}="([^"]*)"`));
                return mm ? mm[1] : def;
            }
            const name = extract('adtcore:name');
            const type = extract('adtcore:type');
            const description = extract('adtcore:description');
            let pkgName = extract('adtcore:packageName');
            // If packageName is missing, attempt to pull it from the raw XML via <adtcore:packageName>
            if (!pkgName) {
                const pkgMatch = xmlText.match(/<adtcore:packageName>([^<]*)<\/adtcore:packageName>/);
                if (pkgMatch) {
                    pkgName = pkgMatch[1];
                }
            }
            resultsArr.push({ name, type, description, packageName: pkgName });
        }
        getObjectsListCache_1.objectsListCache.setCache(result);
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ results: resultsArr, rawXML: xmlText }),
                },
            ],
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
//# sourceMappingURL=handleSearchObject.js.map