/**
 * Gateway RFC backend — calls a remote HTTPS middleware that owns the
 * NW RFC SDK + node-rfc stack on behalf of many MCP clients.
 *
 * Architecture:
 *   MCP client ──HTTPS/JSON──▶ RFC Gateway (Node + node-rfc) ──RFC──▶ SAP
 *
 * This backend keeps developer laptops free of the NW RFC SDK / MSVC
 * build tools / S-user downloads. All of that lives on the gateway.
 *
 * Contract-compatible with soapRfc.ts and nativeRfc.ts — same
 * DispatchResult / TextpoolResult shapes. Handlers only import from
 * ./rfcBackend, never directly from here.
 *
 * Environment variables (populated from .sc4sap/sap.env):
 *   SAP_RFC_GATEWAY_URL       — e.g. https://rfc-gw.company.com:8443  (required)
 *   SAP_RFC_GATEWAY_TOKEN     — Bearer token for gateway ACL          (optional but recommended)
 *   SAP_RFC_GATEWAY_TLS_VERIFY — "0" to allow self-signed certs        (optional, default "1")
 *
 * SAP credentials are forwarded per-request via X-SAP-* headers using
 * the same SAP_USERNAME / SAP_PASSWORD / SAP_CLIENT values the ADT
 * HTTPS backend already consumes. Each developer therefore stays
 * identified on the SAP side (audit trail preserved).
 *
 * Gateway contract:
 *   POST /rfc/dispatch   body { action, params }           → { result, subrc, message }
 *   POST /rfc/textpool   body { action, program, language,
 *                                textpool_json }           → { result, subrc, message }
 *   GET  /health                                           → { status: "ok", ... }
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import type { DispatchResult, TextpoolResult } from './soapRfc';

const DEFAULT_TIMEOUT_MS = 60_000;

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `${key} is required for SAP_RFC_BACKEND=gateway but not set in sap.env`,
    );
  }
  return v;
}

function normaliseBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function buildSapHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const token = process.env.SAP_RFC_GATEWAY_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  // Credential passthrough — gateway uses these to open a per-user RFC
  // session so the SAP audit log shows the real developer, not a
  // service account.
  if (process.env.SAP_USERNAME)
    headers['X-SAP-User'] = process.env.SAP_USERNAME;
  if (process.env.SAP_PASSWORD)
    headers['X-SAP-Password'] = process.env.SAP_PASSWORD;
  if (process.env.SAP_CLIENT) headers['X-SAP-Client'] = process.env.SAP_CLIENT;
  if (process.env.SAP_LANGUAGE)
    headers['X-SAP-Language'] = process.env.SAP_LANGUAGE;

  return headers;
}

async function postJson(path: string, body: Record<string, any>): Promise<any> {
  const base = normaliseBaseUrl(required('SAP_RFC_GATEWAY_URL'));
  const url = `${base}${path}`;

  // TLS verification toggle — gateway on internal LAN with self-signed
  // cert is a common setup. The flag is applied via NODE_TLS_REJECT_UNAUTHORIZED
  // which Node's fetch() honours. We do not touch the process-wide value;
  // the user sets it themselves in sap.env if needed.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildSapHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = (e as Error).message;
    throw new Error(
      `RFC Gateway request failed (POST ${url}): ${msg}. ` +
        `Check SAP_RFC_GATEWAY_URL is reachable and TLS is trusted ` +
        `(set SAP_RFC_GATEWAY_TLS_VERIFY=0 for self-signed, dev only).`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `RFC Gateway returned HTTP ${res.status} (POST ${url}): ${text.substring(0, 256)}`,
    );
  }

  try {
    return await res.json();
  } catch (e) {
    throw new Error(
      `RFC Gateway returned non-JSON response (POST ${url}): ${(e as Error).message}`,
    );
  }
}

/**
 * Call ZMCP_ADT_DISPATCH via the gateway. `connection` is accepted for
 * signature parity but ignored — the gateway URL and SAP creds come
 * from process.env.
 */
export async function callDispatch(
  _connection: IAbapConnection,
  action: string,
  params: Record<string, any>,
): Promise<DispatchResult> {
  const body = await postJson('/rfc/dispatch', { action, params });
  const subrc = Number(body.subrc ?? 0);
  const message = String(body.message ?? '');
  const result = body.result ?? {};
  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_DISPATCH error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}

/**
 * Call ZMCP_ADT_TEXTPOOL via the gateway.
 */
export async function callTextpool(
  _connection: IAbapConnection,
  action: 'READ' | 'WRITE' | 'WRITE_INACTIVE',
  params: {
    program: string;
    language?: string;
    textpool_json?: string;
  },
): Promise<TextpoolResult> {
  const body = await postJson('/rfc/textpool', {
    action,
    program: params.program,
    language: params.language ?? '',
    textpool_json: params.textpool_json ?? '',
  });
  const subrc = Number(body.subrc ?? 0);
  const message = String(body.message ?? '');
  const result = body.result ?? [];
  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_TEXTPOOL error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}
