"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VRSD_ROW_CAP = exports.CLASS_INCLUDES = exports.VERSIONED_TYPES = void 0;
exports.normaliseType = normaliseType;
exports.versionsUri = versionsUri;
exports.adtPath = adtPath;
exports.parseVersionsFeed = parseVersionsFeed;
exports.vrsdKey = vrsdKey;
exports.isFeedMissing = isFeedMissing;
exports.readVersionsFeed = readVersionsFeed;
exports.readVersionsVrsd = readVersionsVrsd;
exports.isVersionContentUri = isVersionContentUri;
exports.readVersionSource = readVersionSource;
const fast_xml_parser_1 = require("fast-xml-parser");
const legacyTableRead_1 = require("./legacyTableRead");
const resolveAdtUri_1 = require("./resolveAdtUri");
const utils_1 = require("./utils");
/** Object types whose source has versions. */
exports.VERSIONED_TYPES = [
    'PROG/P',
    'PROG/I',
    'CLAS/OC',
    'INTF/OI',
    'FUGR/FF',
];
/** Class source parts that ADT versions one by one. */
exports.CLASS_INCLUDES = [
    'main',
    'definitions',
    'implementations',
    'macros',
    'testclasses',
];
/** Normalises the type the caller gave (PROG, CLAS, FUNC …) to an ADT type with a slash. */
function normaliseType(t) {
    const u = String(t ?? '')
        .toUpperCase()
        .trim();
    const map = {
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
function versionsUri(target) {
    const type = normaliseType(target.object_type);
    if (!exports.VERSIONED_TYPES.includes(type)) {
        throw new Error(`object_type ${target.object_type} has no source versions here; use one of ${exports.VERSIONED_TYPES.join(', ')}`);
    }
    if (type === 'FUGR/FF' && !target.function_group) {
        throw new Error('function_group is required for a function module (FUGR/FF)');
    }
    const base = (0, resolveAdtUri_1.resolveAdtUri)({
        name: target.object_name,
        type,
        parentName: target.function_group,
    });
    if (type === 'CLAS/OC') {
        const part = (target.class_include ?? 'main').toLowerCase();
        if (!exports.CLASS_INCLUDES.includes(part)) {
            throw new Error(`class_include must be one of ${exports.CLASS_INCLUDES.join(', ')}`);
        }
        return `${base}/includes/${part}/versions`;
    }
    return `${base}/source/main/versions`;
}
const asArray = (v) => v === undefined ? [] : Array.isArray(v) ? v : [v];
const text = (v) => v === undefined || v === null
    ? ''
    : typeof v === 'object'
        ? String(v['#text'] ?? '')
        : String(v);
/** Strips the host from an absolute URI, so the request goes through the same connection. */
function adtPath(uri) {
    if (!/^https?:/i.test(uri))
        return uri;
    try {
        const u = new URL(uri);
        return `${u.pathname}${u.search}`;
    }
    catch {
        return uri;
    }
}
/**
 * Parses the ADT revision feed into versions, newest first as SAP sends them.
 * Tolerant: an entry without a content link is kept with an empty content_uri.
 */
function parseVersionsFeed(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        removeNSPrefix: true,
        // keep '00007' / '00123' as text — no number conversion
        parseTagValue: false,
        parseAttributeValue: false,
    });
    const doc = parser.parse(String(xml ?? ''));
    const entries = asArray(doc?.feed?.entry);
    return entries.map((e) => {
        const links = asArray(e.link);
        const contentLink = (e.content && typeof e.content === 'object' && e.content.src) ||
            links.find((l) => /relations\/content$|\/content$/.test(String(l.rel ?? '')) ||
                /\/content$/.test(String(l.href ?? '')))?.href ||
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
function vrsdKey(target) {
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
function isFeedMissing(e) {
    const status = e?.response?.status ?? e?.status;
    // With an HTTP status, the status alone decides: 401 / 403 / 400 / 500 bodies
    // often say "not found" or "not supported" and must still be reported.
    if (status !== undefined && status !== null && status !== '')
        return [404, 405, 501].includes(Number(status));
    return /not found|not supported|no resource|does not exist/i.test(String(e?.message ?? e));
}
/** Versions from the ADT feed. */
async function readVersionsFeed(connection, target) {
    const resp = await (0, utils_1.makeAdtRequest)(connection, versionsUri(target), 'GET', 30000, undefined, undefined, {
        Accept: 'application/atom+xml;type=feed',
    });
    return parseVersionsFeed(typeof resp.data === 'string' ? resp.data : String(resp.data ?? ''));
}
/** VRSD rows read per object: all of them in practice, so "newest N" is cut after sorting. */
exports.VRSD_ROW_CAP = 5000;
/**
 * Versions from VRSD through the dispatcher (list only), newest first.
 * TABLE_READ has no ORDER BY, so every row (up to VRSD_ROW_CAP) is read and
 * sorted here; the caller cuts the newest N.
 */
async function readVersionsVrsd(connection, target, maxRows = exports.VRSD_ROW_CAP) {
    const { objtype, objname } = vrsdKey(target);
    const res = await (0, legacyTableRead_1.legacyTableRead)(connection, {
        table: 'VRSD',
        fields: ['VERSNO', 'KORRNUM', 'AUTHOR', 'DATUM', 'ZEIT'],
        where: `OBJTYPE = '${objtype}' AND OBJNAME = '${objname.replace(/'/g, "''")}'`,
        maxRows,
    });
    const rows = res?.rows ?? [];
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
const VERSION_CONTENT_URI = new RegExp('^/sap/bc/adt/' +
    `(?:programs/programs|programs/includes|oo/classes|oo/interfaces|functions/groups/${URI_NAME}/fmodules)` +
    `/${URI_NAME}` +
    `/(?:source/main|includes/(?:${exports.CLASS_INCLUDES.join('|')}))` +
    '/versions/\\d{1,14}/\\d{1,5}/content$', 'i');
/**
 * Only version content URIs are read by GetObjectVersionSource — the guard that
 * keeps the tool from becoming a generic GET: a fixed object root, one name
 * segment per level, a source part, `/versions/<timestamp>/<number>/content`,
 * and a path that URL normalisation leaves unchanged (no dot segments).
 */
function isVersionContentUri(uri) {
    const p = adtPath(String(uri ?? ''));
    if (!VERSION_CONTENT_URI.test(p))
        return false;
    try {
        return new URL(p, 'http://x').pathname === p;
    }
    catch {
        return false;
    }
}
/** Source text of one version. */
async function readVersionSource(connection, contentUri) {
    const path = adtPath(contentUri);
    if (!isVersionContentUri(path))
        throw new Error(`not a version content URI: ${contentUri}`);
    const resp = await (0, utils_1.makeAdtRequest)(connection, path, 'GET', 30000, undefined, undefined, { Accept: 'text/plain' });
    return typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
}
//# sourceMappingURL=objectVersions.js.map