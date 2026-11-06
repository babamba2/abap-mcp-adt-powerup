"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_LISTING_BUDGET = exports.OUTPUT_PARAM_DESCRIPTION = void 0;
exports.outputRoot = outputRoot;
exports.safeOutputPath = safeOutputPath;
exports.sourceFileName = sourceFileName;
exports.abapOutline = abapOutline;
exports.writeSourceFile = writeSourceFile;
exports.fitFileListing = fitFileListing;
exports.isFileOutput = isFileOutput;
/**
 * File output for source-reading tools.
 *
 * A large class or program read inline lands in the model's context in full
 * (a 60 KB class is ~20K tokens). With output="file" the source is written
 * under the output root and the tool returns the path, the line count and an
 * outline (METHOD / FORM / MODULE / … with line ranges), so the caller reads
 * only the parts it needs.
 *
 * Every file write, including the older hidden `filePath` argument, must stay
 * inside the output root: MCP_OUTPUT_DIR when set, otherwise ./output.
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.OUTPUT_PARAM_DESCRIPTION = '"inline" (default) or "file": writes the source under the MCP output dir and returns path, line count and an outline with line ranges. Prefer "file" for large objects.';
function outputRoot() {
    return path.resolve(process.env.MCP_OUTPUT_DIR || 'output');
}
/**
 * Resolve `p` (relative to the output root, or absolute) and refuse anything
 * outside the root.
 */
function safeOutputPath(p) {
    const root = outputRoot();
    const resolved = path.resolve(root, p);
    const rel = path.relative(root, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`Refusing to write outside the MCP output directory (${root}): ${p}`);
    }
    return resolved;
}
/** File name for an ABAP object: lower case, "/" → "#" (abapGit style). */
function sourceFileName(name, kind, version) {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/\//g, '#')
        .replace(/[^a-z0-9_#-]/g, '_');
    const ver = version === 'inactive' ? '.inactive' : '';
    return `${base}.${kind}${ver}.abap`;
}
const MAX_OUTLINE = 400;
const OPENERS = [
    {
        re: /^(REPORT|PROGRAM|FUNCTION-POOL)\s+([^\s.]+)/i,
        kind: 'PROGRAM',
        label: (m) => `${m[1].toUpperCase()} ${m[2]}`,
    },
    {
        re: /^CLASS\s+([^\s.]+)\s+(DEFINITION|IMPLEMENTATION)\b(.*)$/i,
        kind: 'CLASS',
        end: 'ENDCLASS',
        label: (m) => /\b(DEFERRED|LOAD)\b/i.test(m[3])
            ? null
            : `CLASS ${m[1]} ${m[2].toUpperCase()}`,
    },
    {
        re: /^INTERFACE\s+([^\s.]+)(.*)$/i,
        kind: 'INTERFACE',
        end: 'ENDINTERFACE',
        label: (m) => /\b(DEFERRED|LOAD)\b/i.test(m[2]) ? null : `INTERFACE ${m[1]}`,
    },
    {
        re: /^METHOD\s+([^\s.]+)/i,
        kind: 'METHOD',
        end: 'ENDMETHOD',
        label: (m) => `METHOD ${m[1]}`,
    },
    {
        re: /^FORM\s+([^\s.]+)/i,
        kind: 'FORM',
        end: 'ENDFORM',
        label: (m) => `FORM ${m[1]}`,
    },
    {
        re: /^MODULE\s+([^\s.]+)(?:\s+(INPUT|OUTPUT))?/i,
        kind: 'MODULE',
        end: 'ENDMODULE',
        label: (m) => `MODULE ${m[1]}${m[2] ? ` ${m[2].toUpperCase()}` : ''}`,
    },
    {
        re: /^FUNCTION\s+([^\s.]+)/i,
        kind: 'FUNCTION',
        end: 'ENDFUNCTION',
        label: (m) => `FUNCTION ${m[1]}`,
    },
    {
        re: /^(INITIALIZATION|START-OF-SELECTION|END-OF-SELECTION|TOP-OF-PAGE|END-OF-PAGE|LOAD-OF-PROGRAM|AT\s+LINE-SELECTION|AT\s+USER-COMMAND|AT\s+SELECTION-SCREEN[^.]*)\s*\./i,
        kind: 'EVENT',
        label: (m) => m[1].toUpperCase().replace(/\s+/g, ' '),
    },
    {
        re: /^INCLUDE\s+([^\s.]+)\s*\./i,
        kind: 'INCLUDE',
        label: (m) => (/^(STRUCTURE|TYPE)$/i.test(m[1]) ? null : `INCLUDE ${m[1]}`),
    },
];
/**
 * One entry per block or event, as "start-end LABEL" (1-based lines matching
 * the SAP editor), e.g. "120-188 METHOD get_data".
 */
function abapOutline(source) {
    const lines = source.split(/\r?\n/);
    const entries = [];
    const open = [];
    lines.forEach((raw, idx) => {
        if (raw.startsWith('*'))
            return;
        const line = raw.trim();
        if (line === '' || line.startsWith('"'))
            return;
        const endMatch = line.match(/^(ENDCLASS|ENDINTERFACE|ENDMETHOD|ENDFORM|ENDMODULE|ENDFUNCTION)\b/i);
        if (endMatch) {
            const word = endMatch[1].toUpperCase();
            for (let i = open.length - 1; i >= 0; i--) {
                if (open[i].end === word) {
                    open[i].entry.end = idx + 1;
                    open.splice(i, 1);
                    break;
                }
            }
            return;
        }
        for (const o of OPENERS) {
            const m = line.match(o.re);
            if (!m)
                continue;
            const label = o.label(m);
            if (label) {
                const entry = { start: idx + 1, label };
                entries.push(entry);
                if (o.end)
                    open.push({ end: o.end, entry });
            }
            break;
        }
    });
    const outline = entries
        .slice(0, MAX_OUTLINE)
        .map((e) => `${e.start}${e.end ? `-${e.end}` : ''} ${e.label}`);
    return { outline, truncated: entries.length > MAX_OUTLINE };
}
/** Write one source under <root>/src[/subdir]/ and describe it. */
function writeSourceFile(fileName, source, subdir) {
    const rel = subdir
        ? path.join('src', subdir, fileName)
        : path.join('src', fileName);
    const target = safeOutputPath(rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf8');
    const { outline, truncated } = abapOutline(source);
    return {
        path: target,
        lines: source.split(/\r?\n/).length,
        bytes: Buffer.byteLength(source, 'utf8'),
        outline,
        ...(truncated ? { outline_truncated: true } : {}),
    };
}
/**
 * The JSON answer of a file-output read must stay under the client's
 * tool-result limit (about 50k characters; a function group with ~180
 * includes produced 54–94k only from paths and outlines, and the client
 * dropped the whole answer although every file was written).
 *
 * The full listing is always written to `<folder>/_index.json`. The answer is
 * that listing when it fits `budget`; otherwise the outlines are left out
 * (`outline_omitted`), and if it still does not fit, every entry after the
 * first carries only its file name (`file`) instead of the absolute `path` —
 * the first entry keeps `path`, so "the folder of the first path" still works.
 */
exports.FILE_LISTING_BUDGET = 40_000;
function fitFileListing(head, entries, folder, budget = exports.FILE_LISTING_BUDGET) {
    const indexPath = safeOutputPath(path.relative(outputRoot(), path.join(folder, '_index.json')));
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify({ ...head, code_objects: entries }, null, 1), 'utf8');
    const full = {
        ...head,
        folder,
        index_path: indexPath,
        code_objects: entries,
    };
    if (JSON.stringify(full).length <= budget)
        return full;
    const noOutline = entries.map((e) => {
        const { outline, outline_truncated, ...rest } = e;
        return rest;
    });
    const lean = {
        ...head,
        folder,
        index_path: indexPath,
        outline_omitted: true,
        note: 'Outlines left out to keep the answer small; the full listing with outlines is in index_path, and every source file is in folder.',
        code_objects: noOutline,
    };
    if (JSON.stringify(lean).length <= budget)
        return lean;
    const leaner = noOutline.map((e, i) => {
        if (i === 0 || typeof e.path !== 'string')
            return e;
        const { path: p, ...rest } = e;
        return { ...rest, file: path.basename(p) };
    });
    const short = {
        ...lean,
        paths_shortened: true,
        note: 'Outlines left out and paths shortened to file names (all files are in folder; the first entry keeps its full path); the full listing is in index_path.',
        code_objects: leaner,
    };
    if (JSON.stringify(short).length <= budget)
        return short;
    // last resort (hundreds of includes): list as many entries as fit, count the rest
    let size = JSON.stringify({
        ...short,
        code_objects: [],
        code_objects_truncated: entries.length,
    }).length;
    const kept = [];
    for (const e of leaner) {
        const add = JSON.stringify(e).length + 1;
        if (size + add > budget)
            break;
        kept.push(e);
        size += add;
    }
    return {
        ...short,
        note: 'Outlines left out, paths shortened and the list cut to fit; every file is in folder and the full listing is in index_path.',
        code_objects_truncated: entries.length - kept.length,
        code_objects: kept,
    };
}
function isFileOutput(args) {
    return args?.output === 'file';
}
//# sourceMappingURL=sourceOutput.js.map