"use strict";
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
exports.SSF_RENDER_INSTALL_HINT = void 0;
exports.renderSmartForm = renderSmartForm;
/**
 * SmartForm output as SAP prints it — the reference picture for a preview.
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_RENDER → FM ZMCP_SSF_RENDER, which
 * calls the form's generated function module with the given interface
 * values and CONTROL_PARAMETERS-GETOTF = 'X' (no dialog, no spool) and
 * converts the OTF to PDF. The form's own program lines run, like in a real
 * print. Both files are written under the MCP output directory
 * (smartforms/<form>/<form>.sap.otf.txt and .sap.pdf).
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const rfcBackend_1 = require("./rfcBackend");
const sourceOutput_1 = require("./sourceOutput");
exports.SSF_RENDER_INSTALL_HINT = 'The SAP side of RenderSmartForm is not installed on this system: it needs FM ZMCP_SSF_RENDER ' +
    '(function group ZMCP_ADT_UTILS) and the SSF_RENDER branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_render.abap).';
/** values: interface parameter → value in /UI2/CL_JSON shape (internal formats). */
async function renderSmartForm(connection, formName, values, language, device, families) {
    const params = Object.entries(values ?? {}).map(([name, v]) => ({
        name: name.toUpperCase(),
        json: JSON.stringify(upperKeys(v)),
    }));
    let result;
    let message;
    try {
        ({ result, message } = (await (0, rfcBackend_1.callDispatch)(connection, 'SSF_RENDER', {
            form_name: formName,
            params: JSON.stringify(params),
            language: language ?? '',
            device: device ?? '',
            families: (families ?? []).join(','),
        })));
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/Unknown action:\s*SSF_RENDER/i.test(msg) ||
            /ZMCP_SSF_RENDER[\s\S]*not found/i.test(msg))
            throw new Error(`${exports.SSF_RENDER_INSTALL_HINT} (SAP said: ${msg})`);
        throw new Error(msg);
    }
    if (!result || typeof result !== 'object' || !result.otf)
        throw new Error(`SSF_RENDER returned no OTF: ${String(message ?? JSON.stringify(result)).substring(0, 300)}`);
    const dir = `smartforms/${formName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    const write = (name, data) => {
        const abs = (0, sourceOutput_1.safeOutputPath)(`${dir}/${name}`);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, data);
        return abs;
    };
    const base = formName.toLowerCase();
    const files = {
        otf: write(`${base}.sap.otf.txt`, Buffer.from(result.otf, 'base64')),
    };
    if (result.pdf)
        files.pdf = write(`${base}.sap.pdf`, Buffer.from(result.pdf, 'base64'));
    return {
        form: result.form ?? formName,
        fm: result.fm ?? '',
        device: result.device ?? '',
        deviceType: result.deviceType ?? '',
        pages: Number(result.pages ?? 0),
        ...(message ? { message } : {}),
        files,
    };
}
/** /UI2/CL_JSON matches ABAP component names; send them upper case. */
function upperKeys(v) {
    if (Array.isArray(v))
        return v.map(upperKeys);
    if (v && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k.toUpperCase(), upperKeys(x)]));
    return v;
}
//# sourceMappingURL=smartFormRender.js.map