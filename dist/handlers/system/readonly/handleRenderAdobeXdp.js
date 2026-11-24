"use strict";
/**
 * RenderAdobeXdp — an XDP template rendered with XML data in ADS (as SAP's form-template samples do with
 * CL_FP_ADS_UTIL=>RENDER_PDF): no SAP form object, no form code, nothing printed, spooled or stored in SAP.
 * The XDP and XML come from files inside the MCP output directory / profile work folder (confined like values_file).
 *
 * Backend: ZMCP_ADT_DISPATCH action FP_CONTENT, part RENDER_XDP → FM ZMCP_FP_CONTENT.
 * Companion ABAP: sc4sap/abap/zmcp_fp_content.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRenderAdobeXdp = handleRenderAdobeXdp;
const adobeForm_1 = require("../../../lib/adobeForm");
const utils_1 = require("../../../lib/utils");
const valuesFile_1 = require("../../../lib/valuesFile");
exports.TOOL_DEFINITION = {
    name: 'RenderAdobeXdp',
    available_in: ['onprem', 'legacy'],
    description: '[read-only, no output] Render an Adobe XDP template with XML data in ADS (CL_FP_ADS_UTIL=>RENDER_PDF) and write the PDF under the MCP output directory (adobe/<name>/<name>.xdp.sap.pdf, plus the ADS trace). No SAP form object is used, no form code runs, nothing is printed, spooled or stored in SAP. For SAP form-template samples (ZF_CINE_TICKET, ZFORM_FDP_SCRATCH) and own ZSC4SAP_* templates. Needs the ZMCP_FP_CONTENT FM (part RENDER_XDP) and a working ADS connection (development clients only).',
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'Label of the template: ZF_CINE_TICKET, ZFORM_FDP_SCRATCH or ZSC4SAP_*.',
            },
            xdp_file: {
                type: 'string',
                description: 'Path of the .xdp template inside the MCP output directory or the profile work folder (≤ 5 MB).',
            },
            xml_file: {
                type: 'string',
                description: 'Path of the .xml data file inside the MCP output directory or the profile work folder (≤ 5 MB).',
            },
            locale: {
                type: 'string',
                description: 'Locale language_COUNTRY, e.g. en_US (default) or de_DE.',
            },
            embed_fonts: {
                type: 'boolean',
                description: 'Embed the fonts in the PDF. Default false.',
            },
        },
        required: ['form_name', 'xdp_file', 'xml_file'],
    },
};
async function handleRenderAdobeXdp(context, args) {
    const { connection, logger } = context;
    try {
        const xdp = (0, valuesFile_1.readFormInputFile)(args?.xdp_file, 'xdp_file', ['.xdp']);
        const xml = (0, valuesFile_1.readFormInputFile)(args?.xml_file, 'xml_file', ['.xml']);
        logger?.info(`RenderAdobeXdp: ${args?.form_name}`);
        const result = await (0, adobeForm_1.renderAdobeXdp)(connection, args?.form_name, xdp, xml, args?.locale?.trim() || 'en_US', args?.embed_fonts === true);
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger?.error(`RenderAdobeXdp error: ${msg}`);
        return (0, utils_1.return_error)(new Error(msg));
    }
}
//# sourceMappingURL=handleRenderAdobeXdp.js.map