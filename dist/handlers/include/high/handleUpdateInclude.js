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
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
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
            main_program: {
                type: 'string',
                description: 'Name of the parent/master program that contains this include. When provided, a program-wide syntax check is run after the source is uploaded to catch ABAP errors in the new include code. Highly recommended.',
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
    let checkWarnings = [];
    try {
        // PRE-WRITE syntax check via /sap/bc/adt/checkruns with the
        // proposed source embedded as a base64 inline artifact under the
        // PARENT program's checkObject. This compiles the full program tree
        // in a single SAP call and returns ALL errors it can detect (with
        // line numbers), without writing anything to the server. Only fires
        // when main_program is provided.
        if (args.main_program) {
            currentStep = 'check_new_code';
            const mainProgram = args.main_program.toUpperCase();
            const programUri = `/sap/bc/adt/programs/programs/${(0, utils_1.encodeSapObjectName)(mainProgram).toLowerCase()}`;
            const includeArtifactUri = `${baseUrl}/source/main`;
            logger?.debug(`Pre-write inline check: program=${mainProgram}, include=${includeName}`);
            const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, {
                kind: 'programTreeInline',
                name: mainProgram,
                parentObjectUri: programUri,
                inlineArtifactUri: includeArtifactUri,
                inlineSourceCode: args.source_code,
            });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Include', includeName);
            checkWarnings = checkResult.warnings;
            logger?.info(`Pre-write check passed: ${includeName} via ${mainProgram} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`);
        }
        // NOTE on include syntax checking:
        //
        // SAP's /sap/bc/adt/checkruns reporter does NOT reliably catch
        // cross-reference errors (type not found, form not found, etc.)
        // when the object being checked is a PROG/I include — neither via
        // raw version="inactive" checks, nor via inline-artifact
        // substitution, nor via program-tree checks. The reporter only
        // reliably validates the outermost object's OWN source.
        //
        // For includes, the ONLY reliable validator is activation itself:
        // the ADT activation endpoint compiles the full program tree and
        // returns structured error messages on failure. So this handler
        // treats the activation step (Step 5) as the validation gate and
        // parses any chkl:messages from a failed activation response,
        // returning them as structured check_errors. A deliberately broken
        // include source will fail at activation with line-level detail,
        // and the active version on SAP stays in its previous working
        // state because activation failures do not promote inactive code.
        //
        // Callers that want validation MUST pass activate: true. With
        // activate: false, the broken source lands as an inactive version
        // on SAP but the active version remains intact — use DeleteInclude
        // or another UpdateInclude to clean up.
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
        // Step 4: Activate (if requested) — THIS IS ALSO THE VALIDATION GATE
        // for include source. SAP activation compiles the full program tree
        // and returns <chkl:messages> with line numbers on failure. We parse
        // those into structured checkErrors so the caller can see exactly
        // which line is broken.
        if (shouldActivate) {
            currentStep = 'activate';
            logger?.debug(`Activating include: ${includeName}`);
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${baseUrl}" adtcore:name="${includeName}"/></adtcore:objectReferences>`;
            const activationResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
            // Parse activation response for compile errors. SAP returns HTTP
            // 200 on activation WITH errors — the errors are in the body as
            // <chkl:messages> with type="E". If any E-type messages are
            // present, the activation didn't actually promote the inactive
            // version; we surface ALL errors to the caller.
            //
            // Multi-error support: SAP's activation endpoint returns ALL
            // compile errors it detects in a single call, including
            // cross-reference errors from the parent program tree (e.g.
            // PERFORM calls to FORMs that no longer exist in the updated
            // include). Verified empirically — a single broken include
            // returned 9 errors in one call. Each error has its own line
            // number, extracted from the href fragment
            // (`#start=line,col;end=line,col`) when SAP sets the misleading
            // line="1" attribute.
            const activationBody = typeof activationResponse.data === 'string'
                ? activationResponse.data
                : String(activationResponse.data ?? '');
            if (activationBody.includes('<chkl:messages') ||
                activationBody.includes('chkl:messages')) {
                const actParser = new fast_xml_parser_1.XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                    removeNSPrefix: true,
                });
                const parsed = actParser.parse(activationBody);
                const messages = parsed?.messages?.msg ?? parsed?.['chkl:messages']?.msg ?? [];
                const msgArray = Array.isArray(messages)
                    ? messages
                    : messages
                        ? [messages]
                        : [];
                const activationErrors = [];
                const activationWarnings = [];
                for (const msg of msgArray) {
                    if (!msg || typeof msg !== 'object')
                        continue;
                    const msgType = String(msg['@_type'] || msg.type || '').toUpperCase();
                    const shortText = (msg.shortText &&
                        (msg.shortText['#text'] || msg.shortText.txt || msg.shortText)) ||
                        msg['@_shortText'] ||
                        '';
                    const rawLine = msg['@_line'] || msg.line;
                    const href = msg['@_href'] || msg.href;
                    // SAP often sets line="1" as a placeholder and embeds the
                    // real line/column in the href fragment
                    // (`#start=line,col;end=line,col`). Prefer that when present.
                    let line = rawLine;
                    if (typeof href === 'string') {
                        const m = href.match(/#start=(\d+),/);
                        if (m)
                            line = m[1];
                    }
                    const entry = {
                        type: msgType,
                        text: String(shortText),
                        line,
                        href,
                    };
                    if (msgType === 'E')
                        activationErrors.push(entry);
                    else if (msgType === 'W')
                        activationWarnings.push(entry);
                }
                if (activationErrors.length > 0) {
                    const full = activationErrors
                        .map((e) => `${e.line ? `[L${e.line}] ` : ''}${e.text}`)
                        .join(' | ');
                    const err = new Error(`Include ${includeName} activation failed (${activationErrors.length} error${activationErrors.length === 1 ? '' : 's'}): ${full}. Active version on SAP is unchanged; broken source is staged as inactive and must be replaced via a second UpdateInclude call.`);
                    err.isPreCheckFailure = true;
                    err.checkErrors = activationErrors;
                    err.checkWarnings = activationWarnings;
                    throw err;
                }
                // Warnings only: keep them in the response
                checkWarnings = activationWarnings;
            }
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
            check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
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
        // Surface preCheck-check details so the caller can fix & retry.
        if (error?.isPreCheckFailure) {
            const errWithDetails = new Error(`Failed to update include ${includeName} at step=${currentStep}: ${errorMessage}`);
            errWithDetails.checkErrors = error.checkErrors;
            errWithDetails.checkWarnings = error.checkWarnings;
            return (0, utils_1.return_error)(errWithDetails);
        }
        return (0, utils_1.return_error)(new Error(`Failed to update include ${includeName} at step=${currentStep}${statusPart}: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateInclude.js.map