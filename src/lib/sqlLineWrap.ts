/**
 * ADT freestyle data preview answers HTTP 400 when one line of the statement is
 * longer than 255 characters (ABAP source line limit; measured on S/4HANA
 * 2026-11-24: the same SELECT passes once it is split over several lines).
 *
 * wrapSqlLines breaks every over-long line at whitespace or after a comma that
 * sits outside a string literal ('…' or `…`), so no line exceeds `max`.
 * - Literals are never split; a literal longer than `max` stays whole.
 * - Continuation lines start with one space, so a `*` never lands in column 1
 *   (ABAP reads a line starting with `*` as a comment: COUNT( * ), SELECT *).
 * - A line holding a `"` end-of-line comment is left as it is (wrapping would
 *   move commented text onto live lines).
 * Lines that are already short are returned unchanged.
 */
export const SQL_MAX_LINE = 200;

export function wrapSqlLines(sql: string, max = SQL_MAX_LINE): string {
  return sql
    .split(/\r?\n/)
    .map((line) => (line.length <= max ? line : wrapLine(line, max)))
    .join('\n');
}

function wrapLine(line: string, max: number): string {
  // Break points: index just after a space or comma outside a literal.
  const breaks: number[] = [];
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        if (line[i + 1] === quote)
          i++; // doubled quote = escaped quote
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '"') return line; // end-of-line comment: leave the line alone
    if (ch === ' ' || ch === ',') breaks.push(i + 1);
  }

  // Continuation lines carry a one-space indent, so they may hold max - 1 chars.
  const out: string[] = [];
  let start = 0;
  let last = -1; // last usable break point after start
  const room = () => (out.length ? max - 1 : max);
  for (const b of breaks) {
    if (b - start > room() && last > start) {
      out.push(line.slice(start, last).trimEnd());
      start = last;
    }
    last = b;
  }
  if (line.length - start > room() && last > start) {
    out.push(line.slice(start, last).trimEnd());
    start = last;
  }
  out.push(line.slice(start));
  return out
    .filter((l) => l.trim() !== '')
    .map((l, i) => (i === 0 ? l : ` ${l.trimStart()}`))
    .join('\n');
}
