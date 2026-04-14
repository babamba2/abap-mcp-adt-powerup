/**
 * Table extraction blocklist (defense-in-depth, server-side).
 *
 * Even when a downstream client (Claude Code, custom MCP host) does not
 * enforce an extraction policy, this guard refuses row-returning calls
 * (`GetTableContents`, `GetSqlQuery`) against tables containing PII,
 * credentials, payroll, banking, or other protected data.
 *
 * Schema-only calls (`GetTable`, `GetStructure`, `GetView`,
 * `GetDataElement`, `GetDomain`) are unaffected — they return DDIC
 * metadata, not rows.
 *
 * ## Profiles
 *   - `minimal`  — PII + credentials only
 *   - `standard` — minimal + Protected Business Data        (default)
 *   - `strict`   — standard + Audit/Security + Comm/Workflow
 *   - `off`     — disable the guard entirely (NOT recommended)
 *
 * Configure via env:
 *   - `MCP_BLOCKLIST_PROFILE`  — one of the profile names above
 *   - `MCP_BLOCKLIST_EXTEND`   — comma-separated extra names/patterns (always denied)
 *   - `MCP_ALLOW_TABLE`        — comma-separated names to whitelist for the
 *                                current process (audited via stderr)
 *
 * Patterns use `*` as `[A-Z0-9_]*` and are matched case-insensitively.
 */

export type BlocklistAction = 'deny' | 'ask';
export type BlocklistTier = 'minimal' | 'standard' | 'strict';
export type BlocklistProfile = BlocklistTier | 'off';

export interface BlocklistEntry {
  category: string;
  tier: BlocklistTier;
  action: BlocklistAction;
  why: string;
}

export interface BlocklistMatch extends BlocklistEntry {
  table: string;
}

interface RawEntry extends BlocklistEntry {
  names: string[];
}

const TIER_ORDER: Record<BlocklistTier, number> = {
  minimal: 1,
  standard: 2,
  strict: 3,
};

const RAW: RawEntry[] = [
  {
    category: 'Banking / Payment',
    tier: 'minimal',
    action: 'deny',
    why: 'Customer/vendor bank account credentials',
    names: [
      'BNKA',
      'KNBK',
      'LFBK',
      'BUT0BK',
      'T012K',
      'REGUH',
      'REGUP',
      'PAYR',
      'FPLT',
      'FPLTC',
      'CCARD',
      'TCRCO',
      'BSEGC',
      'FPAYH',
      'FPAYHX',
      'FPAYP',
      'FPAYPX',
    ],
  },
  {
    category: 'Customer / Vendor Master PII',
    tier: 'minimal',
    action: 'deny',
    why: 'Name, address, tax ID, DUNS, BP core PII',
    names: [
      'KNA1',
      'KNB1',
      'KNVK',
      'KNVV',
      'KNVL',
      'LFA1',
      'LFB1',
      'LFM1',
      'LFM2',
      'BUT000',
      'BUT020',
      'BUT021',
      'BUT021_FS',
      'BUT050',
      'BUT051',
      'BUT100',
      'BUT0ID',
      'BUT0BANK',
    ],
  },
  {
    category: 'Addresses / Communication',
    tier: 'minimal',
    action: 'deny',
    why: 'Address, phone, fax, email, URL — PII',
    names: [
      'ADRC',
      'ADRP',
      'ADR2',
      'ADR3',
      'ADR6',
      'ADR7',
      'ADR9',
      'ADR11',
      'ADR12',
      'ADR13',
      'ADRT',
      'ADRCT',
    ],
  },
  {
    category: 'Authentication / Authorization / Security',
    tier: 'minimal',
    action: 'deny',
    why: 'Password hashes, auth values, RFC secrets, crypto keys',
    names: [
      'USR02',
      'USH02',
      'USRBF2',
      'USR01',
      'USR04',
      'USR10',
      'USR12',
      'USR21',
      'USR22',
      'USR40',
      'USR41',
      'USR_CUST',
      'AGR_1251',
      'AGR_USERS',
      'AGR_AGRS',
      'PRGN_CUST',
      'RFCDES',
      'RSECACTB',
      'RSECTAB',
      'SNCSYSACL',
      'SSF_PSE_D',
    ],
  },
  {
    category: 'HR / Payroll / Personnel',
    tier: 'minimal',
    action: 'deny',
    why: 'Employee PII, salary, payroll results, medical data',
    names: [
      'PA*',
      'PB9*',
      'PD9*',
      'HRP*',
      'PCL1',
      'PCL2',
      'PCL3',
      'PCL4',
      'PCL5',
      'T526',
    ],
  },
  {
    category: 'Tax / Government IDs',
    tier: 'minimal',
    action: 'deny',
    why: 'Tax IDs, VAT registrations, national IDs',
    names: [
      'DFKKBPTAXNUM',
      'TFKTAXNUMTYPE',
      'J_1BTXIC3',
      'J_1BNFDOC',
      'KNAS',
      'LFAS',
      'BUT0TX',
    ],
  },
  {
    category: 'Protected Business Data',
    tier: 'standard',
    action: 'ask',
    why: 'Transactional data with linked customer/vendor PII; allow only with user-authorized scope and anonymization',
    names: [
      'VBRK',
      'VBRP',
      'VBAK',
      'VBAP',
      'VBPA',
      'EKKO',
      'EKPO',
      'BKPF',
      'BSEG',
      'ACDOCA',
      'FAGLFLEXA',
      'FAGLFLEXT',
      'CDHDR',
      'CDPOS',
      'STXH',
      'STXL',
    ],
  },
  {
    category: 'Audit / Security Logs',
    tier: 'strict',
    action: 'deny',
    why: 'May contain PII in message vars, user activity traces',
    names: [
      'BALDAT',
      'BALHDR',
      'SLG1',
      'SLGD',
      'RSAU_BUF_DATA',
      'SNAP',
      'SMONI',
      'SWNCMONI',
      'SWNCT*',
      'STAD',
      'STATTRACE',
      'DBTABLOG',
    ],
  },
  {
    category: 'Communication & Workflow',
    tier: 'strict',
    action: 'deny',
    why: 'Mail body, workflow context, broadcast records',
    names: [
      'SOOD',
      'SOC3',
      'SOST',
      'SOFM',
      'SWWWIHEAD',
      'SWWCONT',
      'SWWLOGHIST',
      'BCST_SR',
      'BCST_CAM',
    ],
  },
];

interface CompiledEntry extends BlocklistEntry {
  exact: Set<string>;
  patterns: RegExp[];
}

const COMPILED: CompiledEntry[] = RAW.map((e) => {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const raw of e.names) {
    const upper = raw.toUpperCase();
    if (upper.includes('*')) {
      patterns.push(new RegExp(`^${upper.replace(/\*/g, '[A-Z0-9_]*')}$`));
    } else {
      exact.add(upper);
    }
  }
  return {
    category: e.category,
    tier: e.tier,
    action: e.action,
    why: e.why,
    exact,
    patterns,
  };
});

function readProfile(): BlocklistProfile {
  const raw = (process.env.MCP_BLOCKLIST_PROFILE || '').toLowerCase().trim();
  if (
    raw === 'off' ||
    raw === 'minimal' ||
    raw === 'standard' ||
    raw === 'strict'
  ) {
    return raw as BlocklistProfile;
  }
  return 'standard';
}

function readSetEnv(name: string): Set<string> {
  const out = new Set<string>();
  const raw = process.env[name];
  if (!raw) return out;
  for (const tok of raw.split(/[,\s]+/)) {
    const t = tok.trim().toUpperCase();
    if (t) out.add(t);
  }
  return out;
}

function readExtendPatterns(): { exact: Set<string>; patterns: RegExp[] } {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const t of readSetEnv('MCP_BLOCKLIST_EXTEND')) {
    if (t.includes('*'))
      patterns.push(new RegExp(`^${t.replace(/\*/g, '[A-Z0-9_]*')}$`));
    else exact.add(t);
  }
  return { exact, patterns };
}

/**
 * True when the SELECT projection contains only aggregate calls
 * (COUNT/SUM/MIN/MAX/AVG) and no plain column references. Used to exempt
 * row-count and aggregate queries from the blocklist — they don't return
 * row-level PII even on protected tables.
 *
 * Rejects: subqueries, UNION, GROUP BY (which surfaces grouping keys).
 */
export function isAggregateOnly(sql: string): boolean {
  const norm = sql.replace(/\s+/g, ' ').trim();
  if (/\b(UNION|GROUP\s+BY|HAVING)\b/i.test(norm)) return false;
  const m = norm.match(/^SELECT\s+(.+?)\s+FROM\s+/i);
  if (!m) return false;
  const projection = m[1];
  if (/\(\s*SELECT\b/i.test(projection)) return false;

  const items = splitTopLevel(projection, ',');
  if (items.length === 0) return false;
  const aggRe =
    /^(?:COUNT|SUM|MIN|MAX|AVG)\s*\(\s*(?:DISTINCT\s+)?(?:\*|[A-Z0-9_./~]+)\s*\)(?:\s+AS\s+[A-Z0-9_]+)?$/i;
  return items.every((item) => aggRe.test(item.trim()));
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/**
 * Extract candidate table names from a freestyle SQL string.
 * Matches `FROM table` and `JOIN table` (no schema qualifier).
 */
export function extractTablesFromSql(sql: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+([A-Z0-9_/]+)/gi;
  for (const match of sql.matchAll(re)) {
    out.add(match[1].toUpperCase());
  }
  return [...out];
}

function matchOne(
  name: string,
  profile: BlocklistProfile,
): BlocklistMatch | null {
  if (profile === 'off') return null;
  const upper = name.toUpperCase();
  const maxTier = TIER_ORDER[profile];
  for (const e of COMPILED) {
    if (TIER_ORDER[e.tier] > maxTier) continue;
    if (e.exact.has(upper) || e.patterns.some((p) => p.test(upper))) {
      return {
        table: upper,
        category: e.category,
        tier: e.tier,
        action: e.action,
        why: e.why,
      };
    }
  }
  return null;
}

/**
 * Check a list of candidate table names against the active blocklist.
 * Whitelisted entries (`MCP_ALLOW_TABLE`) are removed from the result and
 * logged to stderr for audit.
 */
export function checkTables(names: string[]): BlocklistMatch[] {
  const profile = readProfile();
  if (profile === 'off') return [];

  const allow = readSetEnv('MCP_ALLOW_TABLE');
  const extend = readExtendPatterns();
  const hits: BlocklistMatch[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    const upper = raw.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);

    if (allow.has(upper)) {
      process.stderr.write(
        `[mcp-abap-adt][blocklist] AUDIT: MCP_ALLOW_TABLE bypass for ${upper}\n`,
      );
      continue;
    }

    let m = matchOne(upper, profile);
    if (!m) {
      if (
        extend.exact.has(upper) ||
        extend.patterns.some((p) => p.test(upper))
      ) {
        m = {
          table: upper,
          category: 'User-extended blocklist',
          tier: 'minimal',
          action: 'deny',
          why: 'Listed in MCP_BLOCKLIST_EXTEND',
        };
      }
    }
    if (m) hits.push(m);
  }
  return hits;
}

/**
 * Build a human-readable refusal message for a set of blocklist hits.
 */
export function formatRefusal(
  hits: BlocklistMatch[],
  profile: BlocklistProfile = readProfile(),
): string {
  const lines = hits
    .map((h) => `  - ${h.table} — ${h.category} (${h.action}): ${h.why}`)
    .join('\n');
  return (
    `mcp-abap-adt blocklist (profile: ${profile}) — row extraction refused:\n${lines}\n\n` +
    `Schema metadata is allowed (GetTable / GetStructure / GetView / GetDataElement / GetDomain). ` +
    `For row data, use a released CDS view that masks PII, anonymized test data, or COUNT/SUM aggregates. ` +
    `For an audited one-off bypass set MCP_ALLOW_TABLE=<NAME[,NAME...]> in the server environment.`
  );
}

/**
 * Build a user-confirmation prompt for 'ask'-tier hits. The caller is
 * expected to surface this to the user and re-invoke the tool with
 * `acknowledge_risk: true` once the user has authorized the extraction.
 */
export function formatAskPrompt(
  hits: BlocklistMatch[],
  profile: BlocklistProfile = readProfile(),
): string {
  const lines = hits
    .map((h) => `  - ${h.table} — ${h.category}: ${h.why}`)
    .join('\n');
  return (
    `mcp-abap-adt blocklist (profile: ${profile}) — user confirmation required for row extraction:\n${lines}\n\n` +
    `These tables contain sensitive business data. If the user has authorized this extraction, ` +
    `re-invoke the tool with \`acknowledge_risk: true\` to proceed. ` +
    `The approval will be logged to stderr for audit. ` +
    `Prefer a released CDS view that masks PII, anonymized test data, or COUNT/SUM aggregates when possible.`
  );
}

/**
 * Partition hits by action. 'deny' hits are hard-blocked; 'ask' hits may
 * be bypassed with an explicit user acknowledgement (`acknowledge_risk`).
 */
export function partitionHits(hits: BlocklistMatch[]): {
  deny: BlocklistMatch[];
  ask: BlocklistMatch[];
} {
  const deny: BlocklistMatch[] = [];
  const ask: BlocklistMatch[] = [];
  for (const h of hits) {
    if (h.action === 'ask') ask.push(h);
    else deny.push(h);
  }
  return { deny, ask };
}

/**
 * Evaluate blocklist hits against a user-provided acknowledgement flag.
 * Returns one of:
 *   - { kind: 'pass' }             — no hits, or ask-only + acknowledged
 *   - { kind: 'deny',    message } — contains a 'deny' hit (hard block)
 *   - { kind: 'ask',     message } — contains 'ask' hits and not acknowledged
 *   - { kind: 'approved', tables } — ask-only AND acknowledged (caller must audit-log)
 */
export function evaluateHits(
  hits: BlocklistMatch[],
  acknowledgeRisk: boolean,
  profile: BlocklistProfile = readProfile(),
):
  | { kind: 'pass' }
  | { kind: 'deny'; message: string }
  | { kind: 'ask'; message: string }
  | { kind: 'approved'; tables: string[] } {
  if (hits.length === 0) return { kind: 'pass' };
  const { deny, ask } = partitionHits(hits);
  if (deny.length > 0) {
    return { kind: 'deny', message: formatRefusal(hits, profile) };
  }
  if (!acknowledgeRisk) {
    return { kind: 'ask', message: formatAskPrompt(ask, profile) };
  }
  return { kind: 'approved', tables: ask.map((h) => h.table) };
}

export function activeProfile(): BlocklistProfile {
  return readProfile();
}
