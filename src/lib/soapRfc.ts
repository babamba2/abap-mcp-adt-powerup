/**
 * SOAP RFC Utility - Call RFC-enabled Function Modules via SAP SOAP endpoint
 *
 * Uses /sap/bc/soap/rfc to call RFC FMs with simple string parameters.
 * Designed for the ZMCP_ADT_DISPATCH dispatcher FM which uses JSON strings.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { makeAdtRequestWithTimeout } from './utils';

const SOAP_RFC_PATH = '/sap/bc/soap/rfc';
const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const URN_NS = 'urn:sap-com:document:sap:rfc:functions';

/**
 * Build SOAP XML envelope for an RFC function module call
 */
function buildSoapEnvelope(
  fmName: string,
  params: Record<string, string>,
): string {
  const paramXml = Object.entries(params)
    .map(([key, value]) => {
      const escaped = escapeXml(value);
      return `      <${key}>${escaped}</${key}>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap-env:Envelope xmlns:soap-env="${SOAP_NS}" xmlns:urn="${URN_NS}">
  <soap-env:Header/>
  <soap-env:Body>
    <urn:${fmName}>
${paramXml}
    </urn:${fmName}>
  </soap-env:Body>
</soap-env:Envelope>`;
}

/**
 * Escape special XML characters in a string value
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse SOAP response XML and extract the function module response body
 */
function parseSoapResponse(
  responseXml: string,
  fmName: string,
): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(responseXml);

  const body = parsed?.Envelope?.Body;
  if (!body) {
    throw new Error('Invalid SOAP response: missing Body element');
  }

  // Check for SOAP fault
  const fault = body.Fault;
  if (fault) {
    const faultString =
      fault.faultstring || fault.detail || 'Unknown SOAP fault';
    throw new Error(`SOAP Fault: ${faultString}`);
  }

  // Extract FM response - SAP uses "FM_NAME.Response" as element name
  const responseKey = `${fmName}.Response`;
  const fmResponse = body[responseKey];
  if (!fmResponse) {
    // Try without .Response suffix (some SAP versions)
    return body;
  }

  return fmResponse;
}

export interface SoapRfcResult {
  /** Raw parsed SOAP response parameters */
  raw: Record<string, any>;
}

export interface DispatchResult {
  /** JSON-parsed result from EV_RESULT */
  result: any;
  /** ABAP SY-SUBRC equivalent */
  subrc: number;
  /** Error/info message from ABAP */
  message: string;
}

export interface TextpoolRow {
  ID: 'I' | 'S' | 'R' | 'H' | string;
  KEY: string;
  ENTRY: string;
  LENGTH: number;
}

export interface TextpoolResult {
  /** JSON-parsed result from EV_RESULT (array of rows for READ, {written:true} for WRITE) */
  result: any;
  subrc: number;
  message: string;
}

/**
 * Call an RFC-enabled Function Module via SOAP
 *
 * @param connection SAP connection
 * @param fmName Function module name (must be RFC-enabled)
 * @param params Key-value pairs for IMPORTING parameters (string values)
 * @returns Parsed SOAP response parameters
 */
export async function callSoapRfc(
  connection: IAbapConnection,
  fmName: string,
  params: Record<string, string>,
): Promise<SoapRfcResult> {
  const soapXml = buildSoapEnvelope(fmName, params);

  const response = await makeAdtRequestWithTimeout(
    connection,
    SOAP_RFC_PATH,
    'POST',
    'long',
    soapXml,
    undefined,
    {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: URN_NS,
    },
  );

  const responseXml =
    typeof response.data === 'string' ? response.data : String(response.data);

  const raw = parseSoapResponse(responseXml, fmName);
  return { raw };
}

/**
 * Call ZMCP_ADT_DISPATCH via SOAP RFC - the JSON dispatcher FM
 *
 * @param connection SAP connection
 * @param action Action name (e.g., 'CUA_FETCH', 'DYNPRO_READ')
 * @param params JSON-serializable parameters for the action
 * @returns Parsed dispatch result with JSON result, subrc, and message
 */
export async function callDispatch(
  connection: IAbapConnection,
  action: string,
  params: Record<string, any>,
): Promise<DispatchResult> {
  const { raw } = await callSoapRfc(connection, 'ZMCP_ADT_DISPATCH', {
    IV_ACTION: action,
    IV_PARAMS: JSON.stringify(params),
  });

  const subrc = Number(raw.EV_SUBRC ?? raw.ev_subrc ?? 0);
  const message = String(raw.EV_MESSAGE ?? raw.ev_message ?? '');
  const resultStr = String(raw.EV_RESULT ?? raw.ev_result ?? '{}');

  let result: any;
  try {
    result = JSON.parse(resultStr);
  } catch {
    result = resultStr;
  }

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_DISPATCH error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }

  return { result, subrc, message };
}

/**
 * Call ZMCP_ADT_TEXTPOOL via SOAP RFC - dedicated text pool read/write FM.
 *
 * Text elements (text symbols, selection texts, program title, list
 * headings) have no ADT URI, so this routes through a custom RFC in
 * function group ZMCP_ADT_UTILS. INSERT TEXTPOOL fully replaces the
 * language-specific pool, so WRITE must always carry the complete
 * array (fetch → modify → write back). The FM writes with STATE 'A'
 * so the text pool becomes active in one round-trip (matching the
 * CUA/DYNPRO dispatcher semantics).
 *
 * @param action 'READ' | 'WRITE' | 'WRITE_INACTIVE' — WRITE_INACTIVE stages
 *   the whole pool with STATE 'I' so the parent program's activation
 *   promotes the pool atomically. Use it when registering many elements
 *   on a not-yet-activated program.
 * @param params program/language/textpool_json
 */
export async function callTextpool(
  connection: IAbapConnection,
  action: 'READ' | 'WRITE' | 'WRITE_INACTIVE',
  params: {
    program: string;
    language?: string;
    textpool_json?: string;
  },
): Promise<TextpoolResult> {
  const { raw } = await callSoapRfc(connection, 'ZMCP_ADT_TEXTPOOL', {
    IV_ACTION: action,
    IV_PROGRAM: params.program,
    IV_LANGUAGE: params.language ?? '',
    IV_TEXTPOOL_JSON: params.textpool_json ?? '',
  });

  const subrc = Number(raw.EV_SUBRC ?? raw.ev_subrc ?? 0);
  const message = String(raw.EV_MESSAGE ?? raw.ev_message ?? '');
  const resultStr = String(raw.EV_RESULT ?? raw.ev_result ?? '[]');

  let result: any;
  try {
    result = JSON.parse(resultStr);
  } catch {
    result = resultStr;
  }

  if (subrc !== 0) {
    throw new Error(
      `ZMCP_ADT_TEXTPOOL error (action=${action}, subrc=${subrc}): ${message}`,
    );
  }

  return { result, subrc, message };
}
