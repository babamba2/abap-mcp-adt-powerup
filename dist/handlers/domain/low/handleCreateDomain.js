"use strict";
/**
 * CreateDomain Handler - Create ABAP Domain
 *
 * Uses AdtClient.createDomain from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateDomain = handleCreateDomain;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateDomainLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP domain. - use CreateDomain (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.',
            },
            description: {
                type: 'string',
                description: 'Domain description.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['domain_name', 'description', 'package_name'],
    },
};
/**
 * Main handler for CreateDomain MCP tool
 *
 * Uses AdtClient.createDomain - low-level single method call
 */
async function handleCreateDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, description, package_name, transport_request, session_id, session_state, } = args;
        // Validation
        if (!domain_name || !description || !package_name) {
            return (0, utils_1.return_error)(new Error('domain_name, description, and package_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const domainName = domain_name.toUpperCase();
        logger?.info(`Starting domain creation: ${domainName}`);
        try {
            // Create domain
            const createState = await client.getDomain().create({
                domainName,
                description,
                packageName: package_name,
                transportRequest: transport_request,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for domain ${domainName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateDomain completed: ${domainName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    description,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Domain ${domainName} created successfully. Use LockDomain and UpdateDomain to add source code, then UnlockDomain and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to create domain: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Domain ${domainName} already exists.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
                try {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    const errorData = parser.parse(error.response.data);
                    const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                        errorData['exc:exception']?.message;
                    if (errorMsg) {
                        errorMessage = `SAP Error: ${errorMsg}`;
                    }
                }
                catch (_parseError) {
                    // Ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateDomain.js.map