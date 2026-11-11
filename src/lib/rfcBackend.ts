/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' / 'nco'
 * opt-in) and routes callDispatch / callTextpool to the matching backend
 * module on every call.
 *
 *   odata   — SAP OData v2 service (ZMCP_ADT_SRV) via HTTPS (default)
 *   soap    — classic /sap/bc/soap/rfc HTTPS gateway (SAP built-in)
 *   nco     — RFC through SAP .NET Connector (Windows; ./ncoRfc). Uses the
 *             odata module's functions, whose transport point switches to
 *             NCo, so every DDIC / usage helper works on it too.
 *
 * The 'native', 'gateway' and 'zrfc' backends were removed in 4.10.0; a
 * profile that still selects one fails with a message naming the fix
 * (see ./removedTransports).
 *
 * Handlers import from this file, never directly from soapRfc.ts /
 * odataRfc.ts, so switching backends is a single env flip with no code
 * change.
 *
 * Resolution is lazy (per-call) — required because:
 *   1. The sc4sap profile loader (lib/profile.ts activateProfile()) runs
 *      inside main() in launcher.ts, AFTER all handler imports complete.
 *      Handler imports transitively load this module, so eager top-level
 *      resolution would freeze the backend before sap.env was read.
 *   2. ReloadProfile (handlers/system/readonly/handleReloadProfile.ts)
 *      changes SAP_RFC_BACKEND at runtime; eager caching would defeat it.
 */

import * as odata from './odataRfc';
import {
  REMOVED_RFC_BACKENDS,
  removedBackendMessage,
} from './removedTransports';
import * as soap from './soapRfc';

export type RfcBackend = 'soap' | 'odata' | 'nco';

function resolveBackend(): RfcBackend {
  const v = (process.env.SAP_RFC_BACKEND ?? '').trim().toLowerCase();
  // Empty / unset → default. Default flipped from 'soap' to 'odata' 2026-04-22.
  if (v === '') return 'odata';
  if (v === 'odata') return 'odata';
  if (v === 'soap') return 'soap';
  if (v === 'nco') return 'nco';
  if ((REMOVED_RFC_BACKENDS as readonly string[]).includes(v)) {
    throw new Error(removedBackendMessage(v));
  }
  throw new Error(
    `SAP_RFC_BACKEND must be 'odata' | 'soap' | 'nco' (got '${v}'). ` +
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
  // nco reuses the odata functions (their transport switches to NCo).
  return b === 'soap' ? soap : odata;
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
 * DdicDoma / DdicActivate. They have no soap
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
    `${name} requires SAP_RFC_BACKEND=odata or nco (current='${current}'). ` +
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
    if (b !== 'odata' && b !== 'nco') unsupportedDdic(name, b);
    return fn()(...args);
  }) as T;
}

/**
 * Read-only DDIC helpers also run over SOAP RFC (BASIS 7.31 has no SAP
 * Gateway, so the OData service cannot exist there). Same FMs, same result.
 */
function lazyDdicRead<T extends (...args: any[]) => any>(
  name: string,
  odataFn: () => T,
  soapFn: () => T,
): T {
  return ((...args: Parameters<T>) => {
    const b = resolveBackend();
    if (b === 'odata' || b === 'nco') return odataFn()(...args);
    if (b === 'soap') return soapFn()(...args);
    unsupportedDdic(name, b);
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
export const callDdicTtyp: typeof odata.callDdicTtyp = lazyDdic(
  'callDdicTtyp',
  () => odata.callDdicTtyp,
);
export const callDdicActivate: typeof odata.callDdicActivate = lazyDdic(
  'callDdicActivate',
  () => odata.callDdicActivate,
);
export const callDdicBadi: typeof odata.callDdicBadi = lazyDdic(
  'callDdicBadi',
  () => odata.callDdicBadi,
);
export const callDdicTablRead: typeof odata.callDdicTablRead = lazyDdicRead(
  'callDdicTablRead',
  () => odata.callDdicTablRead,
  () => soap.callDdicTablRead,
);
export const callDdicDtelRead: typeof odata.callDdicDtelRead = lazyDdicRead(
  'callDdicDtelRead',
  () => odata.callDdicDtelRead,
  () => soap.callDdicDtelRead,
);
export const callDdicDomaRead: typeof odata.callDdicDomaRead = lazyDdicRead(
  'callDdicDomaRead',
  () => odata.callDdicDomaRead,
  () => soap.callDdicDomaRead,
);
export const callWlTcodeUsage: typeof odata.callWlTcodeUsage = lazyDdic(
  'callWlTcodeUsage',
  () => odata.callWlTcodeUsage,
);
export const callWlJobUsage: typeof odata.callWlJobUsage = lazyDdic(
  'callWlJobUsage',
  () => odata.callWlJobUsage,
);

export type { DdicResult } from './odataRfc';
// Re-export shared types so handlers do not need to reach into
// soapRfc.ts / odataRfc.ts for them. This keeps the import surface
// symmetrical.
export type { DispatchResult, TextpoolResult, TextpoolRow } from './soapRfc';

/**
 * Response labels of the ECC function-module bridge. The OData labels stay
 * exactly as before ('ecc-odata-rfc', "via OData"); the NCo backend reports
 * its own path so a reply never claims a transport that was not used.
 */
function backendOrDefault(): RfcBackend {
  try {
    return resolveBackend();
  } catch {
    return 'odata';
  }
}

export function eccBridgePath(): 'ecc-odata-rfc' | 'ecc-nco-rfc' {
  return backendOrDefault() === 'nco' ? 'ecc-nco-rfc' : 'ecc-odata-rfc';
}

export function eccBridgeVia(): 'OData' | 'NCo RFC' {
  return backendOrDefault() === 'nco' ? 'NCo RFC' : 'OData';
}
