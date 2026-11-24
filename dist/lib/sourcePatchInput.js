"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_CODE_REFUSAL = exports.SOURCE_PATCH_TOOLS = exports.MAX_SOURCE_PATCHES = void 0;
exports.includeSourceUrl = includeSourceUrl;
exports.patchTargetOf = patchTargetOf;
exports.withSourcePatchesSchema = withSourcePatchesSchema;
exports.parseSourcePatches = parseSourcePatches;
exports.applySourcePatches = applySourcePatches;
exports.stripAbapComments = stripAbapComments;
exports.hasOrphanClassImplementation = hasOrphanClassImplementation;
exports.isReadChannel = isReadChannel;
exports.assertNotTestCode = assertNotTestCode;
exports.readNewestSource = readNewestSource;
exports.readCurrentSource = readCurrentSource;
exports.resolveSourcePatchesArg = resolveSourcePatchesArg;
exports.sameSource = sameSource;
exports.restoreAfterFailedPatch = restoreAfterFailedPatch;
exports.withUndoNote = withUndoNote;
exports.runWithPatchRestore = runWithPatchRestore;
exports.attachPatchedInfo = attachPatchedInfo;
/**
 * `source_patches` — server-side patch input for the source-writing Update* tools.
 *
 * The caller sends only the changed fragments as exact replacements
 * (`{ old_string, new_string, replace_all? }`, 1–50). Before the handler runs,
 * the server reads the object's current source itself — the newest saved
 * version (inactive when one exists, else active), because that is what the
 * Update overwrites — applies the replacements in order and passes the result
 * on as the tool's source argument. One call, no fetch, no local file.
 *
 * Rules:
 *   - source_patches is exclusive with the tool's source argument and with
 *     source_file — any presence of those keys, even "", refuses the call.
 *   - Matching runs on text with line endings normalised to \n (the patches
 *     too); a source with mixed line endings is patched as written instead.
 *     Each old_string must be non-empty and occur exactly once (overlapping
 *     occurrences count), unless replace_all (then at least once). Any
 *     failure refuses the WHOLE call — nothing is uploaded.
 *   - The uploaded text keeps the source's original line-ending style.
 *   - Test code is never patched: UpdateLocalTestClass, or FOR TESTING in the
 *     current or the patched source (comments and literals ignored) refuses
 *     the call — send the full source_code, which the plugin's blocklist hook
 *     scans. Business code passes, as a full upload of it does (the hook does
 *     not scan business code). No blocklist profile is read here.
 *   - The result gets `patched: { count, replacements, bytes, source_sha256 }`
 *     (sha of the uploaded text). The source is never echoed.
 */
const node_crypto_1 = require("node:crypto");
const handleUpdateInclude_1 = require("../handlers/include/high/handleUpdateInclude");
const clients_1 = require("./clients");
const utils_1 = require("./utils");
exports.MAX_SOURCE_PATCHES = 50;
const up = (v) => String(v ?? '')
    .trim()
    .toUpperCase();
/** readResult.data → text, like the Get* handlers do. */
function dataText(readResult) {
    if (!readResult || !readResult.readResult)
        return undefined;
    const d = readResult.readResult.data;
    if (d === undefined || d === null)
        return undefined;
    return typeof d === 'string' ? d : JSON.stringify(d);
}
const clientRead = (pick, config) => async (ctx, args, version) => {
    const client = (0, clients_1.createAdtClient)(ctx.connection, ctx.logger);
    return dataText(await pick(client).read(config(args), version));
};
/**
 * Include: the same source URL UpdateInclude writes — under the function
 * group for a function-group include (function_group, or main_program
 * SAPL<group>), else /programs/includes — with an explicit version.
 */
function includeSourceUrl(args, version) {
    const name = (0, utils_1.encodeSapObjectName)(up(args.include_name));
    const fg = (0, handleUpdateInclude_1.functionGroupOf)(args);
    const base = fg
        ? `/sap/bc/adt/functions/groups/${(0, utils_1.encodeSapObjectName)(fg).toLowerCase()}/includes/${name.toLowerCase()}`
        : `/sap/bc/adt/programs/includes/${name}`;
    return `${base}/source/main?version=${version}`;
}
const readInclude = async (ctx, args, version) => {
    const url = includeSourceUrl(args, version);
    try {
        const resp = await (0, utils_1.makeAdtRequestWithTimeout)(ctx.connection, url, 'GET', 'default');
        const d = resp?.data;
        return d === undefined || d === null ? undefined : String(d);
    }
    catch (e) {
        if (e?.response?.status === 404)
            return undefined;
        throw e;
    }
};
const TARGETS = {
    UpdateProgram: {
        codeField: 'source_code',
        nameFields: ['program_name'],
        singlePart: true,
        read: clientRead((c) => c.getProgram(), (a) => ({ programName: up(a.program_name) })),
    },
    UpdateInclude: {
        codeField: 'source_code',
        nameFields: ['include_name'],
        singlePart: true,
        read: readInclude,
    },
    UpdateClass: {
        codeField: 'source_code',
        nameFields: ['class_name'],
        read: clientRead((c) => c.getClass(), (a) => ({ className: up(a.class_name) })),
    },
    UpdateInterface: {
        codeField: 'source_code',
        nameFields: ['interface_name'],
        singlePart: true,
        read: clientRead((c) => c.getInterface(), (a) => ({ interfaceName: up(a.interface_name) })),
    },
    UpdateFunctionModule: {
        codeField: 'source_code',
        nameFields: ['function_group_name', 'function_module_name'],
        singlePart: true,
        read: clientRead((c) => c.getFunctionModule(), (a) => ({
            functionModuleName: up(a.function_module_name),
            functionGroupName: up(a.function_group_name),
        })),
    },
    UpdateLocalTypes: {
        codeField: 'local_types_code',
        nameFields: ['class_name'],
        activateField: 'activate_on_update',
        read: clientRead((c) => c.getLocalTypes(), (a) => ({ className: up(a.class_name) })),
    },
    UpdateLocalDefinitions: {
        codeField: 'definitions_code',
        nameFields: ['class_name'],
        activateField: 'activate_on_update',
        read: clientRead((c) => c.getLocalDefinitions(), (a) => ({ className: up(a.class_name) })),
    },
    UpdateLocalMacros: {
        codeField: 'macros_code',
        nameFields: ['class_name'],
        activateField: 'activate_on_update',
        read: clientRead((c) => c.getLocalMacros(), (a) => ({ className: up(a.class_name) })),
    },
    UpdateLocalTestClass: {
        codeField: 'test_class_code',
        nameFields: ['class_name'],
        activateField: 'activate_on_update',
        read: clientRead((c) => c.getLocalTestClass(), (a) => ({ className: up(a.class_name) })),
    },
};
/** Tools that accept source_patches. */
exports.SOURCE_PATCH_TOOLS = Object.keys(TARGETS);
/** Supported only when the tool's schema really carries the source field. */
function patchTargetOf(toolName, inputSchema) {
    const t = TARGETS[toolName];
    if (!t)
        return undefined;
    if (inputSchema && !inputSchema?.properties?.[t.codeField])
        return undefined;
    return t;
}
const PATCHES_DESCRIPTION = "Server-side patch: exact replacements applied to the object's current source (newest saved version — inactive if one exists, else active), then uploaded. Use instead of the full source when you know the exact current text of the lines you change. Each old_string must occur exactly once (or set replace_all); otherwise nothing is uploaded. Line endings are normalised for matching. Not together with the full source or source_file. Business code only: a source with test classes (FOR TESTING) or a local test class part is refused — send the full source.";
/**
 * Schema with `source_patches` added and the source field no longer required
 * (one of the inputs is checked at call time). Other tools pass unchanged.
 */
function withSourcePatchesSchema(toolName, inputSchema) {
    const t = patchTargetOf(toolName, inputSchema);
    if (!t || !inputSchema?.properties)
        return inputSchema;
    return {
        ...inputSchema,
        properties: {
            ...inputSchema.properties,
            source_patches: {
                type: 'array',
                description: PATCHES_DESCRIPTION,
                minItems: 1,
                maxItems: exports.MAX_SOURCE_PATCHES,
                items: {
                    type: 'object',
                    properties: {
                        old_string: {
                            type: 'string',
                            description: 'Exact current text (non-empty).',
                        },
                        new_string: {
                            type: 'string',
                            description: 'Replacement text (may be empty).',
                        },
                        replace_all: {
                            type: 'boolean',
                            description: 'Replace every occurrence. Default false.',
                        },
                    },
                    required: ['old_string', 'new_string'],
                },
            },
        },
        required: (inputSchema.required || []).filter((k) => k !== t.codeField),
    };
}
const nl = (s) => s.replace(/\r\n?/g, '\n');
const snippet = (s) => {
    const one = s.replace(/\s+/g, ' ').trim();
    return one.length > 60 ? `${one.slice(0, 57)}...` : one;
};
/** Count occurrences, overlapping ones too ("aa" in "aaa" = 2). */
function occurrences(text, needle) {
    let n = 0;
    let i = text.indexOf(needle);
    while (i !== -1) {
        n++;
        i = text.indexOf(needle, i + 1);
    }
    return n;
}
/** Line-ending style: 'crlf' / 'lf' when uniform (or none), 'mixed' otherwise (lone CR counts as mixed). */
function eolStyle(text) {
    const crlf = /\r\n/.test(text);
    const lf = /(^|[^\r])\n/.test(text);
    const cr = /\r(?!\n)/.test(text);
    if (cr || (crlf && lf))
        return 'mixed';
    return crlf ? 'crlf' : 'lf';
}
/** Validate the raw argument; throws a short error naming the bad patch. */
function parseSourcePatches(raw) {
    if (!Array.isArray(raw))
        throw new Error('source_patches must be an array');
    if (raw.length < 1 || raw.length > exports.MAX_SOURCE_PATCHES)
        throw new Error(`source_patches must hold 1–${exports.MAX_SOURCE_PATCHES} patches (got ${raw.length})`);
    return raw.map((p, i) => {
        if (!p || typeof p !== 'object' || Array.isArray(p))
            throw new Error(`source_patches[${i}] must be an object`);
        if (typeof p.old_string !== 'string' || p.old_string.length === 0)
            throw new Error(`source_patches[${i}].old_string must be a non-empty string`);
        if (typeof p.new_string !== 'string')
            throw new Error(`source_patches[${i}].new_string must be a string`);
        if (p.replace_all !== undefined && typeof p.replace_all !== 'boolean')
            throw new Error(`source_patches[${i}].replace_all must be a boolean`);
        if (nl(p.old_string) === nl(p.new_string))
            throw new Error(`source_patches[${i}]: old_string and new_string are the same`);
        return {
            old_string: p.old_string,
            new_string: p.new_string,
            replace_all: p.replace_all === true,
        };
    });
}
/**
 * Apply patches in order. Returns the new text in the source's line-ending
 * style. Throws (nothing applied) when a patch does not match as required.
 *
 * Uniform line endings: matching on text normalised to \n, the result is
 * written back in the source's style. Mixed line endings: the patches are
 * applied to the raw text as given (no line is rewritten); an old_string
 * that does not match the raw text refuses the call.
 */
function applySourcePatches(source, patches) {
    const style = eolStyle(source);
    const mixed = style === 'mixed';
    let text = mixed ? source : nl(source);
    let replacements = 0;
    patches.forEach((p, i) => {
        const oldS = mixed ? p.old_string : nl(p.old_string);
        const newS = mixed ? p.new_string : nl(p.new_string);
        const n = occurrences(text, oldS);
        if (n === 0 && mixed)
            throw new Error(`source_patches[${i}]: old_string found 0 times in the current source as written ("${snippet(oldS)}"); the source has mixed line endings — nothing uploaded, send source_code.`);
        if (n === 0)
            throw new Error(`source_patches[${i}]: old_string found 0 times in the current source ("${snippet(oldS)}") — nothing uploaded. Copy old_string from the current source.`);
        if (n > 1 && !p.replace_all)
            throw new Error(`source_patches[${i}]: old_string found ${n} times ("${snippet(oldS)}") — nothing uploaded. Add surrounding lines to make it unique, or set replace_all.`);
        // split/join replaces non-overlapping occurrences — count those, not n
        const parts = text.split(oldS);
        text = parts.join(newS);
        replacements += parts.length - 1;
    });
    return {
        text: style === 'crlf' ? text.replace(/\n/g, '\r\n') : text,
        replacements,
    };
}
/**
 * ABAP source without comments and literal text — a character scanner, the
 * same as the plugin hook's stripAbapNoise (ABAP mode): `*` in column 1 and
 * `"` comment to the line end; '…' / `…` become '' / `` (doubled quote =
 * escaped); a string template |…| keeps its delimiters and the CODE of its
 * embedded expressions { … } (which may hold literals and templates of their
 * own) and drops its text (\ escapes). '…', `…` and template text end at the
 * line end. A quote inside one literal never opens another and never
 * swallows the code after it.
 */
function stripAbapComments(source) {
    const s = nl(source);
    const n = s.length;
    const stack = [];
    let out = '';
    let lineStart = true;
    let i = 0;
    const toEol = () => {
        while (i < n && s[i] !== '\n')
            i++;
    };
    while (i < n) {
        const c = s[i];
        if (c === '\n') {
            if (stack[stack.length - 1] === 'tpl') {
                stack.pop();
                out += '|';
            }
            out += '\n';
            lineStart = true;
            i++;
            continue;
        }
        const atStart = lineStart;
        lineStart = false;
        if (stack[stack.length - 1] === 'tpl') {
            if (c === '\\') {
                i += s[i + 1] === '\n' ? 1 : 2;
                continue;
            }
            if (c === '|') {
                stack.pop();
                out += '|';
                i++;
                continue;
            }
            if (c === '{') {
                stack.push('emb');
                out += '{';
                i++;
                continue;
            }
            i++;
            continue;
        }
        if ((atStart && c === '*') || c === '"') {
            toEol();
            continue;
        }
        if (c === "'" || c === '`') {
            let j = i + 1;
            while (j < n && s[j] !== '\n') {
                if (s[j] === c) {
                    if (s[j + 1] === c) {
                        j += 2;
                        continue;
                    }
                    break;
                }
                j++;
            }
            out += c + c;
            i = j < n && s[j] === c ? j + 1 : j;
            continue;
        }
        if (c === '|') {
            stack.push('tpl');
            out += '|';
            i++;
            continue;
        }
        if (c === '}' && stack[stack.length - 1] === 'emb') {
            stack.pop();
            out += '}';
            i++;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}
/** Tools whose whole source is ABAP Unit test code. */
const TEST_CODE_TOOLS = new Set(['UpdateLocalTestClass']);
/**
 * A CLASS … IMPLEMENTATION without a CLASS … DEFINITION (not DEFERRED /
 * LOAD) of that class in the same text — e.g. a test class split over two
 * includes: its implementation alone carries no FOR TESTING but still runs
 * under RunUnitTest. Expects comment- and literal-free text.
 */
function hasOrphanClassImplementation(clean) {
    const t = clean.replace(/:/g, ' ');
    const defined = new Set();
    for (const m of t.matchAll(/\bCLASS\s+([\w/]+)\s+DEFINITION\b(?!\s+(?:DEFERRED|LOAD|LOCAL\s+FRIENDS)\b)/gi))
        defined.add(m[1].toUpperCase());
    for (const m of t.matchAll(/\bCLASS\s+([\w/]+)\s+IMPLEMENTATION\b/gi))
        if (!defined.has(m[1].toUpperCase()))
            return true;
    return false;
}
/**
 * True when the patched source is a read channel — the same rule the plugin
 * hook applies to a full upload (block-forbidden-tables.mjs
 * sourceIsReadChannel): a test-code tool, `FOR TESTING` in the source, or a
 * class implementation whose definition is elsewhere (comments and literals
 * ignored). Its test classes' messages come back to the agent through
 * RunUnitTest, so a read there extracts rows.
 */
function isReadChannel(toolName, source) {
    if (TEST_CODE_TOOLS.has(toolName))
        return true;
    // Colon chaining (`FOR: TESTING`) splits keywords: the colon is a separator here.
    const clean = stripAbapComments(source).replace(/:/g, ' ');
    return (/\bFOR\s+TESTING\b/i.test(clean) || hasOrphanClassImplementation(clean));
}
exports.TEST_CODE_REFUSAL = 'source_patches refused — this source contains test classes (FOR TESTING, or a class implementation whose definition is in another include); nothing uploaded. Send the full source_code so the blocklist hook can check it.';
/**
 * Exactly "same as a full upload", with no blocklist profile on the server:
 * the hook scans a full upload only when it is a read channel (test code),
 * so a patch to test code is refused outright — before (the current text)
 * or after (the patched text), so removing FOR TESTING by a patch is caught
 * too. Business code passes, as a full upload of it does.
 */
function assertNotTestCode(before, after, toolName = '') {
    if (isReadChannel(toolName, before) || isReadChannel(toolName, after))
        throw new Error(exports.TEST_CODE_REFUSAL);
}
/**
 * Newest saved version and whether it is an inactive one. `unsure` is set
 * when an inactive read came back but it could not be proven that no real
 * inactive version exists — hadInactive is then true (never activate).
 */
async function readNewestSource(t, ctx, args) {
    let inactive;
    try {
        inactive = await t.read(ctx, args, 'inactive');
    }
    catch (e) {
        // 404 = no inactive version. Anything else: refuse rather than patch a
        // possibly stale active text over someone's inactive changes.
        if (e?.response?.status !== 404)
            throw e;
    }
    if (typeof inactive === 'string') {
        // ECC ADT answers ?version=inactive with the ACTIVE text (200, not 404)
        // when no inactive version exists. Same text as active = nothing inactive
        // worth keeping: re-activating it changes nothing, even if someone's
        // inactive entry with identical text exists — but only for single-part
        // objects (a class activation also activates its other parts). An
        // inactive version that reads as "" (and differs from active) is a real
        // (empty) version. Active never activated (404) → a real inactive
        // version; active read failed → cannot tell, keep it inactive.
        let activeText;
        try {
            activeText = await t.read(ctx, args, 'active');
        }
        catch (e) {
            if (e?.response?.status !== 404)
                return {
                    text: inactive,
                    hadInactive: true,
                    unsure: `the active version could not be read (${e?.message || String(e)}), so it is unknown whether an inactive version existed before`,
                };
        }
        if (typeof activeText !== 'string' || !sameSource(inactive, activeText))
            return { text: inactive, hadInactive: true };
        if (!t.singlePart)
            return {
                text: inactive,
                hadInactive: true,
                unsure: "activating it would also activate the other parts of the object, which may hold someone else's inactive changes",
            };
        return { text: inactive, hadInactive: false };
    }
    const active = await t.read(ctx, args, 'active');
    if (typeof active !== 'string')
        throw new Error('current source not found');
    return { text: active, hadInactive: false };
}
/** Newest saved version: inactive when it exists, else active. */
async function readCurrentSource(t, ctx, args) {
    return (await readNewestSource(t, ctx, args)).text;
}
/**
 * Replace `source_patches` by the tool's source argument. Calls without
 * `source_patches` pass through unchanged. Throws a short error when the
 * tool is unsupported, inputs are combined, a patch is malformed, the read
 * fails or a patch does not match — the handler never runs then.
 */
async function resolveSourcePatchesArg(toolName, inputSchema, args, ctx) {
    if (!args || typeof args !== 'object' || args.source_patches === undefined)
        return { args };
    const t = patchTargetOf(toolName, inputSchema);
    if (!t)
        throw new Error(`${toolName} does not take source_patches (supported: ${exports.SOURCE_PATCH_TOOLS.join(', ')})`);
    // Any presence of the source field or source_file (even "" or null) is a
    // mix: the hooks would scan that field, not the patches.
    const has = (k) => Object.hasOwn(args, k);
    if (has(t.codeField) || has('source_file'))
        throw new Error(`give source_patches alone — not together with ${t.codeField} or source_file`);
    const patches = parseSourcePatches(args.source_patches);
    // A test-code tool is refused before any read.
    if (TEST_CODE_TOOLS.has(toolName))
        throw new Error(exports.TEST_CODE_REFUSAL);
    for (const f of t.nameFields)
        if (typeof args[f] !== 'string' || !args[f].trim())
            throw new Error(`source_patches needs ${f}`);
    const context = typeof ctx === 'function' ? await ctx() : ctx;
    let current;
    let hadInactive;
    let unsure;
    try {
        ({
            text: current,
            hadInactive,
            unsure,
        } = await readNewestSource(t, context, args));
    }
    catch (e) {
        throw new Error(`source_patches: cannot read the current source of ${t.nameFields.map((f) => up(args[f])).join('/')} — nothing uploaded (${e?.message || String(e)})`);
    }
    const { text, replacements } = applySourcePatches(current, patches);
    assertNotTestCode(current, text, toolName);
    const { source_patches: _p, source_file: _f, ...rest } = args;
    return {
        args: { ...rest, [t.codeField]: text },
        patched: {
            count: patches.length,
            replacements,
            bytes: Buffer.byteLength(text, 'utf8'),
            source_sha256: (0, node_crypto_1.createHash)('sha256').update(text, 'utf8').digest('hex'),
        },
        restore: {
            target: t,
            codeField: t.codeField,
            before: current,
            after: text,
            hadInactive,
            ...(unsure ? { unsure } : {}),
        },
    };
}
/**
 * Same source as SAP stores it: line endings, trailing blanks per line and
 * trailing empty lines do not count (SAP's line storage drops them).
 */
function sameSource(a, b) {
    const norm = (s) => nl(s)
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .replace(/\n+$/, '');
    return norm(a) === norm(b);
}
const resultText = (r) => (Array.isArray(r?.content) ? r.content : [])
    .map((c) => typeof c?.text === 'string'
    ? c.text
    : c?.json !== undefined
        ? JSON.stringify(c.json)
        : '')
    .join('\n');
/**
 * A failed patched call must not leave the patched source behind (e.g. an
 * include fails at activation after its upload: SAP keeps the broken text as
 * the inactive version). When the newest saved source now equals the patched
 * text, the pre-patch source is uploaded again with the same tool: activated
 * when there was no inactive version before (active and inactive back to the
 * old state), else saved as the previous inactive version. Returns the line
 * to add to the error.
 */
async function restoreAfterFailedPatch(r, args, ctx, invoke) {
    let now;
    try {
        now = (await readNewestSource(r.target, ctx, args)).text;
    }
    catch (e) {
        return `source_patches: could not read the object after the failure (${e?.message || String(e)}) — check its inactive version.`;
    }
    if (sameSource(now, r.before))
        return 'source_patches: the patched source was not saved — nothing to undo.';
    if (!sameSource(now, r.after))
        return 'source_patches: NOT UNDONE — the saved source is neither the patched nor the pre-patch text (SAP may have changed it on save); check the object.';
    const activateField = r.target.activateField || 'activate';
    try {
        const res = await invoke({
            ...args,
            [r.codeField]: r.before,
            [activateField]: !r.hadInactive,
        });
        if (res?.isError)
            throw new Error(resultText(res) || 'error result');
    }
    catch (e) {
        // Say what is saved now, not what probably is.
        let saved = 'unknown — read the object';
        try {
            const after = (await readNewestSource(r.target, ctx, args)).text;
            saved = sameSource(after, r.after)
                ? 'the PATCHED source is still saved as the inactive version; replace it before anything else'
                : sameSource(after, r.before)
                    ? 'the pre-patch source is saved again but its activation did not finish; activate or check it'
                    : 'a different source is saved now; check the object';
        }
        catch {
            /* keep "unknown" */
        }
        return `source_patches: UNDO FAILED (${e?.message || String(e)}) — ${saved}.`;
    }
    // Read back: report only what is saved now.
    try {
        const back = (await readNewestSource(r.target, ctx, args)).text;
        if (!sameSource(back, r.before))
            return 'source_patches: UNDO UNCONFIRMED — the undo call succeeded but a different source is saved now; check the object.';
    }
    catch (e) {
        return `source_patches: UNDO UNCONFIRMED — the undo call succeeded but the read-back failed (${e?.message || String(e)}); check the object.`;
    }
    if (!r.hadInactive)
        // Read-back checks the text only (ECC serves the active text as "inactive"), so no claim about the worklist.
        return `${UNDONE_NOTE} — the previous source is active again.`;
    if (r.unsure)
        return `${UNDONE_NOTE} — the pre-patch source is saved as the inactive version, not activated: ${r.unsure}. Activate it if no one else has open changes.`;
    return `${UNDONE_NOTE} — the previous inactive version is back (not activated).`;
}
const UNDONE_NOTE = 'source_patches: the failed patch was undone';
/**
 * INCLUDE_STAGED_ADVICE (UpdateInclude, failed activation) is only true while
 * the broken source is still saved: after a successful undo it contradicts
 * the undo note, so it is dropped. The handler builds its message from the
 * same constant, so the two cannot drift apart.
 */
const dropStagedAdvice = (s) => s
    .split(` ${handleUpdateInclude_1.INCLUDE_STAGED_ADVICE}`)
    .join('')
    .split(handleUpdateInclude_1.INCLUDE_STAGED_ADVICE)
    .join('');
/** Failure text plus the undo note; stale staged-source advice removed when the undo succeeded. */
function withUndoNote(message, note) {
    const base = note.startsWith(UNDONE_NOTE)
        ? dropStagedAdvice(message)
        : message;
    return `${base}\n${note}`;
}
/**
 * Run a resolved call; when it was a patch and it fails (throws or returns
 * isError), undo a saved patched source before reporting the failure.
 */
async function runWithPatchRestore(resolved, ctx, invoke) {
    if (!resolved.restore)
        return invoke(resolved.args);
    let result;
    try {
        result = await invoke(resolved.args);
    }
    catch (e) {
        const note = await restoreAfterFailedPatch(resolved.restore, resolved.args, ctx, invoke);
        if (e instanceof Error) {
            e.message = withUndoNote(e.message, note);
            throw e;
        }
        throw new Error(withUndoNote(String(e), note));
    }
    if (!result?.isError)
        return result;
    const note = await restoreAfterFailedPatch(resolved.restore, resolved.args, ctx, invoke);
    const undone = note.startsWith(UNDONE_NOTE);
    const content = (Array.isArray(result.content) ? result.content : []).map((c) => undone && c?.type === 'text' && typeof c.text === 'string'
        ? { ...c, text: dropStagedAdvice(c.text) }
        : c);
    return { ...result, content: [...content, { type: 'text', text: note }] };
}
/**
 * Add `patched` to a successful handler result: into the JSON of the first
 * text item when it is a JSON object, else as an extra text item.
 */
function attachPatchedInfo(result, patched) {
    const r = result;
    if (!patched || !r || typeof r !== 'object' || r.isError)
        return result;
    const content = Array.isArray(r.content) ? [...r.content] : [];
    const idx = content.findIndex((c) => c?.type === 'text' && typeof c.text === 'string');
    if (idx >= 0) {
        try {
            const obj = JSON.parse(content[idx].text);
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                content[idx] = {
                    ...content[idx],
                    text: JSON.stringify({ ...obj, patched }, null, 2),
                };
                return { ...r, content };
            }
        }
        catch {
            /* not JSON — append below */
        }
    }
    const jdx = content.findIndex((c) => c?.type === 'json' && c.json && typeof c.json === 'object');
    if (jdx >= 0 && !Array.isArray(content[jdx].json)) {
        content[jdx] = { ...content[jdx], json: { ...content[jdx].json, patched } };
        return { ...r, content };
    }
    content.push({ type: 'text', text: JSON.stringify({ patched }) });
    return { ...r, content };
}
//# sourceMappingURL=sourcePatchInput.js.map