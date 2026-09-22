/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' /
 * 'native' / 'gateway' / 'zrfc' opt-in) and routes callDispatch / callTextpool
 * to the matching backend module on every call.
 *
 * Default changed 2026-04-22 from 'soap' to 'odata': hardened Gateway
 * installs increasingly disable the /sap/bc/soap/rfc ICF node, and the
 * OData path goes through standard Gateway authorization (S_SERVICE)
 * instead of S_RFC. Existing setups that explicitly set
 * SAP_RFC_BACKEND=soap are unaffected.
 *
 *   soap    — classic /sap/bc/soap/rfc HTTPS gateway (SAP built-in)
 *   native  — direct NW RFC SDK on this host (requires SDK + node-rfc)
 *   gateway — remote RFC Gateway middleware via HTTPS/JSON (no SDK here)
 *   odata   — SAP OData v2 service (ZMCP_ADT_SRV) via HTTPS (SEGW-free)
 *
 * Handlers import from this file, never directly from soapRfc.ts /
 * nativeRfc.ts / gatewayRfc.ts / odataRfc.ts, so switching backends is
 * a single env flip with no code change.
 *
 * Resolution is lazy (per-call) — required because:
 *   1. The sc4sap profile loader (lib/profile.ts activateProfile()) runs
 *      inside main() in launcher.ts, AFTER all handler imports complete.
 *      Handler imports transitively load this module, so eager top-level
 *      resolution would freeze the backend before sap.env was read.
 *   2. ReloadProfile (handlers/system/readonly/handleReloadProfile.ts)
 *      changes SAP_RFC_BACKEND at runtime; eager caching would defeat it.
 */

import * as gateway from './gatewayRfc';
import * as native from './nativeRfc';
import * as odata from './odataRfc';
import * as soap from './soapRfc';
import * as zrfc from './zrfcProxy';

export type RfcBackend = 'soap' | 'native' | 'gateway' | 'odata' | 'zrfc';

function resolveBackend(): RfcBackend {
  const v = (process.env.SAP_RFC_BACKEND ?? '').trim().toLowerCase();
  // Empty / unset → default. Default flipped from 'soap' to 'odata' 2026-04-22.
  if (v === '') return 'odata';
  if (v === 'native') return 'native';
  if (v === 'gateway') return 'gateway';
  if (v === 'odata') return 'odata';
  if (v === 'soap') return 'soap';
  if (v === 'zrfc') return 'zrfc';
  throw new Error(
    `SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' | 'zrfc' (got '${v}'). ` +
      `Default is 'odata'. Set in .sc4sap/sap.env.`,
  );
}

/** Returns the active backend resolved from current process.env. */
export function getBackend(): RfcBackend {
  return resolveBackend();
}

type BackendModule = {
  callDispatch: typeof odata.callDispatch;
  callTextpool: typeof odata.callTextpool;
};

function pickModule(b: RfcBackend): BackendModule {
  switch (b) {
    case 'native':
      return native;
    case 'gateway':
      return gateway;
    case 'odata':
      return odata;
    case 'zrfc':
      return zrfc;
    default:
      return soap;
  }
}

export const callDispatch: typeof odata.callDispatch = (...args) =>
  pickModule(resolveBackend()).callDispatch(...args);

export const callTextpool: typeof odata.callTextpool = (...args) =>
  pickModule(resolveBackend()).callTextpool(...args);

// Live `backend` getter — preserves the existing read-only constant API
// while reflecting the *current* env (not the boot-time snapshot).
Object.defineProperty(module.exports, 'backend', {
  enumerable: true,
  configurable: false,
  get: resolveBackend,
});
// Type-only declaration so TS callers can still `import { backend }`.
export declare const backend: RfcBackend;

/**
 * DDIC fallback helpers — ECC only, OData backend only.
 *
 * These route to the ZMCP_ADT_DDIC_TABL / DTEL / DOMA / ACTIVATE
 * function modules via the OData FunctionImports DdicTabl / DdicDtel /
 * DdicDoma / DdicActivate. They have no soap / native / gateway
 * equivalent — ECC fallback is intentionally only supported when the
 * environment has already chosen the OData path. Attempting to call
 * these with any other SAP_RFC_BACKEND raises a helpful error so the
 * user knows exactly which env var to change.
 *
 * Handlers typically gate on SAP_VERSION=ECC before reaching here. On
 * S/4HANA the native /sap/bc/adt/ddic/... REST endpoints are used and
 * these helpers are never invoked.
 */
function unsupportedDdic(name: string, current: RfcBackend): never {
  throw new Error(
    `${name} requires SAP_RFC_BACKEND=odata (current='${current}'). ` +
      `The ECC DDIC fallback is only implemented against the OData ZMCP_ADT_SRV ` +
      `service. Set SAP_RFC_BACKEND=odata in .sc4sap/sap.env or use S/4HANA (native ADT).`,
  );
}

function lazyDdic<T extends (...args: any[]) => any>(
  name: string,
  fn: () => T,
): T {
  return ((...args: Parameters<T>) => {
    const b = resolveBackend();
    if (b !== 'odata') unsupportedDdic(name, b);
    return fn()(...args);
  }) as T;
}

export const callDdicTabl: typeof odata.callDdicTabl = lazyDdic(
  'callDdicTabl',
  () => odata.callDdicTabl,
);
export const callDdicDtel: typeof odata.callDdicDtel = lazyDdic(
  'callDdicDtel',
  () => odata.callDdicDtel,
);
export const callDdicDoma: typeof odata.callDdicDoma = lazyDdic(
  'callDdicDoma',
  () => odata.callDdicDoma,
);
export const callDdicActivate: typeof odata.callDdicActivate = lazyDdic(
  'callDdicActivate',
  () => odata.callDdicActivate,
);
export const callDdicBadi: typeof odata.callDdicBadi = lazyDdic(
  'callDdicBadi',
  () => odata.callDdicBadi,
);
export const callDdicTablRead: typeof odata.callDdicTablRead = lazyDdic(
  'callDdicTablRead',
  () => odata.callDdicTablRead,
);
export const callDdicDtelRead: typeof odata.callDdicDtelRead = lazyDdic(
  'callDdicDtelRead',
  () => odata.callDdicDtelRead,
);
export const callDdicDomaRead: typeof odata.callDdicDomaRead = lazyDdic(
  'callDdicDomaRead',
  () => odata.callDdicDomaRead,
);

export type { DdicResult } from './odataRfc';
// Re-export shared types so handlers do not need to reach into
// soapRfc.ts / odataRfc.ts for them. This keeps the import surface
// symmetrical.
export type { DispatchResult, TextpoolResult, TextpoolRow } from './soapRfc';
