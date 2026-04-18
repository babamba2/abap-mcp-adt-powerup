/**
 * Runtime feeds helper — Atom XML parsers, feed URLs, query builder.
 *
 * Ported from fr0ster/mcp-abap-adt's FeedRepository (v5 adt-clients) so that
 * powerup can expose fr0ster's feed tools (RuntimeListSystemMessages,
 * RuntimeGetGatewayErrorLog, RuntimeListFeeds) while still pinned to
 * @babamba2/mcp-abap-adt-clients ^3.10.2, where getFeeds() returns a raw Axios
 * response instead of the IFeedRepository facade.
 *
 * Covers three ADT feeds:
 *   - /sap/bc/adt/runtime/dumps
 *   - /sap/bc/adt/runtime/systemmessages
 *   - /sap/bc/adt/gw/errorlog
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { XMLParser } from 'fast-xml-parser';
import { makeAdtRequestWithTimeout } from '../../../lib/utils';

export const FEED_URLS = {
  dumps: '/sap/bc/adt/runtime/dumps',
  systemMessages: '/sap/bc/adt/runtime/systemmessages',
  gatewayErrors: '/sap/bc/adt/gw/errorlog',
} as const;

export interface IFeedQueryOptions {
  user?: string;
  maxResults?: number;
  from?: string;
  to?: string;
}

export interface IFeedDescriptor {
  id: string;
  title: string;
  url: string;
  category?: string;
}

export interface IFeedVariant {
  id: string;
  title: string;
  url: string;
}

export interface IFeedEntry {
  id: string;
  title: string;
  updated: string;
  link: string;
  content: string;
  author?: string;
  category?: string;
}

export interface ISystemMessageEntry {
  id: string;
  title: string;
  text: string;
  severity: string;
  validFrom: string;
  validTo: string;
  createdBy: string;
}

export interface IGatewayErrorEntry {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: string;
  username: string;
  client: string;
  requestKind: string;
  link?: string;
}

/**
 * Enriched ST22 runtime-dump feed entry — fields sourced from atom:category,
 * atom:author, atom:published, atom:link[rel=self] and the embedded HTML
 * summary (Short Text / Runtime Error / Exception / Program / App Component /
 * Date/Time / User / Client / Host).
 */
export interface IDumpFeedEntry {
  id: string;
  dumpId: string;
  detailUrl: string;
  published: string;
  updated: string;
  shortText: string;
  runtimeError: string;
  exception: string;
  program: string;
  applicationComponent: string;
  dateTime: string;
  user: string;
  client: string;
  host: string;
}

export interface ICallStackEntry {
  number: number | string;
  event: string;
  program: string;
  name: string;
  line: number | string;
}

export interface ISourceCodeLine {
  number: number | string;
  content: string;
  isError: boolean;
}

export interface IGatewayException {
  type: string;
  text: string;
  raiseLocation: string;
}

export interface IGatewayErrorDetail {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: string;
  username: string;
  client: string;
  requestKind: string;
  serviceInfo: {
    namespace: string;
    serviceName: string;
    serviceVersion: string;
    groupId: string;
    serviceRepository: string;
    destination: string;
  };
  errorContext: {
    errorInfo: string;
    resolution: Record<string, unknown>;
    exceptions: IGatewayException[];
  };
  sourceCode: {
    lines: ISourceCodeLine[];
    errorLine: number | string;
  };
  callStack: ICallStackEntry[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  processEntities: false,
});

function extractText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec['#text'] === 'string') return rec['#text'] as string;
    if (typeof rec['#text'] === 'number') return String(rec['#text']);
    return '';
  }
  return String(value);
}

function extractCategoryTerm(entry: any): string | undefined {
  const cat = entry?.category;
  if (!cat) return undefined;
  if (typeof cat === 'object') return cat['@_term'];
  return String(cat);
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Decode HTML entities commonly found in ADT feed `<atom:summary type="html">`
 * payloads (nbsp, lt, gt, amp, quot, ndash, mdash, numeric refs).
 */
function decodeHtmlEntitiesOnce(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-fA-F]+);/g, (_m, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

/**
 * ADT feeds frequently double-encode HTML (e.g. `&amp;nbsp;`) because the
 * `<atom:summary>` body is already escaped for XML. Run the decoder until
 * the string is stable so both layers unwind.
 */
function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  let prev = input;
  for (let i = 0; i < 3; i += 1) {
    const next = decodeHtmlEntitiesOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/**
 * Parse the `<b>Label</b></td><td>value</td>` tables embedded inside ADT feed
 * `<atom:summary type="html">` content. Returns a Map keyed by normalized
 * lowercase label ("short text", "runtime error", ...). Strips inner tags and
 * trims whitespace.
 */
export function parseHtmlSummaryTable(
  summaryHtml: string,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!summaryHtml) return map;
  // The helper accepts either already-decoded HTML or escaped-inside-XML HTML.
  // If we see `&lt;b&gt;`, decode once.
  const decoded = summaryHtml.includes('&lt;')
    ? decodeHtmlEntities(summaryHtml)
    : summaryHtml;
  const rowRegex =
    /<b[^>]*>\s*([^<]+?)\s*<\/b>\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>/gi;
  let m: RegExpExecArray | null = rowRegex.exec(decoded);
  while (m) {
    const label = m[1]
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const rawValue = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (label && !map.has(label)) {
      map.set(label, rawValue);
    }
    m = rowRegex.exec(decoded);
  }
  return map;
}

/**
 * Convert Gateway `atom:id` prefix ("FrontendError", "BackendError", ...) to
 * the human-readable label used throughout SAP UIs ("Frontend Error", ...).
 */
function prettyTypeFromIdPrefix(prefix: string): string {
  if (!prefix) return '';
  return prefix
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build query string for feed URLs.
 * userAttribute differs per feed: 'user' for dumps/systemMessages, 'username'
 * for gateway errors.
 */
export function buildFeedQueryParams(
  options?: IFeedQueryOptions,
  userAttribute: string = 'user',
): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.user) {
    params.set(
      '$query',
      `and ( equals ( ${userAttribute} , ${options.user.trim()} ) )`,
    );
  }
  if (options.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Fetch a feed URL with optional query params. Accept header set to Atom XML.
 */
export async function fetchFeed(
  connection: IAbapConnection,
  feedUrl: string,
  options?: IFeedQueryOptions,
  userAttribute?: string,
) {
  const url = `${feedUrl}${buildFeedQueryParams(options, userAttribute)}`;
  return makeAdtRequestWithTimeout(
    connection,
    url,
    'GET',
    'default',
    undefined,
    undefined,
    {
      Accept: 'application/atom+xml;type=feed',
    },
  );
}

export function parseAtomFeed(xml: string): IFeedEntry[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];
  return toArray<any>(feed.entry).map((entry) => ({
    id: entry.id ?? '',
    title: extractText(entry.title),
    updated: entry.updated ?? '',
    link: entry.link?.['@_href'] ?? '',
    content: extractText(entry.content),
    author: entry.author?.name,
    category: extractCategoryTerm(entry),
  }));
}

export function parseFeedDescriptors(xml: string): IFeedDescriptor[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];
  return toArray<any>(feed.entry).map((entry) => ({
    id: entry.id ?? '',
    title: extractText(entry.title),
    url: entry.link?.['@_href'] ?? '',
    category: extractCategoryTerm(entry),
  }));
}

export function parseFeedVariants(xml: string): IFeedVariant[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];
  return toArray<any>(feed.entry).map((entry) => ({
    id: entry.id ?? '',
    title: extractText(entry.title),
    url: entry.link?.['@_href'] ?? '',
  }));
}

export function parseSystemMessages(xml: string): ISystemMessageEntry[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];
  return toArray<any>(feed.entry).map((entry) => ({
    id: entry.id ?? '',
    title: extractText(entry.title),
    text: extractText(entry.content),
    severity: String(
      entry.severity ??
        entry['sm:severity'] ??
        entry.category?.['@_term'] ??
        '',
    ),
    validFrom: String(
      entry.validFrom ?? entry['sm:validFrom'] ?? entry.updated ?? '',
    ),
    validTo: String(entry.validTo ?? entry['sm:validTo'] ?? ''),
    createdBy: entry.author?.name ?? '',
  }));
}

export function parseGatewayErrors(xml: string): IGatewayErrorEntry[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];
  return toArray<any>(feed.entry).map((entry) => {
    // atom:id carries the entry type as a prefix, e.g.
    // "FrontendError/020000DD4A3B..." → "Frontend Error".
    const rawId: string = typeof entry.id === 'string' ? entry.id : '';
    const slashIdx = rawId.indexOf('/');
    const idPrefix = slashIdx > 0 ? rawId.slice(0, slashIdx) : '';
    // Fallback: some feeds still use <atom:category term="...">.
    const type =
      prettyTypeFromIdPrefix(idPrefix) || extractCategoryTerm(entry) || '';

    // Everything else lives inside the embedded HTML summary table.
    const summaryHtml =
      typeof entry.summary === 'object'
        ? extractText(entry.summary)
        : String(entry.summary ?? '');
    const table = parseHtmlSummaryTable(summaryHtml);

    // Transaction ID cell contains extra "(Replay in GW Client)" link — strip
    // everything from the first whitespace onward to isolate the GUID.
    const rawTxId = table.get('transaction id') ?? '';
    const transactionId = rawTxId.split(/\s+/)[0] ?? '';

    // The title cell for GW entries is redundant; prefer the short-text row.
    const shortText = table.get('short text') ?? extractText(entry.title) ?? '';

    // Compose a fetchable detail URL. GW entries often lack <atom:link>, so
    // synthesize /sap/bc/adt/gw/errorlog/{Pretty Type}/{GUID} from atom:id.
    const hrefFromLink = entry.link?.['@_href'];
    const guid = slashIdx > 0 ? rawId.slice(slashIdx + 1) : '';
    const synthesizedLink =
      type && guid
        ? `/sap/bc/adt/gw/errorlog/${encodeURIComponent(type)}/${guid}`
        : '';
    const link = hrefFromLink || synthesizedLink;

    return {
      type,
      shortText,
      transactionId,
      package: table.get('package') ?? '',
      applicationComponent: table.get('application component') ?? '',
      dateTime: entry.updated ?? '',
      username: entry.author?.name ?? '',
      client: table.get('client') ?? '',
      requestKind: table.get('request kind') ?? '',
      link,
    };
  });
}

/**
 * Enriched parser for ST22 `/sap/bc/adt/runtime/dumps` Atom feed. Extracts
 * program, user, exception, host, etc. directly from the feed's embedded
 * HTML summary so callers don't need a per-dump detail fetch.
 */
export function parseRuntimeDumpFeed(xml: string): IDumpFeedEntry[] {
  const parsed = xmlParser.parse(xml);
  const feed = parsed?.feed;
  if (!feed?.entry) return [];

  return toArray<any>(feed.entry).map((entry) => {
    const id: string = typeof entry.id === 'string' ? entry.id : '';
    // Dump ID is the last path segment of atom:id.
    const dumpId = id.split('/').pop() ?? '';

    // Entries typically carry two category terms — first is the runtime
    // error code (e.g. COMPUTE_INT_PLUS_OVERFLOW), second is the program.
    let runtimeError = '';
    let programFromCategory = '';
    const cats = toArray<any>(entry.category);
    if (cats.length > 0) {
      runtimeError = cats[0]?.['@_term'] ?? '';
    }
    if (cats.length > 1) {
      programFromCategory = cats[1]?.['@_term'] ?? '';
    }

    // atom:link with rel=self carries the canonical dump-detail URL.
    const selfLink = toArray<any>(entry.link).find(
      (l) => l?.['@_rel'] === 'self',
    );
    const detailUrl = selfLink?.['@_href'] ?? '';

    // Parse the rich HTML summary for human-facing fields.
    const summaryHtml =
      typeof entry.summary === 'object'
        ? extractText(entry.summary)
        : String(entry.summary ?? '');
    const table = parseHtmlSummaryTable(summaryHtml);

    return {
      id,
      dumpId,
      detailUrl,
      published: entry.published ?? '',
      updated: entry.updated ?? '',
      shortText: table.get('short text') ?? '',
      // Prefer the HTML row, but empty-string cells fall through to the
      // category term so category info is not lost when a row exists but is
      // blank.
      runtimeError: table.get('runtime error') || runtimeError,
      exception: table.get('exception') ?? '',
      program: table.get('program') || programFromCategory,
      applicationComponent: table.get('application component') ?? '',
      dateTime: table.get('date/time') ?? '',
      user: table.get('user') || entry.author?.name || '',
      client: table.get('client') ?? '',
      host: table.get('host') ?? '',
    };
  });
}

export function parseGatewayErrorDetail(xml: string): IGatewayErrorDetail {
  const parsed = xmlParser.parse(xml);
  const root =
    parsed?.['errorlog:errorEntry'] ?? parsed?.['errorEntry'] ?? parsed ?? {};

  const callStackRaw =
    root['errorlog:callStack']?.['errorlog:entry'] ??
    root.callStack?.entry ??
    [];
  const callStack: ICallStackEntry[] = toArray<any>(callStackRaw).map(
    (e, idx) => ({
      number: e['@_number'] ?? idx,
      event: e['@_event'] ?? '',
      program: e['@_program'] ?? '',
      name: e['@_name'] ?? '',
      line: e['@_line'] ?? 0,
    }),
  );

  const linesRaw =
    root['errorlog:sourceCode']?.['errorlog:line'] ??
    root.sourceCode?.line ??
    [];
  const sourceLines: ISourceCodeLine[] = toArray<any>(linesRaw).map(
    (l, idx) => ({
      number: l?.['@_number'] ?? idx,
      content: extractText(l),
      isError: l?.['@_isError'] === 'true' || l?.['@_isError'] === true,
    }),
  );

  const exceptionsRaw =
    root['errorlog:errorContext']?.['errorlog:exceptions']?.[
      'errorlog:exception'
    ] ??
    root.errorContext?.exceptions?.exception ??
    [];
  const exceptions: IGatewayException[] = toArray<any>(exceptionsRaw).map(
    (ex) => ({
      type: ex?.['@_type'] ?? '',
      text: extractText(ex),
      raiseLocation: ex?.['@_raiseLocation'] ?? '',
    }),
  );

  const serviceInfo = root['errorlog:serviceInfo'] ?? root.serviceInfo ?? {};

  return {
    type: root['@_type'] ?? '',
    shortText: root['errorlog:shortText'] ?? root.shortText ?? '',
    transactionId: root['errorlog:transactionId'] ?? root.transactionId ?? '',
    package: root['errorlog:package'] ?? root.package ?? '',
    applicationComponent:
      root['errorlog:applicationComponent'] ?? root.applicationComponent ?? '',
    dateTime: root['errorlog:dateTime'] ?? root.dateTime ?? '',
    username: root['errorlog:username'] ?? root.username ?? '',
    client: root['errorlog:client'] ?? root.client ?? '',
    requestKind: root['errorlog:requestKind'] ?? root.requestKind ?? '',
    serviceInfo: {
      namespace: serviceInfo['@_namespace'] ?? '',
      serviceName: serviceInfo['@_serviceName'] ?? '',
      serviceVersion: serviceInfo['@_serviceVersion'] ?? '',
      groupId: serviceInfo['@_groupId'] ?? '',
      serviceRepository: serviceInfo['@_serviceRepository'] ?? '',
      destination: serviceInfo['@_destination'] ?? '',
    },
    errorContext: {
      errorInfo:
        root['errorlog:errorContext']?.['errorlog:errorInfo'] ??
        root.errorContext?.errorInfo ??
        '',
      resolution: {},
      exceptions,
    },
    sourceCode: {
      lines: sourceLines,
      errorLine:
        root['errorlog:sourceCode']?.['@_errorLine'] ??
        root.sourceCode?.['@_errorLine'] ??
        0,
    },
    callStack,
  };
}
