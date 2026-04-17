"use strict";
/**
 * CUA (SAP GUI Status) schema helpers.
 *
 * SAP's RS_CUA_INTERNAL_WRITE overwrites the entire GUI status definition of
 * a program atomically — every row of every table (STA/FUN/PFK/BUT/MEN/…).
 * Missing rows and missing fields become empty. This module provides:
 *
 *   1. A typed representation (`CuaData`) that matches what
 *      /ui2/cl_json=>serialize returns for ABAP structures rsmpe_*.
 *   2. `normalizeCuaInput` — accepts either a JSON string (back-compat with
 *      the historical `cua_data: string` tool surface) or an already-parsed
 *      object, and returns a normalized `CuaData`.
 *   3. `validateCuaData` — checks required fields per table so the tool
 *      layer catches obviously-broken payloads (e.g. STA row without CODE,
 *      FUN row without FUN_TEXT) BEFORE they blow the production GUI
 *      status away. Returns the list of problems or null on success.
 *   4. `mergeCuaData` — row-level shallow merge with stable keys per table:
 *        STA  → CODE
 *        FUN  → CODE
 *        PFK  → CODE + PFNO
 *        BUT  → PFK_CODE + CODE + NO
 *        TIT  → CODE
 *        MEN  → CODE + NO
 *        MTX  → CODE
 *        ACT  → CODE + NO
 *        SET  → STATUS + FUNCTION
 *        DOC  → OBJ_TYPE + OBJ_CODE
 *        BIV  → CODE + POS  (best guess — rarely used)
 *      A row present in `changes` overwrites the matching key in `base`;
 *      any row in `base` without a match is kept. Enables Read→merge→Write
 *      semantics for PatchGuiStatus.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCuaInput = normalizeCuaInput;
exports.validateCuaData = validateCuaData;
exports.mergeCuaData = mergeCuaData;
exports.serializeCuaForRfc = serializeCuaForRfc;
const CUA_TABLES = [
    'STA',
    'FUN',
    'MEN',
    'MTX',
    'ACT',
    'BUT',
    'PFK',
    'SET',
    'DOC',
    'TIT',
    'BIV',
];
function normalizeCuaInput(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        }
        catch (e) {
            throw new Error(`cua_data is a string but is not valid JSON: ${e?.message || e}`);
        }
    }
    if (!raw || typeof raw !== 'object') {
        throw new Error('cua_data must be a JSON object (or a JSON string of one)');
    }
    // Case-normalize: accept lower/mixed case top-level keys too. Upstream
    // ABAP /ui2/cl_json=>deserialize is case-sensitive (expects UPPERCASE to
    // match DDIC field names), but many callers build JSON with camelCase.
    // We remap top-level only; per-row field names still need to be correct
    // (the DDIC mapping happens inside ABAP).
    const normalized = {};
    for (const [k, v] of Object.entries(raw)) {
        const upper = k.toUpperCase();
        if (upper === 'ADM') {
            normalized.ADM = (v ?? {});
        }
        else if (CUA_TABLES.includes(upper)) {
            if (!Array.isArray(v)) {
                throw new Error(`cua_data.${upper} must be an array, got ${typeof v}`);
            }
            normalized[upper] = v;
        }
        else {
            normalized[k] = v;
        }
    }
    return normalized;
}
/**
 * Per-table required-field checks that a sane caller would pass.
 * Fails early so a half-written JSON can never wipe production.
 */
function validateCuaData(data) {
    const problems = [];
    const requireField = (table, rows, fields) => {
        if (!rows)
            return;
        rows.forEach((row, i) => {
            for (const f of fields) {
                const v = row?.[f];
                if (v === undefined ||
                    v === null ||
                    (typeof v === 'string' && v.trim() === '')) {
                    problems.push({
                        table,
                        rowIndex: i,
                        field: f,
                        message: `${table}[${i}] is missing required field "${f}"`,
                    });
                }
            }
        });
    };
    requireField('STA', data.STA, ['CODE']);
    requireField('FUN', data.FUN, ['CODE']);
    requireField('PFK', data.PFK, ['CODE', 'PFNO', 'FUNCODE']);
    requireField('BUT', data.BUT, ['PFK_CODE', 'CODE', 'NO', 'PFNO']);
    requireField('TIT', data.TIT, ['CODE']);
    // Cross-reference: STA.PFKCODE must have at least one PFK.CODE match if PFK is supplied.
    if (Array.isArray(data.STA) &&
        Array.isArray(data.PFK) &&
        data.PFK.length > 0) {
        const pfkCodes = new Set(data.PFK.map((p) => p.CODE));
        data.STA.forEach((s, i) => {
            if (s.PFKCODE && !pfkCodes.has(s.PFKCODE)) {
                problems.push({
                    table: 'STA',
                    rowIndex: i,
                    field: 'PFKCODE',
                    message: `STA[${i}].PFKCODE="${s.PFKCODE}" has no matching PFK.CODE row — the F-keys will be empty for status ${s.CODE}`,
                });
            }
        });
    }
    // Same for BUT: every BUT row's PFK_CODE should exist in PFK (warn only if PFK supplied).
    if (Array.isArray(data.BUT) &&
        Array.isArray(data.PFK) &&
        data.PFK.length > 0) {
        const pfkCodes = new Set(data.PFK.map((p) => p.CODE));
        data.BUT.forEach((b, i) => {
            if (!pfkCodes.has(b.PFK_CODE)) {
                problems.push({
                    table: 'BUT',
                    rowIndex: i,
                    field: 'PFK_CODE',
                    message: `BUT[${i}].PFK_CODE="${b.PFK_CODE}" has no matching PFK.CODE — toolbar button will not resolve to a function`,
                });
            }
        });
    }
    return problems;
}
const KEYS = {
    STA: (r) => `STA:${r?.CODE ?? ''}`,
    FUN: (r) => `FUN:${r?.CODE ?? ''}`,
    PFK: (r) => `PFK:${r?.CODE ?? ''}|${r?.PFNO ?? ''}`,
    BUT: (r) => `BUT:${r?.PFK_CODE ?? ''}|${r?.CODE ?? ''}|${r?.NO ?? ''}`,
    TIT: (r) => `TIT:${r?.CODE ?? ''}`,
    MEN: (r) => `MEN:${r?.CODE ?? ''}|${r?.NO ?? ''}`,
    MTX: (r) => `MTX:${r?.CODE ?? ''}`,
    ACT: (r) => `ACT:${r?.CODE ?? ''}|${r?.NO ?? ''}`,
    SET: (r) => `SET:${r?.STATUS ?? ''}|${r?.FUNCTION ?? ''}`,
    DOC: (r) => `DOC:${r?.OBJ_TYPE ?? ''}|${r?.OBJ_CODE ?? ''}`,
    BIV: (r) => `BIV:${r?.CODE ?? ''}|${r?.POS ?? ''}`,
};
function mergeTable(baseRows, changeRows, table) {
    const keyFn = KEYS[table];
    if (!keyFn) {
        // Unknown table — prefer changes when supplied, else base.
        return changeRows ?? baseRows ?? [];
    }
    if (!changeRows)
        return baseRows ? [...baseRows] : [];
    const map = new Map();
    for (const row of baseRows ?? []) {
        map.set(keyFn(row), row);
    }
    for (const row of changeRows) {
        const k = keyFn(row);
        const existing = map.get(k);
        // Field-level merge: changes override, base fields preserved.
        map.set(k, existing ? { ...existing, ...row } : row);
    }
    return [...map.values()];
}
/**
 * Row-level merge. Returns a new CuaData where every table in `changes`
 * is merged into the matching `base` table; rows in `base` without a
 * matching change are kept as-is. Fields within a matched row are shallow-
 * merged (changes win). Tables absent from `changes` keep `base`'s array.
 */
function mergeCuaData(base, changes) {
    const out = {
        ADM: { ...(base.ADM ?? {}), ...(changes.ADM ?? {}) },
    };
    for (const t of CUA_TABLES) {
        const merged = mergeTable(base[t], changes[t], t);
        if (merged.length > 0 ||
            Array.isArray(base[t]) ||
            Array.isArray(changes[t])) {
            out[t] = merged;
        }
    }
    return out;
}
function serializeCuaForRfc(data) {
    return JSON.stringify(data);
}
//# sourceMappingURL=cuaSchema.js.map