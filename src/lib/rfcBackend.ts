/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('odata' default, 'soap' /
 * 'native' / 'gateway' opt-in) and re-exports the matching
 * callDispatch / callTextpool implementation.
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
 * a single env flip with no code change. The resolution happens once
 * at module-load time — changing SAP_RFC_BACKEND at runtime requires
 * an MCP server restart, which is already required for any sap.env
 * edit.
 */

import * as gateway from './gatewayRfc';
import * as native from './nativeRfc';
import * as odata from './odataRfc';
import * as soap from './soapRfc';

export type RfcBackend = 'soap' | 'native' | 'gateway' | 'odata';

function resolveBackend(): RfcBackend {
  const v = (process.env.SAP_RFC_BACKEND ?? 'odata').trim().toLowerCase();
  if (v === 'native') return 'native';
  if (v === 'gateway') return 'gateway';
  if (v === 'odata') return 'odata';
  if (v === 'soap' || v === '') return 'soap';
  throw new Error(
    `SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' (got '${v}'). ` +
      `Default is 'odata'. Set in .sc4sap/sap.env.`,
  );
}

export const backend: RfcBackend = resolveBackend();

function pickDispatch() {
  switch (backend) {
    case 'native':
      return native.callDispatch;
    case 'gateway':
      return gateway.callDispatch;
    case 'odata':
      return odata.callDispatch;
    default:
      return soap.callDispatch;
  }
}

function pickTextpool() {
  switch (backend) {
    case 'native':
      return native.callTextpool;
    case 'gateway':
      return gateway.callTextpool;
    case 'odata':
      return odata.callTextpool;
    default:
      return soap.callTextpool;
  }
}

export const callDispatch = pickDispatch();
export const callTextpool = pickTextpool();

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
function unsupportedDdic(name: string): never {
  throw new Error(
    `${name} requires SAP_RFC_BACKEND=odata (current='${backend}'). ` +
      `The ECC DDIC fallback is only implemented against the OData ZMCP_ADT_SRV ` +
      `service. Set SAP_RFC_BACKEND=odata in .sc4sap/sap.env or use S/4HANA (native ADT).`,
  );
}

function pickDdicTabl(): typeof odata.callDdicTabl {
  if (backend === 'odata') return odata.callDdicTabl;
  return (() => unsupportedDdic('callDdicTabl')) as typeof odata.callDdicTabl;
}

function pickDdicDtel(): typeof odata.callDdicDtel {
  if (backend === 'odata') return odata.callDdicDtel;
  return (() => unsupportedDdic('callDdicDtel')) as typeof odata.callDdicDtel;
}

function pickDdicDoma(): typeof odata.callDdicDoma {
  if (backend === 'odata') return odata.callDdicDoma;
  return (() => unsupportedDdic('callDdicDoma')) as typeof odata.callDdicDoma;
}

function pickDdicActivate(): typeof odata.callDdicActivate {
  if (backend === 'odata') return odata.callDdicActivate;
  return (() =>
    unsupportedDdic('callDdicActivate')) as typeof odata.callDdicActivate;
}

export const callDdicTabl = pickDdicTabl();
export const callDdicDtel = pickDdicDtel();
export const callDdicDoma = pickDdicDoma();
export const callDdicActivate = pickDdicActivate();

export type { DdicResult } from './odataRfc';
// Re-export shared types so handlers do not need to reach into
// soapRfc.ts / odataRfc.ts for them. This keeps the import surface
// symmetrical.
export type { DispatchResult, TextpoolResult, TextpoolRow } from './soapRfc';
