/**
 * Business-action transport — calls ZMCP_BIZ_EXECUTE (function group ZMCP_BIZ).
 *
 * Path per SAP_RFC_BACKEND:
 *   soap   — direct SOAP RFC call of ZMCP_BIZ_EXECUTE (no dispatcher needed)
 *   odata  — ZMCP_ADT_DISPATCH action BIZ_EXECUTE, which
 *            forwards to ZMCP_BIZ_EXECUTE and wraps its exports as JSON
 *            {subrc, message, token, result}. Needs the dispatcher release
 *            that contains the BIZ_EXECUTE branch.
 *
 * EV_SUBRC of ZMCP_BIZ_EXECUTE: 0 ok, 4 refused / failed, 8 blocked.
 * A non-zero subrc is returned to the caller (it is the business answer),
 * never thrown. Only transport failures throw.
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { callDispatch, getBackend } from './rfcBackend';
import * as soap from './soapRfc';

export type BizMode = 'LIST' | 'QUERY' | 'PRECHECK' | 'PREVIEW' | 'EXECUTE';

export interface BizRequest {
  action?: string;
  mode: BizMode;
  params?: Record<string, unknown>;
  token?: string;
  idemKey?: string;
}

export interface BizResult {
  subrc: number;
  message: string;
  token: string;
  result: unknown;
}

const BIZ_FM = 'ZMCP_BIZ_EXECUTE';

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const s = value.trim();
  if (s === '') return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function fromExports(raw: Record<string, any>): BizResult {
  const pick = (k: string) => raw[k] ?? raw[k.toLowerCase()];
  return {
    subrc: Number(pick('EV_SUBRC') ?? 0),
    message: String(pick('EV_MESSAGE') ?? ''),
    token: String(pick('EV_TOKEN') ?? ''),
    result: parseMaybeJson(pick('EV_RESULT')),
  };
}

/** Builds the IV_* import parameters (all strings). */
export function buildImports(req: BizRequest): Record<string, string> {
  return {
    IV_ACTION: (req.action ?? '').trim().toUpperCase(),
    IV_MODE: req.mode,
    IV_PARAMS: JSON.stringify(req.params ?? {}),
    IV_TOKEN: req.token ?? '',
    IV_IDEM_KEY: req.idemKey ?? '',
  };
}

/** Parses the dispatcher BIZ_EXECUTE result object. */
export function fromDispatch(result: any): BizResult {
  const r = typeof result === 'string' ? parseMaybeJson(result) : result;
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, any>;
  return {
    subrc: Number(o.subrc ?? 0),
    message: String(o.message ?? ''),
    token: String(o.token ?? ''),
    result: parseMaybeJson(o.result),
  };
}

export async function callBizExecute(
  connection: IAbapConnection,
  req: BizRequest,
): Promise<BizResult> {
  const imports = buildImports(req);
  const backend = getBackend();
  if (backend === 'soap') {
    const { raw } = await soap.callSoapRfc(connection, BIZ_FM, imports);
    return fromExports(raw);
  }
  const { result } = await callDispatch(connection, 'BIZ_EXECUTE', {
    action: imports.IV_ACTION,
    mode: imports.IV_MODE,
    params: imports.IV_PARAMS,
    token: imports.IV_TOKEN,
    idem_key: imports.IV_IDEM_KEY,
  });
  return fromDispatch(result);
}
