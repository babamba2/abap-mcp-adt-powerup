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
exports.FP_MIGRATE_INSTALL_HINT = exports.FP_INSTALL_HINT = void 0;
exports.normalizeFormName = normalizeFormName;
exports.translateFpError = translateFpError;
exports.summarizeXdp = summarizeXdp;
exports.getAdobeFormContent = getAdobeFormContent;
exports.renderAdobeForm = renderAdobeForm;
exports.checkMigrationNames = checkMigrationNames;
exports.createAdobeFormFromSmartForm = createAdobeFormFromSmartForm;
/**
 * Adobe forms (SFP) — read the form and its PDF from ADS, for previews and checks.
 *
 * ADT has no content endpoint for form objects (only the generic
 * /sap/bc/adt/vit/wb/object_type/sfpf5f/... properties URI), so both go
 * through the dispatcher, like the SmartForm tools:
 *   FP_CONTENT → FM ZMCP_FP_CONTENT parts FORM / LAYOUT / INTERFACE
 *   FP_RENDER  → FM ZMCP_FP_CONTENT part RENDER (FP_JOB_OPEN GETPDF, no spool)
 * Files go under the MCP output directory, adobe/<form>/.
 * Companion ABAP: sc4sap/abap/zmcp_fp_content.abap and
 * zmcp_adt_dispatch_fp_content_branch.abap.
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const rfcBackend_1 = require("./rfcBackend");
const sourceOutput_1 = require("./sourceOutput");
exports.FP_INSTALL_HINT = 'The SAP side of the Adobe form tools is not installed on this system: it needs FM ZMCP_FP_CONTENT ' +
    '(function group ZMCP_FP) and the FP_CONTENT / FP_RENDER branches in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_fp_content.abap, zmcp_adt_dispatch_fp_content_branch.abap).';
const NAME_RE = /^[A-Z0-9_/]{1,30}$/;
/** Check a form / interface name before it goes to SAP or into a path. */
function normalizeFormName(name) {
    const n = String(name ?? '')
        .trim()
        .toUpperCase();
    if (!NAME_RE.test(n))
        throw new Error(`form_name: an SFP form name (letters, digits, _ /, ≤ 30): ${String(name ?? '').slice(0, 40)}`);
    return n;
}
/** Map dispatcher errors: missing helper → install hint, subrc 4 → not found. */
function translateFpError(error, action) {
    const msg = error instanceof Error ? error.message : String(error);
    if (new RegExp(`Unknown action:\\s*${action}`, 'i').test(msg) ||
        /ZMCP_FP_CONTENT[\s\S]*(not found|does not exist|not exist)|(CALL_FUNCTION_NOT_FOUND|FU_NOT_FOUND)[\s\S]*ZMCP_FP_CONTENT/i.test(msg))
        return new Error(`${exports.FP_INSTALL_HINT} (SAP said: ${msg})`);
    if (/subrc=4\b/.test(msg))
        return new Error(`Not found: ${msg}`);
    return new Error(msg);
}
/** Counts from the XDP template, enough to tell what kind of layout it is. */
function summarizeXdp(xdp) {
    const count = (re) => (xdp.match(re) || []).length;
    const layouts = {};
    for (const m of xdp.matchAll(/<subform\b[^>]*\blayout="([^"]+)"/g))
        layouts[m[1]] = (layouts[m[1]] || 0) + 1;
    const binds = [
        ...new Set([...xdp.matchAll(/<bind\b[^>]*\bref="([^"]+)"/g)].map((m) => m[1])),
    ].sort();
    return {
        pageAreas: count(/<pageArea\b/g),
        contentAreas: count(/<contentArea\b/g),
        subforms: count(/<subform\b/g),
        fields: count(/<field\b/g),
        draws: count(/<draw\b/g),
        binds,
        layouts,
        scripts: count(/<script\b/g),
    };
}
function dirOf(form) {
    return `adobe/${form.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
}
function writeOut(dir, name, data) {
    const abs = (0, sourceOutput_1.safeOutputPath)(`${dir}/${name}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
    return abs;
}
async function fpCall(connection, action, params) {
    try {
        const r = (await (0, rfcBackend_1.callDispatch)(connection, action, params));
        return { result: r?.result ?? {}, message: r?.message || undefined };
    }
    catch (error) {
        throw translateFpError(error, action);
    }
}
/** Form header, the full form XML, the layout (XDP) and the interface XML, written as files. */
async function getAdobeFormContent(connection, formName, options = {}) {
    const form = normalizeFormName(formName);
    const language = options.language ?? '';
    const head = await fpCall(connection, 'FP_CONTENT', {
        part: 'FORM',
        name: form,
        language,
    });
    if (!head.result?.xml)
        throw new Error(`FP_CONTENT FORM returned no XML for ${form}: ${String(head.message ?? '').slice(0, 200)}`);
    const lay = await fpCall(connection, 'FP_CONTENT', {
        part: 'LAYOUT',
        name: form,
        language,
    });
    const xdp = Buffer.from(String(lay.result?.xdp ?? ''), 'base64').toString('utf8');
    const dir = dirOf(form);
    const base = form.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const files = {
        form: '',
        formXml: writeOut(dir, `${base}.form.xml`, Buffer.from(String(head.result.xml), 'base64')),
        layout: writeOut(dir, `${base}.layout.xdp`, xdp),
    };
    const ifName = String(head.result.interface ?? '').trim();
    if (options.includeInterface !== false && ifName && NAME_RE.test(ifName)) {
        const itf = await fpCall(connection, 'FP_CONTENT', {
            part: 'INTERFACE',
            name: ifName,
            language,
        });
        if (itf.result?.xml)
            files.interface = writeOut(dir, `${ifName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.interface.xml`, Buffer.from(String(itf.result.xml), 'base64'));
    }
    let check;
    if (options.includeCheck) {
        // read-only on SAP: CL_FP_WB_FORM=>CHECK in display mode, nothing saved
        const chk = await fpCall(connection, 'FP_CONTENT', {
            part: 'CHECK',
            name: form,
            language,
        });
        const messages = (Array.isArray(chk.result?.messages) ? chk.result.messages : []).map((m) => ({
            msgty: String(m?.msgty ?? ''),
            msgid: String(m?.msgid ?? ''),
            msgno: String(m?.msgno ?? ''),
            text: String(m?.text ?? ''),
            type: String(m?.type ?? ''),
            navcursor: String(m?.navcursor ?? ''),
        }));
        check = { messages };
        files.check = writeOut(dir, `${base}.check.json`, JSON.stringify({ form, messages }, null, 2));
    }
    const out = {
        form,
        interface: ifName,
        formType: String(head.result.formType ?? ''),
        formTech: String(head.result.formTech ?? ''),
        layoutType: String(head.result.layoutType ?? ''),
        summary: summarizeXdp(xdp),
        ...(check ? { check } : {}),
        files,
        ...(head.message ? { message: head.message } : {}),
    };
    files.form = writeOut(dir, `${base}.form.json`, JSON.stringify({ ...out, files: { ...files, form: undefined } }, null, 2));
    return out;
}
/** The PDF of an active form from ADS for invented interface values (internal formats). */
async function renderAdobeForm(connection, formName, values, language, getXml = false) {
    const form = normalizeFormName(formName);
    const params = Object.entries(values ?? {})
        .filter(([name]) => !name.startsWith('$'))
        .map(([name, v]) => ({
        name: name.toUpperCase(),
        json: JSON.stringify(upperKeys(v)),
    }));
    // "$GETXML" is not an interface parameter: it asks the helper for the data XML ADS got
    if (getXml)
        params.push({ name: '$GETXML', json: 'true' });
    const paramStr = JSON.stringify(params);
    if (paramStr.length > 200000)
        throw new Error('values: more than 200 000 characters once serialized');
    const r = await fpCall(connection, 'FP_RENDER', {
        name: form,
        params: paramStr,
        language: language ?? '',
    });
    if (!r.result?.pdf)
        throw new Error(`FP_RENDER returned no PDF: ${String(r.message ?? JSON.stringify(r.result)).slice(0, 300)}`);
    const pdf = Buffer.from(String(r.result.pdf), 'base64');
    if (pdf.subarray(0, 4).toString('latin1') !== '%PDF')
        throw new Error('FP_RENDER returned data that is not a PDF');
    const base = form.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const files = {
        pdf: writeOut(dirOf(form), `${base}.sap.pdf`, pdf),
    };
    let xmlError;
    if (getXml) {
        if (r.result.xml)
            files.dataXml = writeOut(dirOf(form), `${base}.sap.data.xml`, Buffer.from(String(r.result.xml), 'base64'));
        else
            xmlError = String(r.result.xmlError ?? 'no data XML returned (helper without GETXML?)');
    }
    return {
        form,
        fm: String(r.result.fm ?? ''),
        pages: Number(r.result.pages ?? 0),
        ...(r.message ? { message: r.message } : {}),
        ...(xmlError ? { xmlError } : {}),
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
// ── SmartForm → Adobe form (DEV write) ────────────────────────────────────────────
exports.FP_MIGRATE_INSTALL_HINT = 'The SAP side of CreateAdobeFormFromSmartForm is not installed on this system: it needs FM ZMCP_FP_MIGRATE ' +
    '(function group ZMCP_FP) and the FP_MIGRATE branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_fp_migrate.abap, zmcp_adt_dispatch_fp_migrate_branch.abap).';
// a SAP name: no Z / Y first letter, no namespace
const SOURCE_RE = /^[A-X0-9_][A-Z0-9_]{0,29}$/;
const TARGET_RE = /^ZSC4SAP_AFM_[A-Z0-9_]+$/;
/** Check the names before anything reaches SAP (the FM checks them again). */
function checkMigrationNames(source, form, iface) {
    const up = (v) => String(v ?? '')
        .trim()
        .toUpperCase();
    const src = up(source), f = up(form), i = up(iface);
    if (!SOURCE_RE.test(src))
        throw new Error('source: a SAP SmartForm name (letters, digits, _; no Z / Y / namespace)');
    for (const [k, v] of [
        ['form_name', f],
        ['interface_name', i],
    ])
        if (v.length > 30 || !TARGET_RE.test(v))
            throw new Error(`${k}: must match ZSC4SAP_AFM_[A-Z0-9_]+ (≤ 30 characters)`);
    return { source: src, form: f, iface: i };
}
/** SAP's SmartForm migration into new $TMP objects (ZMCP_FP_MIGRATE); the result and log go to a file too. */
async function createAdobeFormFromSmartForm(connection, source, formName, interfaceName) {
    const n = checkMigrationNames(source, formName, interfaceName);
    let r;
    try {
        r = await fpCall(connection, 'FP_MIGRATE', {
            source: n.source,
            form: n.form,
            interface: n.iface,
            preset: 'FULL',
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Unknown action:\s*FP_MIGRATE|ZMCP_FP_MIGRATE[\s\S]*(not found|does not exist)/i.test(msg))
            throw new Error(`${exports.FP_MIGRATE_INSTALL_HINT} (SAP said: ${msg})`);
        throw e;
    }
    const res = r.result ?? {};
    const out = {
        source: n.source,
        form: n.form,
        interface: n.iface,
        options: res.options ?? {},
        raised: res.raised === true,
        ...(res.error ? { error: String(res.error) } : {}),
        saved: Array.isArray(res.saved) ? res.saved : [],
        left: Array.isArray(res.left) ? res.left : [],
        active: Array.isArray(res.active) ? res.active : [],
        ...(res.activation ? { activation: String(res.activation) } : {}),
        renamed: Array.isArray(res.renamed) ? res.renamed : [],
        log: Array.isArray(res.log) ? res.log : [],
        ...(res.cacheInfo ? { cacheInfo: String(res.cacheInfo) } : {}),
        complete: false,
        ...(r.message ? { message: String(r.message) } : {}),
        files: { result: '' },
    };
    out.complete =
        !out.raised &&
            out.active.includes(`SFPF ${n.form}`) &&
            out.active.includes(`SFPI ${n.iface}`);
    out.files.result = writeOut(dirOf(n.form), `${n.form.toLowerCase()}.migrate.json`, JSON.stringify({ ...out, files: undefined }, null, 2));
    return out;
}
//# sourceMappingURL=adobeForm.js.map