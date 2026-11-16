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
  files: { form: string; layout: string; interface?: string; formXml: string };
  message?: string;
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
  action: 'FP_CONTENT' | 'FP_RENDER',
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
  options: { language?: string; includeInterface?: boolean } = {},
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
  const out: AdobeFormContent = {
    form,
    interface: ifName,
    formType: String(head.result.formType ?? ''),
    formTech: String(head.result.formTech ?? ''),
    layoutType: String(head.result.layoutType ?? ''),
    summary: summarizeXdp(xdp),
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
  files: { pdf: string };
}

/** The PDF of an active form from ADS for invented interface values (internal formats). */
export async function renderAdobeForm(
  connection: IAbapConnection,
  formName: string,
  values: Record<string, unknown>,
  language?: string,
): Promise<AdobeRenderResult> {
  const form = normalizeFormName(formName);
  const params = Object.entries(values ?? {}).map(([name, v]) => ({
    name: name.toUpperCase(),
    json: JSON.stringify(upperKeys(v)),
  }));
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
  return {
    form,
    fm: String(r.result.fm ?? ''),
    pages: Number(r.result.pages ?? 0),
    ...(r.message ? { message: r.message } : {}),
    files: { pdf: writeOut(dirOf(form), `${base}.sap.pdf`, pdf) },
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
