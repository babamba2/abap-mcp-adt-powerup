"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetEnhancementSpot = handleGetEnhancementSpot;
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
exports.TOOL_DEFINITION = {
    name: 'GetEnhancementSpot',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve metadata and list of implementations for a specific enhancement spot.',
    inputSchema: {
        type: 'object',
        properties: {
            enhancement_spot: {
                type: 'string',
                description: 'Name of the enhancement spot',
            },
        },
        required: ['enhancement_spot'],
    },
};
/**
 * Parses enhancement spot XML to extract metadata and function (implementation) descriptions.
 * @param xmlData - Raw XML response from ADT
 * @returns Metadata object with description, type, status, and functions (implementations)
 */
function parseEnhancementSpotMetadata(xmlData) {
    const metadata = {};
    try {
        // Spot name, description, type, package
        const nameMatch = xmlData.match(/adtcore:name="([^"]*)"/);
        if (nameMatch?.[1])
            metadata.name = nameMatch[1];
        const descMatch = xmlData.match(/adtcore:description="([^"]*)"/);
        if (descMatch?.[1])
            metadata.description = descMatch[1];
        const typeMatch = xmlData.match(/adtcore:type="([^"]*)"/);
        if (typeMatch?.[1])
            metadata.type = typeMatch[1];
        const pkgMatch = xmlData.match(/adtcore:packageRef[^>]+adtcore:name="([^"]*)"/);
        if (pkgMatch?.[1])
            metadata.package = pkgMatch[1];
        // Interface reference
        const ifaceMatch = xmlData.match(/<enhs:interface[^>]*adtcore:name="([^"]*)"/);
        if (ifaceMatch?.[1])
            metadata.interface = ifaceMatch[1];
        // BAdI definitions
        const badiDefs = [];
        const badiDefRegex = /<enhs:badiDefinition[\s\S]*?<\/enhs:badiDefinition>/g;
        let badiMatch = badiDefRegex.exec(xmlData);
        while (badiMatch !== null) {
            const block = badiMatch[0];
            const badiName = (block.match(/enhs:name="([^"]*)"/) || [])[1];
            const badiShort = (block.match(/enhs:shorttext="([^"]*)"/) || [])[1];
            const badiIface = (block.match(/<enhs:interface[^>]*adtcore:name="([^"]*)"/) || [])[1];
            badiDefs.push({
                name: badiName,
                shorttext: badiShort,
                interface: badiIface,
            });
            badiMatch = badiDefRegex.exec(xmlData);
        }
        if (badiDefs.length > 0)
            metadata.badi_definitions = badiDefs;
        // All atom:link rels
        const links = [];
        const linkRegex = /<atom:link ([^>]+)\/>/g;
        let linkMatch = linkRegex.exec(xmlData);
        while (linkMatch !== null) {
            const attrs = linkMatch[1];
            const href = (attrs.match(/href="([^"]*)"/) || [])[1];
            const rel = (attrs.match(/rel="([^"]*)"/) || [])[1];
            const type = (attrs.match(/type="([^"]*)"/) || [])[1];
            const title = (attrs.match(/title="([^"]*)"/) || [])[1];
            links.push({ href, rel, type, title });
            linkMatch = linkRegex.exec(xmlData);
        }
        if (links.length > 0)
            metadata.links = links;
        utils_1.logger?.info(`Parsed structured metadata for enhancement spot:`, metadata);
        return metadata;
    }
    catch (parseError) {
        utils_1.logger?.error('Failed to parse enhancement spot XML metadata:', parseError);
        return {};
    }
}
/**
 * Handler to retrieve metadata for a specific enhancement spot in an ABAP system.
 * This function uses the SAP ADT API endpoint to fetch details about an enhancement spot,
 * regardless of whether it has any implementations. It is designed to provide information
 * about the spot's existence, description, type, and status.
 *
 * @param args - Tool arguments containing:
 *   - enhancement_spot: Name of the enhancement spot (e.g., 'enhoxhh'). This is a required parameter.
 * @returns Response object containing:
 *   - enhancement_spot: The name of the queried enhancement spot.
 *   - metadata: An object with properties like description, type, and status of the enhancement spot.
 *   - raw_xml: The raw XML response from the ADT API for debugging purposes.
 *   - In case of error, an error object with details about the failure.
 */
async function handleGetEnhancementSpot(context, args) {
    const { connection, logger } = context;
    try {
        logger?.info('handleGetEnhancementSpot called with args:', args);
        if (!args?.enhancement_spot) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Enhancement spot is required');
        }
        const enhancementSpot = args.enhancement_spot;
        logger?.info(`Getting metadata for enhancement spot: ${enhancementSpot}`);
        // Build the ADT URL for the specific enhancement spot (Eclipse uses /sap/bc/adt/enhancements/enhsxsb/{spot_name})
        const url = `/sap/bc/adt/enhancements/enhsxsb/${(0, utils_1.encodeSapObjectName)(enhancementSpot)}`;
        logger?.info(`Enhancement spot URL: ${url}`);
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, url, 'GET', 'default', {
            Accept: 'application/vnd.sap.adt.enhancements.v1+xml',
        });
        if (response.status === 200 && response.data) {
            // Parse the XML to extract metadata
            const metadata = parseEnhancementSpotMetadata(response.data);
            const enhancementSpotResponse = {
                enhancement_spot: enhancementSpot,
                metadata: metadata,
            };
            const result = {
                isError: false,
                content: [
                    {
                        type: 'json',
                        json: enhancementSpotResponse,
                    },
                ],
            };
            if (args.filePath) {
                (0, writeResultToFile_1.writeResultToFile)(JSON.stringify(result, null, 2), args.filePath);
            }
            return result;
        }
        else {
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to retrieve metadata for enhancement spot ${enhancementSpot}. Status: ${response.status}`);
        }
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
//# sourceMappingURL=handleGetEnhancementSpot.js.map