"use strict";
/**
 * UpdateInclude Handler - Update ABAP Include Source Code
 *
 * Uses direct ADT REST API since AdtClient doesn't have include methods.
 * ADT endpoint: /sap/bc/adt/programs/includes/{name}
 * Workflow: lock -> update source -> unlock -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateInclude = handleUpdateInclude;
const fast_xml_parser_1 = require("fast-xml-parser");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'UpdateInclude',
    available_in: ['onprem', 'legacy'],
    description: 'Update source code of an existing ABAP Include program (Type I). Locks the include, uploads new source code, and unlocks. Optionally activates after update. Use this instead of UpdateProgram for Type I include programs.',
    inputSchema: {
        type: 'object',
        properties: {
            include_name: {
                type: 'string',
                description: 'Include program name. Must already exist as Type I include in SAP.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP include source code. Do NOT include a REPORT statement — include programs start directly with code or comments.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number. Required for transportable packages.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate include after source update. Default: false. Set to true to activate immediately.',
            },
        },
        required: ['include_name', 'source_code'],
    },
};
async function handleUpdateInclude(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.include_name || !args.source_code) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: include_name and source_code'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Include programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
    }
    const includeName = args.include_name.toUpperCase();
    const encodedName = (0, utils_1.encodeSapObjectName)(includeName);
    const baseUrl = `/sap/bc/adt/programs/includes/${encodedName}`;
    const shouldActivate = args.activate === true;
    logger?.info(`Starting include source update: ${includeName} (activate=${shouldActivate})`);
    let lockHandle;
    let currentStep = 'start';
    try {
        // Step 1: Lock — stateful BEFORE lock to establish ICM session
        currentStep = 'lock';
        logger?.debug(`Locking include: ${includeName}`);
        connection.setSessionType('stateful');
        const lockResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${baseUrl}?_action=LOCK&accessMode=MODIFY`, 'POST', 'default', null, undefined, { Accept: ACCEPT_LOCK });
        connection.setSessionType('stateless');
        // Parse lock handle from XML response body
        {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '',
            });
            const parsed = parser.parse(lockResponse.data || '');
            lockHandle =
                parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
                    lockResponse.headers?.['x-sap-adt-lock-handle'];
        }
        if (!lockHandle) {
            throw new Error(`Failed to obtain lock handle for include ${includeName}`);
        }
        logger?.debug(`Include locked: ${includeName} (handle=${String(lockHandle).substring(0, 8)}...)`);
        // Step 2: Update source — PUT {baseUrl}/source/main?lockHandle=...&corrNr=...
        // Session cookie from lock is replayed automatically by the connection
        currentStep = 'update';
        logger?.debug(`Updating include source code: ${includeName}`);
        let updateUrl = `${baseUrl}/source/main?lockHandle=${encodeURIComponent(String(lockHandle))}`;
        if (args.transport_request) {
            updateUrl += `&corrNr=${args.transport_request}`;
        }
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, updateUrl, 'PUT', 'default', args.source_code, undefined, { 'Content-Type': 'text/plain; charset=utf-8' });
        logger?.info(`Include source code updated: ${includeName}`);
        // Step 3: Unlock — stateful again for unlock
        currentStep = 'unlock';
        logger?.debug(`Unlocking include: ${includeName}`);
        connection.setSessionType('stateful');
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${baseUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(String(lockHandle))}`, 'POST', 'default', null);
        connection.setSessionType('stateless');
        lockHandle = undefined;
        logger?.info(`Include unlocked: ${includeName}`);
        // Step 4: Activate if requested
        if (shouldActivate) {
            currentStep = 'activate';
            logger?.debug(`Activating include: ${includeName}`);
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${baseUrl}" adtcore:name="${includeName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
            logger?.info(`Include activated: ${includeName}`);
        }
        const result = {
            success: true,
            include_name: includeName,
            type: 'PROG/I',
            activated: shouldActivate,
            message: shouldActivate
                ? `Include ${includeName} source updated and activated successfully`
                : `Include ${includeName} source updated successfully (not activated)`,
            uri: baseUrl.toLowerCase(),
            steps_completed: [
                'lock',
                'update',
                'unlock',
                ...(shouldActivate ? ['activate'] : []),
            ],
            source_size_bytes: args.source_code.length,
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
        // Attempt unlock if still locked
        if (lockHandle) {
            try {
                connection.setSessionType('stateful');
                await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${baseUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(String(lockHandle))}`, 'POST', 'default', null);
                connection.setSessionType('stateless');
                logger?.debug(`Include unlocked after error: ${includeName}`);
            }
            catch (unlockErr) {
                connection.setSessionType('stateless');
                logger?.warn(`Failed to unlock include after error: ${unlockErr instanceof Error ? unlockErr.message : String(unlockErr)}`);
            }
        }
        let errorMessage = error instanceof Error ? error.message : String(error);
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
            if (errorMsg)
                errorMessage = `SAP Error: ${errorMsg}`;
        }
        catch {
            // ignore parse errors
        }
        const statusCode = error.response?.status;
        const statusPart = statusCode ? ` [${statusCode}]` : '';
        logger?.error(`Error updating include ${includeName} at step=${currentStep}${statusPart}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to update include ${includeName} at step=${currentStep}${statusPart}: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateInclude.js.map