/**
 * OData RFC backend — calls the ZMCP_ADT_SRV OData v2 service on SAP
 * whose FunctionImports `Dispatch` and `Textpool` forward to the
 * RFC-enabled function modules `ZMCP_ADT_DISPATCH` / `ZMCP_ADT_TEXTPOOL`.
 *
 * Best fit for enterprises that disable the legacy `/sap/bc/soap/rfc`
 * ICF node but keep the modern OData Gateway active — the typical
 * shape of a "hardened" SAP Gateway install.
 *
 * Contract-compatible with soapRfc.ts / nativeRfc.ts / gatewayRfc.ts —
 * same DispatchResult / TextpoolResult shapes. Handlers only import
 * from ./rfcBackend, never directly from here.
 *
 * Environment variables (populated from .sc4sap/sap.env):
 *   SAP_RFC_ODATA_SERVICE_URL  — e.g. https://sap.company.com:44300/sap/opu/odata/sap/ZMCP_ADT_SRV
 *   SAP_RFC_ODATA_CSRF_TTL_SEC — CSRF token cache TTL, default 600s
 *   SAP_USERNAME / SAP_PASSWORD / SAP_CLIENT — reused for Basic auth
 *
 * CSRF 2-step handshake on first call (cached TTL = SAP_RFC_ODATA_CSRF_TTL_SEC):
 *   1. GET  {service}/$metadata with header "X-CSRF-Token: Fetch"
 *      → response includes "X-CSRF-Token: <token>" + Set-Cookie(s)
 *   2. POST {service}/Dispatch?IV_ACTION='...'&IV_PARAMS='...'
 *      with header "X-CSRF-Token: <token>" + Cookie: <session>
 *   On HTTP 403 (CSRF expired) → clear cache, retry once.
 *
 * ─────────────────────────────────────────────────────────────────
 * SERVER PREREQUISITE (SEGW MPC_EXT — easy to get wrong):
 * ─────────────────────────────────────────────────────────────────
 * Every Action / FunctionImport in ZCL_ZMCP_ADT_MPC_EXT must call
 * BOTH set_return_complex_type() AND set_return_multiplicity('1'):
 *
 *   lo_action->set_return_complex_type( 'DispatchResult' ).
 *   lo_action->set_return_multiplicity( '1' ).   " ← missing = broken
 *
 * Calling only set_return_complex_type() silently omits the ReturnType
 * attribute from $metadata FunctionImport. Gateway then cannot map the
 * DPC_EXT response and every POST fails with HTTP 500 "In the context
 * of Data Services an unknown internal server error occurred". Easy
 * diagnostic: fetch $metadata and grep for ReturnType="..." on each
 * FunctionImport — if the attribute is missing, this is the cause.
 * (Encountered 2026-04-22.)
 *
 * Do NOT append $format=json to Function Import URLs — Gateway
 * rejects it with "System query options ... are not allowed in the
 * requested URI". Use Accept: application/json header instead.
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
      `${key} is required for SAP_RFC_BACKEND=odata but not set in sap.env`,
    );
  }
  return v;
}

function normaliseBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function ttlMs(): number {
  const sec = Number(
    process.env.SAP_RFC_ODATA_CSRF_TTL_SEC ?? DEFAULT_CSRF_TTL_SEC,
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
  // Node 19.7+ supports getSetCookie() which returns the array form.
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
      // Crude split on ", " only when followed by "<name>=" so we don't
      // split on commas inside Expires=... values.
      setCookies = raw.split(/,(?=\s*[A-Za-z0-9_!#$%&'*+\-.^`|~]+=)/);
    }
  }
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * OData v2 string literal encoding:
 *   - wrapped in single quotes
 *   - internal single quotes doubled ('' = literal ')
 *   - URI-percent-encoded for use in query string
 */
function encodeODataStringLiteral(value: string): string {
  const escaped = value.replace(/'/g, "''");
  return `'${encodeURIComponent(escaped)}'`;
}

function buildFunctionImportQuery(
  actionName: string,
  params: Record<string, string>,
): string {
  const pairs: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    pairs.push(`${key}=${encodeODataStringLiteral(val)}`);
  }
  return pairs.length > 0 ? `${actionName}?${pairs.join('&')}` : actionName;
}

async function fetchCsrf(): Promise<CsrfSession> {
  const base = normaliseBaseUrl(required('SAP_RFC_ODATA_SERVICE_URL'));
  const url = withSapClient(`${base}/$metadata`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-CSRF-Token': 'Fetch',
        Authorization: buildBasicAuth(),
        Accept: 'application/xml',
      },
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      `OData CSRF fetch failed (GET ${url}): ${(e as Error).message}. ` +
        `Check SAP_RFC_ODATA_SERVICE_URL is reachable and credentials are correct.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `OData CSRF fetch returned HTTP ${res.status} (GET ${url}): ${text.substring(0, 256)}`,
    );
  }

  const token = res.headers.get('x-csrf-token');
  if (!token || token.toLowerCase() === 'required') {
    throw new Error(
      `OData CSRF fetch: server did not return an X-CSRF-Token header. ` +
        `Verify the service is registered in /IWFND/MAINT_SERVICE and the URL path is correct.`,
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

/**
 * OData v2 response envelope auto-detection.
 *
 *   Form A (named-wrapped): { "d": { "Dispatch": { EV_RESULT: ..., ... } } }
 *   Form B (direct):        { "d": { EV_RESULT: ..., ... } }
 *
 * We probe Form A first (FunctionImport name), fall back to Form B.
 * If neither matches, return `d` verbatim and let downstream parse.
 */
function extractODataResult(body: any, actionName: string): any {
  const d = body?.d;
  if (d === undefined || d === null) {
    throw new Error(
      `OData response missing 'd' envelope: ${JSON.stringify(body).substring(0, 200)}`,
    );
  }
  if (typeof d === 'object' && actionName in d) {
    return d[actionName];
  }
  return d;
}

function tryParseJson(str: string, fallback: any): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

async function postFunctionImport(
  actionName: string,
  params: Record<string, string>,
): Promise<any> {
  const base = normaliseBaseUrl(required('SAP_RFC_ODATA_SERVICE_URL'));
  const path = buildFunctionImportQuery(actionName, params);
  const url = withSapClient(`${base}/${path}`);

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
        ...(session.cookie ? { Cookie: session.cookie } : {}),
      },
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      `OData function import failed (POST ${url}): ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 403) {
    // CSRF token expired — clear cache and retry once
    const header = res.headers.get('x-csrf-token');
    if (header && header.toLowerCase() === 'required') {
      cachedSession = null;
      return await postFunctionImport(actionName, params);
    }
    const text = await res.text().catch(() => '');
    throw new Error(
      `OData function import returned HTTP 403 without CSRF refresh signal: ${text.substring(0, 256)}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `OData function import returned HTTP ${res.status} (POST ${url}): ${text.substring(0, 256)}`,
    );
  }

  const body = await res.json().catch((e) => {
    throw new Error(
      `OData function import returned non-JSON body (POST ${url}): ${(e as Error).message}`,
    );
  });

  return extractODataResult(body, actionName);
}

/**
 * Call ZMCP_ADT_DISPATCH through the OData `Dispatch` function import.
 * `connection` is accepted for signature parity but ignored — OData URL
 * and SAP credentials come from process.env.
 */
export async function callDispatch(
  _connection: IAbapConnection,
  action: string,
  params: Record<string, any>,
): Promise<DispatchResult> {
  const raw = await postFunctionImport('Dispatch', {
    IV_ACTION: action,
    IV_PARAMS: JSON.stringify(params ?? {}),
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_DISPATCH error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}

/**
 * Call ZMCP_ADT_TEXTPOOL through the OData `Textpool` function import.
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
  const raw = await postFunctionImport('Textpool', {
    IV_ACTION: action,
    IV_PROGRAM: params.program,
    IV_LANGUAGE: params.language ?? '',
    IV_TEXTPOOL_JSON: params.textpool_json ?? '',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '[]'), []);

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_TEXTPOOL error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }
  return { result, subrc, message };
}

/**
 * DDIC fallback — ECC-only.
 *
 * ECC 7.40's ADT REST does not expose /sap/bc/adt/ddic/{tables,
 * dataelements, domains} endpoints, so DDIC writes on ECC route through
 * four OData FunctionImports backed by the ZMCP_ADT_DDIC_* function
 * modules: DdicTabl / DdicDtel / DdicDoma (CREATE / UPDATE / DELETE via
 * `iv_action`), and DdicActivate (type + name → DDIF_*_ACTIVATE).
 *
 * Each write FM performs this sequence server-side:
 *   1. RS_CORR_INSERT (creates TADIR + binds to package)
 *   2. DDIF_*_PUT (stages inactive DDIC record)
 *   3. TR_RECORD_OBJ_CHANGE_TO_REQ (appends to transport)
 *   4. WB_TREE_ACTUALIZE (refreshes SE80 repository tree cache)
 *
 * Caller then invokes callDdicActivate separately to activate the
 * staged inactive version. This split matches the S/4HANA ADT pattern
 * (create-then-activate) and lets the caller batch multiple creates
 * before activating.
 *
 * S/4HANA callers must NOT reach these — on S/4 the handlers use the
 * native /sap/bc/adt/ddic/... endpoints directly. The ECC gate lives in
 * each handler, not here.
 */
export interface DdicResult {
  subrc: number;
  message: string;
  result: any; // {saved, state, name} on CREATE/UPDATE; {deleted, name} on DELETE; {activated, rc, type, name} on ACTIVATE
}

async function callDdicObject(
  functionImport: 'DdicTabl' | 'DdicDtel' | 'DdicDoma',
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  params: {
    name: string;
    devclass?: string;
    transport?: string;
    payload_json?: string;
  },
): Promise<DdicResult> {
  const raw = await postFunctionImport(functionImport, {
    IV_ACTION: action,
    IV_NAME: params.name,
    IV_DEVCLASS: params.devclass ?? '',
    IV_TRANSPORT: params.transport ?? '',
    IV_PAYLOAD_JSON: params.payload_json ?? '',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_${functionImport.replace('Ddic', 'DDIC_').toUpperCase()} error (action=${action}, name=${params.name}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
}

export async function callDdicTabl(
  _connection: IAbapConnection,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  params: {
    name: string;
    devclass?: string;
    transport?: string;
    payload_json?: string;
  },
): Promise<DdicResult> {
  return callDdicObject('DdicTabl', action, params);
}

export async function callDdicDtel(
  _connection: IAbapConnection,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  params: {
    name: string;
    devclass?: string;
    transport?: string;
    payload_json?: string;
  },
): Promise<DdicResult> {
  return callDdicObject('DdicDtel', action, params);
}

export async function callDdicDoma(
  _connection: IAbapConnection,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  params: {
    name: string;
    devclass?: string;
    transport?: string;
    payload_json?: string;
  },
): Promise<DdicResult> {
  return callDdicObject('DdicDoma', action, params);
}

export async function callDdicActivate(
  _connection: IAbapConnection,
  type: 'TABL' | 'DTEL' | 'DOMA',
  name: string,
): Promise<DdicResult> {
  const raw = await postFunctionImport('DdicActivate', {
    IV_TYPE: type,
    IV_NAME: name,
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  // rc=4 on TABL is "activated with warnings" — object is usable, do
  // not throw. Only raise on rc >= 8 or sy-subrc !== 0 from the FM.
  if (subrc >= 8) {
    throw new Error(
      `ZMCP_ADT_DDIC_ACTIVATE error (type=${type}, name=${name}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
}

/**
 * Read-only BAdI implementation discovery — ECC bridge.
 *
 * Calls the ZMCP_ADT_DDIC_BADI function module via the OData
 * FunctionImport `DdicBadi`. Given a (classic) BAdI definition name,
 * returns the implementations registered against it (impl name, impl
 * class, package, methods redefined). Customer-only / active-only
 * filters default to true to match the most common debugging use case
 * ("which Z class extends standard BAdI X?").
 *
 * Result schema (parsed from EV_RESULT JSON):
 *   {
 *     badi_definition: string,
 *     kind: 'classic' | 'unknown',
 *     interface: string,
 *     multi_use: boolean,
 *     filter_dependent: boolean,
 *     implementations: Array<{
 *       impl_name: string,
 *       impl_class: string,
 *       active: boolean,
 *       package: string,
 *       methods_redefined: string[],
 *     }>
 *   }
 *
 * kind='unknown' = def not in SXS_ATTR (likely kernel/new BAdI; not
 * supported in v1). The handler should surface this gracefully.
 */
export async function callDdicBadi(
  _connection: IAbapConnection,
  params: {
    badi_definition: string;
    customer_only?: boolean;
    active_only?: boolean;
    include_methods?: boolean;
  },
): Promise<DdicResult> {
  const raw = await postFunctionImport('DdicBadi', {
    IV_BADI_DEFINITION: params.badi_definition,
    IV_CUSTOMER_ONLY: params.customer_only === false ? '' : 'X',
    IV_ACTIVE_ONLY: params.active_only === false ? '' : 'X',
    IV_INCLUDE_METHODS: params.include_methods === false ? '' : 'X',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc >= 8) {
    throw new Error(
      `ZMCP_ADT_DDIC_BADI error (badi_definition=${params.badi_definition}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
}

/**
 * Read-only DDIC table / structure metadata — ECC bridge.
 *
 * Calls ZMCP_ADT_DDIC_TABL_READ via OData FunctionImport `DdicTablRead`.
 * Returns a JSON skeleton compatible with the marketplace `handleGetTable`
 * / `handleGetStructure` handlers when the standard /sap/bc/adt/ddic/tables
 * endpoint is missing on legacy kernels (BASIS < 7.50).
 *
 * Result schema (parsed from EV_RESULT JSON):
 *   {
 *     name: string,
 *     kind: 'TABL' | 'STRU' | string,
 *     tabclass: string,             // TRANSP / STRUCTURE / INTTAB / VIEW / ...
 *     delivery_class: string,
 *     buffered: string,
 *     description: string,
 *     package: string,
 *     fields: Array<{
 *       fieldname: string, position: number, key: boolean, mandatory: boolean,
 *       rollname: string, checktable: string, datatype: string,
 *       leng: number, decimals: number, domname: string, comptype: string,
 *       notnull: boolean, description: string,
 *     }>
 *   }
 */
export async function callDdicTablRead(
  _connection: IAbapConnection,
  params: {
    name: string;
    version?: 'A' | 'I';
  },
): Promise<DdicResult> {
  const raw = await postFunctionImport('DdicTablRead', {
    IV_NAME: params.name,
    IV_VERSION: params.version ?? 'A',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc >= 8) {
    throw new Error(
      `ZMCP_ADT_DDIC_TABL_READ error (name=${params.name}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
}

/**
 * Read-only DDIC data element metadata — ECC bridge.
 *
 * Result schema:
 *   {
 *     name: string, domname: string, datatype: string,
 *     leng: number, decimals: number, outputlen: number,
 *     lowercase: boolean, signflag: boolean, convexit: string,
 *     description: string, heading: string,
 *     short_label: string, medium_label: string, long_label: string,
 *     package: string,
 *   }
 */
export async function callDdicDtelRead(
  _connection: IAbapConnection,
  params: {
    name: string;
    version?: 'A' | 'I';
  },
): Promise<DdicResult> {
  const raw = await postFunctionImport('DdicDtelRead', {
    IV_NAME: params.name,
    IV_VERSION: params.version ?? 'A',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc >= 8) {
    throw new Error(
      `ZMCP_ADT_DDIC_DTEL_READ error (name=${params.name}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
}

/**
 * Read-only DDIC domain metadata + fixed values — ECC bridge.
 *
 * Result schema:
 *   {
 *     name: string, datatype: string, leng: number, decimals: number,
 *     outputlen: number, lowercase: boolean, signflag: boolean,
 *     convexit: string, value_table: string, description: string,
 *     package: string,
 *     fixed_values: Array<{ valpos: number, low: string, high: string, description: string }>
 *   }
 */
export async function callDdicDomaRead(
  _connection: IAbapConnection,
  params: {
    name: string;
    version?: 'A' | 'I';
  },
): Promise<DdicResult> {
  const raw = await postFunctionImport('DdicDomaRead', {
    IV_NAME: params.name,
    IV_VERSION: params.version ?? 'A',
  });

  const subrc = Number(raw?.EV_SUBRC ?? 0);
  const message = String(raw?.EV_MESSAGE ?? '');
  const result = tryParseJson(String(raw?.EV_RESULT ?? '{}'), {});

  if (subrc >= 8) {
    throw new Error(
      `ZMCP_ADT_DDIC_DOMA_READ error (name=${params.name}, subrc=${subrc}): ${message}`,
    );
  }
  return { subrc, message, result };
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
