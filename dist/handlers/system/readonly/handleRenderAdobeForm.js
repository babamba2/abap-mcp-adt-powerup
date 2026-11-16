"use strict";
/**
 * RenderAdobeForm — the PDF of an Adobe form exactly as ADS produces it,
 * for given interface values, without printing or spooling.
 *
 * Runs the form's generated function module between FP_JOB_OPEN
 * (GETPDF = 'X', NODIALOG = 'X', no preview) and FP_JOB_CLOSE. Nothing is
 * printed, stored or sent, but the form's context coding runs as in a real
 * print (it may read the database). Use invented sample values only.
 *
 * Backend: ZMCP_ADT_DISPATCH action FP_RENDER → FM ZMCP_FP_CONTENT (RENDER).
 * Companion ABAP: sc4sap/abap/zmcp_fp_content.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRenderAdobeForm = handleRenderAdobeForm;
const adobeForm_1 = require("../../../lib/adobeForm");
const utils_1 = require("../../../lib/utils");
const valuesFile_1 = require("../../../lib/valuesFile");
exports.TOOL_DEFINITION = {
    name: 'RenderAdobeForm',
    available_in: ['onprem', 'legacy'],
    description: "[runs the form, no output] The PDF of an active Adobe form (SFP) as ADS produces it, for given interface values: calls the generated function module with FP_JOB_OPEN GETPDF (no dialog, no print, no spool) and writes the PDF under the MCP output directory (adobe/<form>/<form>.sap.pdf). The form's own context coding runs as in a real print and may read the database — pass invented sample values only. Needs the ZMCP_FP_CONTENT FM, the FP_RENDER dispatcher action and a working ADS connection (development clients only).",
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'Adobe form name (e.g. "FP_TEST_00").',
            },
            values: {
                type: 'object',
                description: 'Interface parameter → value, in internal format: structures as objects with the ABAP component names, table types as arrays, dates "2026-10-16", times "14:00:00", amounts and quantities as numbers. Parameters left out are passed initial.',
            },
            values_file: {
                type: 'string',
                description: 'Path of a JSON file with the same content as values (for large tables): a .json file inside the MCP output directory or the profile work folder, at most 1 MB.',
            },
            language: {
                type: 'string',
                description: 'Output language: 1-char SAP key or 2-letter ISO code. Default: logon language.',
            },
        },
        required: ['form_name'],
    },
};
async function handleRenderAdobeForm(context, args) {
    const { connection, logger } = context;
    try {
        if (!String(args?.form_name ?? '').trim())
            return (0, utils_1.return_error)(new Error('form_name is required'));
        let values = args?.values;
        if (!values && args?.values_file)
            values = (0, valuesFile_1.readValuesFile)(args.values_file);
        logger?.info(`RenderAdobeForm: ${args.form_name}`);
        const result = await (0, adobeForm_1.renderAdobeForm)(connection, args.form_name, values ?? {}, args?.language?.trim() || undefined);
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`RenderAdobeForm error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleRenderAdobeForm.js.map