"use strict";
/**
 * Tier-based readonly enforcement for MCP tool calls.
 *
 * This is the server-side layer of the two-layer defense described in
 * docs/architecture: a client-side PreToolUse hook (sc4sap plugin) rejects
 * calls quickly and explains the reason; this guard is the uncircumventable
 * last line of defense that fires even when the hook is missing, disabled,
 * or never installed.
 *
 * Block matrix (Strict policy, see sc4sap multi-profile-design.md §4):
 *
 *   Tool family                                DEV   QA   PRD
 *   Create* / Update* / Delete*                 ✓    ✗    ✗
 *   CreateTransport                             ✓    ✗    ✗   (subset of Create*)
 *   RunUnitTest                                 ✓    ✓    ✗
 *   RuntimeRunProgramWithProfiling              ✓    ✗    ✗
 *   RuntimeRunClassWithProfiling                ✓    ✗    ✗
 *   RuntimeAnalyze* / RuntimeGet* / List*       ✓    ✓    ✓
 *   Get* / Read* / Search*                      ✓    ✓    ✓
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkToolAllowed = checkToolAllowed;
exports.guardTool = guardTool;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const profile_1 = require("./profile");
/** Prefixes that indicate a mutating operation on SAP. */
const MUTATION_PREFIXES = ['Create', 'Update', 'Delete'];
/** Tools that execute ABAP code and may have state-changing side effects. */
const RUNTIME_EXECUTION_TOOLS = new Set([
    'RunUnitTest',
    'RuntimeRunProgramWithProfiling',
    'RuntimeRunClassWithProfiling',
]);
/** Tools that are allowed on QA despite being in RUNTIME_EXECUTION_TOOLS. */
const QA_RUNTIME_ALLOWLIST = new Set(['RunUnitTest']);
function isMutation(toolName) {
    return MUTATION_PREFIXES.some((p) => toolName.startsWith(p));
}
/**
 * Returns `null` if the tool is allowed on the given tier, else a short reason
 * string that explains why it is blocked.
 */
function checkToolAllowed(toolName, tier) {
    if (tier === 'DEV')
        return null;
    if (isMutation(toolName)) {
        return `${toolName} mutates SAP objects; only DEV profiles may mutate.`;
    }
    if (RUNTIME_EXECUTION_TOOLS.has(toolName)) {
        if (tier === 'QA' && QA_RUNTIME_ALLOWLIST.has(toolName)) {
            return null;
        }
        return `${toolName} executes ABAP code on the server and is blocked on ${tier} profiles.`;
    }
    return null;
}
/**
 * Throws an `McpError` if the named tool is not allowed on the currently
 * active profile's tier. Called by the registration wrapper in
 * BaseHandlerGroup so every tool is guarded from a single chokepoint.
 */
function guardTool(toolName) {
    // `ReloadProfile` must always be allowed — it is how the user escapes the
    // readonly state by switching back to a DEV profile. It does not touch SAP.
    if (toolName === 'ReloadProfile')
        return;
    const tier = (0, profile_1.getActiveTier)();
    const reason = checkToolAllowed(toolName, tier);
    if (!reason)
        return;
    const alias = (0, profile_1.getActiveAlias)() ?? '(legacy)';
    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `ERR_READONLY_TIER: ${reason} Active profile: ${alias} (tier=${tier}). ` +
        'Switch to a DEV profile via sap-option to perform this operation.');
}
//# sourceMappingURL=readonlyGuard.js.map