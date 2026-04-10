"use strict";
/**
 * GetScreensList Handler - List screens (dynpros) for an ABAP program
 *
 * Uses ADT object structure API to discover screens (PROG/PS nodes).
 * Direct REST sub-resource endpoints (/dynpros) don't exist in ADT.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetScreensList = handleGetScreensList;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetScreensList',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] List all screens (dynpros) belonging to an ABAP program.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., SAPMV45A).',
            },
        },
        required: ['program_name'],
    },
};
async function handleGetScreensList(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name } = args;
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
        }
        const programName = program_name.toUpperCase();
        logger?.info(`Listing screens for program: ${programName}`);
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const response = await client
            .getUtils()
            .getObjectStructure('PROG/P', programName);
        const screens = [];
        if (response.data) {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '',
            });
            const parsed = parser.parse(response.data);
            let nodes = parsed['projectexplorer:objectstructure']?.['projectexplorer:node'];
            if (!nodes) {
                return (0, utils_1.return_response)({
                    data: JSON.stringify({
                        success: true,
                        program_name: programName,
                        total_screens: 0,
                        screens: [],
                    }, null, 2),
                });
            }
            if (!Array.isArray(nodes))
                nodes = [nodes];
            for (const node of nodes) {
                if (node.objecttype === 'PROG/PS' &&
                    node.isfolder !== 'true' &&
                    node.isfolder !== true) {
                    // Screen number is in the description field (e.g., "0100", "1000")
                    const screenNumber = String(node.description || '').trim();
                    if (screenNumber) {
                        screens.push({
                            screen_number: screenNumber,
                        });
                    }
                }
            }
        }
        logger?.info(`✅ GetScreensList completed: ${programName} (${screens.length} screens)`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                total_screens: screens.length,
                screens,
            }, null, 2),
        });
    }
    catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);
        if (error.response?.status === 404) {
            errorMessage = `Program ${args?.program_name} not found.`;
        }
        logger?.error(`Error listing screens: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleGetScreensList.js.map