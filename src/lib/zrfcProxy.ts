/**
 * ZRFC backend — calls custom ICF handler `ZCL_MCP_RFC_HTTP_HANDLER`
 * mounted at `/sap/bc/rest/zmcp_rfc` on the SAP system.
 *
 * The ABAP handler exposes `ZMCP_ADT_DISPATCH` / `ZMCP_ADT_TEXTPOOL`
 * as HTTPS/JSON endpoints, so this backend needs neither the SAP NW
 * RFC SDK (unlike `native`/`gateway`) nor the SOAP RFC ICF node
 * (unlike `soap`) nor OData Gateway registration (unlike `odata`).
 *
 * Best fit for ECC / hardened S/4 systems where `/sap/bc/soap/rfc` is
 * closed by policy and OData Gateway is not configured. Single Basis
 * action required: activate one ICF node + install one handler class.
 *
 * Contract-compatible with soapRfc.ts / nativeRfc.ts / gatewayRfc.ts /
 * odataRfc.ts — same DispatchResult / TextpoolResult shapes. Handlers
 * only import from ./rfcBackend, never directly from here.
 *
 * Environment variables (populated from .sc4sap/sap.env):
 *   SAP_RFC_ZRFC_BASE_URL    — e.g. https://sap.company.com:44300/sap/bc/rest/zmcp_rfc  (required)
 *   SAP_RFC_ZRFC_CSRF_TTL_SEC — CSRF token cache TTL, default 600s
 *   SAP_USERNAME / SAP_PASSWORD / SAP_CLIENT — reused for Basic auth
 *
 * CSRF handshake (double-submit cookie, mirrors odataRfc.ts):
 *   1. GET  {base}/dispatch with "X-CSRF-Token: Fetch"
 *      → 200 + response "X-CSRF-Token: <uuid>" + Set-Cookie "zrfc_csrf=<uuid>"
 *   2. POST {base}/<endpoint> with "X-CSRF-Token: <uuid>" + Cookie "zrfc_csrf=<uuid>"
 *      On HTTP 403 (CSRF expired) → clear cache, retry once.
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import type { DispatchResult, TextpoolResult } from './soapRfc';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_CSRF_TTL_SEC = 600;

interface CsrfSession {
  token: string;
  cookie: string; // prebuilt Cookie header value ("name1=val1; name2=val2")
  expiresAt: number; // epoch ms
}

let cachedSession: CsrfSession | null = null;

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `${key} is required for SAP_RFC_BACKEND=zrfc but not set in sap.env`,
    );
  }
  return v;
}

function normaliseBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function ttlMs(): number {
  const sec = Number(
    process.env.SAP_RFC_ZRFC_CSRF_TTL_SEC ?? DEFAULT_CSRF_TTL_SEC,
  );
  return Math.max(60, Number.isFinite(sec) ? sec : DEFAULT_CSRF_TTL_SEC) * 1000;
}

function buildBasicAuth(): string {
  const user = required('SAP_USERNAME');
  const pw = required('SAP_PASSWORD');
  return `Basic ${Buffer.from(`${user}:${pw}`).toString('base64')}`;
}

function withSapClient(url: string): string {
  const client = process.env.SAP_CLIENT;
  if (!client) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sap-client=${encodeURIComponent(client)}`;
}

/**
 * Extract cookies from a fetch Response into a single Cookie header
 * value. Drops attributes (path, expires, ...) — keeps only name=value
 * pairs as required by the Cookie request header.
 */
function extractCookies(res: Response): string {
  const getSetCookie = (
    res.headers as unknown as {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;
  let setCookies: string[] = [];
  if (typeof getSetCookie === 'function') {
    setCookies = getSetCookie.call(res.headers);
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      setCookies = raw.split(/,(?=\s*[A-Za-z0-9_!#$%&'*+\-.^`|~]+=)/);
    }
  }
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function fetchCsrf(): Promise<CsrfSession> {
  const base = normaliseBaseUrl(required('SAP_RFC_ZRFC_BASE_URL'));
  // Use /dispatch as the preflight target — any endpoint under the
  // handler serves the CSRF fetch identically, but /dispatch is the
  // one guaranteed to exist by our handler contract.
  const url = withSapClient(`${base}/dispatch`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-CSRF-Token': 'Fetch',
        Authorization: buildBasicAuth(),
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      `ZRFC CSRF fetch failed (GET ${url}): ${(e as Error).message}. ` +
        `Verify SAP_RFC_ZRFC_BASE_URL is reachable and the ICF node ` +
        `/sap/bc/rest/zmcp_rfc is active in SICF.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `ZRFC CSRF fetch returned HTTP ${res.status} (GET ${url}): ${text.substring(0, 256)}`,
    );
  }

  const token = res.headers.get('x-csrf-token');
  if (!token || token.toLowerCase() === 'required') {
    throw new Error(
      `ZRFC CSRF fetch: server did not return an X-CSRF-Token header. ` +
        `Verify ZCL_MCP_RFC_HTTP_HANDLER is installed and activated, and ` +
        `the SICF node /sap/bc/rest/zmcp_rfc is active.`,
    );
  }

  return {
    token,
    cookie: extractCookies(res),
    expiresAt: Date.now() + ttlMs(),
  };
}

async function getSession(forceRefresh = false): Promise<CsrfSession> {
  if (
    !forceRefresh &&
    cachedSession !== null &&
    cachedSession.expiresAt > Date.now()
  ) {
    return cachedSession;
  }
  cachedSession = await fetchCsrf();
  return cachedSession;
}

function tryParseJson(str: string, fallback: any): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

async function postEndpoint(
  endpoint: 'dispatch' | 'textpool',
  body: Record<string, any>,
): Promise<any> {
  const base = normaliseBaseUrl(required('SAP_RFC_ZRFC_BASE_URL'));
  const url = withSapClient(`${base}/${endpoint}`);

  const session = await getSession();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': session.token,
        Authorization: buildBasicAuth(),
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      `ZRFC endpoint call failed (POST ${url}): ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 403) {
    const header = res.headers.get('x-csrf-token');
    if (header && header.toLowerCase() === 'required') {
      // CSRF token expired — invalidate cache and retry once.
      cachedSession = null;
      return await postEndpoint(endpoint, body);
    }
    const text = await res.text().catch(() => '');
    throw new Error(
      `ZRFC endpoint returned HTTP 403 without CSRF refresh signal: ${text.substring(0, 256)}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `ZRFC endpoint returned HTTP ${res.status} (POST ${url}): ${text.substring(0, 256)}`,
    );
  }

  try {
    return await res.json();
  } catch (e) {
    throw new Error(
      `ZRFC endpoint returned non-JSON body (POST ${url}): ${(e as Error).message}`,
    );
  }
}

/**
 * Call ZMCP_ADT_DISPATCH via the zrfc ICF handler.
 * `connection` is accepted for signature parity but ignored — the URL
 * and SAP credentials come from process.env.
 */
export async function callDispatch(
  _connection: IAbapConnection,
  action: string,
  params: Record<string, any>,
): Promise<DispatchResult> {
  const raw = await postEndpoint('dispatch', {
    action,
    // ZMCP_ADT_DISPATCH expects IV_PARAMS as a JSON string — the ABAP
    // handler forwards ls_req-params verbatim into IV_PARAMS. Keep the
    // stringification here so the ABAP side remains a plain pass-through.
    params: JSON.stringify(params ?? {}),
  });

  const subrc = Number(raw?.subrc ?? 0);
  const message = String(raw?.message ?? '');
  const result = tryParseJson(String(raw?.result ?? '{}'), {});

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_DISPATCH error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}

/**
 * Call ZMCP_ADT_TEXTPOOL via the zrfc ICF handler.
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
  const raw = await postEndpoint('textpool', {
    action,
    program: params.program,
    language: params.language ?? '',
    // Field is named textpoolJson in the ABAP handler (camelCase from
    // /ui2/cl_json deserialize with pretty_name = camel_case).
    textpoolJson: params.textpool_json ?? '',
  });

  const subrc = Number(raw?.subrc ?? 0);
  const message = String(raw?.message ?? '');
  const result = tryParseJson(String(raw?.result ?? '[]'), []);

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_TEXTPOOL error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}

/**
 * Internal — exposed for tests. Production code should never need to
 * touch the CSRF cache directly.
 */
export const __test__ = {
  clearCachedSession: () => {
    cachedSession = null;
  },
  getCachedSession: () => cachedSession,
};
