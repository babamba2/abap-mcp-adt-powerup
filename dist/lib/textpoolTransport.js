"use strict";
/**
 * Records a program's text pool (LIMU REPT) on a transport request before
 * the text pool is written.
 *
 * ZMCP_ADT_TEXTPOOL writes with INSERT TEXTPOOL, which never touches the
 * transport system: the texts changed in the system but no request carried
 * them, so a released request moved new code with old texts. The dispatcher
 * action TEXTPOOL_CORR (ZMCP_ADT_DISPATCH, FORM textpool_corr) calls
 * RS_CORR_INSERT with object class 'TEXT' (= LIMU REPT) without a dialog.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTextpoolTransport = recordTextpoolTransport;
const rfcBackend_1 = require("./rfcBackend");
const UNKNOWN_ACTION = /Unknown action:\s*TEXTPOOL_CORR/i;
/**
 * Records LIMU REPT <program> on `transport` (or learns that the program is
 * local). Call it after the program lock and before the text pool write.
 * @param connection ADT connection (passed through to the dispatcher call)
 * @param program program whose text pool is about to be written
 * @param transport request from the tool call; required by SAP unless the
 *   program is in a $ package
 * @param dispatch dispatcher call, replaceable in unit tests
 * @returns what was recorded
 * @throws Error when SAP refuses to record (no request for a transportable
 *   package, released / foreign request, …) or when a request was given but
 *   the dispatcher cannot record it — the caller must then not write
 */
async function recordTextpoolTransport(connection, program, transport, dispatch = rfcBackend_1.callDispatch) {
    const request = (transport ?? '').trim().toUpperCase();
    try {
        const { result } = await dispatch(connection, 'TEXTPOOL_CORR', {
            program: program.toUpperCase(),
            transport: request,
        });
        const local = result?.local === true;
        const korrnum = String(result?.korrnum ?? '');
        return { recorded: !local, korrnum, local };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!UNKNOWN_ACTION.test(message)) {
            throw new Error(`Text pool of ${program} not written — recording LIMU REPT failed: ${message}`);
        }
        // Dispatcher installed before TEXTPOOL_CORR existed.
        if (request) {
            throw new Error(`Text pool of ${program} not written — ZMCP_ADT_DISPATCH on this system has no TEXTPOOL_CORR action, so LIMU REPT cannot be recorded on ${request}. Re-install the dispatcher from the current sc4sap abap/ sources (setup Step 9a).`);
        }
        return {
            recorded: false,
            korrnum: '',
            local: false,
            warning: 'ZMCP_ADT_DISPATCH has no TEXTPOOL_CORR action: the text pool was written but is not on any transport request. Re-install the dispatcher, or add LIMU REPT to the request by hand.',
        };
    }
}
//# sourceMappingURL=textpoolTransport.js.map