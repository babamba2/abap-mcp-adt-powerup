"use strict";
/**
 * RenderSmartForm — the output of a SmartForm exactly as SAP prints it
 * (OTF + PDF), for given interface values, without printing or spooling.
 *
 * Runs the form's generated function module with GETOTF = 'X'. Nothing is
 * printed, stored or sent, but the form's program lines run as in a real
 * print (they may read the database). Use invented sample values only.
 *
 * Backend: ZMCP_ADT_DISPATCH action SSF_RENDER → FM ZMCP_SSF_RENDER.
 * Companion ABAP source: sc4sap/abap/zmcp_ssf_render.abap
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRenderSmartForm = handleRenderSmartForm;
const fs = __importStar(require("node:fs"));
const smartFormRender_1 = require("../../../lib/smartFormRender");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RenderSmartForm',
    available_in: ['onprem', 'legacy'],
    description: "[runs the form, no output] The output of a SmartForm as SAP prints it, for given interface values: calls the generated function module with GETOTF (no dialog, no print, no spool) and writes the OTF (text: positions, fonts, strings) and the PDF under the MCP output directory (smartforms/<form>/<form>.sap.otf.txt / .sap.pdf). The form's own program lines run as in a real print and may read the database — pass invented sample values only. Needs the ZMCP_SSF_RENDER FM and the SSF_RENDER dispatcher action.",
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'SmartForm name (e.g. "ZMY_FORM").',
            },
            values: {
                type: 'object',
                description: 'Interface parameter → value, in internal format: structures as objects with the ABAP component names, TABLES parameters / table types as arrays, dates "2026-10-16", times "14:00:00", amounts and quantities as numbers. Parameters left out are passed initial.',
            },
            values_file: {
                type: 'string',
                description: 'Path of a JSON file with the same object as `values` (for large interfaces). Ignored when `values` is given.',
            },
            device: {
                type: 'string',
                description: 'Output device whose device type sets fonts and character widths (e.g. the printer the form goes to). Default: the user default device, else a SAPWIN / PDF device.',
            },
            families: {
                type: 'array',
                items: { type: 'string' },
                description: 'Font families the form uses (from GetSmartFormContent styles). Without `device`, a device whose type has printer fonts for most of them is used, so the output shows the fonts the form was made for.',
            },
            language: {
                type: 'string',
                description: 'Output language: 1-char SAP key or 2-letter ISO code. Default: logon language.',
            },
        },
        required: ['form_name'],
    },
};
async function handleRenderSmartForm(context, args) {
    const { connection, logger } = context;
    try {
        const formName = String(args?.form_name ?? '')
            .trim()
            .toUpperCase();
        if (!formName)
            return (0, utils_1.return_error)(new Error('form_name is required'));
        let values = args?.values;
        if (!values && args?.values_file)
            values = JSON.parse(fs.readFileSync(args.values_file, 'utf8'));
        logger?.info(`RenderSmartForm: ${formName}`);
        const result = await (0, smartFormRender_1.renderSmartForm)(connection, formName, values ?? {}, args?.language?.trim() || undefined, args?.device?.trim() || undefined, Array.isArray(args?.families) ? args.families : undefined);
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`RenderSmartForm error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleRenderSmartForm.js.map