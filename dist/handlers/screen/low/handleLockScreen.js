"use strict";
/**
 * LockScreen Handler - Lock parent program for Screen modification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleLockScreen = handleLockScreen;
const fast_xml_parser_1 = require("fast-xml-parser");
const utils_1 = require("../../../lib/utils");
const ACCEPT_LOCK = 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';
exports.TOOL_DEFINITION = {
    name: 'LockScreenLow',
    available_in: ['onprem', 'legacy'],
    description: '[low-level] Lock a program for Screen modification. Returns lock handle for subsequent operations.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            screen_number: {
                type: 'string',
                description: 'Screen number (for reference).',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['program_name'],
    },
};
async function handleLockScreen(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, screen_number, session_id, session_state } = args;
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        if ((0, utils_1.isCloudConnection)()) {
            return (0, utils_1.return_error)(new Error('Screens are not available on cloud systems (ABAP Cloud).'));
        }
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const programName = program_name.toUpperCase();
        const encodedProgram = (0, utils_1.encodeSapObjectName)(programName);
        const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
        logger?.info(`Locking program for screen: ${programName}`);
        const lockResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${programUrl}?_action=LOCK&accessMode=MODIFY`, 'POST', 'default', null, undefined, { Accept: ACCEPT_LOCK });
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const parsed = parser.parse(lockResponse.data || '');
        const lockHandle = parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
            lockResponse.headers?.['x-sap-adt-lock-handle'];
        if (!lockHandle) {
            throw new Error(`Failed to obtain lock handle for program ${programName}`);
        }
        logger?.info(`✅ Program locked for screen: ${programName}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                screen_number: screen_number || null,
                session_id: session_id || null,
                lock_handle: lockHandle,
                message: `Program ${programName} locked for screen modification.`,
            }, null, 2),
        });
    }
    catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);
        if (error.response?.status === 409) {
            errorMessage = `Program ${args?.program_name} is already locked by another user.`;
        }
        logger?.error(`Error locking for screen: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to lock: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleLockScreen.js.map