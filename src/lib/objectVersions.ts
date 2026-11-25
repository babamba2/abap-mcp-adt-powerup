/**
 * Source versions of ABAP objects (SE38 / SE80 "Versions", Eclipse ADT
 * "Compare With → Revision").
 *
 * Primary path: the ADT revision feed of an object's source,
 *   GET <source uri>/versions            (Atom feed, one entry per version)
 *   GET <entry content uri>              (the source text of that version)
 * Fallback for systems without the feed: the version directory VRSD read
 * through ZMCP_ADT_DISPATCH TABLE_READ (list only — the version source then
 * needs a dispatcher action, not part of this module).
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { XMLParser } from 'fast-xml-parser';
import { legacyTableRead } from './legacyTableRead';
import { resolveAdtUri } from './resolveAdtUri';
import { makeAdtRequest } from './utils';

/** Object types whose source has versions. */
export const VERSIONED_TYPES = [
  'PROG/P',
  'PROG/I',
  'CLAS/OC',
  'INTF/OI',
  'FUGR/FF',
] as const;

/** Class source parts that ADT versions one by one. */
export const CLASS_INCLUDES = [
  'main',
  'definitions',
  'implementations',
  'macros',
  'testclasses',
] as const;

export interface VersionTarget {
  object_type: string;
  object_name: string;
  /** function group of a function module (FUGR/FF) */
  function_group?: string;
  /** class part (CLAS/OC); default main */
  class_include?: string;
}

export interface ObjectVersion {
  /** version number as SAP shows it (00000 = the active / newest one in the feed) */
  version: string;
  /** ISO time of the version */
  date: string;
  author: string;
  /** transport request the version was created with, if any */
  transport: string;
  /** short text of the version (feed title), if any */
  title: string;
  /** ADT URI that returns this version's source; empty in the VRSD fallback */
  content_uri: string;
}

/** Normalises the type the caller gave (PROG, CLAS, FUNC …) to an ADT type with a slash. */
export function normaliseType(t: string): string {
  const u = String(t ?? '')
    .toUpperCase()
    .trim();
  const map: Record<string, string> = {
    PROG: 'PROG/P',
    REPS: 'PROG/P',
    INCLUDE: 'PROG/I',
    PROGI: 'PROG/I',
    CLAS: 'CLAS/OC',
    INTF: 'INTF/OI',
    FUNC: 'FUGR/FF',
    FM: 'FUGR/FF',
  };
  return map[u] ?? u;
}

/**
 * ADT URI of the version feed of one object's source.
 * @throws when the type has no versioned source or a needed parent is missing
 */
export function versionsUri(target: VersionTarget): string {
  const type = normaliseType(target.object_type);
  if (!(VERSIONED_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `object_type ${target.object_type} has no source versions here; use one of ${VERSIONED_TYPES.join(', ')}`,
    );
  }
  if (type === 'FUGR/FF' && !target.function_group) {
    throw new Error(
      'function_group is required for a function module (FUGR/FF)',
    );
  }
  const base = resolveAdtUri({
    name: target.object_name,
    type,
    parentName: target.function_group,
  });
  if (type === 'CLAS/OC') {
    const part = (target.class_include ?? 'main').toLowerCase();
    if (!(CLASS_INCLUDES as readonly string[]).includes(part)) {
      throw new Error(
        `class_include must be one of ${CLASS_INCLUDES.join(', ')}`,
      );
    }
    return `${base}/includes/${part}/versions`;
  }
  return `${base}/source/main/versions`;
}

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const text = (v: unknown): string =>
  v === undefined || v === null
    ? ''
    : typeof v === 'object'
      ? String((v as Record<string, unknown>)['#text'] ?? '')
      : String(v);

/** Strips the host from an absolute URI, so the request goes through the same connection. */
export function adtPath(uri: string): string {
  if (!/^https?:/i.test(uri)) return uri;
  try {
    const u = new URL(uri);
    return `${u.pathname}${u.search}`;
  } catch {
    return uri;
  }
}

/**
 * Parses the ADT revision feed into versions, newest first as SAP sends them.
 * Tolerant: an entry without a content link is kept with an empty content_uri.
 */
export function parseVersionsFeed(xml: string): ObjectVersion[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    // keep '00007' / '00123' as text — no number conversion
    parseTagValue: false,
    parseAttributeValue: false,
  });
  const doc = parser.parse(String(xml ?? ''));
  const entries = asArray(doc?.feed?.entry);
  return entries.map((e: any) => {
    const links = asArray<any>(e.link);
    const contentLink =
      (e.content && typeof e.content === 'object' && e.content.src) ||
      links.find(
        (l) =>
          /relations\/content$|\/content$/.test(String(l.rel ?? '')) ||
          /\/content$/.test(String(l.href ?? '')),
      )?.href ||
      '';
    const trLink = links.find((l) => /transport/i.test(String(l.rel ?? '')));
    // content URI: …/versions/<yyyymmddhhmmss>/<version no>/content
    const m = /\/versions\/[^/]+\/(\d+)\/content/.exec(String(contentLink));
    return {
      version: m?.[1] ?? text(e.id).split('/').pop() ?? '',
      date: text(e.updated),
      author: text(e.author?.name ?? e.author),
      transport: String(trLink?.name ?? trLink?.title ?? '').trim(),
      title: text(e.title),
      content_uri: contentLink ? adtPath(String(contentLink)) : '',
    };
  });
}

/** VRSD object type and name of a target (version directory keys). */
export function vrsdKey(target: VersionTarget): {
  objtype: string;
  objname: string;
} {
  const type = normaliseType(target.object_type);
  const name = target.object_name.toUpperCase();
  switch (type) {
    case 'PROG/P':
    case 'PROG/I':
      return { objtype: 'REPS', objname: name };
    case 'FUGR/FF':
      return { objtype: 'FUNC', objname: name };
    case 'INTF/OI':
      return { objtype: 'INTF', objname: name };
    case 'CLAS/OC':
      return { objtype: 'CLSD', objname: name };
    default:
      throw new Error(`no version directory key for ${target.object_type}`);
  }
}

/** True when an ADT error means "this system has no version feed for it" (fall back), not a real failure. */
export function isFeedMissing(e: unknown): boolean {
  const status = (e as any)?.response?.status ?? (e as any)?.status;
  // With an HTTP status, the status alone decides: 401 / 403 / 400 / 500 bodies
  // often say "not found" or "not supported" and must still be reported.
  if (status !== undefined && status !== null && status !== '')
    return [404, 405, 501].includes(Number(status));
  return /not found|not supported|no resource|does not exist/i.test(
    String((e as Error)?.message ?? e),
  );
}

/** Versions from the ADT feed. */
export async function readVersionsFeed(
  connection: IAbapConnection,
  target: VersionTarget,
): Promise<ObjectVersion[]> {
  const resp = await makeAdtRequest(
    connection,
    versionsUri(target),
    'GET',
    30000,
    undefined,
    undefined,
    {
      Accept: 'application/atom+xml;type=feed',
    },
  );
  return parseVersionsFeed(
    typeof resp.data === 'string' ? resp.data : String(resp.data ?? ''),
  );
}

/** VRSD rows read per object: all of them in practice, so "newest N" is cut after sorting. */
export const VRSD_ROW_CAP = 5000;

/**
 * Versions from VRSD through the dispatcher (list only), newest first.
 * TABLE_READ has no ORDER BY, so every row (up to VRSD_ROW_CAP) is read and
 * sorted here; the caller cuts the newest N.
 */
export async function readVersionsVrsd(
  connection: IAbapConnection,
  target: VersionTarget,
  maxRows: number = VRSD_ROW_CAP,
): Promise<ObjectVersion[]> {
  const { objtype, objname } = vrsdKey(target);
  const res: any = await legacyTableRead(connection, {
    table: 'VRSD',
    fields: ['VERSNO', 'KORRNUM', 'AUTHOR', 'DATUM', 'ZEIT'],
    where: `OBJTYPE = '${objtype}' AND OBJNAME = '${objname.replace(/'/g, "''")}'`,
    maxRows,
  });
  const rows: any[] = res?.rows ?? [];
  return rows
    .map((r) => ({
      version: String(r.VERSNO ?? '').padStart(5, '0'),
      date: `${String(r.DATUM ?? '')}${r.ZEIT ? `T${String(r.ZEIT)}` : ''}`,
      author: String(r.AUTHOR ?? ''),
      transport: String(r.KORRNUM ?? ''),
      title: '',
      content_uri: '',
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// One object name in a URI: letters, digits, '_' and the encoded namespace slash
// '%2f' only — so no '.', '..', '%2e', '\', '%5c' or other encoded byte gets in.
const URI_NAME = '(?:[a-z0-9_]|%2f)+';
const VERSION_CONTENT_URI = new RegExp(
  '^/sap/bc/adt/' +
    `(?:programs/programs|programs/includes|oo/classes|oo/interfaces|functions/groups/${URI_NAME}/fmodules)` +
    `/${URI_NAME}` +
    `/(?:source/main|includes/(?:${CLASS_INCLUDES.join('|')}))` +
    '/versions/\\d{1,14}/\\d{1,5}/content$',
  'i',
);

/**
 * Only version content URIs are read by GetObjectVersionSource — the guard that
 * keeps the tool from becoming a generic GET: a fixed object root, one name
 * segment per level, a source part, `/versions/<timestamp>/<number>/content`,
 * and a path that URL normalisation leaves unchanged (no dot segments).
 */
export function isVersionContentUri(uri: string): boolean {
  const p = adtPath(String(uri ?? ''));
  if (!VERSION_CONTENT_URI.test(p)) return false;
  try {
    return new URL(p, 'http://x').pathname === p;
  } catch {
    return false;
  }
}

/** Source text of one version. */
export async function readVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<string> {
  const path = adtPath(contentUri);
  if (!isVersionContentUri(path))
    throw new Error(`not a version content URI: ${contentUri}`);
  const resp = await makeAdtRequest(
    connection,
    path,
    'GET',
    30000,
    undefined,
    undefined,
    { Accept: 'text/plain' },
  );
  return typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
}
