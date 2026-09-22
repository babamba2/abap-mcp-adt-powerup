"use strict";
/**
 * Shared helpers for RuntimeGetDumpById / RuntimeAnalyzeDump.
 *
 * 1. Key facts from the default dump view. The generic key walker these
 *    handlers used before picked the first `title` / `line` it met, which is
 *    the first entry of the chapter index ("System environment", line 81)
 *    instead of the dump itself. The dump root carries the real facts
 *    (error, exception, terminatedProgram, …) and the termination link
 *    carries the failing object + line.
 *
 * 2. Chapter filter for the formatted (ST22 long text) view. A formatted dump
 *    is ~50 KB, most of it basis detail (system environment, kernel calls,
 *    program list, memory, control blocks). Each chapter is a box separated
 *    from the next by a blank line:
 *
 *      ------------------
 *      |Short Text       |
 *      |    text…        |
 *      ------------------
 *
 *    compactFormattedDump keeps the header block plus the requested chapters
 *    and drops the box borders and the padding inside them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVELOPER_CHAPTERS = void 0;
exports.extractDumpFacts = extractDumpFacts;
exports.extractFormattedHeaderFacts = extractFormattedHeaderFacts;
exports.splitFormattedDump = splitFormattedDump;
exports.compactFormattedDump = compactFormattedDump;
exports.DEVELOPER_CHAPTERS = [
    'Short Text',
    'What happened?',
    'Error analysis',
    'Chain of Exception Objects',
    'Information on where terminated',
    'Source Code Extract',
    'Active Calls/Events',
    'User and Transaction',
];
const get = (o, key) => o && typeof o === 'object' ? o[key] : undefined;
const asObjArray = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter((x) => !!x && typeof x === 'object');
function dropUndefined(facts) {
    for (const k of Object.keys(facts)) {
        if (facts[k] === undefined)
            delete facts[k];
    }
    return facts;
}
/** Facts from the parsed default view (`dump:dump` root). Empty object otherwise. */
function extractDumpFacts(parsed) {
    const rootValue = get(parsed, 'dump:dump');
    if (!rootValue || typeof rootValue !== 'object')
        return {};
    const root = rootValue;
    const str = (v) => typeof v === 'string' && v.trim() !== '' ? v : undefined;
    const facts = {
        title: str(root.title),
        runtimeError: str(root.error),
        exception: str(root.exception),
        program: str(root.terminatedProgram),
        user: str(root.author),
        datetime: str(root.datetime),
        host: str(root.serverInstance),
    };
    const links = asObjArray(get(root['dump:links'], 'dump:link'));
    const term = links.find((l) => typeof l.relation === 'string' && l.relation.endsWith('/termination'));
    if (term && typeof term.uri === 'string') {
        const uri = term.uri;
        const obj = uri.match(/\/sap\/bc\/adt\/(.+?)(?:\/source\/main)?(?:#|$)/);
        const line = uri.match(/[#&]start=(\d+)/);
        facts.termination = {
            uri,
            object: obj ? obj[1] : undefined,
            line: line ? Number(line[1]) : undefined,
        };
    }
    const chapters = asObjArray(get(root['dump:chapters'], 'dump:chapter'))
        .filter((c) => typeof c.title === 'string')
        .sort((a, b) => Number(a.chapterOrder ?? 0) - Number(b.chapterOrder ?? 0))
        .map((c) => ({
        title: c.title,
        line: c.line !== undefined ? Number(c.line) : undefined,
    }));
    if (chapters.length)
        facts.chapters = chapters;
    return dropUndefined(facts);
}
/** Facts from the header block of the formatted view. */
function extractFormattedHeaderFacts(text) {
    if (typeof text !== 'string')
        return {};
    const grab = (label) => {
        const m = text.match(new RegExp(`^${label}\\s{2,}(.+?)\\s*$`, 'm'));
        return m ? m[1] : undefined;
    };
    return dropUndefined({
        runtimeError: grab('Runtime Errors'),
        exception: grab('Except\\.'),
        program: grab('ABAP: Program'),
        datetime: grab('Date and Time'),
    });
}
const isRule = (l) => /^-{10,}$/.test(l);
const boxed = /^\|(.*)\|$/;
/**
 * Split a formatted dump into its header lines and titled chapters.
 * Chapters are separated by blank lines; the title of a chapter is its first
 * boxed line. The leading block has no boxed line and is the header
 * (Category / Runtime Errors / Except. / Program / Date and Time).
 */
function splitFormattedDump(text) {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
    const blocks = [];
    let cur = [];
    for (const line of lines) {
        if (line === '') {
            if (cur.length)
                blocks.push(cur);
            cur = [];
        }
        else {
            cur.push(line);
        }
    }
    if (cur.length)
        blocks.push(cur);
    const header = [];
    const chapters = [];
    for (const block of blocks) {
        const titleIdx = block.findIndex((l) => boxed.test(l));
        if (titleIdx < 0) {
            header.push(...block.filter((l) => !isRule(l)));
            continue;
        }
        const title = block[titleIdx].match(boxed)[1].trim();
        const body = block
            .slice(titleIdx + 1)
            .filter((l) => !isRule(l))
            .map((l) => {
            const m = l.match(boxed);
            return m ? m[1].replace(/\s+$/, '') : l;
        });
        chapters.push({ title, body });
    }
    return { header, chapters };
}
/**
 * Keep the header plus the requested chapters, without box borders or padding.
 * `wanted` entries match chapter titles case-insensitively by prefix; the
 * keyword "developer" expands to DEVELOPER_CHAPTERS.
 */
function compactFormattedDump(text, wanted) {
    const want = wanted.flatMap((w) => w.toLowerCase() === 'developer' ? [...exports.DEVELOPER_CHAPTERS] : [w]);
    const matches = (title) => want.some((w) => title.toLowerCase().startsWith(w.toLowerCase()));
    const { header, chapters } = splitFormattedDump(text);
    const out = [...header];
    const kept = [];
    const omitted = [];
    for (const ch of chapters) {
        if (!matches(ch.title)) {
            omitted.push(ch.title);
            continue;
        }
        kept.push(ch.title);
        out.push('', `## ${ch.title}`, ...ch.body);
    }
    out.push('', `[chapters kept: ${kept.join(', ') || 'none'}; omitted: ${omitted.join(', ') || 'none'}]`);
    return out.join('\n');
}
//# sourceMappingURL=runtimeDumpFormat.js.map