/**
 * NCo RFC backend — SAP_RFC_BACKEND=nco.
 *
 * Calls the sc4sap helper function modules over RFC through SAP .NET
 * Connector (nco-bridge.exe from @babamba2/mcp-abap-connection), so neither
 * the OData service ZMCP_ADT_SRV nor the SOAP RFC ICF node is needed.
 * Windows only; NCo 3.x must be installed (see ensureNcoBridge).
 *
 * The OData backend (./odataRfc) names every call by its FunctionImport and
 * passes the FM's own parameter names (IV_*), so odataRfc delegates its
 * single transport point here when SAP_RFC_BACKEND=nco — callDispatch,
 * callTextpool and every DDIC / usage helper then work unchanged.
 *
 *   - remote-enabled FMs are called directly;
 *   - the others go through ZMCP_ADT_DISPATCH action FM_PROXY (allow list in
 *     the dispatcher), which needs a dispatcher with that action.
 *
 * Connection parameters (process.env, i.e. the active sc4sap profile):
 *   SAP_NCO_ASHOST  (default: host of SAP_URL)
 *   SAP_NCO_SYSNR   (default: derived from the SAP_URL port 80XX → XX)
 *   SAP_CLIENT, SAP_USERNAME, SAP_PASSWORD
 *   SAP_NCO_LANG    (default: SAP_LANGUAGE or EN)
 */

import {
  type NcoConnectionParams,
  NcoRfcClient,
} from '@babamba2/mcp-abap-connection';
import { registerProfileChangeHook } from './profileEvents';

/** FunctionImport → remote-enabled FM, called directly. */
const DIRECT_FM: Record<string, string> = {
  Dispatch: 'ZMCP_ADT_DISPATCH',
  Textpool: 'ZMCP_ADT_TEXTPOOL',
  DdicTabl: 'ZMCP_ADT_DDIC_TABL',
  DdicDtel: 'ZMCP_ADT_DDIC_DTEL',
  DdicDoma: 'ZMCP_ADT_DDIC_DOMA',
  DdicActivate: 'ZMCP_ADT_DDIC_ACTIVATE',
};

/** FunctionImport → FM that is not remote-enabled, called via FM_PROXY. */
const PROXIED_FM: Record<string, string> = {
  DdicTtyp: 'ZMCP_ADT_DDIC_TTYP',
  DdicBadi: 'ZMCP_ADT_DDIC_BADI',
  DdicTablRead: 'ZMCP_ADT_DDIC_TABL_READ',
  DdicDtelRead: 'ZMCP_ADT_DDIC_DTEL_READ',
  DdicDomaRead: 'ZMCP_ADT_DDIC_DOMA_READ',
  WlTcodeUsage: 'ZMCP_WL_TCODE_USAGE',
  WlJobUsage: 'ZMCP_WL_JOB_USAGE',
};

export function isNcoBackend(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.SAP_RFC_BACKEND ?? '').trim().toLowerCase() === 'nco';
}

/** Builds the NCo logon parameters from the active profile env. */
export function ncoParamsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NcoConnectionParams {
  let host = '';
  let sysnr = '';
  if (env.SAP_URL) {
    try {
      const u = new URL(env.SAP_URL);
      host = u.hostname;
      const port = Number.parseInt(u.port || '8000', 10);
      if (port >= 8000 && port <= 8099) {
        sysnr = String(port - 8000).padStart(2, '0');
      }
    } catch {
      /* fall through to the explicit keys */
    }
  }
  const ashost = env.SAP_NCO_ASHOST?.trim() || host;
  const sys = env.SAP_NCO_SYSNR?.trim() || sysnr;
  const missing: string[] = [];
  if (!ashost) missing.push('SAP_NCO_ASHOST (or SAP_URL)');
  if (!sys) missing.push('SAP_NCO_SYSNR (SAP_URL port is not 80XX)');
  if (!env.SAP_CLIENT) missing.push('SAP_CLIENT');
  if (!env.SAP_USERNAME) missing.push('SAP_USERNAME');
  if (!env.SAP_PASSWORD) missing.push('SAP_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`NCo RFC backend: missing ${missing.join(', ')}`);
  }
  return {
    ashost,
    sysnr: sys,
    client: String(env.SAP_CLIENT),
    user: String(env.SAP_USERNAME),
    passwd: String(env.SAP_PASSWORD),
    lang: env.SAP_NCO_LANG?.trim() || env.SAP_LANGUAGE?.trim() || 'EN',
  };
}

type ClientFactory = (params: NcoConnectionParams) => {
  readonly alive: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  call(
    fm: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, any>>;
};

let factory: ClientFactory = (p) => new NcoRfcClient(p);
let client: ReturnType<ClientFactory> | null = null;
let opening: Promise<ReturnType<ClientFactory>> | null = null;

/** Test seam: replace the client factory (and drop the open client). */
export function __setNcoClientFactory(f: ClientFactory | null): void {
  void resetNcoClient();
  factory = f ?? ((p) => new NcoRfcClient(p));
}

export async function resetNcoClient(): Promise<void> {
  const c = client;
  client = null;
  opening = null;
  if (c) await c.close().catch(() => undefined);
}

// The client logged on with the previous profile's credentials.
registerProfileChangeHook(() => {
  void resetNcoClient();
});

async function getClient(): Promise<ReturnType<ClientFactory>> {
  if (client?.alive) return client;
  if (!opening) {
    opening = (async () => {
      const c = factory(ncoParamsFromEnv());
      await c.open();
      client = c;
      return c;
    })().finally(() => {
      opening = null;
    });
  }
  return opening;
}

/** Calls any remote-enabled FM on the NCo connection (node-rfc value shapes). */
export async function callNcoFunction(
  fm: string,
  params: Record<string, unknown>,
): Promise<Record<string, any>> {
  const c = await getClient();
  return c.call(fm, params);
}

/**
 * Transport for odataRfc when SAP_RFC_BACKEND=nco: same FunctionImport name
 * and IV_* parameters, returns the FM's exports (EV_SUBRC / EV_MESSAGE /
 * EV_RESULT, ...).
 */
export async function ncoFunctionImport(
  functionImport: string,
  params: Record<string, string>,
): Promise<Record<string, any>> {
  const direct = DIRECT_FM[functionImport];
  if (direct) return callNcoFunction(direct, params);

  const proxied = PROXIED_FM[functionImport];
  if (!proxied) {
    throw new Error(
      `NCo RFC backend: no function module mapped for '${functionImport}'`,
    );
  }
  const r = await callNcoFunction('ZMCP_ADT_DISPATCH', {
    IV_ACTION: 'FM_PROXY',
    IV_PARAMS: JSON.stringify({
      fm: proxied,
      params: Object.entries(params).map(([name, value]) => ({
        name,
        value: value ?? '',
      })),
    }),
  });
  const subrc = Number(r.EV_SUBRC ?? 0);
  const message = String(r.EV_MESSAGE ?? '');
  if (subrc !== 0) {
    const hint = /Unknown action/i.test(message)
      ? ' — the ZMCP_ADT_DISPATCH on this system predates FM_PROXY; reinstall it via /sc4sap:setup (Step 9a).'
      : '';
    throw new Error(`ZMCP_ADT_DISPATCH FM_PROXY ${proxied}: ${message}${hint}`);
  }
  try {
    return JSON.parse(String(r.EV_RESULT ?? '{}'));
  } catch {
    throw new Error(
      `ZMCP_ADT_DISPATCH FM_PROXY ${proxied}: result is not JSON: ${String(r.EV_RESULT).slice(0, 200)}`,
    );
  }
}
