/**
 * Transport request reads for BASIS < 7.40 (e.g. 7.31).
 *
 * The ADT transport organizer (/sap/bc/adt/cts/transportrequests) does not
 * exist there: the URL answers 200 with an empty text/html body, and the
 * /sap/bc/cts/* collections listed in discovery answer 404. The request
 * header, its tasks and their objects are read from E070 / E07T / E071 with
 * the standard RFC-enabled RFC_READ_TABLE over SOAP RFC (/sap/bc/soap/rfc),
 * so no custom ABAP is needed.
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { XMLParser } from 'fast-xml-parser';
import { makeAdtRequestWithTimeout } from './utils';

const SOAP_RFC_PATH = '/sap/bc/soap/rfc';
const URN_NS = 'urn:sap-com:document:sap:rfc:functions';
const DELIMITER = '|';
/** RFC_READ_TABLE OPTIONS rows are CHAR 72. */
const OPTION_LINE_MAX = 72;

/** True on BASIS releases without the ADT transport organizer. */
export function needsLegacyTransportRead(): boolean {
  const release = parseInt(process.env.ABAP_RELEASE || '', 10);
  return !Number.isNaN(release) && release < 740;
}

const TYPE_TEXT: Record<string, string> = {
  K: 'Workbench request',
  W: 'Customizing request',
  T: 'Transport of copies',
  C: 'Relocation without package change',
  O: 'Relocation with package change',
  E: 'Relocation of complete package',
  S: 'Development/correction task',
  R: 'Repair task',
  Q: 'Customizing task',
  X: 'Unclassified task',
};

const STATUS_TEXT: Record<string, string> = {
  D: 'Modifiable',
  L: 'Modifiable, protected',
  O: 'Release started',
  R: 'Released',
  N: 'Released (with import protection for repaired objects)',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Splits a WHERE clause into <= 72 character OPTIONS rows at spaces. */
export function splitOptionLines(where: string): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of where.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > OPTION_LINE_MAX && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** `FIELD IN ('A','B')` written as OR terms, which RFC_READ_TABLE accepts. */
function inClause(field: string, values: string[]): string {
  return `( ${values.map((v) => `${field} = '${v}'`).join(' OR ')} )`;
}

/**
 * RFC_READ_TABLE over SOAP. Returns one object per row keyed by field name,
 * values trimmed. The last field may contain the delimiter (free text).
 */
export async function readTableViaSoap(
  connection: IAbapConnection,
  table: string,
  fields: string[],
  where: string,
): Promise<Record<string, string>[]> {
  const options = splitOptionLines(where)
    .map((line) => `<item><TEXT>${escapeXml(line)}</TEXT></item>`)
    .join('');
  const fieldXml = fields
    .map((f) => `<item><FIELDNAME>${f}</FIELDNAME></item>`)
    .join('');
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="${URN_NS}">
  <soap-env:Body>
    <urn:RFC_READ_TABLE>
      <QUERY_TABLE>${table}</QUERY_TABLE>
      <DELIMITER>${DELIMITER}</DELIMITER>
      <OPTIONS>${options}</OPTIONS>
      <FIELDS>${fieldXml}</FIELDS>
      <DATA/>
    </urn:RFC_READ_TABLE>
  </soap-env:Body>
</soap-env:Envelope>`;

  const response = await makeAdtRequestWithTimeout(
    connection,
    SOAP_RFC_PATH,
    'POST',
    'long',
    envelope,
    undefined,
    { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: URN_NS },
  );
  const xml =
    typeof response.data === 'string' ? response.data : String(response.data);
  const parsed = new XMLParser({
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
    isArray: (name) => name === 'item',
  }).parse(xml);
  const body = parsed?.Envelope?.Body;
  if (body?.Fault) {
    const f = body.Fault;
    throw new Error(
      `RFC_READ_TABLE ${table}: ${f.detail?.Error?.message || f.faultstring || 'SOAP fault'}`,
    );
  }
  const rows = body?.['RFC_READ_TABLE.Response']?.DATA?.item ?? [];
  return rows.map((row: { WA?: string }) => {
    const parts = String(row.WA ?? '').split(DELIMITER);
    const out: Record<string, string> = {};
    fields.forEach((f, i) => {
      const value =
        i === fields.length - 1 ? parts.slice(i).join(DELIMITER) : parts[i];
      out[f] = (value ?? '').trim();
    });
    return out;
  });
}

/** Request numbers per E07T read, so the WHERE clause stays small. */
const TEXT_CHUNK = 100;

/** E07T descriptions, logon language first; returns a lookup by number. */
async function readTexts(
  connection: IAbapConnection,
  numbers: string[],
): Promise<(nr: string) => string | undefined> {
  const texts: Record<string, string>[] = [];
  for (let i = 0; i < numbers.length; i += TEXT_CHUNK) {
    texts.push(
      ...(await readTableViaSoap(
        connection,
        'E07T',
        ['TRKORR', 'LANGU', 'AS4TEXT'],
        inClause('TRKORR', numbers.slice(i, i + TEXT_CHUNK)),
      )),
    );
  }
  const logon = (process.env.SAP_LANGUAGE || '').toUpperCase().slice(0, 1);
  return (nr: string) => {
    const rows = texts.filter((t) => t.TRKORR === nr);
    return (rows.find((t) => t.LANGU === logon) || rows[0])?.AS4TEXT;
  };
}

interface LegacyObject {
  name: string;
  type: string;
  pgmid: string;
  position: number;
  lock_status: string;
  task: string;
}

/**
 * Reads one transport request (or task) with its tasks and objects.
 * Returns null when E070 has no such request.
 */
export async function readTransportLegacy(
  connection: IAbapConnection,
  trNumber: string,
  includeObjects: boolean,
  includeTasks: boolean,
) {
  const nr = trNumber.toUpperCase();
  const headers = await readTableViaSoap(
    connection,
    'E070',
    [
      'TRKORR',
      'TRFUNCTION',
      'TRSTATUS',
      'TARSYSTEM',
      'AS4USER',
      'AS4DATE',
      'AS4TIME',
      'STRKORR',
    ],
    `TRKORR = '${nr}' OR STRKORR = '${nr}'`,
  );
  const request = headers.find((h) => h.TRKORR === nr);
  if (!request) return null;
  const tasks = headers.filter((h) => h.STRKORR === nr);
  const numbers = [nr, ...tasks.map((t) => t.TRKORR)];

  const textOf = await readTexts(connection, numbers);

  let objects: LegacyObject[] = [];
  if (includeObjects || includeTasks) {
    const rows = await readTableViaSoap(
      connection,
      'E071',
      ['TRKORR', 'AS4POS', 'PGMID', 'OBJECT', 'LOCKFLAG', 'OBJ_NAME'],
      inClause('TRKORR', numbers),
    );
    objects = rows.map((r) => ({
      name: r.OBJ_NAME,
      type: r.OBJECT,
      pgmid: r.PGMID,
      position: Number(r.AS4POS) || 0,
      lock_status: r.LOCKFLAG,
      task: r.TRKORR,
    }));
  }

  const stamp = (date: string, time: string) =>
    date && date !== '00000000'
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
      : undefined;

  const transport = {
    number: nr,
    description: textOf(nr),
    type: request.TRFUNCTION,
    type_text: TYPE_TEXT[request.TRFUNCTION],
    status: request.TRSTATUS,
    status_text: STATUS_TEXT[request.TRSTATUS],
    owner: request.AS4USER,
    target_system: request.TARSYSTEM || undefined,
    changed_at: stamp(request.AS4DATE, request.AS4TIME),
    parent: request.STRKORR || undefined,
  };

  const taskList = tasks.map((t) => ({
    number: t.TRKORR,
    parent: nr,
    description: textOf(t.TRKORR),
    type: t.TRFUNCTION,
    type_text: TYPE_TEXT[t.TRFUNCTION],
    status: t.TRSTATUS,
    status_text: STATUS_TEXT[t.TRSTATUS],
    owner: t.AS4USER,
    changed_at: stamp(t.AS4DATE, t.AS4TIME),
    objects: objects
      .filter((o) => o.task === t.TRKORR)
      .map(({ task: _task, ...o }) => o),
  }));

  const allObjects = objects.map(({ task: _task, ...o }) => o);
  return {
    transport,
    objects: includeObjects ? allObjects : undefined,
    tasks: includeTasks ? taskList : undefined,
    object_count: allObjects.length,
    task_count: taskList.length,
  };
}

/**
 * Lists a user's transport requests (not tasks), like the ADT transport
 * organizer list: modifiable only (status D / L) unless told otherwise.
 */
export async function listTransportsLegacy(
  connection: IAbapConnection,
  user: string,
  modifiableOnly: boolean,
) {
  const status = modifiableOnly
    ? ` AND ( TRSTATUS = 'D' OR TRSTATUS = 'L' )`
    : '';
  const rows = await readTableViaSoap(
    connection,
    'E070',
    ['TRKORR', 'TRFUNCTION', 'TRSTATUS', 'TARSYSTEM', 'AS4USER'],
    `AS4USER = '${user.toUpperCase()}' AND STRKORR = ' '${status}`,
  );
  const textOf = await readTexts(
    connection,
    rows.map((r) => r.TRKORR),
  );
  return rows
    .map((r) => ({
      number: r.TRKORR,
      description: textOf(r.TRKORR) || '',
      type: r.TRFUNCTION,
      status: r.TRSTATUS,
      owner: r.AS4USER,
      target: r.TARSYSTEM,
    }))
    .sort((a, b) => b.number.localeCompare(a.number));
}
