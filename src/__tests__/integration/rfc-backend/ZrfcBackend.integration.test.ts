/**
 * Integration test — `zrfc` backend against a live SAP system.
 *
 * Proves end-to-end that the custom ICF handler
 * `ZCL_MCP_RFC_HTTP_HANDLER` mounted at `/sap/bc/rest/zmcp_rfc` is:
 *   1. reachable + authenticated (Basic Auth)
 *   2. correctly issuing a CSRF token on GET with `X-CSRF-Token: Fetch`
 *   3. accepting CSRF-authenticated POSTs to `/dispatch` and `/textpool`
 *   4. enforcing the hardcoded deny list on the `/call` endpoint
 *   5. reusing the cached CSRF session across multiple calls
 *
 * Skip conditions (test passes without running):
 *   • tests/test-config.yaml missing OR rfc_backend.enabled=false
 *   • 'zrfc' not in rfc_backend.backends[]
 *   • rfc_backend.zrfc.base_url is empty
 *   • AuthBroker / env not set up (no SAP_USERNAME/SAP_PASSWORD available)
 *
 * Prerequisites on the SAP side:
 *   • `ZCL_MCP_RFC_HTTP_HANDLER` class installed + active (sc4sap:setup step 9d)
 *   • SICF node `/default_host/sap/bc/rest/zmcp_rfc` active
 *   • `ZMCP_ADT_DISPATCH` + `ZMCP_ADT_TEXTPOOL` function modules installed (step 9a)
 *   • The integration-test user has basic auth + S_RFC auth on those two FMs
 */

import { loadTestConfig } from '../helpers/configHelpers';
import { createTestConnectionAndSession } from '../helpers/sessionHelpers';

interface ZrfcConfig {
  base_url?: string;
  csrf_ttl_sec?: number;
}

interface RfcBackendConfig {
  enabled?: boolean;
  backends?: string[];
  probe_program?: string;
  probe_language?: string;
  zrfc?: ZrfcConfig;
}

const rfcCfg: RfcBackendConfig = (loadTestConfig() ?? {}).rfc_backend ?? {};
const zrfcCfg: ZrfcConfig = rfcCfg.zrfc ?? {};
const suiteEnabled =
  rfcCfg.enabled === true &&
  (rfcCfg.backends ?? []).includes('zrfc') &&
  !!zrfcCfg.base_url;

const probeProgram = rfcCfg.probe_program ?? 'RSPARAM';
const probeLanguage = rfcCfg.probe_language ?? 'EN';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    process.env[k] = v;
  }
}

function applyZrfcEnv() {
  restoreEnv();
  process.env.SAP_RFC_BACKEND = 'zrfc';
  if (zrfcCfg.base_url) process.env.SAP_RFC_ZRFC_BASE_URL = zrfcCfg.base_url;
  if (zrfcCfg.csrf_ttl_sec !== undefined) {
    process.env.SAP_RFC_ZRFC_CSRF_TTL_SEC = String(zrfcCfg.csrf_ttl_sec);
  }
}

function buildBasicAuthHeader(): string {
  const user = process.env.SAP_USERNAME ?? '';
  const pw = process.env.SAP_PASSWORD ?? '';
  return `Basic ${Buffer.from(`${user}:${pw}`).toString('base64')}`;
}

function withSapClient(url: string): string {
  const client = process.env.SAP_CLIENT;
  if (!client) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sap-client=${encodeURIComponent(client)}`;
}

const describeOrSkip = suiteEnabled ? describe : describe.skip;

describeOrSkip('zrfc backend (live SAP integration)', () => {
  let connectionReady = false;

  beforeAll(async () => {
    try {
      await createTestConnectionAndSession();
      connectionReady = true;
    } catch (e) {
      console.warn(
        `[ZrfcBackend] No live SAP session — suite will skip: ${(e as Error).message}`,
      );
      connectionReady = false;
    }
    applyZrfcEnv();
  }, 60_000);

  afterAll(() => {
    restoreEnv();
  });

  afterEach(() => {
    // Wipe the CSRF cache between tests so each test exercises the
    // full handshake deterministically.
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../../lib/zrfcProxy');
        mod.__test__?.clearCachedSession?.();
      });
    } catch {
      // Module not loaded yet — nothing to clear
    }
  });

  it('CSRF preflight — GET with X-CSRF-Token: Fetch returns a token + cookie', async () => {
    if (!connectionReady) return;
    applyZrfcEnv();

    const url = withSapClient(`${zrfcCfg.base_url}/dispatch`);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-CSRF-Token': 'Fetch',
        Authorization: buildBasicAuthHeader(),
        Accept: 'application/json',
      },
    });

    expect(res.status).toBe(200);
    const token = res.headers.get('x-csrf-token');
    expect(token).toBeTruthy();
    expect(token).not.toMatch(/^required$/i);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('zrfc_csrf=');
  }, 60_000);

  it('callDispatch — CUA_FETCH against a standard SAP program returns subrc=0', async () => {
    if (!connectionReady) return;
    applyZrfcEnv();

    let out: any;
    (await jest.isolateModulesAsync?.(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../../lib/zrfcProxy');
      out = await mod.callDispatch({}, 'CUA_FETCH', { program: probeProgram });
    })) ??
      (() => {
        // Fallback for Jest versions without isolateModulesAsync
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../../lib/zrfcProxy');
        return (async () => {
          out = await mod.callDispatch({}, 'CUA_FETCH', {
            program: probeProgram,
          });
        })();
      })();

    expect(out).toBeDefined();
    expect(out.subrc).toBe(0);
    // Result shape is action-specific; CUA_FETCH returns an object
    expect(typeof out.result).toBe('object');
  }, 120_000);

  it('callTextpool READ — standard program RSPARAM returns text rows', async () => {
    if (!connectionReady) return;
    applyZrfcEnv();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../lib/zrfcProxy');
    const out = await mod.callTextpool({}, 'READ', {
      program: probeProgram,
      language: probeLanguage,
    });

    expect(out.subrc).toBe(0);
    expect(Array.isArray(out.result)).toBe(true);
    expect(out.result.length).toBeGreaterThan(0);
    const first = out.result[0];
    expect(first).toEqual(
      expect.objectContaining({
        ID: expect.any(String),
        KEY: expect.any(String),
      }),
    );
  }, 120_000);

  it('/call deny list — POST {fm: SXPG_CALL_SYSTEM} returns HTTP 403', async () => {
    if (!connectionReady) return;
    applyZrfcEnv();

    // First handshake a CSRF token.
    const fetchUrl = withSapClient(`${zrfcCfg.base_url}/dispatch`);
    const preflight = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'X-CSRF-Token': 'Fetch',
        Authorization: buildBasicAuthHeader(),
        Accept: 'application/json',
      },
    });
    const token = preflight.headers.get('x-csrf-token') ?? '';
    const cookieHeader = preflight.headers.get('set-cookie') ?? '';
    const csrfCookie = cookieHeader.split(';')[0].trim();

    // Now try the deny-listed FM via raw POST to /call.
    const callUrl = withSapClient(`${zrfcCfg.base_url}/call`);
    const res = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': token,
        Cookie: csrfCookie,
        Authorization: buildBasicAuthHeader(),
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({ fm: 'SXPG_CALL_SYSTEM', params: {} }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    expect(body).toBeTruthy();
    expect(String(body?.error ?? '')).toMatch(/deny list/i);
  }, 60_000);

  it('CSRF session is cached across multiple callDispatch invocations', async () => {
    if (!connectionReady) return;
    applyZrfcEnv();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../lib/zrfcProxy');
    mod.__test__.clearCachedSession();

    // First call — triggers CSRF fetch.
    await mod.callDispatch({}, 'CUA_FETCH', { program: probeProgram });
    const session1 = mod.__test__.getCachedSession();
    expect(session1).toBeTruthy();
    expect(session1.token).toBeTruthy();

    // Second call — must reuse the same token (no new GET).
    await mod.callDispatch({}, 'CUA_FETCH', { program: probeProgram });
    const session2 = mod.__test__.getCachedSession();
    expect(session2.token).toBe(session1.token);
    expect(session2.cookie).toBe(session1.cookie);
  }, 120_000);
});
