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
import * as fs from 'node:fs';
import * as path from 'node:path';

export type OutputMode = 'inline' | 'file';

export const OUTPUT_PARAM_DESCRIPTION =
  '"inline" (default) or "file": writes the source under the MCP output dir and returns path, line count and an outline with line ranges. Prefer "file" for large objects.';

export function outputRoot(): string {
  return path.resolve(process.env.MCP_OUTPUT_DIR || 'output');
}

/**
 * Resolve `p` (relative to the output root, or absolute) and refuse anything
 * outside the root.
 */
export function safeOutputPath(p: string): string {
  const root = outputRoot();
  const resolved = path.resolve(root, p);
  const rel = path.relative(root, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to write outside the MCP output directory (${root}): ${p}`,
    );
  }
  return resolved;
}

/** File name for an ABAP object: lower case, "/" → "#" (abapGit style). */
export function sourceFileName(
  name: string,
  kind: string,
  version?: string,
): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\//g, '#')
    .replace(/[^a-z0-9_#-]/g, '_');
  const ver = version === 'inactive' ? '.inactive' : '';
  return `${base}.${kind}${ver}.abap`;
}

const MAX_OUTLINE = 400;

const OPENERS: Array<{
  re: RegExp;
  kind: string;
  end?: string;
  label: (m: RegExpMatchArray) => string | null;
}> = [
  {
    re: /^(REPORT|PROGRAM|FUNCTION-POOL)\s+([^\s.]+)/i,
    kind: 'PROGRAM',
    label: (m) => `${m[1].toUpperCase()} ${m[2]}`,
  },
  {
    re: /^CLASS\s+([^\s.]+)\s+(DEFINITION|IMPLEMENTATION)\b(.*)$/i,
    kind: 'CLASS',
    end: 'ENDCLASS',
    label: (m) =>
      /\b(DEFERRED|LOAD)\b/i.test(m[3])
        ? null
        : `CLASS ${m[1]} ${m[2].toUpperCase()}`,
  },
  {
    re: /^INTERFACE\s+([^\s.]+)(.*)$/i,
    kind: 'INTERFACE',
    end: 'ENDINTERFACE',
    label: (m) =>
      /\b(DEFERRED|LOAD)\b/i.test(m[2]) ? null : `INTERFACE ${m[1]}`,
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
export function abapOutline(source: string): {
  outline: string[];
  truncated: boolean;
} {
  const lines = source.split(/\r?\n/);
  const entries: Array<{ start: number; end?: number; label: string }> = [];
  const open: Array<{ end: string; entry: { end?: number } }> = [];

  lines.forEach((raw, idx) => {
    if (raw.startsWith('*')) return;
    const line = raw.trim();
    if (line === '' || line.startsWith('"')) return;

    const endMatch = line.match(
      /^(ENDCLASS|ENDINTERFACE|ENDMETHOD|ENDFORM|ENDMODULE|ENDFUNCTION)\b/i,
    );
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
      if (!m) continue;
      const label = o.label(m);
      if (label) {
        const entry = { start: idx + 1, label } as {
          start: number;
          end?: number;
          label: string;
        };
        entries.push(entry);
        if (o.end) open.push({ end: o.end, entry });
      }
      break;
    }
  });

  const outline = entries
    .slice(0, MAX_OUTLINE)
    .map((e) => `${e.start}${e.end ? `-${e.end}` : ''} ${e.label}`);
  return { outline, truncated: entries.length > MAX_OUTLINE };
}

export interface WrittenSource {
  path: string;
  lines: number;
  bytes: number;
  outline: string[];
  outline_truncated?: boolean;
}

/** Write one source under <root>/src[/subdir]/ and describe it. */
export function writeSourceFile(
  fileName: string,
  source: string,
  subdir?: string,
): WrittenSource {
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

export function isFileOutput(args: { output?: unknown } | undefined): boolean {
  return args?.output === 'file';
}
