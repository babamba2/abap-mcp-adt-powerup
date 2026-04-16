/**
 * RFC backend selector.
 *
 * Reads SAP_RFC_BACKEND from process.env ('soap' default, 'native' /
 * 'gateway' / 'odata' opt-in) and re-exports the matching
 * callDispatch / callTextpool implementation.
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
  const v = (process.env.SAP_RFC_BACKEND ?? 'soap').trim().toLowerCase();
  if (v === 'native') return 'native';
  if (v === 'gateway') return 'gateway';
  if (v === 'odata') return 'odata';
  if (v === 'soap' || v === '') return 'soap';
  throw new Error(
    `SAP_RFC_BACKEND must be 'soap' | 'native' | 'gateway' | 'odata' (got '${v}'). ` +
      `Default is 'soap'. Set in .sc4sap/sap.env.`,
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

// Re-export shared types so handlers do not need to reach into
// soapRfc.ts for them. This keeps the import surface symmetrical.
export type { DispatchResult, TextpoolResult, TextpoolRow } from './soapRfc';
