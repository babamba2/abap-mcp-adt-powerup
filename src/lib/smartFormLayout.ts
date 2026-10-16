/**
 * SmartForm layout — pages and window positions of one SmartForm.
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_LAYOUT → FM ZMCP_SSF_LAYOUT
 * (sc4sap/abap/zmcp_ssf_layout.abap). The FM reads the Form Builder object
 * model in display mode and returns every coordinate raw with its own unit.
 * This module converts the coordinates to millimetres and names the window
 * types. Runs over every RFC backend that serves callDispatch (OData on
 * BASIS 7.40, SOAP RFC on BASIS 7.31).
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { callDispatch, getBackend } from './rfcBackend';

export const DEFAULT_LPI = 6;
export const DEFAULT_CPI = 10;

export const SSF_LAYOUT_INSTALL_HINT =
  'The SAP side of GetSmartFormLayout is not installed on this system: it needs FM ZMCP_SSF_LAYOUT ' +
  '(function group ZMCP_ADT_UTILS) and the SSF_LAYOUT branch in ZMCP_ADT_DISPATCH. ' +
  'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_layout.abap, zmcp_adt_dispatch_ssf_layout_branch.abap).';

/** Window type codes of domain TDSFWTYPE. */
const WINDOW_TYPES: Record<string, string> = {
  M: 'MAIN',
  T: 'SECONDARY',
  C: 'COPIES',
  L: 'FINAL',
  G: 'GRAPHIC',
  A: 'ADDRESS',
};

export function windowTypeName(code: string): string {
  const c = (code ?? '').trim().toUpperCase();
  return WINDOW_TYPES[c] ?? c;
}

function positiveOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert a SmartForm length to millimetres. LN (lines) uses LPI, CH
 * (characters) uses CPI of the page variant. Unknown unit or value → null.
 */
export function toMm(
  value: unknown,
  unit: unknown,
  lpi: number = DEFAULT_LPI,
  cpi: number = DEFAULT_CPI,
): number | null {
  if (value === null || value === undefined || String(value).trim() === '')
    return null;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  const u = String(unit ?? '')
    .trim()
    .toUpperCase();
  let mm: number;
  switch (u) {
    case 'CM':
      mm = v * 10;
      break;
    case 'MM':
      mm = v;
      break;
    case 'IN':
      mm = v * 25.4;
      break;
    case 'PT':
      mm = (v * 25.4) / 72;
      break;
    case 'TW':
      mm = (v * 25.4) / 1440;
      break;
    case 'LN':
      mm = (v * 25.4) / positiveOr(lpi, DEFAULT_LPI);
      break;
    case 'CH':
      mm = (v * 25.4) / positiveOr(cpi, DEFAULT_CPI);
      break;
    default:
      return null;
  }
  return round2(mm);
}

export interface LengthValue {
  value: number | null;
  unit: string;
}

export interface SmartFormWindow {
  name: string;
  caption: string;
  type: string;
  typeCode: string;
  level: number | null;
  left?: LengthValue;
  top?: LengthValue;
  width?: LengthValue;
  height?: LengthValue;
  leftMm?: number | null;
  topMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  frame?: LengthValue;
  shading?: number;
  alwaysDrawBox?: boolean;
}

export interface SmartFormPage {
  variant: string;
  name: string;
  caption: string;
  format: string;
  orientation: string;
  nextPage: string;
  printMode: string;
  cpi: number;
  lpi: number;
  stdStyle: string;
  windows: SmartFormWindow[];
}

export interface SmartFormLayout {
  form: string;
  language: string;
  masterLanguage: string;
  /** false = never activated, read from the saved version; null = not reported. */
  active: boolean | null;
  pages: SmartFormPage[];
  path: string;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function orientationName(raw: unknown): string {
  const o = str(raw).toUpperCase();
  if (o === '' || o === 'P') return 'portrait';
  if (o === 'L') return 'landscape';
  return o;
}

function mapWindow(w: any, lpi: number, cpi: number): SmartFormWindow {
  const typeCode = str(w?.wtype).toUpperCase();
  const out: SmartFormWindow = {
    name: str(w?.name),
    caption: str(w?.caption),
    type: windowTypeName(typeCode),
    typeCode,
    level: num(w?.wlevel),
  };
  // A window node without output attributes carries no coordinates.
  const hasCoords = ['wleft', 'wtop', 'wwidth', 'wheight'].some(
    (k) => w?.[k] !== undefined && w?.[k] !== null,
  );
  if (hasCoords) {
    const pairs: Array<[keyof SmartFormWindow, keyof SmartFormWindow, string]> =
      [
        ['left', 'leftMm', 'wleft'],
        ['top', 'topMm', 'wtop'],
        ['width', 'widthMm', 'wwidth'],
        ['height', 'heightMm', 'wheight'],
      ];
    for (const [key, mmKey, src] of pairs) {
      const unit = str(w?.[`u_${src}`]).toUpperCase();
      (out as any)[key] = { value: num(w?.[src]), unit };
      (out as any)[mmKey] = toMm(w?.[src], unit, lpi, cpi);
    }
  }
  const frame = num(w?.wframe);
  if (frame !== null && frame > 0) {
    out.frame = { value: frame, unit: str(w?.u_wframe).toUpperCase() };
  }
  const shading = num(w?.wshading);
  if (shading !== null && shading > 0) out.shading = shading;
  if (str(w?.wempty) !== '') out.alwaysDrawBox = true;
  return out;
}

/** Map the raw ZMCP_SSF_LAYOUT JSON to the tool output (pages flattened). */
export function mapSmartFormLayout(raw: any, path: string): SmartFormLayout {
  const pages: SmartFormPage[] = [];
  const variants: any[] = Array.isArray(raw?.variants) ? raw.variants : [];
  for (const v of variants) {
    const lpi = positiveOr(v?.lpi, DEFAULT_LPI);
    const cpi = positiveOr(v?.cpi, DEFAULT_CPI);
    const rawPages: any[] = Array.isArray(v?.pages) ? v.pages : [];
    for (const p of rawPages) {
      const rawWindows: any[] = Array.isArray(p?.windows) ? p.windows : [];
      pages.push({
        variant: str(v?.variant),
        name: str(p?.name),
        caption: str(p?.caption),
        format: str(v?.pageFormat),
        orientation: orientationName(p?.orientation),
        nextPage: str(p?.nextPage),
        printMode: str(p?.printMode),
        cpi,
        lpi,
        stdStyle: str(v?.stdStyle),
        windows: rawWindows.map((w) => mapWindow(w, lpi, cpi)),
      });
    }
  }
  return {
    form: str(raw?.form),
    language: str(raw?.language),
    masterLanguage: str(raw?.masterLanguage),
    active: typeof raw?.active === 'boolean' ? raw.active : null,
    pages,
    path,
  };
}

/**
 * Normalise the `language` argument: a 1-char SAP language key is passed
 * as-is (keys are case-sensitive), a 2-letter ISO code is upper-cased and
 * converted on the SAP side (CONVERSION_EXIT_ISOLA_INPUT). Empty → ''
 * (master language of the form). Anything else throws.
 */
export function normalizeSmartFormLanguage(language: unknown): string {
  const raw = String(language ?? '').trim();
  if (raw === '') return '';
  if (raw.length === 1) return raw;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  throw new Error(
    `language must be a 1-character SAP language key (e.g. "E") or a 2-letter ISO code (e.g. "EN"); got "${raw}"`,
  );
}

/**
 * Turn a dispatcher failure into an actionable message. callDispatch throws
 * `ZMCP_ADT_DISPATCH error (action=…, subrc=N): <message>` on subrc ≠ 0.
 * The install hint is given only when the error clearly means "not
 * installed": the dispatcher does not know the action, the dispatcher FM
 * itself is missing, or ZMCP_SSF_LAYOUT is not found.
 */
export function translateSmartFormLayoutError(
  error: unknown,
  formName: string,
): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    /Unknown action:\s*SSF_LAYOUT/i.test(msg) ||
    /SOAP Fault:[\s\S]*(FU_NOT_FOUND|ZMCP_ADT_DISPATCH)/i.test(msg) ||
    /ZMCP_SSF_LAYOUT[\s\S]*(not found|does not exist|not exist)|(CALL_FUNCTION_NOT_FOUND|FU_NOT_FOUND)[\s\S]*ZMCP_SSF_LAYOUT/i.test(
      msg,
    )
  ) {
    return `${SSF_LAYOUT_INSTALL_HINT} (SAP said: ${msg})`;
  }
  if (/SOAP Fault/i.test(msg)) {
    return `SOAP Fault from SSF_LAYOUT: ${msg}. If ZMCP_SSF_LAYOUT / the SSF_LAYOUT branch is not installed, see sc4sap/abap/README.md.`;
  }
  const m = msg.match(/subrc=(\d+)\):\s*([\s\S]*)$/);
  if (m) {
    // subrc 4 = not found; the FM sends SAP message SMARTFORMS 200 (as in
    // transaction SMARTFORMS), with " (language X)" when only LOAD failed.
    if (m[1] === '4') return m[2].trim() || `SmartForm ${formName} not found`;
    return m[2].trim() || msg;
  }
  return msg;
}

export async function getSmartFormLayout(
  connection: IAbapConnection,
  formName: string,
  language?: string,
): Promise<SmartFormLayout> {
  const form = String(formName ?? '')
    .trim()
    .toUpperCase();
  const lang = normalizeSmartFormLanguage(language);
  let result: any;
  try {
    ({ result } = await callDispatch(connection, 'SSF_LAYOUT', {
      form_name: form,
      language: lang,
    }));
  } catch (error) {
    throw new Error(translateSmartFormLayoutError(error, form));
  }
  if (result === null || typeof result !== 'object') {
    throw new Error(
      `SSF_LAYOUT returned no JSON object for ${form}: ${String(result).substring(0, 200)}`,
    );
  }
  return mapSmartFormLayout(result, `dispatch-${getBackend()}`);
}
