/**
 * GetAreaMenu — read-only: an SE43 area menu as a flat list of entries with
 * their folder path.
 *
 * Storage (structure type BMENU, see TTREETYPE):
 *   TTREE      header   ID = menu name, TYPE = 'BMENU', MASTERLANG
 *   TMENU01    nodes    TREE_ID = menu, NODE_ID / PARENT_ID / BROTHER_ID,
 *                       NODE_TYPE NULL = folder, TCOD = t-code, AMRF = link to
 *                       another area menu
 *   TMENU01R   targets  NODE_ID → REF_TYPE TCOD (t-code) / TREE (menu);
 *                       every node also carries a BMFR row (ignored)
 *   TMENU01T   texts    TREE_ID + NODE_ID + SPRAS → TEXT
 *
 * TMENU01R has no menu key, so it is read in NODE_ID batches. Every read is a
 * single-table SELECT, which also runs through ZMCP_ADT_DISPATCH TABLE_READ on
 * BASIS < 7.50 (row cap 5000 per call).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
} from '@babamba2/mcp-abap-adt-interfaces';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  DISPATCH_MAX_ROWS,
  isLegacyUnsupported,
  legacyTableRead,
} from '../../../lib/legacyTableRead';
import { safeOutputPath } from '../../../lib/sourceOutput';
import { parseSqlQueryXml } from './handleGetSqlQuery';

export const TOOL_DEFINITION = {
  name: 'GetAreaMenu',
  available_in: ['onprem'] as const,
  description:
    '[read-only] Read an SE43 area menu (e.g. a customer menu ZXX00) as a flat list: every t-code with its folder path, plus the folders and the links to other area menus. Links to customer menus (Z / Y / namespace) are followed by default. Pass menu_pattern (e.g. "Z*") instead of menu to list the area menus.',
  inputSchema: {
    type: 'object',
    properties: {
      menu: {
        type: 'string',
        description: 'Area menu name (SE43), e.g. ZXX00.',
      },
      menu_pattern: {
        type: 'string',
        description:
          'List area menus instead: name pattern with * (e.g. "Z*"). Returns name, master language, last change.',
      },
      follow_links: {
        type: 'string',
        enum: ['customer', 'all', 'none'],
        default: 'customer',
        description:
          'Linked area menus: "customer" follows Z / Y / namespace menus only (default), "all" also SAP menus, "none" lists the links only.',
      },
      language: {
        type: 'string',
        description:
          'SAP one-character language key for texts (e.g. E, 3). Default: the menu master language. Falls back to the master language, then E.',
      },
      output: {
        type: 'string',
        enum: ['inline', 'file'],
        default: 'inline',
        description:
          '"file" writes the full result as JSON under the MCP output dir (areamenu/<menu>-<time>.json) and returns the path and counts only. Prefer it for large menus.',
      },
    },
  },
} as const;

export interface AreaMenuEntry {
  tcode: string;
  text: string;
  /** folder texts from the top folder down to the entry's own folder */
  path: string[];
  /** area menu the node belongs to (differs from the requested menu for followed links) */
  menu: string;
}

export interface AreaMenuLink {
  from_menu: string;
  path: string[];
  target: string;
  followed: boolean;
  reason?: 'sap_menu' | 'not_found' | 'cycle' | 'not_requested';
}

export interface AreaMenuPart {
  menu: string;
  masterLang: string;
  nodes: Array<Record<string, any>>;
  texts: Array<Record<string, any>>;
  refs: Array<Record<string, any>>;
}

const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
const str = (v: unknown) => String(v ?? '').trim();
/** Texts stored in a code page the system cannot show come back as '#' only. */
const isGarbled = (t: string) => !t || /^[#\s()[\]\-_/.,:]*$/.test(t);

export const isCustomerMenu = (name: string) => /^([ZY]|\/)/i.test(name);

/** Pick a node text: requested language → master language → E → any readable. */
export function pickTexts(
  texts: Array<Record<string, any>>,
  language: string | undefined,
  masterLang: string,
): Map<string, string> {
  const order = [language, masterLang, 'E'].filter(Boolean) as string[];
  const best = new Map<string, { rank: number; text: string }>();
  for (const r of texts) {
    const text = str(r.TEXT);
    if (isGarbled(text)) continue;
    const idx = order.indexOf(str(r.SPRAS));
    const rank = idx < 0 ? order.length : idx;
    const id = str(r.NODE_ID);
    const cur = best.get(id);
    if (!cur || rank < cur.rank) best.set(id, { rank, text });
  }
  return new Map([...best].map(([k, v]) => [k, v.text]));
}

/**
 * Children in menu order: BROTHER_ID points to the next sibling, so the first
 * child is the one no sibling points to. Broken chains keep the rest in input
 * order.
 */
function orderChildren(kids: Array<Record<string, any>>) {
  const byId = new Map(kids.map((k) => [str(k.NODE_ID), k]));
  const pointed = new Set(kids.map((k) => str(k.BROTHER_ID)).filter(Boolean));
  const out: Array<Record<string, any>> = [];
  const seen = new Set<string>();
  for (const start of kids.filter((k) => !pointed.has(str(k.NODE_ID)))) {
    let cur: Record<string, any> | undefined = start;
    while (cur && !seen.has(str(cur.NODE_ID))) {
      seen.add(str(cur.NODE_ID));
      out.push(cur);
      cur = byId.get(str(cur.BROTHER_ID));
    }
  }
  for (const k of kids) if (!seen.has(str(k.NODE_ID))) out.push(k);
  return out;
}

/** Walk one menu's nodes into entries, folders and links (no SAP access). */
export function walkAreaMenu(
  part: AreaMenuPart,
  language: string | undefined,
  basePath: string[] = [],
): {
  entries: AreaMenuEntry[];
  folders: string[][];
  links: Array<{ path: string[]; target: string }>;
  title: string;
} {
  const text = pickTexts(part.texts, language, part.masterLang);
  const target = new Map<string, { type: string; object: string }>();
  for (const r of part.refs) {
    const type = str(r.REF_TYPE);
    if (type === 'TCOD' || type === 'TREE')
      target.set(str(r.NODE_ID), { type, object: str(r.REF_OBJECT) });
  }
  const ids = new Set(part.nodes.map((n) => str(n.NODE_ID)));
  const kids = new Map<string, Array<Record<string, any>>>();
  const roots: Array<Record<string, any>> = [];
  for (const n of part.nodes) {
    const parent = str(n.PARENT_ID);
    if (!parent || !ids.has(parent)) roots.push(n);
    else {
      if (!kids.has(parent)) kids.set(parent, []);
      kids.get(parent)!.push(n);
    }
  }
  const entries: AreaMenuEntry[] = [];
  const folders: string[][] = [];
  const links: Array<{ path: string[]; target: string }> = [];
  // The single root is the menu itself: its text is the title, not a folder.
  const title =
    roots.length === 1 ? (text.get(str(roots[0].NODE_ID)) ?? '') : '';
  const visit = (n: Record<string, any>, path: string[]) => {
    const id = str(n.NODE_ID);
    const type = str(n.NODE_TYPE);
    const ref = target.get(id);
    const label = text.get(id) ?? '';
    if (type === 'TCOD' || ref?.type === 'TCOD') {
      if (ref?.object)
        entries.push({ tcode: ref.object, text: label, path, menu: part.menu });
      return;
    }
    if (type === 'AMRF' || ref?.type === 'TREE') {
      if (ref?.object) links.push({ path, target: ref.object });
      return;
    }
    const own = [...path, label || id];
    folders.push(own);
    for (const c of orderChildren(kids.get(id) ?? [])) visit(c, own);
  };
  for (const r of orderChildren(roots)) {
    if (roots.length === 1)
      for (const c of orderChildren(kids.get(str(r.NODE_ID)) ?? []))
        visit(c, basePath);
    else visit(r, basePath);
  }
  return { entries, folders, links, title };
}

async function selectRows(
  connection: IAbapConnection,
  logger: ILogger | undefined,
  table: string,
  fields: string[],
  where: string,
  maxRows = DISPATCH_MAX_ROWS,
): Promise<{ rows: Array<Record<string, any>>; truncated: boolean }> {
  const sql = `SELECT ${fields.join(', ')} FROM ${table} WHERE ${where}`;
  try {
    const response = await createAdtClient(connection, logger)
      .getUtils()
      .getSqlQuery({ sql_query: sql, row_number: maxRows });
    const parsed = parseSqlQueryXml(response.data, sql, maxRows, logger);
    return { rows: parsed.rows, truncated: parsed.truncated === true };
  } catch (e) {
    if (!isLegacyUnsupported(e)) throw e;
    const res = await legacyTableRead(connection, {
      table,
      fields,
      where,
      maxRows,
      sqlQuery: sql,
    });
    return { rows: res.rows, truncated: res.truncated === true };
  }
}

/** NODE_IDs per TMENU01R read (32-char GUIDs; keeps the condition short). */
export const REF_BATCH = 60;

async function readMenu(
  connection: IAbapConnection,
  logger: ILogger | undefined,
  menu: string,
  warnings: string[],
): Promise<AreaMenuPart | null> {
  const head = await selectRows(
    connection,
    logger,
    'TTREE',
    ['ID', 'MASTERLANG'],
    `TYPE = 'BMENU' AND ID = ${q(menu)}`,
    2,
  );
  if (!head.rows.length) return null;
  const masterLang = str(head.rows[0].MASTERLANG) || 'E';
  const nodes = await selectRows(
    connection,
    logger,
    'TMENU01',
    ['NODE_ID', 'PARENT_ID', 'BROTHER_ID', 'NODE_TYPE'],
    `TREE_ID = ${q(menu)}`,
  );
  if (nodes.truncated)
    warnings.push(`${menu}: more than ${DISPATCH_MAX_ROWS} nodes — tree cut`);
  const texts = await selectRows(
    connection,
    logger,
    'TMENU01T',
    ['NODE_ID', 'SPRAS', 'TEXT'],
    `TREE_ID = ${q(menu)}`,
  );
  if (texts.truncated)
    warnings.push(
      `${menu}: more than ${DISPATCH_MAX_ROWS} texts — some missing`,
    );
  const refIds = nodes.rows
    .filter((n) => ['TCOD', 'AMRF'].includes(str(n.NODE_TYPE)))
    .map((n) => str(n.NODE_ID));
  const refs: Array<Record<string, any>> = [];
  for (let i = 0; i < refIds.length; i += REF_BATCH) {
    const batch = refIds.slice(i, i + REF_BATCH);
    const res = await selectRows(
      connection,
      logger,
      'TMENU01R',
      ['NODE_ID', 'REF_TYPE', 'REF_OBJECT'],
      `REF_TYPE IN ('TCOD','TREE') AND NODE_ID IN (${batch.map(q).join(',')})`,
      batch.length * 4,
    );
    refs.push(...res.rows);
  }
  return { menu, masterLang, nodes: nodes.rows, texts: texts.rows, refs };
}

async function listMenus(
  connection: IAbapConnection,
  logger: ILogger | undefined,
  pattern: string,
) {
  const like = pattern.toUpperCase().replace(/\*/g, '%');
  const res = await selectRows(
    connection,
    logger,
    'TTREE',
    ['ID', 'MASTERLANG', 'LUSER', 'LDATE'],
    `TYPE = 'BMENU' AND ID LIKE ${q(like)}`,
  );
  return {
    success: true,
    pattern,
    count: res.rows.length,
    truncated: res.truncated,
    menus: res.rows.map((r) => ({
      menu: str(r.ID),
      master_language: str(r.MASTERLANG),
      changed_by: str(r.LUSER),
      changed_on: str(r.LDATE),
    })),
  };
}

export async function handleGetAreaMenu(context: HandlerContext, args: any) {
  const { connection, logger } = context;
  try {
    if (!args?.menu && args?.menu_pattern) {
      const payload = await listMenus(
        connection,
        logger,
        str(args.menu_pattern),
      );
      return {
        isError: false,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }
    const menu = str(args?.menu).toUpperCase();
    if (!menu) throw new Error('menu or menu_pattern is required');
    const follow: 'customer' | 'all' | 'none' = ['all', 'none'].includes(
      args?.follow_links,
    )
      ? args.follow_links
      : 'customer';
    const language = args?.language ? str(args.language) : undefined;
    const warnings: string[] = [];

    const entries: AreaMenuEntry[] = [];
    const folders: string[][] = [];
    const links: AreaMenuLink[] = [];
    const menus: string[] = [];
    let title = '';
    const seen = new Set<string>();
    const queue: Array<{ menu: string; path: string[] }> = [{ menu, path: [] }];
    while (queue.length) {
      const job = queue.shift()!;
      seen.add(job.menu);
      const part = await readMenu(connection, logger, job.menu, warnings);
      if (!part) {
        if (job.menu === menu)
          throw new Error(`Area menu ${menu} not found (TTREE, type BMENU)`);
        continue;
      }
      menus.push(job.menu);
      const walked = walkAreaMenu(part, language, job.path);
      if (job.menu === menu) title = walked.title;
      entries.push(...walked.entries);
      folders.push(...walked.folders);
      for (const l of walked.links) {
        const t = l.target.toUpperCase();
        let followed = false;
        let reason: AreaMenuLink['reason'];
        if (follow === 'none') reason = 'not_requested';
        else if (follow === 'customer' && !isCustomerMenu(t))
          reason = 'sap_menu';
        else if (seen.has(t) || queue.some((x) => x.menu === t))
          reason = 'cycle';
        else {
          followed = true;
          queue.push({ menu: t, path: l.path });
        }
        links.push({
          from_menu: job.menu,
          path: l.path,
          target: t,
          followed,
          ...(reason ? { reason } : {}),
        });
      }
    }
    // A link that was queued but not found
    for (const l of links)
      if (l.followed && !menus.includes(l.target)) {
        l.followed = false;
        l.reason = 'not_found';
      }

    const tcodes = [...new Set(entries.map((e) => e.tcode))].sort();
    const payload = {
      success: true,
      menu,
      title,
      menus_read: menus,
      counts: {
        entries: entries.length,
        distinct_tcodes: tcodes.length,
        folders: folders.length,
        links: links.length,
      },
      entries,
      folders,
      links,
      tcodes,
      ...(warnings.length ? { warnings } : {}),
    };
    let text = JSON.stringify(payload);
    if (args?.output === 'file') {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
      const target = safeOutputPath(
        path.join(
          'areamenu',
          `${menu.replace(/[^A-Z0-9_]/gi, '_')}-${stamp}.json`,
        ),
      );
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text, 'utf8');
      text = JSON.stringify({
        success: true,
        output: 'file',
        path: target,
        menu,
        title,
        menus_read: menus,
        counts: payload.counts,
        ...(warnings.length ? { warnings } : {}),
      });
    }
    return { isError: false, content: [{ type: 'text', text }] };
  } catch (error) {
    logger?.error('GetAreaMenu failed', error as any);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ADT error: ${String((error as Error)?.message ?? error)}`,
        },
      ],
    };
  }
}
