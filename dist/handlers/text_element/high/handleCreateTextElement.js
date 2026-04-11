"use strict";
/**
 * CreateTextElement Handler (High-level) - Add a text element row
 *
 * Uses ZMCP_ADT_TEXTPOOL RFC (READ + WRITE) via SOAP. INSERT TEXTPOOL
 * fully replaces the language-specific pool, so we fetch the current
 * rows, append the new one, write the complete array back, and
 * optionally activate the parent program.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateTextElement = handleCreateTextElement;
const fast_xml_parser_1 = require("fast-xml-parser");
const soapRfc_1 = require("../../../lib/soapRfc");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
const MAX_ENTRY_LEN = 132;
exports.TOOL_DEFINITION = {
    name: 'CreateTextElement',
    available_in: ['onprem', 'legacy'],
    description: 'Add a text element (text symbol, selection text, program title, or list heading) to an ABAP program. Optionally activates after write.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name (e.g., Z_MY_PROGRAM).',
            },
            text_type: {
                type: 'string',
                description: '"I"=text symbol (TEXT-xxx), "S"=selection text, "R"=program title, "H"=list heading.',
                enum: ['I', 'S', 'R', 'H'],
            },
            key: {
                type: 'string',
                description: 'Row key. For "I" use 3-char code (e.g., "001"). For "S" use the parameter/select-option name. For "R" the key is ignored (single row).',
            },
            text: {
                type: 'string',
                description: `Text content (max ${MAX_ENTRY_LEN} characters).`,
            },
            language: {
                type: 'string',
                description: 'Language key (1-char). Defaults to SAP logon language.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate the parent program after write. Default: false.',
            },
        },
        required: ['program_name', 'text_type', 'text'],
    },
};
function keyMatches(a, b) {
    return a.trim().toUpperCase() === b.trim().toUpperCase();
}
async function handleCreateTextElement(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.program_name || !args.text_type || typeof args.text !== 'string') {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name, text_type, text'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Text elements are not available on cloud systems (ABAP Cloud).'));
    }
    const programName = args.program_name.toUpperCase();
    const textType = args.text_type.toUpperCase();
    const language = (args.language || '').toUpperCase();
    const shouldActivate = args.activate === true;
    // "R" is the single-row program title — key is fixed (empty / program name).
    // ABAP TEXTPOOL stores it with KEY = program name; /ui2/cl_json keeps it
    // UPPERCASE. We accept empty key for "R" and default to the program name.
    let rowKey = (args.key || '').trim().toUpperCase();
    if (textType === 'R') {
        rowKey = rowKey || programName;
    }
    else if (!rowKey) {
        return (0, utils_1.return_error)(new Error(`key is required for text_type "${textType}"`));
    }
    if (args.text.length > MAX_ENTRY_LEN) {
        return (0, utils_1.return_error)(new Error(`text exceeds max length (${MAX_ENTRY_LEN} chars): got ${args.text.length}`));
    }
    const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
    logger?.info(`Creating text element: ${programName} ${textType}/${rowKey}${language ? ` [${language}]` : ''}`);
    let lockHandle;
    try {
        // Lock parent program (text pool has no standalone ADT URI).
        const lockResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=LOCK&accessMode=MODIFY`, 'POST', 'default', null, undefined, { Accept: ACCEPT_LOCK });
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const parsed = parser.parse(lockResponse.data || '');
        lockHandle =
            parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
                lockResponse.headers?.['x-sap-adt-lock-handle'];
        if (!lockHandle) {
            throw new Error(`Failed to obtain lock handle for program ${programName}`);
        }
        // Fetch current text pool (may be empty — FM returns []).
        const { result: fetched } = await (0, soapRfc_1.callTextpool)(connection, 'READ', {
            program: programName,
            language,
        });
        const rowsIn = Array.isArray(fetched) ? fetched : [];
        // Normalize to UPPERCASE field names (what /ui2/cl_json deserialize expects).
        const rows = rowsIn.map((r) => ({
            ID: String(r?.ID ?? r?.id ?? '').toUpperCase(),
            KEY: String(r?.KEY ?? r?.key ?? ''),
            ENTRY: String(r?.ENTRY ?? r?.entry ?? ''),
            LENGTH: Number(r?.LENGTH ?? r?.length ?? 0),
        }));
        // Reject duplicates — "R" has at most one row, so overwriting it here
        // would silently shadow an existing title.
        const duplicate = rows.find((r) => r.ID === textType && keyMatches(r.KEY, rowKey));
        if (duplicate) {
            throw new Error(`Text element already exists: ${programName} ${textType}/${rowKey}. Use UpdateTextElement instead.`);
        }
        rows.push({
            ID: textType,
            KEY: rowKey,
            ENTRY: args.text,
            LENGTH: args.text.length,
        });
        await (0, soapRfc_1.callTextpool)(connection, 'WRITE', {
            program: programName,
            language,
            textpool_json: JSON.stringify(rows),
        });
        // Unlock before activation (same order as handleUpdateGuiStatus).
        await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
        lockHandle = undefined;
        if (shouldActivate) {
            const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUrl}" adtcore:name="${programName}"/></adtcore:objectReferences>`;
            await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/activation', 'POST', 'long', activationXml, { method: 'activate', preauditRequested: 'true' }, {
                'Content-Type': 'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
            });
        }
        logger?.info(`✅ Text element created: ${programName} ${textType}/${rowKey}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                text_type: textType,
                key: rowKey,
                text: args.text,
                length: args.text.length,
                language: language || null,
                activated: shouldActivate,
                message: shouldActivate
                    ? `Text element ${programName} ${textType}/${rowKey} created and activated.`
                    : `Text element ${programName} ${textType}/${rowKey} created (not activated).`,
                steps_completed: [
                    'lock',
                    'read',
                    'write',
                    'unlock',
                    ...(shouldActivate ? ['activate'] : []),
                ],
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        if (lockHandle) {
            try {
                await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, 'POST', 'default');
            }
            catch {
                /* ignore */
            }
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error creating text element: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create text element: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateTextElement.js.map