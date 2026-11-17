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
exports.FP_MIGRATE_INSTALL_HINT = exports.XDP_EXTERNAL_RE = exports.XDP_LABEL_RE = exports.FP_INSTALL_HINT = void 0;
exports.normalizeFormName = normalizeFormName;
exports.translateFpError = translateFpError;
exports.summarizeXdp = summarizeXdp;
exports.getAdobeFormContent = getAdobeFormContent;
exports.renderAdobeForm = renderAdobeForm;
exports.prepareXdp = prepareXdp;
exports.renderAdobeXdp = renderAdobeXdp;
exports.checkMigrationNames = checkMigrationNames;
exports.normalizeCorrection = normalizeCorrection;
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
/** Labels RENDER_XDP accepts (the SAP form-template samples, or own ZSC4SAP_* templates); the FM checks again. */
exports.XDP_LABEL_RE = /^(ZF_CINE_TICKET|ZFORM_FDP_SCRATCH|ZSC4SAP_[A-Z0-9_]+)$/;
const LOCALE_RE = /^[a-z]{2}_[A-Z]{2}$/;
/** References that would make ADS fetch something from outside — refused (the FM checks the same again). */
exports.XDP_EXTERNAL_RE = /<(\w+:)?(wsdlAddress|soapAddress|submit|effectiveOutputPolicy)\b|<(\w+:)?uri\s*>\s*[^<\s]|\b(href|src)\s*=\s*["'](?!#|data:)|usehref\s*=\s*["'](?!#)|url\s*\(|\.(gotoURL|importData|launchURL|exportData)\b|\b(Get|Post|Put)\s*\(/i;
const CONNECTION_SET_RE = /<(\w+:)?connectionSet\b[\s\S]*?<\/(\w+:)?connectionSet\s*>/gi;
/**
 * Check an XDP before it goes to ADS: the designer's data-connection packet (<connectionSet>, a design-time link
 * to a sample data / schema file, never used when the data comes with the call) is taken out; anything that could
 * still make ADS fetch a resource is refused. Returns the template to send and what was removed.
 */
function prepareXdp(xdp) {
    let s = xdp.toString('utf8');
    const removed = [];
    if (CONNECTION_SET_RE.test(s)) {
        s = s.replace(CONNECTION_SET_RE, '');
        removed.push('connectionSet');
    }
    if (/<(\w+:)?connectionSet\b/i.test(s))
        throw new Error('xdp_file: refused — unterminated <connectionSet> packet');
    const m = s.match(exports.XDP_EXTERNAL_RE);
    if (m)
        throw new Error(`xdp_file: refused — external or data-connection reference (${m[0].slice(0, 40)}); ADS must not fetch anything`);
    return { xdp: Buffer.from(s, 'utf8'), removed };
}
/**
 * An XDP template rendered with XML data straight in ADS (CL_FP_ADS_UTIL=>RENDER_PDF via ZMCP_FP_CONTENT part
 * RENDER_XDP): no SAP form object, no form code, no print, no spool. `xdp` / `xml` are the file contents.
 */
async function renderAdobeXdp(connection, label, xdp, xml, locale = 'en_US', embedFonts = false) {
    const form = String(label ?? '')
        .trim()
        .toUpperCase();
    if (!exports.XDP_LABEL_RE.test(form) || form.length > 30)
        throw new Error(`form_name: ZF_CINE_TICKET, ZFORM_FDP_SCRATCH or ZSC4SAP_* (≤ 30): ${String(label ?? '').slice(0, 40)}`);
    if (!LOCALE_RE.test(locale))
        throw new Error(`locale: language_COUNTRY, e.g. en_US: ${String(locale).slice(0, 12)}`);
    if (!xdp.length || !xml.length)
        throw new Error('xdp and xml must not be empty');
    const prepared = prepareXdp(xdp);
    const params = JSON.stringify({
        xdp: prepared.xdp.toString('base64'),
        xml: xml.toString('base64'),
        locale,
        embedFonts,
    });
    if (params.length > 3000000)
        throw new Error('xdp + xml: more than 3 000 000 characters once base64-encoded');
    const r = await fpCall(connection, 'FP_CONTENT', {
        part: 'RENDER_XDP',
        name: form,
        params,
    });
    if (r.result?.error) {
        // ADS error: the FM returns the ADS trace with it (subrc 0, no pdf) — keep it as a file.
        const tracePath = r.result.trace
            ? writeOut(dirOf(form), `${form.toLowerCase()}.xdp.ads-trace.txt`, String(r.result.trace))
            : '';
        throw new Error(`RENDER_XDP: ADS error: ${String(r.result.error).slice(0, 300)}${tracePath ? ` (ADS trace: ${tracePath})` : ''}`);
    }
    if (!r.result?.pdf)
        throw new Error(`RENDER_XDP returned no PDF: ${String(r.message ?? JSON.stringify(r.result)).slice(0, 300)}`);
    const pdf = Buffer.from(String(r.result.pdf), 'base64');
    if (pdf.subarray(0, 4).toString('latin1') !== '%PDF')
        throw new Error('RENDER_XDP returned data that is not a PDF');
    const base = form.toLowerCase();
    const files = {
        pdf: writeOut(dirOf(form), `${base}.xdp.sap.pdf`, pdf),
    };
    if (r.result.trace)
        files.trace = writeOut(dirOf(form), `${base}.xdp.ads-trace.txt`, String(r.result.trace));
    return {
        form,
        pages: Number(r.result.pages ?? 0),
        ...(prepared.removed.length ? { removed: prepared.removed } : {}),
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
const CORRECTION_OPS = new Set([
    'layout',
    'geometry',
    'margin',
    'font',
    'para',
    'xhtml',
    'picture',
    'border',
    'presence',
    // the only script edit: one DateFmt(<n>, $.locale) call in the field's initialize script → a fixed picture
    'datePicture',
]);
/** date{…} pictures datePicture may write: D / M / Y and . / - or space only. */
const DATE_PICTURE_RE = /^date\{[DMY][DMY./ -]{0,19}\}$/;
/** op fields passed on (spec name → the FM's lower-case key); anything else is ignored. */
const CORRECTION_FIELDS = [
    'rule',
    'basis',
    'value',
    'x',
    'y',
    'w',
    'h',
    'anchorType',
    'topInset',
    'bottomInset',
    'leftInset',
    'rightInset',
    'typeface',
    'size',
    'weight',
    'spaceAbove',
    'spaceBelow',
    'marginLeft',
    'marginRight',
    'textIndent',
    'lineHeight',
    'hAlign',
    'vAlign',
    'div',
    'display',
    'format',
    'edge',
    'presence',
    'thickness',
    'picture',
];
const CSS_NAMES = new Set([
    'line-height',
    'margin-left',
    'margin-right',
    'margin-top',
    'margin-bottom',
    'text-indent',
    'tab-stops',
    'font-size',
    'font-family',
    'font-weight',
    'text-align',
]);
const MAX_CORRECTION_OPS = 500;
const MAX_CORRECTION_CHARS = 1000000;
/**
 * Layout correction spec v1 ({version:1, strict?, ops:[{op, target:{path | protoId [+ path] | xliffId}, …}]}) →
 * the flat JSON ZMCP_FP_MIGRATE takes (lower-case keys, CSS as "name:value;…"). Unknown op keys are ignored;
 * unknown ops, a missing target, non-scalar values or CSS names outside the allow-list are refused here. The FM
 * checks every value again (allow-lists, measurements) and reports each op as applied / not_found / ambiguous /
 * refused.
 */
function normalizeCorrection(spec, strict) {
    const s = spec;
    if (!s || typeof s !== 'object' || s.version !== 1 || !Array.isArray(s.ops))
        throw new Error('correction: expected {"version":1,"ops":[...]}');
    if (!s.ops.length || s.ops.length > MAX_CORRECTION_OPS)
        throw new Error(`correction: 1 to ${MAX_CORRECTION_OPS} ops (${s.ops.length})`);
    const scalar = (v, where) => {
        if (typeof v === 'number' && Number.isFinite(v))
            return String(v);
        if (typeof v === 'string' && v.length <= 1000)
            return v;
        throw new Error(`correction: ${where} must be a string or number`);
    };
    const ops = s.ops.map((o, i) => {
        if (!o || typeof o !== 'object')
            throw new Error(`correction: op ${i} is not an object`);
        const op = String(o.op ?? '');
        if (!CORRECTION_OPS.has(op))
            throw new Error(`correction: op ${i} "${op.slice(0, 20)}" unknown`);
        const t = o.target ?? {};
        const out = { op };
        if (t.path != null)
            out.path = scalar(t.path, `op ${i} target.path`);
        if (t.protoId != null)
            out.protoid = scalar(t.protoId, `op ${i} target.protoId`);
        if (t.xliffId != null)
            out.xliffid = scalar(t.xliffId, `op ${i} target.xliffId`);
        if (!out.path && !out.protoid && !out.xliffid)
            throw new Error(`correction: op ${i} has no target`);
        for (const f of CORRECTION_FIELDS)
            if (o[f] != null)
                out[f.toLowerCase()] = scalar(o[f], `op ${i} ${f}`);
        if (op === 'datePicture' && !DATE_PICTURE_RE.test(out.picture ?? ''))
            throw new Error(`correction: op ${i} datePicture needs picture date{…} with D / M / Y and . / - or space only`);
        if (o.css != null) {
            if (typeof o.css !== 'object' || Array.isArray(o.css))
                throw new Error(`correction: op ${i} css must be an object`);
            out.css = Object.entries(o.css)
                .map(([k, v]) => {
                const name = k.toLowerCase();
                if (!CSS_NAMES.has(name))
                    throw new Error(`correction: op ${i} CSS "${k.slice(0, 30)}" not allowed`);
                const val = scalar(v, `op ${i} css ${k}`);
                if (/[;:<>{}()"\\]/.test(val))
                    throw new Error(`correction: op ${i} CSS ${k} value not allowed`);
                return `${name}:${val}`;
            })
                .join(';');
        }
        return out;
    });
    const isStrict = strict ?? s.strict === true;
    const json = JSON.stringify({ strict: isStrict, ops });
    if (json.length > MAX_CORRECTION_CHARS)
        throw new Error(`correction: more than ${MAX_CORRECTION_CHARS} characters once flattened`);
    return { json, ops: ops.length, strict: isStrict };
}
/** SAP's SmartForm migration into new $TMP objects (ZMCP_FP_MIGRATE); the result and log go to a file too. */
async function createAdobeFormFromSmartForm(connection, source, formName, interfaceName, senderCountry, correction) {
    const n = checkMigrationNames(source, formName, interfaceName);
    const country = String(senderCountry ?? '')
        .trim()
        .toUpperCase();
    if (country && !/^[A-Z0-9]{1,3}$/.test(country))
        throw new Error(`sender_country: a country key (T005, e.g. "DE"): ${String(senderCountry).slice(0, 10)}`);
    let r;
    try {
        r = await fpCall(connection, 'FP_MIGRATE', {
            source: n.source,
            form: n.form,
            interface: n.iface,
            preset: 'FULL',
            ...(country ? { sender_country: country } : {}),
            ...(correction ? { correction: correction.json } : {}),
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
        adjusted: Array.isArray(res.adjusted) ? res.adjusted : [],
        log: Array.isArray(res.log) ? res.log : [],
        ...(res.cacheInfo ? { cacheInfo: String(res.cacheInfo) } : {}),
        ...(res.correction && typeof res.correction === 'object'
            ? { correction: res.correction }
            : {}),
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