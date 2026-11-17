/**
 * Personal-data masking for test-data reads (`mask` on GetTableContents / GetSqlQuery /
 * GetRemoteTableContents), so personal values never leave the server.
 *
 * Same personal-field lists, table refusals and strict SELECT grammar as the sc4sap
 * plugin's scripts/program-test/pt-lib.mjs (program-test skill); both repos assert the
 * shared vectors in `src/__tests__/unit/fixtures/mask-vectors.json` — change both
 * together. Tokens are made only here: HMAC under a server-side key (maskSecret.ts).
 *
 * Default-deny: a column keeps its value only when it maps (through the SELECT list,
 * alias → source field, or by its own name) to a field of the table's DDIC that is not
 * personal by field name, data element or domain. Expressions, unknown columns and
 * fields the DDIC does not list are masked.
 */
import { createHmac } from 'node:crypto';

const up = (s: unknown): string =>
  String(s ?? '')
    .trim()
    .toUpperCase();

/** Field names holding personal data: names, address, contact, bank, tax / ID numbers, birth data, user IDs. */
export const PERSONAL_EXACT: ReadonlySet<string> = new Set([
  'NAME1',
  'NAME2',
  'NAME3',
  'NAME4',
  'NAME_CO',
  'NAMEV',
  'NAME_FIRST',
  'NAME_LAST',
  'NAME_LST2',
  'NAME_TEXT',
  'NAMEMIDDLE',
  'NAME_ORG1',
  'NAME_ORG2',
  'NAME_ORG3',
  'NAME_ORG4',
  'MC_NAME1',
  'MC_NAME2',
  'MCOD1',
  'MCOD2',
  'SORTL',
  'SORT1',
  'SORT2',
  'ENAME',
  'VORNA',
  'NACHN',
  'RUFNM',
  'STRAS',
  'STREET',
  'STR_SUPPL1',
  'STR_SUPPL2',
  'STR_SUPPL3',
  'HOUSE_NUM1',
  'HOUSE_NUM2',
  'PFACH',
  'PSTL2',
  'PO_BOX',
  'ORT01',
  'ORT02',
  'CITY1',
  'CITY2',
  'MC_STREET',
  'MC_CITY1',
  'TELF1',
  'TELF2',
  'TELFX',
  'TELTX',
  'TELX1',
  'TELBX',
  'TEL_NUMBER',
  'TEL_EXTENS',
  'FAX_NUMBER',
  'FAX_EXTENS',
  'MOB_NUMBER',
  'SMTP_ADDR',
  'E_MAIL',
  'EMAIL',
  'INTAD',
  'BANKN',
  'BKONT',
  'IBAN',
  'KOINH',
  'ACCNAME',
  'BKREF',
  'CCNUM',
  'CCINS_NUM',
  'STCD1',
  'STCD2',
  'STCD3',
  'STCD4',
  'STCD5',
  'STCEG',
  'STENR',
  'STKZN',
  'TAXNUM',
  'J_1KFREPRE',
  'J_1KFTBUS',
  'J_1KFTIND',
  'GBDAT',
  'GBORT',
  'BIRTHDT',
  'BIRTHPL',
  'PERID',
  'ICNUM',
  'IDNUMBER',
  'PASSPORT',
  'PERNR',
  'GESCH',
  'ERNAM',
  'AENAM',
  'UNAME',
  'USNAM',
  'BNAME',
  'CREATED_BY',
  'CHANGED_BY',
  'LAST_CHANGED_BY',
  'CRUSR',
  'CHUSR',
  'USERNAME',
]);
const DATE_FIELDS: ReadonlySet<string> = new Set(['GBDAT', 'BIRTHDT']);

/** Data elements of personal data. */
export const PERSONAL_DTEL: ReadonlySet<string> = new Set([
  'NAME1_GP',
  'NAME2_GP',
  'NAME3_GP',
  'NAME4_GP',
  'NAME1',
  'NAME2',
  'AD_NAME1',
  'AD_NAME2',
  'AD_NAME3',
  'AD_NAME4',
  'AD_NAMEFIR',
  'AD_NAMELAS',
  'AD_NAMEMID',
  'AD_NAME_CO',
  'AD_NAMTEXT',
  'BU_NAMEP_F',
  'BU_NAMEP_L',
  'BU_NAMEOR1',
  'BU_NAMEOR2',
  'BU_NAMEOR3',
  'BU_NAMEOR4',
  'BU_NAMEPL2',
  'BU_MCNAME1',
  'BU_MCNAME2',
  'NAMEV_VP',
  'NAME1_VP',
  'EMNAM',
  'PAD_VORNA',
  'PAD_NACHN',
  'VORNA',
  'NACHN',
  'STRAS_GP',
  'AD_STREET',
  'AD_STRSPP1',
  'AD_STRSPP2',
  'AD_STRSPP3',
  'AD_HSNM1',
  'AD_HSNM2',
  'ORT01_GP',
  'ORT02_GP',
  'AD_CITY1',
  'AD_CITY2',
  'PFACH',
  'AD_POBX',
  'AD_MC_STRT',
  'AD_MC_CITY',
  'TELF1',
  'TELF2',
  'TELFX',
  'TELTX',
  'TELX1',
  'TELBX',
  'AD_TLNMBR',
  'AD_TLNMBR1',
  'AD_TLXTNS',
  'AD_FXNMBR',
  'AD_FXNMBR1',
  'AD_FXXTNS',
  'AD_MBNMBR1',
  'AD_SMTPADR',
  'INTAD',
  'BANKN',
  'BKONT',
  'IBAN',
  'KOINH_FI',
  'BU_KOINH',
  'BKREF',
  'CCNUM',
  'CVVAL',
  'STCD1',
  'STCD2',
  'STCD3',
  'STCD4',
  'STCD5',
  'STCEG',
  'STENR',
  'BPTAXNUM',
  'BPTAXNUMXL',
  'GBDAT',
  'GBDAT_GP',
  'BU_BIRTHDT',
  'BU_BIRTHPL',
  'GBORT',
  'PERID',
  'ICNUM',
  'PRDNI',
  'PERNR_D',
  'P_PERNR',
  'PERSNO',
  'GESCH',
  'BU_SEXID',
  'ERNAM',
  'AENAM',
  'USNAM',
  'UNAME',
  'XUBNAME',
  'SYUNAME',
  'BNAME',
  'CRUSR',
  'CHUSR',
  'ABP_CREATION_USER',
  'ABP_LASTCHANGE_USER',
  'VDM_CREATEDBYUSERID',
  'VDM_LASTCHANGEDBYUSERID',
]);
/** Domains of personal data. */
export const PERSONAL_DOMAIN: ReadonlySet<string> = new Set([
  'AD_SMTPADR',
  'AD_TLNMBR',
  'AD_FXNMBR',
  'XUBNAME',
  'USNAM',
  'PERNR',
  'BANKN',
  'IBAN',
  'STCD1',
  'STCD2',
  'STCD3',
  'STCEG',
  'GBDAT',
  'BU_BIRTHDT',
  'TELF1',
  'AD_STREET',
  'AD_NAME',
  'NAME',
  'ORT01',
  'STRAS',
]);

/** Tables never read for test data: HR, user / credential, contact / bank detail, secure store. */
const REFUSED_TABLES: RegExp[] = [
  /^PA\d{4}$/,
  /^PB\d{4}$/,
  /^HRP\d{4}$/,
  /^PCL\d$/,
  /^USR\d\d$/,
  /^USH\d\d$/,
  /^UST\d\d$/,
  /^AGR_/,
  /^RSECTAB$/,
  /^RSECSTORE/,
  /^SSF_PSE/,
  /^ADR[2-6]$/,
  /^ADRP$/,
  /^BUT0ID$/,
  /^KNBK$/,
  /^LFBK$/,
  /^BUT0BK$/,
  /^TIBAN$/,
  /^PCA_/,
];

export type FieldDdic = { rollname: string; domname: string };
export type TableDdic = Record<string, FieldDdic>;

export function isPersonalField(
  name: string,
  extra: readonly string[] = [],
  ddic: FieldDdic | null = null,
): boolean {
  const n = up(name);
  if (PERSONAL_EXACT.has(n) || extra.map(up).includes(n)) return true;
  if (ddic)
    return (
      PERSONAL_DTEL.has(up(ddic.rollname)) ||
      PERSONAL_DOMAIN.has(up(ddic.domname))
    );
  return false;
}

export function isRefusedTable(name: string): boolean {
  const t = up(name);
  return REFUSED_TABLES.some((re) => re.test(t));
}

/** Version of the token scheme, returned in `masking.version`. */
export const MASK_VERSION = 'hmac-v1';

/**
 * Deterministic stand-in: HMAC-SHA256 under the server-side key (maskSecret.ts) of
 * run salt | table | field | value — same input in one run → same token, unrecoverable
 * without the key. Length ≤ original, digits stay digits, birth dates become 19000101.
 */
export function maskToken(
  value: unknown,
  table: string,
  field: string,
  salt: string,
  secret: Buffer,
): string {
  const s = String(value ?? '');
  if (!s.trim()) return s;
  const f = up(field);
  if (DATE_FIELDS.has(f))
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? '1900-01-01' : '19000101';
  const h = createHmac('sha256', secret)
    .update(`${salt}|${up(table)}|${f}|${s.trim()}`)
    .digest('hex');
  if (/^\d+$/.test(s))
    return [...s]
      .map((_, i) => String(Number.parseInt(h[i % h.length], 16) % 10))
      .join('');
  const len = Math.min(s.length, 12);
  return `M${h.toUpperCase()}`.slice(0, len);
}

/** Field → data element / domain from a GetTable answer: ECC bridge JSON (DD03L rows) or the S/4 table source. */
export function ddicFromTableData(body: string): TableDdic | null {
  const fields: TableDdic = {};
  let asJson: unknown = null;
  try {
    asJson = JSON.parse(body);
  } catch {
    asJson = null;
  }
  if (asJson && typeof asJson === 'object') {
    const walk = (o: unknown, depth = 0): void => {
      if (!o || typeof o !== 'object' || depth > 5) return;
      if (Array.isArray(o)) {
        for (const x of o) walk(x, depth + 1);
        return;
      }
      const k: Record<string, unknown> = Object.fromEntries(
        Object.entries(o as Record<string, unknown>).map(([a, b]) => [
          a.toLowerCase(),
          b,
        ]),
      );
      if (
        typeof k.fieldname === 'string' &&
        k.fieldname &&
        !k.fieldname.startsWith('.')
      ) {
        fields[up(k.fieldname)] = {
          rollname: up(k.rollname || k.data_element || ''),
          domname: up(k.domname || k.domain || ''),
        };
      }
      for (const v of Object.values(o as Record<string, unknown>))
        if (v && typeof v === 'object') walk(v, depth + 1);
    };
    walk(asJson);
  } else {
    for (const line of String(body).replace(/\r/g, '').split('\n')) {
      const m = line.match(/^\s*(?:key\s+)?([a-z0-9_/]+)\s*:\s*([a-z0-9_/]+)/i);
      if (m && !/^(include|annotation|@)/i.test(m[1]))
        fields[up(m[1])] = { rollname: up(m[2]), domname: '' };
    }
  }
  return Object.keys(fields).length ? fields : null;
}

/** Every table name after FROM / JOIN (also in sub-queries) — for the refusal check. */
export function tablesInSql(sql: string): string[] {
  return [...String(sql || '').matchAll(/\b(?:FROM|JOIN)\s+([\w/]+)/gi)].map(
    (m) => up(m[1]),
  );
}

const SQL_DENY_WORDS =
  /\b(?:UNION|INTERSECT|EXCEPT|WITH|JOIN|INNER|OUTER|LEFT|RIGHT|CROSS|EXISTS|GROUP|HAVING|CASE|CAST|COALESCE|OFFSET|CLIENT|USING|BYPASSING|APPENDING|INTO|FOR|PACKAGE|CONNECTION|ALL|ANY|SOME)\b/i;
const COND_WORDS = new Set([
  'AND',
  'OR',
  'NOT',
  'IN',
  'BETWEEN',
  'LIKE',
  'IS',
  'NULL',
  'INITIAL',
  'ESCAPE',
  'EQ',
  'NE',
  'LT',
  'GT',
  'LE',
  'GE',
]);
const COND_TOKEN =
  /'L'|-?\d+(?:\.\d+)?|<>|<=|>=|=|<|>|\(|\)|,|[\w/]+(?:~[\w/]+)?|\s+/y;

function simpleCondition(cond: string): boolean {
  const toks: string[] = [];
  let pos = 0;
  while (pos < cond.length) {
    COND_TOKEN.lastIndex = pos;
    const m = COND_TOKEN.exec(cond);
    if (!m || m.index !== pos) return false;
    pos += m[0].length;
    if (m[0].trim()) toks.push(m[0]);
  }
  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '(') {
      const prev = up(toks[i - 1] || '');
      if (i > 0 && !['IN', 'AND', 'OR', 'NOT', '('].includes(prev))
        return false;
      depth++;
    } else if (t === ')') {
      depth -= 1;
      if (depth < 0) return false;
    } else if (
      /^[A-Za-z_/]/.test(t) &&
      !COND_WORDS.has(up(t)) &&
      toks[i + 1] === '('
    )
      return false;
  }
  return depth === 0;
}

export type StrictSelect =
  | { ok: true; table: string; columns: Map<string, string>; star: boolean }
  | { ok: false; why: string };

/**
 * Strict SELECT grammar (allow-list): one SELECT, one table, plain fields with optional
 * AS, unique output names, simple WHERE, UP TO n ROWS, ORDER BY. Anything else fails.
 */
export function parseStrictSelect(sql: string): StrictSelect {
  const raw = String(sql || '');
  if (/^\s*\*/m.test(raw)) return { ok: false, why: 'comment line' };
  let s = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "'") {
      s += raw[i];
      continue;
    }
    let j = i + 1;
    for (;;) {
      if (j >= raw.length) return { ok: false, why: 'unterminated literal' };
      if (raw[j] === "'" && raw[j + 1] === "'") {
        j += 2;
        continue;
      }
      if (raw[j] === "'") break;
      j++;
    }
    s += "'L'";
    i = j;
  }
  if (/["`;@|{}#\\]|--|\/\*|\*\//.test(s))
    return {
      ok: false,
      why: 'comment, host variable, template or statement separator',
    };
  s = s.replace(/\s+/g, ' ').trim();
  if (
    (s.match(/\bSELECT\b/gi) || []).length !== 1 ||
    (s.match(/\bFROM\b/gi) || []).length !== 1
  )
    return { ok: false, why: 'more than one SELECT / FROM' };
  const deny = s.match(SQL_DENY_WORDS);
  if (deny)
    return {
      ok: false,
      why: `not in the strict grammar: ${deny[0].toUpperCase()}`,
    };
  const m = s.match(
    /^SELECT (?:SINGLE )?(?:DISTINCT )?(.+?) FROM ([\w/]+)(?: (?:AS )?(?!WHERE\b|UP\b|ORDER\b)(\w+))?(?: WHERE (.+?))?(?: UP TO \d+ ROWS)?(?: ORDER BY [\w~/]+(?: ?, ?[\w~/]+)*(?: (?:ASCENDING|DESCENDING|ASC|DESC))?)?$/i,
  );
  if (!m)
    return { ok: false, why: 'statement shape outside the strict grammar' };
  if (m[4] && !simpleCondition(m[4]))
    return { ok: false, why: 'WHERE outside the strict grammar' };
  const columns = new Map<string, string>();
  let star = false;
  const toks = m[1].split(/\s*,\s*|\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '*' || /^\w+~\*$/.test(t)) {
      star = true;
      continue;
    }
    const f = t.match(/^(?:[\w/]+~)?([\w/]+)$/);
    if (!f || /^AS$/i.test(t))
      return { ok: false, why: `select list item ${t} is not a plain field` };
    let out = up(f[1]);
    if (/^AS$/i.test(toks[i + 1] || '')) {
      const alias = toks[i + 2];
      if (!alias || !/^[\w/]+$/.test(alias))
        return { ok: false, why: 'AS without an alias' };
      out = up(alias);
      i += 2;
    }
    if (columns.has(out))
      return { ok: false, why: `output name ${out} repeats` };
    columns.set(out, up(f[1]));
  }
  if (!columns.size && !star) return { ok: false, why: 'empty select list' };
  if (star && columns.size)
    return { ok: false, why: '* together with named columns' };
  return { ok: true, table: up(m[2]), columns, star };
}

export type MaskOptions = {
  ddic: TableDdic;
  /** SELECT list: output column → source field; null = not a SELECT (columns are field names). */
  columns?: Map<string, string> | null;
  star?: boolean;
  /** Table the rows come from (part of the token input). */
  table: string;
  /** Server-side key (maskSecret.ts); never leaves the server. */
  secret: Buffer;
};

/** Mask rows default-deny. */
export function maskRows(
  rows: Record<string, unknown>[],
  salt: string,
  extra: readonly string[],
  opts: MaskOptions,
): {
  rows: Record<string, unknown>[];
  masked: string[];
} {
  const masked = new Set<string>();
  // output column → source field (null: not a field of the table → personal)
  const source = (col: string): string | null => {
    const C = up(col);
    if (opts.columns)
      return opts.columns.has(C)
        ? (opts.columns.get(C) ?? null)
        : opts.star
          ? C
          : null;
    return C;
  };
  const personal = (col: string): boolean => {
    const src = source(col);
    if (!src) return true;
    const dd = opts.ddic[src];
    if (!dd) return true;
    return isPersonalField(src, extra, dd) || isPersonalField(col, extra);
  };
  const out = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r || {})) {
      if (personal(k) && String(v ?? '').trim()) {
        masked.add(up(k));
        // the source field, so an alias does not change the token
        o[k] = maskToken(v, opts.table, source(k) ?? k, salt, opts.secret);
      } else o[k] = v;
    }
    return o;
  });
  return { rows: out, masked: [...masked].sort() };
}

export type MaskSpec = { salt: string; extraFields: string[] };

/** The `mask` argument, checked; a string says what is wrong; null when absent. */
export function maskSpecFrom(raw: unknown): MaskSpec | string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw))
    return 'mask must be an object { salt, extra_fields? }';
  const { salt, extra_fields: extra } = raw as Record<string, unknown>;
  if (typeof salt !== 'string' || !/^[0-9a-f]{16,64}$/i.test(salt))
    return 'mask.salt must be 16–64 hex characters';
  if (
    extra !== undefined &&
    (!Array.isArray(extra) ||
      extra.some((f) => typeof f !== 'string' || !/^[\w/]{1,30}$/.test(f)))
  )
    return 'mask.extra_fields must be a list of field names';
  return { salt, extraFields: ((extra as string[]) ?? []).map(up) };
}
