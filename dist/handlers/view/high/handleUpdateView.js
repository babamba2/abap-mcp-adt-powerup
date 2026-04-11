"use strict";
/**
 * UpdateView Handler - Update existing CDS/Classic view DDL source
 *
 * Workflow: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive) -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateView = handleUpdateView;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateView',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update DDL source code of an existing CDS View or Classic View. Locks the view, checks new code, uploads new DDL source, unlocks, and optionally activates.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., ZOK_R_TEST_0002).',
            },
            ddl_source: { type: 'string', description: 'Complete DDL source code.' },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: false.',
            },
        },
        required: ['view_name', 'ddl_source'],
    },
};
async function handleUpdateView(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.view_name || !args.ddl_source) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: view_name and ddl_source'));
    }
    const viewName = args.view_name.toUpperCase();
    logger?.info(`Starting view source update: ${viewName} (activate=${args.activate === true})`);
    // Connection setup
    try {
        // Get connection from session context (set by ProtocolHandler)
        // Connection is managed and cached per session, with proper token refresh via AuthBroker
        logger?.debug(`Created separate connection for handler call: ${viewName}`);
    }
    catch (connectionError) {
        const errorMessage = connectionError instanceof Error
            ? connectionError.message
            : String(connectionError);
        logger?.error(`Failed to create connection: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create connection: ${errorMessage}`));
    }
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const shouldActivate = args.activate === true;
        let lockHandle;
        try {
            // Lock
            logger?.debug(`Locking view: ${viewName}`);
            lockHandle = await client.getView().lock({ viewName });
            logger?.debug(`View locked: ${viewName} (handle=${lockHandle ? `${lockHandle.substring(0, 8)}...` : 'none'})`);
            // Pre-write syntax check on the proposed DDL source.
            // Surfaces ALL compile errors with structured diagnostics via
            // the inline-artifact /checkruns path so the broken source never
            // lands on SAP.
            logger?.debug(`Pre-write syntax check: ${viewName}`);
            const preCheckResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'view', name: viewName, sourceCode: args.ddl_source });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(preCheckResult, 'View', viewName);
            logger?.debug(`Pre-write check passed: ${viewName}`);
            // Update
            logger?.debug(`Updating view DDL source: ${viewName}`);
            await client.getView().update({
                viewName,
                ddlSource: args.ddl_source,
                transportRequest: args.transport_request,
            }, { lockHandle });
            logger?.info(`View DDL source updated: ${viewName}`);
        }
        finally {
            if (lockHandle) {
                try {
                    logger?.debug(`Unlocking view: ${viewName}`);
                    await client.getView().unlock({ viewName }, lockHandle);
                    logger?.info(`View unlocked: ${viewName}`);
                }
                catch (unlockError) {
                    logger?.warn(`Failed to unlock view ${viewName}: ${unlockError?.message || unlockError}`);
                }
            }
        }
        // Post-write inactive check — non-fatal, warnings only (the
        // pre-write check already gated the upload).
        logger?.debug(`Post-write inactive check: ${viewName}`);
        try {
            await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'view', name: viewName });
            logger?.debug(`Inactive version check completed: ${viewName}`);
        }
        catch (checkError) {
            logger?.warn(`Inactive version check had issues: ${viewName} - ${checkError instanceof Error ? checkError.message : String(checkError)}`);
        }
        // Activate if requested
        let activateResponse;
        if (shouldActivate) {
            logger?.debug(`Activating view: ${viewName}`);
            try {
                const activateState = await client.getView().activate({ viewName });
                activateResponse = activateState.activateResult;
                logger?.info(`View activated: ${viewName}`);
            }
            catch (activationError) {
                logger?.error(`Activation failed: ${viewName} - ${activationError instanceof Error ? activationError.message : String(activationError)}`);
                throw new Error(`Activation failed: ${activationError instanceof Error ? activationError.message : String(activationError)}`);
            }
        }
        else {
            logger?.debug(`Skipping activation for: ${viewName}`);
        }
        // Parse activation warnings if activation was performed
        let activationWarnings = [];
        if (shouldActivate && activateResponse) {
            if (typeof activateResponse.data === 'string' &&
                activateResponse.data.includes('<chkl:messages')) {
                const parser = new fast_xml_parser_1.XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const result = parser.parse(activateResponse.data);
                const messages = result?.['chkl:messages']?.msg;
                if (messages) {
                    const msgArray = Array.isArray(messages) ? messages : [messages];
                    activationWarnings = msgArray.map((msg) => `${msg['@_type']}: ${msg.shortText?.txt || 'Unknown'}`);
                }
            }
        }
        logger?.info(`UpdateView completed successfully: ${viewName}`);
        const result = {
            success: true,
            view_name: viewName,
            type: 'DDLS',
            activated: shouldActivate,
            message: `View ${viewName} updated${shouldActivate ? ' and activated' : ''} successfully`,
            uri: `/sap/bc/adt/ddic/ddl/sources/${(0, utils_1.encodeSapObjectName)(viewName).toLowerCase()}`,
            steps_completed: [
                'lock',
                'check_new_code',
                'update',
                'unlock',
                'check_inactive',
                ...(shouldActivate ? ['activate'] : []),
            ],
            activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
        };
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        // PreCheck syntax-check failures carry full structured diagnostics —
        // forward them as-is so the caller sees every error with line numbers.
        if (error?.isPreCheckFailure) {
            logger?.error(`Error updating view ${viewName}: ${error.message}`);
            return (0, utils_1.return_error)(error);
        }
        // Parse error message
        let errorMessage = error instanceof Error ? error.message : String(error);
        // Attempt to parse ADT XML error
        try {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
            });
            const errorData = error?.response?.data
                ? parser.parse(error.response.data)
                : null;
            const errorMsg = errorData?.['exc:exception']?.message?.['#text'] ||
                errorData?.['exc:exception']?.message;
            if (errorMsg) {
                errorMessage = `SAP Error: ${errorMsg}`;
            }
        }
        catch {
            // ignore parse errors
        }
        logger?.error(`Error updating view ${viewName}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleUpdateView.js.map