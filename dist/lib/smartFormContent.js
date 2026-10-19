"use strict";
/**
 * SmartForm content — what each window prints, for preview rendering.
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_CONTENT → FM ZMCP_SSF_CONTENT
 * (sc4sap/abap/zmcp_ssf_content.abap), read-only, four parts:
 *   FORM     Form Builder XML of the active version (FB_CONVERT_FORM_TO_XML,
 *            texts in the logon language), base64
 *   STYLE    SmartStyle as CSS (SSF_CONVERT_STYLE_TO_CSS), base64
 *   GRAPHIC  SE78 graphic as BMP + STXBITMAPS size data, base64
 *   STDTEXT  SO10 / include text lines (READ_TEXT)
 *
 * This module parses the XML into pages → windows → content nodes (text,
 * table / template / loop / folder sections, graphics, addresses, code
 * markers, conditions), then fetches the styles, the graphics with a fixed
 * key and the include texts with a fixed key. Files (XML, CSS, BMP) are
 * written under the MCP output directory; the JSON carries their paths.
 */
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
exports.SSF_CONTENT_INSTALL_HINT = void 0;
exports.hasSymbol = hasSymbol;
exports.plain = plain;
exports.parseSmartFormXml = parseSmartFormXml;
exports.translateSmartFormContentError = translateSmartFormContentError;
exports.symbolsOf = symbolsOf;
exports.summarizeSmartFormContent = summarizeSmartFormContent;
exports.getSmartFormContent = getSmartFormContent;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const fast_xml_parser_1 = require("fast-xml-parser");
const rfcBackend_1 = require("./rfcBackend");
const smartFormLayout_1 = require("./smartFormLayout");
const sourceOutput_1 = require("./sourceOutput");
exports.SSF_CONTENT_INSTALL_HINT = 'The SAP side of GetSmartFormContent is not installed on this system: it needs FM ZMCP_SSF_CONTENT ' +
    '(function group ZMCP_ADT_UTILS, next to ZMCP_SSF_LAYOUT) and the SSF_CONTENT branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_content.abap, zmcp_adt_dispatch_ssf_content_branch.abap).';
/** A field value contains a symbol such as &GV_LOGO& — resolved only at print time. */
function hasSymbol(v) {
    return /&[^&\s]+&/.test(String(v ?? ''));
}
function asArray(v) {
    if (v === undefined || v === null)
        return [];
    return Array.isArray(v) ? v : [v];
}
function str(v) {
    if (v === undefined || v === null)
        return '';
    if (typeof v === 'object') {
        const t = v['#text'];
        return t === undefined || t === null ? '' : String(t);
    }
    return String(v);
}
function trimmed(v) {
    return str(v).trim();
}
/**
 * Turn a field element into a plain value: `<X><item>…</item>…</X>` → array,
 * an element with children → object, a leaf → string. Attributes are kept
 * only for ID / IDREF.
 */
function plain(v) {
    if (v === undefined || v === null)
        return '';
    if (Array.isArray(v))
        return v.map(plain);
    if (typeof v !== 'object')
        return String(v);
    const o = v;
    const keys = Object.keys(o).filter((k) => !k.startsWith('@_') && k !== '#text');
    if (keys.length === 0)
        return str(o);
    if (keys.length === 1 && keys[0] === 'item')
        return asArray(o.item).map(plain);
    const out = {};
    for (const k of keys)
        out[k] = plain(o[k]);
    return out;
}
/** Scalar fields of an object element that are not empty. */
function scalars(o) {
    const out = {};
    for (const [k, v] of Object.entries(o ?? {})) {
        if (k.startsWith('@_') || k === '#text')
            continue;
        if (v === null || v === undefined)
            continue;
        if (typeof v === 'object' && !('#text' in v))
            continue;
        const s = trimmed(v);
        if (s !== '')
            out[k] = s;
    }
    return out;
}
// ---------------------------------------------------------------------------
// XML parsing
// ---------------------------------------------------------------------------
const OBJECT_KINDS = [
    'PAGE',
    'WINDOW',
    'TEXT',
    'SECTION',
    'GRAPHIC',
    'ADDRESS',
    'CODE',
    'COMMAND',
    'CONDITION',
    'EVENT',
];
/** Section types (SECTTYPE). */
const SECTION_KINDS = {
    S: 'template',
    L: 'loop',
    T: 'table46',
};
function sectionKind(code) {
    return SECTION_KINDS[code] ?? (code ? `section-${code}` : 'folder');
}
const TEXT_TYPES = {
    '': 'inline',
    I: 'include',
    R: 'reference',
    D: 'dynamic',
    A: 'application',
    F: 'form',
};
function objectOf(node) {
    const objEl = node?.OBJ;
    if (!objEl || typeof objEl !== 'object')
        return null;
    for (const k of OBJECT_KINDS) {
        if (objEl[k] !== undefined) {
            const o = Array.isArray(objEl[k]) ? objEl[k][0] : objEl[k];
            return { kind: k, obj: (o ?? {}) };
        }
    }
    const first = Object.keys(objEl).find((k) => !k.startsWith('@_') && k !== '#text');
    if (!first)
        return null;
    return { kind: first, obj: (objEl[first] ?? {}) };
}
/** Node name: `<NAME><INAME>%TEXT1</INAME></NAME>`, or a plain INAME / NAME. */
function nameOf(obj) {
    const n = obj?.NAME;
    if (n && typeof n === 'object' && !('#text' in n))
        return trimmed(n.INAME);
    return trimmed(obj?.INAME ?? n);
}
function num(v) {
    const s = trimmed(v);
    if (s === '')
        return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
/** A length in mm from a value and its unit field (CM / MM / IN / PT / TW). */
function mmOf(value, unit) {
    const v = trimmed(value);
    if (v === '')
        return null;
    return (0, smartFormLayout_1.toMm)(v, trimmed(unit).toUpperCase(), smartFormLayout_1.DEFAULT_LPI, smartFormLayout_1.DEFAULT_CPI);
}
/** RGB as #rrggbb, blended toward white when the intensity (%) is below 100. */
function colorOf(c, intensity = 100) {
    if (!c || typeof c !== 'object')
        return undefined;
    const k = Math.max(0, Math.min(100, intensity)) / 100;
    const hex = (x) => {
        const v = Math.max(0, Math.min(255, Number(trimmed(x)) || 0));
        return Math.round(255 - (255 - v) * k)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${hex(c.RED)}${hex(c.GREEN)}${hex(c.BLUE)}`;
}
/** Template lines (STATLINES): line name, line range, height. */
function templateLinesOf(v) {
    return asArray(v?.item).map((it) => ({
        name: trimmed(it?.NAME),
        from: num(it?.LINEFROM),
        to: num(it?.LINETO),
        heightMm: mmOf(it?.LHEIGHT, it?.U_LHEIGHT),
        shading: num(it?.SHADING) ?? 0,
        // a line type that refers to another one takes its height when it has none
        ...(trimmed(it?.REFERENCE) ? { reference: trimmed(it?.REFERENCE) } : {}),
    }));
}
/** Cells (CELLS): line name, column, width, fill and border widths (mm, 0 = none). */
function cellsOf(v) {
    // A line type that covers a row range (LINEFROM..LINETO) has one BORDERS item
    // per row (IDX 001 = first row of the range): each row may draw other lines.
    const look = (b) => {
        const side = (w, c) => {
            const mm = mmOf(b[w], b[`${w}_U`]) ?? 0;
            return mm > 0 && trimmed(b[c]?.USED) === 'X' ? mm : 0;
        };
        // INTENSITY = shading in % of the colour: 0 means no fill even when USED = X.
        const intensity = num(b.INTENSITY) ?? 100;
        const fill = trimmed(b.FILLCOLOR?.USED) === 'X' && intensity > 0
            ? colorOf(b.FILLCOLOR, intensity)
            : undefined;
        return {
            ...(fill ? { fill } : {}),
            borders: {
                left: side('LLEFT', 'CLEFT'),
                top: side('LTOP', 'CTOP'),
                right: side('LRIGHT', 'CRIGHT'),
                bottom: side('LBOTTOM', 'CBOTTOM'),
            },
        };
    };
    return asArray(v?.item).map((it) => {
        const items = asArray(it?.BORDERS?.item);
        const first = look((items[0] ?? {}));
        const rows = items.map(look);
        const varies = rows.some((r) => JSON.stringify(r) !== JSON.stringify(first));
        return {
            line: trimmed(it?.NAME),
            column: num(it?.COLUMNNR),
            widthMm: mmOf(it?.CWIDTH, it?.U_CWIDTH),
            ...first,
            ...(varies ? { rows } : {}),
        };
    });
}
function captionOf(obj) {
    const c = obj?.CAPTION;
    if (c !== undefined && typeof c !== 'object')
        return trimmed(c);
    if (c && typeof c === 'object' && '#text' in c)
        return trimmed(c);
    // T_CAPTION: [{LANGU / SPRAS, CAPTION / TEXT}] — first entry
    const items = asArray(obj?.T_CAPTION?.item);
    for (const it of items) {
        const t = trimmed(it?.CAPTION ?? it?.TEXT ?? it?.TDCAPTION);
        if (t)
            return t;
    }
    return '';
}
function textLines(v) {
    const items = asArray(v?.item);
    return items.map((it) => ({
        format: trimmed(it?.TDFORMAT),
        text: str(it?.TDLINE).replace(/\s+$/, ''),
    }));
}
function outputAttrs(node) {
    const oa = node?.OUTATTR;
    if (!oa || typeof oa !== 'object')
        return undefined;
    const inner = oa.OUTATTR ?? oa[Object.keys(oa).find((k) => !k.startsWith('@_')) ?? ''];
    const s = scalars((inner ?? oa));
    return Object.keys(s).length ? s : undefined;
}
/**
 * Box of a window / node (output options → Box and shading): per side the
 * line thickness and the distance of the text from it, in mm; shading as a
 * colour blended toward white by its intensity. Undefined when nothing is drawn.
 */
function boxOf(node) {
    const oa = node?.OUTATTR;
    if (!oa || typeof oa !== 'object')
        return undefined;
    const inner = (oa.OUTATTR ??
        oa[Object.keys(oa).find((k) => !k.startsWith('@_')) ?? '']);
    const b = (inner?.BORDER ?? {});
    // a side is drawn only with its <LEFT|TOP|RIGHT|BOTTOM>LINE flag; the
    // thickness is there (default 15 TW) whether the line is on or not.
    // Thickness 0 with the flag on is the printer's thinnest line, not "off"
    // (ZSDRA0390_CI_T %WINDOW3 / %WINDOW7 hairline frames).
    const side = (k) => {
        const a = (b[k] ?? {});
        const on = trimmed(b[k.replace('ATTR', 'LINE')]) === 'X';
        const c = (a.COLOR ?? {});
        return {
            mm: on ? ((0, smartFormLayout_1.toMm)(trimmed(a.THICKNESS), trimmed(a.THICKNESSU)) ?? 0) : 0,
            ...(on ? { on: true } : {}),
            distanceMm: (0, smartFormLayout_1.toMm)(trimmed(a.DISTANCE), trimmed(a.DISTANCEU)) ?? 0,
            color: rgbHex(c),
        };
    };
    const box = {
        left: side('LEFTATTR'),
        top: side('TOPATTR'),
        right: side('RIGHTATTR'),
        bottom: side('BOTTOMATTR'),
    };
    const sh = (inner?.SHADING ?? b.SHADING);
    const fill = sh && typeof sh === 'object' && trimmed(sh.USED) === 'X'
        ? blend(rgbHex((sh.COLOR ?? sh)), num(sh.INTENSITY) ?? 100)
        : undefined;
    const any = Object.values(box).some((s) => s.mm > 0 || s.on);
    if (!any && !fill)
        return undefined;
    return { ...box, ...(fill ? { fill } : {}) };
}
function rgbHex(c) {
    const h = (v) => Math.max(0, Math.min(255, Number(v) || 0))
        .toString(16)
        .padStart(2, '0');
    return `#${h(c?.RED)}${h(c?.GREEN)}${h(c?.BLUE)}`;
}
function blend(hex, intensity) {
    const p = Math.max(0, Math.min(100, intensity)) / 100;
    const ch = (i) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * p)
        .toString(16)
        .padStart(2, '0');
    return `#${ch(1)}${ch(3)}${ch(5)}`;
}
// The four checkboxes of a node's Conditions tab: only on first page / only on
// subsequent pages / only after / only before the end of the main window.
// (L = end of the main window, not the last page: an NLPAGE node of the main
// window prints on a one-page document.)
const OCOND_NAMES = {
    FPAGE: 'firstPage',
    NFPAGE: 'notFirstPage',
    LPAGE: 'afterMainEnd',
    NLPAGE: 'beforeMainEnd',
};
/**
 * Print condition of a node (`<COND><CONDITION>`): the page flags of OCOND
 * by name, other condition fields (field comparisons) raw.
 */
function conditionOf(node) {
    const c = node?.COND;
    if (!c || typeof c !== 'object')
        return undefined;
    const cd = (c.CONDITION ?? c);
    const out = {};
    for (const [k, v] of Object.entries(scalars((cd.OCOND ?? {})))) {
        if (v === 'X')
            out[OCOND_NAMES[k] ?? k] = true;
        else
            out[k] = v;
    }
    for (const [k, v] of Object.entries(cd)) {
        if (k.startsWith('@_') ||
            ['NAME', 'CAPTION', 'T_CAPTION', 'OCOND'].includes(k))
            continue;
        const p = plain(v);
        if (p === '' || (Array.isArray(p) && p.length === 0))
            continue;
        out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
}
const KNOWN_TEXT_FIELDS = new Set([
    'INAME',
    'CAPTION',
    'T_CAPTION',
    'TEXT',
    'T_TEXT',
    'TTYPE',
    'TKEY',
    'STYLE_NAME',
    'TABLINE',
    'INP_FIELDS',
]);
class Walker {
    ids = new Map();
    graphicKeys = new Map();
    /** graphics whose key holds a &symbol& (resolved later from sample values) */
    dynamicGraphics = [];
    textKeys = new Map();
    styles = new Set();
    dynamic = [];
    constructor(root) {
        this.index(root, 0);
    }
    index(v, depth) {
        if (depth > 200 || !v || typeof v !== 'object')
            return;
        if (Array.isArray(v)) {
            for (const x of v)
                this.index(x, depth + 1);
            return;
        }
        const o = v;
        const id = o['@_ID'];
        if (id !== undefined && !this.ids.has(String(id)))
            this.ids.set(String(id), o);
        for (const [k, x] of Object.entries(o)) {
            if (!k.startsWith('@_'))
                this.index(x, depth + 1);
        }
    }
    /** A NODE element may be a reference (IDREF) to a node written earlier. */
    resolve(node) {
        const ref = node?.['@_IDREF'];
        if (ref !== undefined)
            return this.ids.get(String(ref)) ?? node;
        return node;
    }
    succ(node) {
        const s = node?.SUCC;
        if (!s || typeof s !== 'object')
            return [];
        const items = asArray(s.item ?? s.NODE);
        const out = [];
        for (const it of items) {
            // item may wrap a NODE element or be the node itself
            const n = it?.NODE ?? it;
            for (const x of asArray(n))
                out.push(this.resolve(x));
        }
        return out;
    }
    /** Nodes under PROC_CTRL of an object (a window's content). */
    procCtrl(obj) {
        const pc = obj?.PROC_CTRL;
        if (!pc || typeof pc !== 'object')
            return [];
        return asArray(pc.NODE).map((n) => this.resolve(n));
    }
    /**
     * Content nodes for a list of XML nodes. Structural nodes without an
     * object (the RC root container of a window) are replaced by their
     * children.
     */
    contents(nodes, depth) {
        const out = [];
        for (const n of nodes) {
            if (depth > 60)
                break;
            if (!objectOf(n) && !n?.COND) {
                out.push(...this.contents(this.succ(n), depth + 1));
                continue;
            }
            const c = this.content(n, depth);
            if (c)
                out.push(c);
        }
        return out;
    }
    content(node, depth) {
        if (depth > 60)
            return null;
        const ob = objectOf(node);
        const children = this.contents([...(ob ? this.procCtrl(ob.obj) : []), ...this.succ(node)], depth + 1);
        if (!ob) {
            // structural node without object but with a condition
            if (children.length === 0)
                return null;
            const g = { kind: 'group', name: '', caption: '', children };
            const cond = conditionOf(node);
            if (cond !== undefined)
                g.condition = cond;
            return g;
        }
        const { kind, obj } = ob;
        const out = {
            kind: kind.toLowerCase(),
            name: nameOf(obj),
            caption: captionOf(obj),
            children,
        };
        const cond = conditionOf(node);
        if (cond !== undefined)
            out.condition = cond;
        const nbox = boxOf(node);
        if (nbox)
            out.box = nbox;
        // alternative: its test (COND lines) decides between the TRUE (+) and FALSE (-) events
        if (kind === 'CONDITION' && obj.COND) {
            const t = plain(obj.COND);
            if (Array.isArray(t) && t.length)
                out.test = t;
        }
        const oa = outputAttrs(node);
        if (oa) {
            // inside a table / template the output attributes carry the cell
            const line = oa.T_LINENR;
            const cell = oa.T_CELLNR;
            if (line || cell) {
                out.tableCell = { line: num(line), cell: num(cell) };
                delete oa.T_LINENR;
                delete oa.T_CELLNR;
            }
            // unit fields alone say nothing
            const meaningful = Object.keys(oa).filter((k) => !k.startsWith('U_'));
            if (meaningful.length)
                out.output = oa;
            // a style named only in the output options (template / window STDSTYLE) is read too:
            // texts whose own style is missing print in it (ZSDM43020_SHIPPING ZSDM43020_CMR_STYLE)
            const std = trimmed(oa.STDSTYLE);
            if (std)
                this.styles.add(std);
        }
        switch (kind) {
            case 'TEXT': {
                const tt = trimmed(obj.TTYPE);
                out.textType = TEXT_TYPES[tt] ?? tt;
                const style = trimmed(obj.STYLE_NAME);
                if (style) {
                    out.style = style;
                    this.styles.add(style);
                }
                if (obj.TEXT && typeof obj.TEXT === 'object')
                    out.lines = textLines(obj.TEXT);
                if (tt === 'I' || tt === 'R') {
                    const k = (obj.TKEY ?? {});
                    const key = {
                        object: trimmed(k.OBJECT) || 'TEXT',
                        name: trimmed(k.NAME),
                        id: trimmed(k.ID) || 'ST',
                        language: trimmed(k.LANG),
                        resolved: false,
                    };
                    if (tt === 'R')
                        key.name = key.name || trimmed(obj.REF_NAME);
                    out.include = key;
                    const dyn = [key.object, key.name, key.id, key.language].some(hasSymbol);
                    if (key.name && !dyn) {
                        this.textKeys.set(`${key.object}|${key.name}|${key.id}|${key.language}`, key);
                    }
                    else if (key.name) {
                        this.dynamic.push(`text ${out.name}: ${key.object} ${key.name} ${key.id} ${key.language}`);
                    }
                }
                const tabline = plain(obj.TABLINE);
                if (!out.tableCell &&
                    tabline &&
                    !(Array.isArray(tabline) && tabline.length === 0))
                    out.tableCell = tabline;
                const rest = {};
                for (const [k, v] of Object.entries(scalars(obj))) {
                    if (!KNOWN_TEXT_FIELDS.has(k))
                        rest[k] = v;
                }
                if (Object.keys(rest).length)
                    out.attrs = rest;
                break;
            }
            case 'SECTION': {
                const st = trimmed(obj.SECTTYPE);
                out.kind = sectionKind(st);
                out.sectionType = st;
                const tab = trimmed(obj.TABNAME);
                if (tab)
                    out.dataTable = tab;
                // loop / table WHERE (WCOND lines: OP1 a field of the row, OP2 a value or another field)
                const wc = plain(obj.WCOND);
                if (Array.isArray(wc) && wc.length)
                    out.where = wc;
                const w = trimmed(obj.WIDTH);
                if (w) {
                    const u = trimmed(obj.U_WIDTH).toUpperCase();
                    out.width = {
                        value: w,
                        unit: u,
                        mm: (0, smartFormLayout_1.toMm)(w, u, smartFormLayout_1.DEFAULT_LPI, smartFormLayout_1.DEFAULT_CPI),
                    };
                }
                // table line types (DYNLINES) and template lines (STATLINES) share a shape
                const dyn = templateLinesOf(obj.DYNLINES);
                if (dyn.length)
                    out.lineTypes = dyn;
                const stat = templateLinesOf(obj.STATLINES);
                if (stat.length)
                    out.templateLines = stat;
                const cells = cellsOf(obj.CELLS);
                if (cells.length)
                    out.cells = cells;
                // Pattern + frame of the whole template / table. PATTERN-BORDER = 'X' draws the outer
                // frame for any pattern but 0000 (the pattern gives the inner lines); USEBORDER is the
                // "use cell borders" switch, not the frame.
                const pat = obj.PATTERN;
                if (pat && typeof pat === 'object') {
                    out.frame = {
                        pattern: trimmed(pat.PATTNUM),
                        lineMm: (0, smartFormLayout_1.toMm)(trimmed(pat.FRAME), trimmed(pat.U_FRAME)) ?? 0,
                        outer: trimmed(obj.USEBORDER) === 'X',
                        border: trimmed(pat.BORDER) === 'X',
                    };
                }
                const s = scalars(obj);
                for (const k of ['INAME', 'SECTTYPE', 'TABNAME', 'WIDTH', 'U_WIDTH'])
                    delete s[k];
                if (Object.keys(s).length)
                    out.attrs = s;
                break;
            }
            case 'GRAPHIC': {
                const k = (obj.GKEYBDS ?? {});
                const g = {
                    object: trimmed(k.OBJECT) || 'GRAPHICS',
                    name: trimmed(k.NAME),
                    id: trimmed(k.ID) || 'BMAP',
                    btype: trimmed(k.BTYPE) || 'BCOL',
                    resolution: trimmed(obj.RESOLUTION),
                    dynamic: false,
                };
                g.dynamic = [g.object, g.name, g.id, g.btype].some(hasSymbol);
                out.graphic = g;
                if (g.name && !g.dynamic) {
                    this.graphicKeys.set(`${g.object}|${g.name}|${g.id}|${g.btype}`, g);
                }
                else if (g.name) {
                    this.dynamicGraphics.push(g);
                    this.dynamic.push(`graphic ${out.name}: ${g.object} ${g.name} ${g.id} ${g.btype}`);
                }
                const s = scalars(obj);
                delete s.INAME;
                if (Object.keys(s).length)
                    out.attrs = s;
                break;
            }
            case 'CODE': {
                // Program lines are never returned — only that a code node is here.
                out.attrs = undefined;
                break;
            }
            default: {
                const s = scalars(obj);
                delete s.INAME;
                if (Object.keys(s).length)
                    out.attrs = s;
            }
        }
        return out;
    }
}
function orientationName(raw) {
    const o = raw.toUpperCase();
    if (o === '' || o === 'P')
        return 'portrait';
    if (o === 'L')
        return 'landscape';
    return o;
}
function lengthMm(attrs, key, lpi, cpi) {
    if (!attrs || attrs[key] === undefined)
        return null;
    return (0, smartFormLayout_1.toMm)(attrs[key], attrs[`U_${key}`], lpi, cpi);
}
const IO_SCOPE = {
    I: 'import',
    E: 'export',
    C: 'changing',
    T: 'tables',
};
/** INTERFACE (minus standard parameters and exceptions) + GDATA of the form root. */
function dataDeclsOf(sf) {
    const out = [];
    for (const it of asArray(sf.INTERFACE?.item)) {
        const scope = IO_SCOPE[trimmed(it?.IOTYPE).toUpperCase()];
        if (!scope || trimmed(it?.STANDARD) === 'X')
            continue;
        out.push({
            name: trimmed(it?.NAME),
            scope,
            typing: trimmed(it?.TYPING),
            typeName: trimmed(it?.TYPENAME),
        });
    }
    for (const it of asArray(sf.GDATA?.item)) {
        out.push({
            name: trimmed(it?.NAME),
            scope: 'global',
            typing: trimmed(it?.TYPING),
            typeName: trimmed(it?.TYPENAME),
        });
    }
    return out.filter((d) => d.name);
}
/** Parse the Form Builder XML of FB_CONVERT_FORM_TO_XML. */
function parseSmartFormXml(xml) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: false,
        isArray: (name) => name === 'item',
    });
    const doc = parser.parse(xml);
    const sf = (doc.SMARTFORM ?? doc);
    const walker = new Walker(sf);
    const pages = [];
    const stdStyles = [];
    const variants = asArray(sf.VARHEADER?.item);
    for (const v of variants) {
        const lpi = Number(trimmed(v.LPI)) || smartFormLayout_1.DEFAULT_LPI;
        const cpi = Number(trimmed(v.CPI)) || smartFormLayout_1.DEFAULT_CPI;
        const std = trimmed(v.STDSTYLE);
        if (std && !stdStyles.includes(std))
            stdStyles.push(std);
        const tree = v.PAGETREE;
        const roots = asArray((tree?.NODE ?? tree)).map((n) => walker.resolve(n));
        const visit = (node, depth) => {
            if (depth > 40)
                return;
            const ob = objectOf(node);
            if (ob?.kind === 'PAGE') {
                const p = ob.obj;
                const page = {
                    variant: trimmed(v.VARI),
                    name: nameOf(p),
                    caption: captionOf(p),
                    format: trimmed(v.PAGEFORMAT),
                    orientation: orientationName(trimmed(p.PAGEORTN)),
                    nextPage: p.NEXTPAGE && typeof p.NEXTPAGE === 'object'
                        ? nameOf({ NAME: p.NEXTPAGE })
                        : trimmed(p.NEXTPAGE),
                    stdStyle: std,
                    windows: [],
                };
                for (const child of walker.succ(node)) {
                    const cob = objectOf(child);
                    if (!cob)
                        continue;
                    const oa = outputAttrs(child);
                    const isWindow = cob.kind === 'WINDOW';
                    const typeCode = isWindow
                        ? trimmed(cob.obj.WTYPE).toUpperCase()
                        : cob.kind === 'GRAPHIC'
                            ? 'G'
                            : cob.kind === 'ADDRESS'
                                ? 'A'
                                : '';
                    const win = {
                        name: nameOf(cob.obj),
                        caption: captionOf(cob.obj),
                        type: (0, smartFormLayout_1.windowTypeName)(typeCode) || cob.kind,
                        typeCode,
                        leftMm: lengthMm(oa, 'WLEFT', lpi, cpi),
                        topMm: lengthMm(oa, 'WTOP', lpi, cpi),
                        widthMm: lengthMm(oa, 'WWIDTH', lpi, cpi),
                        heightMm: lengthMm(oa, 'WHEIGHT', lpi, cpi),
                        content: [],
                    };
                    const cond = conditionOf(child);
                    if (cond !== undefined)
                        win.condition = cond;
                    const wbox = boxOf(child);
                    if (wbox)
                        win.box = wbox;
                    if (isWindow) {
                        // window content hangs under WINDOW/PROC_CTRL
                        win.content = walker.contents([...walker.procCtrl(cob.obj), ...walker.succ(child)], 0);
                    }
                    else {
                        // graphic / address placed directly on the page: the node itself
                        const self = walker.content({ ...child, SUCC: undefined }, 0);
                        if (self)
                            win.content = [self];
                    }
                    page.windows.push(win);
                }
                pages.push(page);
                return;
            }
            for (const c of walker.succ(node))
                visit(c, depth + 1);
        };
        for (const r of roots)
            visit(r, 0);
    }
    return {
        data: dataDeclsOf(sf),
        stdStyles,
        pages,
        graphicKeys: [...walker.graphicKeys.values()],
        dynamicGraphics: walker.dynamicGraphics,
        textKeys: [...walker.textKeys.values()],
        styles: [...walker.styles],
        dynamic: walker.dynamic,
    };
}
// ---------------------------------------------------------------------------
// SAP calls
// ---------------------------------------------------------------------------
function translateSmartFormContentError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/Unknown action:\s*SSF_CONTENT/i.test(msg) ||
        /SOAP Fault:[\s\S]*(FU_NOT_FOUND|ZMCP_ADT_DISPATCH)/i.test(msg) ||
        /ZMCP_SSF_CONTENT[\s\S]*(not found|does not exist|not exist)|(CALL_FUNCTION_NOT_FOUND|FU_NOT_FOUND)[\s\S]*ZMCP_SSF_CONTENT/i.test(msg)) {
        return `${exports.SSF_CONTENT_INSTALL_HINT} (SAP said: ${msg})`;
    }
    const m = msg.match(/subrc=(\d+)\):\s*([\s\S]*)$/);
    if (m)
        return m[2].trim() || msg;
    return msg;
}
async function part(connection, params) {
    let result;
    try {
        ({ result } = await (0, rfcBackend_1.callDispatch)(connection, 'SSF_CONTENT', params));
    }
    catch (error) {
        throw new Error(translateSmartFormContentError(error));
    }
    if (result === null || typeof result !== 'object') {
        throw new Error(`SSF_CONTENT ${params.part} returned no JSON object: ${String(result).substring(0, 200)}`);
    }
    return result;
}
function fileSafe(s) {
    return s
        .trim()
        .toLowerCase()
        .replace(/\//g, '#')
        .replace(/[^a-z0-9_#.-]/g, '_');
}
function writeOut(rel, data) {
    const abs = (0, sourceOutput_1.safeOutputPath)(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
    return abs;
}
/** Every &symbol& printed by text lines of the form (system symbols included), sorted. */
function symbolsOf(pages) {
    const set = new Set();
    const visit = (n) => {
        for (const l of n.lines ?? [])
            for (const m of l.text.matchAll(/&([^&\s][^&]*?)&/g))
                set.add(m[1].replace(/\(.*\)$/, '').trim());
        for (const c of n.children ?? [])
            visit(c);
    };
    for (const p of pages)
        for (const w of p.windows)
            for (const n of w.content)
                visit(n);
    return [...set].sort();
}
/** Compact view for the tool answer when the full content is read from files.content. */
function summarizeSmartFormContent(c) {
    const count = (list) => list.reduce((n, x) => n + 1 + count(x.children ?? []), 0);
    return {
        form: c.form,
        language: c.language,
        data: c.data,
        stdStyles: c.stdStyles,
        pages: c.pages.map((p) => ({
            name: p.name,
            format: p.format,
            orientation: p.orientation,
            windows: p.windows.map((w) => ({
                name: w.name,
                caption: w.caption,
                type: w.type,
                leftMm: w.leftMm,
                topMm: w.topMm,
                widthMm: w.widthMm,
                heightMm: w.heightMm,
                ...(w.condition !== undefined ? { condition: w.condition } : {}),
                nodes: count(w.content),
            })),
        })),
        styles: c.styles.map(({ css, ...rest }) => rest),
        graphics: c.graphics,
        includeTexts: c.includeTexts.map(({ lines, ...rest }) => ({
            ...rest,
            lines: lines?.length ?? 0,
        })),
        symbols: symbolsOf(c.pages),
        dynamicReferences: c.dynamicReferences,
        files: c.files,
        path: c.path,
    };
}
async function getSmartFormContent(connection, formName, options = {}) {
    const form = String(formName ?? '')
        .trim()
        .toUpperCase();
    const formRes = await part(connection, { part: 'FORM', form_name: form });
    const xml = Buffer.from(String(formRes.xml ?? ''), 'base64').toString('utf8');
    if (!xml.trim())
        throw new Error(`SSF_CONTENT FORM returned an empty XML for ${form}`);
    const dir = `smartforms/${fileSafe(form)}`;
    const xmlFile = writeOut(`${dir}/${fileSafe(form)}.xml`, xml);
    const parsed = parseSmartFormXml(xml);
    const language = trimmed(formRes.language);
    // A text with no translation in the logon language prints in the form's master language
    // (ZEARC_F001: master T, logon E — SAP printed the Turkish texts). The XML carries the
    // logon language only, so the texts that came back empty are taken from the master's XML.
    const master = (/<MASTERLANG>([^<]*)<\/MASTERLANG>/.exec(xml)?.[1] ?? '').trim();
    if (master && language && master !== language) {
        const empty = [];
        const walk = (n) => {
            if (n.kind === 'text' && n.textType === 'inline' && !n.lines?.length)
                empty.push(n);
            for (const c of n.children ?? [])
                walk(c);
        };
        for (const p of parsed.pages)
            for (const w of p.windows)
                for (const n of w.content)
                    walk(n);
        if (empty.length) {
            try {
                const mRes = await part(connection, {
                    part: 'FORM',
                    form_name: form,
                    language: master,
                });
                const mXml = Buffer.from(String(mRes.xml ?? ''), 'base64').toString('utf8');
                if (mXml.trim() && trimmed(mRes.language) === master) {
                    const byName = new Map();
                    const index = (n) => {
                        if (n.kind === 'text' && n.lines?.length)
                            byName.set(n.name, n);
                        for (const c of n.children ?? [])
                            index(c);
                    };
                    for (const p of parseSmartFormXml(mXml).pages)
                        for (const w of p.windows)
                            for (const n of w.content)
                                index(n);
                    for (const n of empty) {
                        const m = byName.get(n.name);
                        if (m?.lines)
                            n.lines = m.lines;
                    }
                }
            }
            catch {
                // an older ZMCP_SSF_CONTENT without IV_LANGUAGE for FORM: keep the logon-language texts
            }
        }
    }
    const out = {
        form,
        language,
        data: parsed.data,
        stdStyles: parsed.stdStyles,
        pages: parsed.pages,
        styles: [],
        graphics: [],
        includeTexts: [],
        dynamicReferences: parsed.dynamic,
        files: { xml: xmlFile },
        path: `dispatch-${(0, rfcBackend_1.getBackend)()}`,
    };
    if (options.includeStyles !== false) {
        const names = [...new Set([...parsed.stdStyles, ...parsed.styles])];
        for (const name of names) {
            if (hasSymbol(name))
                continue;
            try {
                const r = await part(connection, { part: 'STYLE', name });
                const css = Buffer.from(String(r.css ?? ''), 'base64').toString('utf8');
                const file = writeOut(`${dir}/style_${fileSafe(name)}.css`, css);
                out.styles.push({
                    name,
                    file,
                    css,
                    ...(r.firstParagraph !== undefined
                        ? {
                            firstParagraph: String(r.firstParagraph).trim(),
                            font: {
                                family: String(r.fontFamily ?? '').trim(),
                                pt: Number(r.fontSize ?? 0) / 10,
                                bold: String(r.bold ?? '').trim() === 'X',
                            },
                            lpi: Number(r.lpi) || undefined,
                            cpi: Number(r.cpi) || undefined,
                            tabDistance: String(r.tabDistance ?? '').trim() || undefined,
                            ...(Array.isArray(r.paragraphs)
                                ? { paragraphs: r.paragraphs }
                                : {}),
                            ...(Array.isArray(r.strings) ? { strings: r.strings } : {}),
                        }
                        : {}),
                });
            }
            catch (e) {
                out.styles.push({
                    name,
                    error: e instanceof Error ? e.message : String(e),
                });
            }
        }
        // The printer the form would go to and its fonts for the form's families:
        // a family / size the device type lacks prints in a substitute font.
        const families = new Set();
        for (const s of out.styles) {
            if (s.font?.family)
                families.add(s.font.family.toUpperCase());
            for (const p of s.paragraphs ?? [])
                if (p.family)
                    families.add(String(p.family).trim().toUpperCase());
            for (const c of s.strings ?? [])
                if (String(c.family ?? '').trim())
                    families.add(String(c.family).trim().toUpperCase());
        }
        if (families.size) {
            try {
                const r = await part(connection, {
                    part: 'FONTS',
                    name: [...families].join(','),
                    object: options.device ?? '',
                });
                out.printer = {
                    device: String(r.device ?? '').trim(),
                    deviceType: String(r.deviceType ?? '').trim(),
                    families: Array.isArray(r.families) ? r.families : [],
                    fonts: Array.isArray(r.fonts) ? r.fonts : [],
                };
            }
            catch (e) {
                out.printer = { error: e instanceof Error ? e.message : String(e) };
            }
        }
    }
    if (options.includeGraphics !== false) {
        // graphics named by a variable: fetched under the name the sample value gives
        const sub = (v) => String(v).replace(/&([^&]+)&/g, (m, k) => {
            const key = String(k).trim().toUpperCase();
            const hit = Object.entries(options.values ?? {}).find(([n]) => n.toUpperCase() === key);
            return hit ? String(hit[1]) : m;
        });
        const resolved = parsed.dynamicGraphics
            .map((g) => ({
            ...g,
            object: sub(g.object),
            name: sub(g.name),
            id: sub(g.id),
            btype: sub(g.btype),
            dynamic: false,
        }))
            .filter((g) => ![g.object, g.name, g.id, g.btype].some(hasSymbol));
        for (const g of [...parsed.graphicKeys, ...resolved]) {
            const entry = {
                object: g.object,
                name: g.name,
                id: g.id,
                btype: g.btype,
            };
            try {
                const r = await part(connection, {
                    part: 'GRAPHIC',
                    object: g.object,
                    name: g.name,
                    id: g.id,
                    btype: g.btype,
                });
                const bmp = Buffer.from(String(r.bmp ?? ''), 'base64');
                entry.widthPix = Number(r.widthPix) || undefined;
                entry.heightPix = Number(r.heightPix) || undefined;
                entry.widthTw = Number(r.widthTw) || undefined;
                entry.heightTw = Number(r.heightTw) || undefined;
                entry.resolution = Number(r.resolution) || undefined;
                if (entry.widthTw)
                    entry.widthMm = Math.round((entry.widthTw * 25.4 * 100) / 1440) / 100;
                if (entry.heightTw)
                    entry.heightMm =
                        Math.round((entry.heightTw * 25.4 * 100) / 1440) / 100;
                entry.file = writeOut(`${dir}/graphic_${fileSafe(g.name)}_${fileSafe(g.btype)}.bmp`, bmp);
            }
            catch (e) {
                entry.error = e instanceof Error ? e.message : String(e);
            }
            out.graphics.push(entry);
        }
    }
    if (options.includeTexts !== false) {
        for (const t of parsed.textKeys) {
            const lang = t.language || options.textLanguage || language;
            const entry = {
                object: t.object,
                name: t.name,
                id: t.id,
                language: lang,
            };
            try {
                const r = await part(connection, {
                    part: 'STDTEXT',
                    object: t.object,
                    name: t.name,
                    id: t.id,
                    language: lang,
                });
                entry.lines = asArray(r.lines).map((l) => ({
                    format: trimmed(l?.f),
                    text: str(l?.l).replace(/\s+$/, ''),
                }));
                t.resolved = true;
            }
            catch (e) {
                entry.error = e instanceof Error ? e.message : String(e);
            }
            out.includeTexts.push(entry);
        }
    }
    // the whole result next to the XML, so preview builders read one file
    const contentRel = `${dir}/${fileSafe(form)}.content.json`;
    out.files.content = (0, sourceOutput_1.safeOutputPath)(contentRel);
    writeOut(contentRel, JSON.stringify(out, null, 1));
    return out;
}
//# sourceMappingURL=smartFormContent.js.map