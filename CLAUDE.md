# MCP ABAP ADT - Development Guide

## Workflow Rules

### [1] Show diff on ABAP source updates (mandatory)

Before calling any Update* tool that changes ABAP source code — programs, includes, classes, interfaces, function modules, CDS views, metadata extensions (DDLX), behavior definitions/implementations, unit tests, screens, GUI statuses — you **must**:

1. Read the **current** source first (e.g. `GetProgram`, `GetInclude`, `GetClass`, `GetView`, `GetMetadataExtension`, `ReadScreen`, `ReadGuiStatus`).
2. Display the **Before / After diff** to the user, highlighting only the changed sections. Use fenced code blocks labeled `**Before**` / `**After**` following the Notion page style.
3. Only proceed with the Update after the diff is visible in the response.

This applies even for "small" edits — the user must see what will change before it lands on SAP.

### [2] Notion logging after task completion (mandatory)

After any task that creates, updates, or deletes ABAP objects on SAP is fully verified, append an entry to the **Team2↔Team3 Code History** database:

- URL: `https://www.notion.so/15d8dd48364147099fa6ba1bd0f471e5?v=e403e481a51742a49d25c1ed44cdd3d0`
- Conform to the existing entry format. Required columns:
  - `Title` — `[Team name or module] <short summary>`
  - `Team` — `Team2:blue` | `Team3:red` | `Both:purple`
  - `Action` — `Code Created:green` | `QA Review:yellow` | `Bug Fix:red` | `Warning Fix:orange` | `Approved:green`
  - `Program` — target ABAP object(s) or TS handler paths
  - `Description`, `Issues`, `Resolution`, `Version`, `Date`
- Page **body** must include **Before / After code blocks** for every substantive change (use fenced code blocks). This is non-negotiable — entries without before/after are incomplete.
- Include an "활성화 정보" or "Activation info" table when changes were activated on SAP (object / method / transport / result).

Use `mcp__claude_ai_Notion__notion-create-pages` to create the entry and target the database via `collection://93762f92-598b-434e-bfc1-fa685a892ef2`.

## Testing

### Integration Tests

Integration tests run against a real SAP system. Two modes:

- **Soft mode** (default, `integration_hard_mode.enabled: false`): calls handlers directly, no MCP subprocess.
- **Hard mode** (`integration_hard_mode.enabled: true`): spawns full MCP server via stdio, calls tools through MCP protocol.

**Strategy**: Run soft mode for mass regression testing. Use hard mode only for targeted verification of recent changes.

**Running integration tests**: Always save full output to a log file — do NOT truncate with `tail`. Tests take 15-25 minutes; use `timeout 1800` (30 min) or `run_in_background` with no timeout truncation. This avoids re-running long tests just to see errors.

```bash
# Soft mode (mass run) — save full log
npm run test:integration 2>&1 | tee /tmp/integration-test.log

# Hard mode (targeted, in test-config.yaml set integration_hard_mode.enabled: true)
npm test -- --testPathPatterns=<specific-test>
```

### Test Configuration

All test parameters live in `tests/test-config.yaml` (gitignored). The template (`tests/test-config.yaml.template`) works out of the box with sensible defaults.

**Setup:**
```bash
cp tests/test-config.yaml.template tests/test-config.yaml
# Edit ONLY the lines marked "# ← CHANGE"
```

**Required changes** (marked `# ← CHANGE`):
- `environment.env` — session .env file name (`"e19.env"`, `"mdd.env"`) from standard sessions folder
- `environment.system_type` — `"onprem"`, `"cloud"`, or `"legacy"`
- `environment.connection_type` — `"http"` (default) or `"rfc"` (legacy)
- `environment.default_package` — dev package (`ZMCP_TEST`, `$TMP`)
- `environment.default_transport` — transport request or `""` for local packages
- `shared_dependencies.package` — package for shared test objects
- `shared_dependencies.software_component` — `"LOCAL"`, `"HOME"`, etc.

Everything else (object names, timeouts, CDS sources, unit test code) has working defaults. See `docs/development/tests/TESTING_GUIDE.md` for full details.

### available_in

`available_in` in `TOOL_DEFINITION` restricts tool to specific SAP environments. If omitted, the tool is available everywhere. Only set it when a tool genuinely doesn't work on some platform (e.g., Programs are onprem-only):

```typescript
available_in: ['onprem', 'legacy'] as const,  // not available on cloud
```

Values: `'onprem'` | `'cloud'` | `'legacy'`. If omitted, tool is available everywhere. Test-level `available_in` is controlled separately in `test-config.yaml.template`.

### Cloud vs On-Prem

- Programs are NOT available on ABAP Cloud (`available_in: ['onprem', 'legacy']`)
- Runtime profiling (class-based) and dumps work on both cloud and onprem
- `RuntimeRunProgramWithProfiling` is onprem-only (no programs on cloud)
