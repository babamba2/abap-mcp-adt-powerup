/**
 * Plain-text <-> structured serializer for the three ADT textelements
 * subsources (symbols / selections / headings).
 *
 * The on-wire format was verified live against S/4HANA. Examples:
 *
 *   GET /sap/bc/adt/textelements/programs/{prog}/source/symbols
 *     @MaxLength:10
 *     001=텍스트 심볼 001
 *
 *     @MaxLength:15
 *     042=Text Symbol 042
 *
 *   GET /sap/bc/adt/textelements/programs/{prog}/source/selections
 *     P_DATE  =처리일자
 *
 *     SO_CARRI=Carrier ID
 *
 *   GET /sap/bc/adt/textelements/programs/{prog}/source/headings
 *     listHeader=<free-form>
 *
 *     columnHeader_1=<text>
 *     columnHeader_2=<text>
 *     ...
 *
 * All subsources use CRLF line endings and blank-line record separators.
 * Selections pad keys to 8 characters. Symbols prefix each record with a
 * `@MaxLength:N` annotation.
 */

export interface SymbolEntry {
  /** 3-char text symbol key (e.g. "001"). Case-preserved. */
  key: string;
  /** Text content (bounded by maxLength). */
  text: string;
  /** Optional max-length annotation. Defaults to 40 if omitted. */
  maxLength?: number;
}

export interface SelectionEntry {
  /** Parameter / select-option name (uppercase, will be padded to 8). */
  key: string;
  /** Selection text shown in the selection screen. */
  text: string;
}

export interface HeadingEntry {
  /**
   * Either the literal 'listHeader' or 'columnHeader_N' for some N.
   * Arbitrary keys are rejected by the serializer because SAP only
   * accepts this fixed key set for the headings subsource.
   */
  key: string;
  text: string;
}

const CRLF = '\r\n';
const RECORD_SEPARATOR = '\r\n\r\n';
const DEFAULT_SYMBOL_MAXLENGTH = 40;
const SELECTION_KEY_WIDTH = 8;
const HEADING_KEY_PATTERN = /^(listHeader|columnHeader_\d+)$/;

function splitRecords(body: string): string[] {
  if (!body) return [];
  // Normalize LF to CRLF so we survive callers that supply Unix-style newlines.
  const normalized = body.replace(/\r?\n/g, '\n');
  return normalized
    .split(/\n\n+/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

export function parseSymbolsSource(body: string): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  for (const record of splitRecords(body)) {
    const lines = record.split(/\r?\n/);
    let maxLength: number | undefined;
    for (const line of lines) {
      const annot = line.match(/^@MaxLength:(\d+)\s*$/i);
      if (annot) {
        maxLength = Number(annot[1]);
        continue;
      }
      const kv = line.match(/^([^=]+?)=(.*)$/);
      if (kv) {
        entries.push({
          key: kv[1].trim(),
          text: kv[2],
          ...(maxLength !== undefined ? { maxLength } : {}),
        });
      }
    }
  }
  return entries;
}

export function serializeSymbolsSource(entries: SymbolEntry[]): string {
  const records: string[] = [];
  for (const e of entries) {
    if (!e.key) {
      throw new Error('Symbol entry missing key');
    }
    const len = e.maxLength ?? DEFAULT_SYMBOL_MAXLENGTH;
    if (!Number.isFinite(len) || len <= 0) {
      throw new Error(
        `Symbol "${e.key}" has invalid maxLength: ${e.maxLength}`,
      );
    }
    records.push(`@MaxLength:${len}${CRLF}${e.key}=${e.text ?? ''}`);
  }
  return records.join(RECORD_SEPARATOR);
}

export function parseSelectionsSource(body: string): SelectionEntry[] {
  const entries: SelectionEntry[] = [];
  for (const record of splitRecords(body)) {
    for (const line of record.split(/\r?\n/)) {
      const kv = line.match(/^(.*?)=(.*)$/);
      if (!kv) continue;
      const rawKey = kv[1].trimEnd();
      if (!rawKey) continue;
      entries.push({ key: rawKey.trim(), text: kv[2] });
    }
  }
  return entries;
}

export function serializeSelectionsSource(entries: SelectionEntry[]): string {
  const records: string[] = [];
  for (const e of entries) {
    if (!e.key) throw new Error('Selection entry missing key');
    const upperKey = e.key.toUpperCase();
    if (upperKey.length > SELECTION_KEY_WIDTH) {
      throw new Error(
        `Selection key "${upperKey}" exceeds ${SELECTION_KEY_WIDTH} chars (ABAP parameter names are limited).`,
      );
    }
    const paddedKey = upperKey.padEnd(SELECTION_KEY_WIDTH, ' ');
    records.push(`${paddedKey}=${e.text ?? ''}`);
  }
  return records.join(RECORD_SEPARATOR);
}

export function parseHeadingsSource(body: string): HeadingEntry[] {
  const entries: HeadingEntry[] = [];
  // Headings do not use blank-line separators — every non-empty line is a k=v.
  for (const line of body.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/);
    if (kv) entries.push({ key: kv[1], text: kv[2] });
  }
  return entries;
}

/**
 * SAP rejects arbitrary keys for the headings subsource — only
 * `listHeader` and `columnHeader_N` are permitted. We surface any stray
 * key as an error so callers notice before the PUT fails 4xx.
 */
export function serializeHeadingsSource(entries: HeadingEntry[]): string {
  const lines: string[] = [];
  // Render listHeader first when present.
  const listHeader = entries.find((e) => e.key === 'listHeader');
  const columns = entries
    .filter((e) => e.key !== 'listHeader')
    .sort((a, b) => {
      const na = Number(a.key.split('_')[1] ?? 0);
      const nb = Number(b.key.split('_')[1] ?? 0);
      return na - nb;
    });
  const all = [...(listHeader ? [listHeader] : []), ...columns];
  for (const e of all) {
    if (!HEADING_KEY_PATTERN.test(e.key)) {
      throw new Error(
        `Heading entry key "${e.key}" is not supported. Use "listHeader" or "columnHeader_<N>".`,
      );
    }
    lines.push(`${e.key}=${e.text ?? ''}`);
  }
  // Blank line after the list-header record when both are present (matches
  // SAP's own layout `listHeader=<X>\r\n\r\ncolumnHeader_1=...`).
  if (listHeader && columns.length > 0) {
    // Insert blank line after listHeader
    return [lines[0], '', ...lines.slice(1)].join(CRLF);
  }
  return lines.join(CRLF);
}

/**
 * Route a mixed bag of entries into the three subsources. `type` must be
 * one of I/S/H; R is handled separately by the caller because the native
 * ADT endpoint does not cover program titles.
 */
export interface MixedTextElementEntry {
  type: 'I' | 'S' | 'H';
  key: string;
  text: string;
  max_length?: number;
}

export interface GroupedSources {
  symbols: SymbolEntry[];
  selections: SelectionEntry[];
  headings: HeadingEntry[];
}

export function groupBySubsource(
  entries: MixedTextElementEntry[],
): GroupedSources {
  const out: GroupedSources = { symbols: [], selections: [], headings: [] };
  for (const e of entries) {
    switch (e.type) {
      case 'I':
        out.symbols.push({
          key: e.key,
          text: e.text,
          ...(e.max_length !== undefined ? { maxLength: e.max_length } : {}),
        });
        break;
      case 'S':
        out.selections.push({ key: e.key, text: e.text });
        break;
      case 'H':
        out.headings.push({ key: e.key, text: e.text });
        break;
      default:
        throw new Error(`Unsupported text element type: ${(e as any).type}`);
    }
  }
  return out;
}
