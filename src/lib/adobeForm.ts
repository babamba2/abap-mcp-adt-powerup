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
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { callDispatch } from './rfcBackend';
import { safeOutputPath } from './sourceOutput';

export const FP_INSTALL_HINT =
  'The SAP side of the Adobe form tools is not installed on this system: it needs FM ZMCP_FP_CONTENT ' +
  '(function group ZMCP_FP) and the FP_CONTENT / FP_RENDER branches in ZMCP_ADT_DISPATCH. ' +
  'Sources and install steps: sc4sap/abap/README.md (zmcp_fp_content.abap, zmcp_adt_dispatch_fp_content_branch.abap).';

const NAME_RE = /^[A-Z0-9_/]{1,30}$/;

export interface AdobeFormSummary {
  pageAreas: number;
  contentAreas: number;
  subforms: number;
  fields: number;
  draws: number;
  binds: string[];
  layouts: Record<string, number>;
  scripts: number;
}

export interface AdobeFormContent {
  form: string;
  interface: string;
  formType: string;
  formTech: string;
  layoutType: string;
  summary: AdobeFormSummary;
  /** SAP's own form check (SFP "Check"), only with includeCheck. */
  check?: { messages: AdobeCheckMessage[] };
  files: {
    form: string;
    layout: string;
    interface?: string;
    formXml: string;
    check?: string;
  };
  message?: string;
}

export interface AdobeCheckMessage {
  msgty: string;
  msgid: string;
  msgno: string;
  text: string;
  type: string;
  navcursor: string;
}

/** Check a form / interface name before it goes to SAP or into a path. */
export function normalizeFormName(name: unknown): string {
  const n = String(name ?? '')
    .trim()
    .toUpperCase();
  if (!NAME_RE.test(n))
    throw new Error(
      `form_name: an SFP form name (letters, digits, _ /, ≤ 30): ${String(name ?? '').slice(0, 40)}`,
    );
  return n;
}

/** Map dispatcher errors: missing helper → install hint, subrc 4 → not found. */
export function translateFpError(error: unknown, action: string): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    new RegExp(`Unknown action:\\s*${action}`, 'i').test(msg) ||
    /ZMCP_FP_CONTENT[\s\S]*(not found|does not exist|not exist)|(CALL_FUNCTION_NOT_FOUND|FU_NOT_FOUND)[\s\S]*ZMCP_FP_CONTENT/i.test(
      msg,
    )
  )
    return new Error(`${FP_INSTALL_HINT} (SAP said: ${msg})`);
  if (/subrc=4\b/.test(msg)) return new Error(`Not found: ${msg}`);
  return new Error(msg);
}

/** Counts from the XDP template, enough to tell what kind of layout it is. */
export function summarizeXdp(xdp: string): AdobeFormSummary {
  const count = (re: RegExp) => (xdp.match(re) || []).length;
  const layouts: Record<string, number> = {};
  for (const m of xdp.matchAll(/<subform\b[^>]*\blayout="([^"]+)"/g))
    layouts[m[1]] = (layouts[m[1]] || 0) + 1;
  const binds = [
    ...new Set(
      [...xdp.matchAll(/<bind\b[^>]*\bref="([^"]+)"/g)].map((m) => m[1]),
    ),
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

function dirOf(form: string): string {
  return `adobe/${form.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
}

function writeOut(dir: string, name: string, data: Buffer | string): string {
  const abs = safeOutputPath(`${dir}/${name}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return abs;
}

async function fpCall(
  connection: IAbapConnection,
  action: 'FP_CONTENT' | 'FP_RENDER' | 'FP_MIGRATE',
  params: Record<string, string>,
): Promise<{ result: any; message?: string }> {
  try {
    const r = (await callDispatch(connection, action, params)) as any;
    return { result: r?.result ?? {}, message: r?.message || undefined };
  } catch (error) {
    throw translateFpError(error, action);
  }
}

/** Form header, the full form XML, the layout (XDP) and the interface XML, written as files. */
export async function getAdobeFormContent(
  connection: IAbapConnection,
  formName: string,
  options: {
    language?: string;
    includeInterface?: boolean;
    includeCheck?: boolean;
  } = {},
): Promise<AdobeFormContent> {
  const form = normalizeFormName(formName);
  const language = options.language ?? '';
  const head = await fpCall(connection, 'FP_CONTENT', {
    part: 'FORM',
    name: form,
    language,
  });
  if (!head.result?.xml)
    throw new Error(
      `FP_CONTENT FORM returned no XML for ${form}: ${String(head.message ?? '').slice(0, 200)}`,
    );
  const lay = await fpCall(connection, 'FP_CONTENT', {
    part: 'LAYOUT',
    name: form,
    language,
  });
  const xdp = Buffer.from(String(lay.result?.xdp ?? ''), 'base64').toString(
    'utf8',
  );
  const dir = dirOf(form);
  const base = form.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const files: AdobeFormContent['files'] = {
    form: '',
    formXml: writeOut(
      dir,
      `${base}.form.xml`,
      Buffer.from(String(head.result.xml), 'base64'),
    ),
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
      files.interface = writeOut(
        dir,
        `${ifName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.interface.xml`,
        Buffer.from(String(itf.result.xml), 'base64'),
      );
  }
  let check: AdobeFormContent['check'];
  if (options.includeCheck) {
    // read-only on SAP: CL_FP_WB_FORM=>CHECK in display mode, nothing saved
    const chk = await fpCall(connection, 'FP_CONTENT', {
      part: 'CHECK',
      name: form,
      language,
    });
    const messages: AdobeCheckMessage[] = (
      Array.isArray(chk.result?.messages) ? chk.result.messages : []
    ).map((m: Record<string, unknown>) => ({
      msgty: String(m?.msgty ?? ''),
      msgid: String(m?.msgid ?? ''),
      msgno: String(m?.msgno ?? ''),
      text: String(m?.text ?? ''),
      type: String(m?.type ?? ''),
      navcursor: String(m?.navcursor ?? ''),
    }));
    check = { messages };
    files.check = writeOut(
      dir,
      `${base}.check.json`,
      JSON.stringify({ form, messages }, null, 2),
    );
  }
  const out: AdobeFormContent = {
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
  files.form = writeOut(
    dir,
    `${base}.form.json`,
    JSON.stringify({ ...out, files: { ...files, form: undefined } }, null, 2),
  );
  return out;
}

export interface AdobeRenderResult {
  form: string;
  fm: string;
  pages: number;
  message?: string;
  /** set when get_xml was asked but SAP returned no data XML (too large, none) */
  xmlError?: string;
  files: { pdf: string; dataXml?: string };
}

/** The PDF of an active form from ADS for invented interface values (internal formats). */
export async function renderAdobeForm(
  connection: IAbapConnection,
  formName: string,
  values: Record<string, unknown>,
  language?: string,
  getXml = false,
): Promise<AdobeRenderResult> {
  const form = normalizeFormName(formName);
  const params = Object.entries(values ?? {})
    .filter(([name]) => !name.startsWith('$'))
    .map(([name, v]) => ({
      name: name.toUpperCase(),
      json: JSON.stringify(upperKeys(v)),
    }));
  // "$GETXML" is not an interface parameter: it asks the helper for the data XML ADS got
  if (getXml) params.push({ name: '$GETXML', json: 'true' });
  const paramStr = JSON.stringify(params);
  if (paramStr.length > 200000)
    throw new Error('values: more than 200 000 characters once serialized');
  const r = await fpCall(connection, 'FP_RENDER', {
    name: form,
    params: paramStr,
    language: language ?? '',
  });
  if (!r.result?.pdf)
    throw new Error(
      `FP_RENDER returned no PDF: ${String(r.message ?? JSON.stringify(r.result)).slice(0, 300)}`,
    );
  const pdf = Buffer.from(String(r.result.pdf), 'base64');
  if (pdf.subarray(0, 4).toString('latin1') !== '%PDF')
    throw new Error('FP_RENDER returned data that is not a PDF');
  const base = form.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const files: AdobeRenderResult['files'] = {
    pdf: writeOut(dirOf(form), `${base}.sap.pdf`, pdf),
  };
  let xmlError: string | undefined;
  if (getXml) {
    if (r.result.xml)
      files.dataXml = writeOut(
        dirOf(form),
        `${base}.sap.data.xml`,
        Buffer.from(String(r.result.xml), 'base64'),
      );
    else
      xmlError = String(
        r.result.xmlError ?? 'no data XML returned (helper without GETXML?)',
      );
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
export const XDP_LABEL_RE =
  /^(ZF_CINE_TICKET|ZFORM_FDP_SCRATCH|ZSC4SAP_[A-Z0-9_]+)$/;
const LOCALE_RE = /^[a-z]{2}_[A-Z]{2}$/;

export interface AdobeXdpRenderResult {
  form: string;
  pages: number;
  /** design-time packets taken out before the call (e.g. connectionSet) */
  removed?: string[];
  files: { pdf: string; trace?: string };
}

/** References that would make ADS fetch something from outside — refused (the FM checks the same again). */
export const XDP_EXTERNAL_RE =
  /<(\w+:)?(wsdlAddress|soapAddress|submit|effectiveOutputPolicy)\b|<(\w+:)?uri\s*>\s*[^<\s]|\b(href|src)\s*=\s*["'](?!#|data:)|usehref\s*=\s*["'](?!#)|url\s*\(|\.(gotoURL|importData|launchURL|exportData)\b|\b(Get|Post|Put)\s*\(/i;
const CONNECTION_SET_RE =
  /<(\w+:)?connectionSet\b[\s\S]*?<\/(\w+:)?connectionSet\s*>/gi;

/**
 * Check an XDP before it goes to ADS: the designer's data-connection packet (<connectionSet>, a design-time link
 * to a sample data / schema file, never used when the data comes with the call) is taken out; anything that could
 * still make ADS fetch a resource is refused. Returns the template to send and what was removed.
 */
export function prepareXdp(xdp: Buffer): { xdp: Buffer; removed: string[] } {
  let s = xdp.toString('utf8');
  const removed: string[] = [];
  if (CONNECTION_SET_RE.test(s)) {
    s = s.replace(CONNECTION_SET_RE, '');
    removed.push('connectionSet');
  }
  if (/<(\w+:)?connectionSet\b/i.test(s))
    throw new Error('xdp_file: refused — unterminated <connectionSet> packet');
  const m = s.match(XDP_EXTERNAL_RE);
  if (m)
    throw new Error(
      `xdp_file: refused — external or data-connection reference (${m[0].slice(0, 40)}); ADS must not fetch anything`,
    );
  return { xdp: Buffer.from(s, 'utf8'), removed };
}

/**
 * An XDP template rendered with XML data straight in ADS (CL_FP_ADS_UTIL=>RENDER_PDF via ZMCP_FP_CONTENT part
 * RENDER_XDP): no SAP form object, no form code, no print, no spool. `xdp` / `xml` are the file contents.
 */
export async function renderAdobeXdp(
  connection: IAbapConnection,
  label: string,
  xdp: Buffer,
  xml: Buffer,
  locale = 'en_US',
  embedFonts = false,
): Promise<AdobeXdpRenderResult> {
  const form = String(label ?? '')
    .trim()
    .toUpperCase();
  if (!XDP_LABEL_RE.test(form) || form.length > 30)
    throw new Error(
      `form_name: ZF_CINE_TICKET, ZFORM_FDP_SCRATCH or ZSC4SAP_* (≤ 30): ${String(label ?? '').slice(0, 40)}`,
    );
  if (!LOCALE_RE.test(locale))
    throw new Error(
      `locale: language_COUNTRY, e.g. en_US: ${String(locale).slice(0, 12)}`,
    );
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
    throw new Error(
      'xdp + xml: more than 3 000 000 characters once base64-encoded',
    );
  const r = await fpCall(connection, 'FP_CONTENT', {
    part: 'RENDER_XDP',
    name: form,
    params,
  });
  if (r.result?.error) {
    // ADS error: the FM returns the ADS trace with it (subrc 0, no pdf) — keep it as a file.
    const tracePath = r.result.trace
      ? writeOut(
          dirOf(form),
          `${form.toLowerCase()}.xdp.ads-trace.txt`,
          String(r.result.trace),
        )
      : '';
    throw new Error(
      `RENDER_XDP: ADS error: ${String(r.result.error).slice(0, 300)}${tracePath ? ` (ADS trace: ${tracePath})` : ''}`,
    );
  }
  if (!r.result?.pdf)
    throw new Error(
      `RENDER_XDP returned no PDF: ${String(r.message ?? JSON.stringify(r.result)).slice(0, 300)}`,
    );
  const pdf = Buffer.from(String(r.result.pdf), 'base64');
  if (pdf.subarray(0, 4).toString('latin1') !== '%PDF')
    throw new Error('RENDER_XDP returned data that is not a PDF');
  const base = form.toLowerCase();
  const files: AdobeXdpRenderResult['files'] = {
    pdf: writeOut(dirOf(form), `${base}.xdp.sap.pdf`, pdf),
  };
  if (r.result.trace)
    files.trace = writeOut(
      dirOf(form),
      `${base}.xdp.ads-trace.txt`,
      String(r.result.trace),
    );
  return {
    form,
    pages: Number(r.result.pages ?? 0),
    ...(prepared.removed.length ? { removed: prepared.removed } : {}),
    files,
  };
}

/** /UI2/CL_JSON matches ABAP component names; send them upper case. */
function upperKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(upperKeys);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k.toUpperCase(), upperKeys(x)]),
    );
  return v;
}

// ── SmartForm → Adobe form (DEV write) ────────────────────────────────────────────

export const FP_MIGRATE_INSTALL_HINT =
  'The SAP side of CreateAdobeFormFromSmartForm is not installed on this system: it needs FM ZMCP_FP_MIGRATE ' +
  '(function group ZMCP_FP) and the FP_MIGRATE branch in ZMCP_ADT_DISPATCH. ' +
  'Sources and install steps: sc4sap/abap/README.md (zmcp_fp_migrate.abap, zmcp_adt_dispatch_fp_migrate_branch.abap).';

// a SAP name: no Z / Y first letter, no namespace
const SOURCE_RE = /^[A-X0-9_][A-Z0-9_]{0,29}$/;
const TARGET_RE = /^ZSC4SAP_AFM_[A-Z0-9_]+$/;

export interface AdobeMigrationResult {
  source: string;
  form: string;
  interface: string;
  options: Record<string, string>;
  raised: boolean;
  error?: string;
  saved: string[];
  left: string[];
  active: string[];
  activation?: string;
  /** sibling context nodes renamed after SAP's migration (gap G1: 4.6C table cells vs work-area fields) */
  renamed: { path: string; from: string; to: string; type: number }[];
  /** node attributes set after SAP's migration (gaps G2 include-text language, G3 sender country) */
  adjusted: { path: string; attribute: string; from: string; to: string }[];
  log: { type: string; text: string }[];
  /** the layout's new ADS cache info (gap G4: never the placeholder 0$0$0$0$…) */
  cacheInfo?: string;
  /** layout correction report: counts, partial flag, font warnings, one result per op */
  correction?: {
    strict: boolean;
    ops: number;
    applied: number;
    notFound: number;
    ambiguous: number;
    refused: number;
    partial: boolean;
    warnings: string[];
    results: {
      i: number;
      op: string;
      rule: string;
      status: string;
      detail: string;
    }[];
  };
  /** true only when nothing raised and both the form and the interface are active. */
  complete: boolean;
  /** SAP's message, e.g. "saved but NOT fully active ...". */
  message?: string;
  files: { result: string };
}

/** Check the names before anything reaches SAP (the FM checks them again). */
export function checkMigrationNames(
  source: unknown,
  form: unknown,
  iface: unknown,
) {
  const up = (v: unknown) =>
    String(v ?? '')
      .trim()
      .toUpperCase();
  const src = up(source),
    f = up(form),
    i = up(iface);
  if (!SOURCE_RE.test(src))
    throw new Error(
      'source: a SAP SmartForm name (letters, digits, _; no Z / Y / namespace)',
    );
  for (const [k, v] of [
    ['form_name', f],
    ['interface_name', i],
  ] as const)
    if (v.length > 30 || !TARGET_RE.test(v))
      throw new Error(
        `${k}: must match ZSC4SAP_AFM_[A-Z0-9_]+ (≤ 30 characters)`,
      );
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
  // G5 (a): a subform / field binds another $record path (or none)
  'bind',
  // G5 (a) model ops — on the interface / context, no layout target
  'contextDeactivate',
  'initSumByKey',
]);
/** Ops that work on the interface / context (ZMCP_FP_MIGRATE FORM fpc_model), not on the XDP. */
const MODEL_OPS = new Set(['contextDeactivate', 'initSumByKey']);
/** date{…} pictures datePicture may write: D / M / Y and . / - or space only. */
const DATE_PICTURE_RE = /^date\{[DMY][DMY./ -]{0,19}\}$/;
/** bind refs: $record and names, [0] or [*] only — no $data, $form, .., #, other indexes or blanks. */
const BIND_REF_RE =
  /^\$record(\.[A-Za-z_][A-Za-z0-9_]{0,29}(\[(0|\*)\])?){1,12}$/;
/** ABAP names initSumByKey takes (the FM checks them against the interface). */
const ABAP_NAME_RE = /^[A-Z][A-Z0-9_]{0,29}$/;
/** contextDeactivate: node names from the context root, "/"-separated. */
const NODE_PATH_RE = /^[A-Z0-9_]{1,30}(\/[A-Z0-9_]{1,30}){1,20}$/;
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
  'match',
  'ref',
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
 * G5 (a) model ops → the FM's flat shape. contextDeactivate {node, basis}: a program-lines node by its path of
 * node names from the context root. initSumByKey {source, target, key[1–5], sum[1–5], basis}: ABAP names only
 * (upper-cased), all different. The FM checks them again against the interface and context.
 */
function modelOp(
  o: Record<string, unknown>,
  i: number,
  op: string,
  scalar: (v: unknown, where: string) => string,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = { op };
  if (o.rule != null) out.rule = scalar(o.rule, `op ${i} rule`);
  const basis = o.basis != null ? scalar(o.basis, `op ${i} basis`) : '';
  if (!basis.trim() || basis.length > 200)
    throw new Error(
      `correction: op ${i} ${op} needs a basis (the SmartForm node or rule, ≤ 200 characters)`,
    );
  out.basis = basis;
  const name = (v: unknown, where: string) => {
    const n = scalar(v ?? '', `op ${i} ${where}`)
      .trim()
      .toUpperCase();
    if (!ABAP_NAME_RE.test(n))
      throw new Error(
        `correction: op ${i} ${op} ${where} must be an ABAP name ([A-Z][A-Z0-9_], ≤ 30)`,
      );
    return n;
  };
  if (op === 'contextDeactivate') {
    const node = scalar(o.node ?? '', `op ${i} node`)
      .trim()
      .toUpperCase();
    if (!NODE_PATH_RE.test(node))
      throw new Error(
        `correction: op ${i} contextDeactivate node must be a path of node names from the context root (e.g. CONTEXT/MAIN/X)`,
      );
    out.node = node;
    return out;
  }
  const list = (v: unknown, where: string) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 5)
      throw new Error(
        `correction: op ${i} initSumByKey ${where}: 1 to 5 names`,
      );
    return v.map((x, k) => name(x, `${where}[${k}]`));
  };
  const source = name(o.source, 'source');
  const target = name(o.target, 'target');
  const key = list(o.key, 'key');
  const sum = list(o.sum, 'sum');
  const all = [source, target, ...key, ...sum];
  if (new Set(all).size !== all.length)
    throw new Error(
      `correction: op ${i} initSumByKey source, target, key and sum names must all differ`,
    );
  Object.assign(out, { source, target, key, sum });
  return out;
}

/**
 * Layout correction spec v1 ({version:1, strict?, ops:[{op, target:{path | protoId [+ path] | xliffId}, …}]}) →
 * the flat JSON ZMCP_FP_MIGRATE takes (lower-case keys, CSS as "name:value;…"). Unknown op keys are ignored;
 * unknown ops, a missing target, non-scalar values or CSS names outside the allow-list are refused here. The FM
 * checks every value again (allow-lists, measurements) and reports each op as applied / not_found / ambiguous /
 * refused.
 */
export function normalizeCorrection(
  spec: unknown,
  strict?: boolean,
): { json: string; ops: number; strict: boolean } {
  const s = spec as any;
  if (!s || typeof s !== 'object' || s.version !== 1 || !Array.isArray(s.ops))
    throw new Error('correction: expected {"version":1,"ops":[...]}');
  if (!s.ops.length || s.ops.length > MAX_CORRECTION_OPS)
    throw new Error(
      `correction: 1 to ${MAX_CORRECTION_OPS} ops (${s.ops.length})`,
    );
  const scalar = (v: unknown, where: string) => {
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'string' && v.length <= 1000) return v;
    throw new Error(`correction: ${where} must be a string or number`);
  };
  const ops = s.ops.map((o: any, i: number) => {
    if (!o || typeof o !== 'object')
      throw new Error(`correction: op ${i} is not an object`);
    const op = String(o.op ?? '');
    if (!CORRECTION_OPS.has(op))
      throw new Error(`correction: op ${i} "${op.slice(0, 20)}" unknown`);
    if (MODEL_OPS.has(op)) return modelOp(o, i, op, scalar);
    const t = o.target ?? {};
    const out: Record<string, string> = { op };
    if (t.path != null) out.path = scalar(t.path, `op ${i} target.path`);
    if (t.protoId != null)
      out.protoid = scalar(t.protoId, `op ${i} target.protoId`);
    if (t.xliffId != null)
      out.xliffid = scalar(t.xliffId, `op ${i} target.xliffId`);
    if (!out.path && !out.protoid && !out.xliffid)
      throw new Error(`correction: op ${i} has no target`);
    for (const f of CORRECTION_FIELDS)
      if (o[f] != null) out[f.toLowerCase()] = scalar(o[f], `op ${i} ${f}`);
    if (op === 'datePicture' && !DATE_PICTURE_RE.test(out.picture ?? ''))
      throw new Error(
        `correction: op ${i} datePicture needs picture date{…} with D / M / Y and . / - or space only`,
      );
    if (op === 'bind') {
      const match = (out.match ?? '').toLowerCase();
      if (match !== 'dataref' && match !== 'none')
        throw new Error(`correction: op ${i} bind needs match dataRef or none`);
      if (match === 'dataref' && !BIND_REF_RE.test(out.ref ?? ''))
        throw new Error(
          `correction: op ${i} bind ref must be a $record path (names, [0] or [*] only)`,
        );
      if (match === 'none') delete out.ref;
      if (!(out.basis ?? '').trim())
        throw new Error(
          `correction: op ${i} bind needs a basis (the SmartForm node or rule)`,
        );
    }
    if (o.css != null) {
      if (typeof o.css !== 'object' || Array.isArray(o.css))
        throw new Error(`correction: op ${i} css must be an object`);
      out.css = Object.entries(o.css)
        .map(([k, v]) => {
          const name = k.toLowerCase();
          if (!CSS_NAMES.has(name))
            throw new Error(
              `correction: op ${i} CSS "${k.slice(0, 30)}" not allowed`,
            );
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
    throw new Error(
      `correction: more than ${MAX_CORRECTION_CHARS} characters once flattened`,
    );
  return { json, ops: ops.length, strict: isStrict };
}

/** SAP's SmartForm migration into new $TMP objects (ZMCP_FP_MIGRATE); the result and log go to a file too. */
export async function createAdobeFormFromSmartForm(
  connection: IAbapConnection,
  source: string,
  formName: string,
  interfaceName: string,
  senderCountry?: string,
  correction?: { json: string },
): Promise<AdobeMigrationResult> {
  const n = checkMigrationNames(source, formName, interfaceName);
  const country = String(senderCountry ?? '')
    .trim()
    .toUpperCase();
  if (country && !/^[A-Z0-9]{1,3}$/.test(country))
    throw new Error(
      `sender_country: a country key (T005, e.g. "DE"): ${String(senderCountry).slice(0, 10)}`,
    );
  let r: { result: any; message?: string };
  try {
    r = await fpCall(connection, 'FP_MIGRATE', {
      source: n.source,
      form: n.form,
      interface: n.iface,
      preset: 'FULL',
      ...(country ? { sender_country: country } : {}),
      ...(correction ? { correction: correction.json } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      /Unknown action:\s*FP_MIGRATE|ZMCP_FP_MIGRATE[\s\S]*(not found|does not exist)/i.test(
        msg,
      )
    )
      throw new Error(`${FP_MIGRATE_INSTALL_HINT} (SAP said: ${msg})`);
    throw e;
  }
  const res = r.result ?? {};
  const out: AdobeMigrationResult = {
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
  out.files.result = writeOut(
    dirOf(n.form),
    `${n.form.toLowerCase()}.migrate.json`,
    JSON.stringify({ ...out, files: undefined }, null, 2),
  );
  return out;
}
