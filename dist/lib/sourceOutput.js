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
exports.OUTPUT_PARAM_DESCRIPTION = void 0;
exports.outputRoot = outputRoot;
exports.safeOutputPath = safeOutputPath;
exports.sourceFileName = sourceFileName;
exports.abapOutline = abapOutline;
exports.writeSourceFile = writeSourceFile;
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
exports.OUTPUT_PARAM_DESCRIPTION = '"inline" (default) returns the source in the response. "file" writes it under the MCP output directory and returns path, line count and an outline (METHOD/FORM/MODULE/… with line ranges); read only the ranges you need. Prefer "file" for large objects.';
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
function isFileOutput(args) {
    return args?.output === 'file';
}
//# sourceMappingURL=sourceOutput.js.map