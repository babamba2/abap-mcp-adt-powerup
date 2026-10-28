"use strict";
/**
 * Narrowing of a fetched CUA definition (RS_CUA_INTERNAL_FETCH result) for
 * GetGuiStatus, so a caller who asks for one status or a few function codes
 * does not receive the whole program interface.
 *
 * Links between the tables (field names as serialized by /ui2/cl_json):
 *   STA.CODE ──SET.STATUS──▶ SET.FUNCTION ──▶ FUN.CODE   (functions of a status)
 *   STA.PFKCODE ─▶ PFK.CODE (function keys: PFNO → FUNCODE)
 *   STA.PFKCODE ─▶ BUT.PFK_CODE, STA.BUTCODE ─▶ BUT.CODE (application toolbar: PFNO)
 *   STA.ACTCODE ─▶ ACT.CODE (menu bar) ─▶ MEN / MTX by the menu codes it names
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterCua = filterCua;
exports.compactCua = compactCua;
const rows = (cua, table) => {
    const v = cua?.[table] ?? cua?.[table.toLowerCase()];
    return Array.isArray(v) ? v : [];
};
const str = (r, field) => String(r?.[field] ?? r?.[field.toLowerCase()] ?? '')
    .trim()
    .toUpperCase();
/** The CUA reduced to the given status (and its functions, keys, toolbar,
 *  menus) and / or the given function codes. ADM is kept; TIT, DOC and BIV are
 *  dropped when a status is given (they do not belong to a status). */
function filterCua(cua, { statusName, functionCodes }) {
    if (!cua || (!statusName && !functionCodes?.length))
        return cua;
    const out = { ...cua };
    const fcodes = functionCodes?.length
        ? new Set(functionCodes.map((c) => c.trim().toUpperCase()))
        : null;
    if (statusName) {
        const st = statusName.toUpperCase();
        const sta = rows(cua, 'STA').filter((r) => str(r, 'CODE') === st);
        const pfk = new Set(sta.map((r) => str(r, 'PFKCODE')).filter(Boolean));
        const but = new Set(sta.map((r) => str(r, 'BUTCODE')).filter(Boolean));
        const act = new Set(sta.map((r) => str(r, 'ACTCODE')).filter(Boolean));
        const set = rows(cua, 'SET').filter((r) => str(r, 'STATUS') === st);
        const inStatus = new Set(set.map((r) => str(r, 'FUNCTION')));
        const actRows = rows(cua, 'ACT').filter((r) => act.has(str(r, 'CODE')));
        // menus named by the menu bar, and their sub-menus (one level per pass)
        const menus = new Set();
        const collect = (rs) => {
            for (const r of rs)
                for (const v of Object.values(r))
                    if (typeof v === 'string' && v.trim())
                        menus.add(v.trim().toUpperCase());
        };
        collect(actRows);
        let menRows = [];
        for (let i = 0; i < 4; i++) {
            menRows = rows(cua, 'MEN').filter((r) => menus.has(str(r, 'CODE')));
            const before = menus.size;
            collect(menRows);
            if (menus.size === before)
                break;
        }
        Object.assign(out, {
            STA: sta,
            SET: set,
            FUN: rows(cua, 'FUN').filter((r) => inStatus.has(str(r, 'CODE'))),
            PFK: rows(cua, 'PFK').filter((r) => pfk.has(str(r, 'CODE'))),
            BUT: rows(cua, 'BUT').filter((r) => pfk.has(str(r, 'PFK_CODE')) && (!but.size || but.has(str(r, 'CODE')))),
            ACT: actRows,
            MEN: menRows,
            MTX: rows(cua, 'MTX').filter((r) => menus.has(str(r, 'CODE'))),
        });
        for (const t of ['TIT', 'DOC', 'BIV', 'tit', 'doc', 'biv'])
            delete out[t];
        for (const t of ['sta', 'set', 'fun', 'pfk', 'but', 'act', 'men', 'mtx'])
            delete out[t];
    }
    if (fcodes) {
        const pfkRows = rows(out, 'PFK').filter((r) => fcodes.has(str(r, 'FUNCODE')));
        const pfnos = new Set(pfkRows.map((r) => `${str(r, 'CODE')}/${str(r, 'PFNO')}`));
        Object.assign(out, {
            FUN: rows(out, 'FUN').filter((r) => fcodes.has(str(r, 'CODE'))),
            SET: rows(out, 'SET').filter((r) => fcodes.has(str(r, 'FUNCTION'))),
            PFK: pfkRows,
            BUT: rows(out, 'BUT').filter((r) => pfnos.has(`${str(r, 'PFK_CODE')}/${str(r, 'PFNO')}`)),
        });
        for (const t of ['fun', 'set', 'pfk', 'but'])
            delete out[t];
    }
    return out;
}
/** One line per function of each status: code, text, icon, function key, on the toolbar. */
function compactCua(cua) {
    const fun = new Map();
    for (const r of rows(cua, 'FUN')) {
        const c = str(r, 'CODE');
        if (!fun.has(c) || (!fun.get(c)?.FUN_TEXT && r.FUN_TEXT))
            fun.set(c, r);
    }
    const statuses = rows(cua, 'STA').map((s) => {
        const code = str(s, 'CODE');
        const pfk = str(s, 'PFKCODE');
        const butCode = str(s, 'BUTCODE');
        const keys = new Map();
        for (const k of rows(cua, 'PFK').filter((r) => str(r, 'CODE') === pfk))
            if (!keys.has(str(k, 'FUNCODE')))
                keys.set(str(k, 'FUNCODE'), str(k, 'PFNO'));
        const onBar = new Set(rows(cua, 'BUT')
            .filter((r) => str(r, 'PFK_CODE') === pfk &&
            (!butCode || str(r, 'CODE') === butCode))
            .map((r) => str(r, 'PFNO')));
        const codes = rows(cua, 'SET')
            .filter((r) => str(r, 'STATUS') === code)
            .map((r) => str(r, 'FUNCTION'));
        const functions = [...new Set(codes)].map((c) => {
            const f = fun.get(c) ?? {};
            const fn = {
                code: c,
                text: String(f.FUN_TEXT || f.TEXT_NAME || '').trim(),
            };
            const icon = String(f.ICON_ID || '').trim();
            if (icon)
                fn.icon = icon;
            const pfno = keys.get(c);
            if (pfno) {
                fn.fkey = pfno;
                if (onBar.has(pfno))
                    fn.toolbar = true;
            }
            return fn;
        });
        return { code, type: str(s, 'MODAL'), functions };
    });
    return { statuses };
}
//# sourceMappingURL=cuaFilter.js.map