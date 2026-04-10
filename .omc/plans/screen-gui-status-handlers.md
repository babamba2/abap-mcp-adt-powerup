# Screen & GUI Status Handlers Implementation Plan (Revised v2)

**Date:** 2026-04-10
**Complexity:** HIGH (up to 30 new files + 3 modified files, gated by Phase 1 findings)
**Scope:** Full CRUD handlers for Screen (Dynpro) and GUI Status ABAP objects

---

## Context

The codebase follows a 3-level handler pattern (high/low/readonly) for each SAP object type. Screen (Dynpro) and GUI Status are sub-objects of Programs, accessed via nested ADT REST endpoints. Since no AdtClient support exists for these object types, all handlers use direct ADT REST calls via `makeAdtRequestWithTimeout()`, following the same pattern as the Include handler (`src/handlers/include/high/handleUpdateInclude.ts`).

Both object types are onprem+legacy only (`available_in: ['onprem', 'legacy']`).

**Novel pattern requirement:** Low-level handlers in this codebase always use `restoreSessionInConnection()` for session management. However, all existing low-level handlers use AdtClient (which internally uses the connection). These new handlers are the first to combine `restoreSessionInConnection()` + `makeAdtRequestWithTimeout()` directly. This is architecturally sound because `restoreSessionInConnection()` mutates the connection object (sets session ID + stateful mode), and `makeAdtRequestWithTimeout()` uses that same connection object for its HTTP calls. A reference template is provided below.

## Work Objectives

1. Validate ADT endpoint assumptions against a real SAP system (Phase 1 gate)
2. Implement Screen (Dynpro) handlers: CRUD operations at high, low, and readonly levels
3. Implement GUI Status handlers: CRUD operations at high, low, and readonly levels
4. Register all new handlers in the three handler group files

## Guardrails

### Must Have
- All handlers use direct ADT REST API (`makeAdtRequestWithTimeout`) -- no AdtClient
- All handlers set `available_in: ['onprem', 'legacy']`
- Low-level tool names have `Low` suffix (e.g., `LockScreenLow`)
- Low-level handlers include `session_id`/`session_state` in inputSchema
- Low-level handlers call `restoreSessionInConnection()` before `makeAdtRequestWithTimeout()`
- High-level handlers return structured JSON with `steps_completed` array
- Error cleanup: attempt unlock in catch blocks when lock is held
- XML parsing via `fast-xml-parser` `XMLParser`
- URL encoding via `encodeSapObjectName()`
- Cloud check via `isCloudConnection()` with appropriate error message
- `corrNr` parameter on all mutating low-level handlers (Lock, Update, Create, Delete) -- not just Delete
- Phase 1 gate must pass before Phase 2 begins

### Must NOT Have
- No AdtClient usage -- these objects have no client support
- No cloud availability -- Screens and GUI Statuses are onprem-only concepts
- No architectural changes to existing handler infrastructure
- No modification to existing handlers (only additions)
- No Check/Validate handlers unless Phase 1 confirms ADT supports them

---

## ADT Endpoint Assumptions (to be validated in Phase 1)

### Screen (Dynpro)
- **Base URL:** `/sap/bc/adt/programs/programs/{program_name}/dynpros/{screen_number}`
- **List URL:** `/sap/bc/adt/programs/programs/{program_name}/dynpros`
- **Source/layout:** `{base}/source/main` (flow logic source code)
- **Metadata:** GET on base URL returns XML metadata (screen attributes, fields)
- **Lock/Unlock:** `?_action=LOCK&accessMode=MODIFY` / `?_action=UNLOCK&lockHandle=...`
- **Activate:** POST to `/sap/bc/adt/activation/activator` with object reference
- **Create:** POST to list URL with XML body
- **Delete:** DELETE on base URL with optional `corrNr` param
- **Check:** POST `{base}?_action=CHECK` -- UNCONFIRMED, may not exist for sub-objects
- **Validate:** Similar to check -- UNCONFIRMED

### GUI Status
- **Base URL:** `/sap/bc/adt/programs/programs/{program_name}/gui_statuses/{status_name}`
- **List URL:** `/sap/bc/adt/programs/programs/{program_name}/gui_statuses`
- **Source:** GET `{base}` returns XML definition
- **Lock/Unlock:** Same `_action=LOCK`/`UNLOCK` pattern
- **Activate:** Same activator endpoint pattern
- **Create:** POST to list URL with XML body
- **Delete:** DELETE on base URL with optional `corrNr` param
- **Check/Validate:** UNCONFIRMED for sub-objects

---

## Reference Template: Direct-REST Low-Level Handler with Session Management

This is the canonical pattern for the new handler type (combining `restoreSessionInConnection` + `makeAdtRequestWithTimeout`). No existing handler in the codebase uses this exact combination. Use this as the base for all Screen/GUI Status low-level handlers.

```typescript
/**
 * LockScreen Handler - Lock an ABAP Screen (Dynpro)
 *
 * Uses direct ADT REST API since AdtClient doesn't have screen methods.
 * ADT endpoint: /sap/bc/adt/programs/programs/{program}/dynpros/{number}?_action=LOCK
 * Low-level handler: single atomic operation with session management.
 */

import { XMLParser } from 'fast-xml-parser';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  encodeSapObjectName,
  isCloudConnection,
  makeAdtRequestWithTimeout,
  restoreSessionInConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

const ACCEPT_LOCK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';

export const TOOL_DEFINITION = {
  name: 'LockScreenLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Lock an ABAP Screen (Dynpro) for modification. Returns lock handle for subsequent update/unlock operations.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., SAPMV45A).',
      },
      screen_number: {
        type: 'string',
        description: 'Screen number (e.g., 0100).',
      },
      session_id: {
        type: 'string',
        description: 'Session ID from GetSession. If not provided, a new session will be created.',
      },
      session_state: {
        type: 'object',
        description: 'Session state from GetSession (cookies, csrf_token, cookie_store).',
        properties: {
          cookies: { type: 'string' },
          csrf_token: { type: 'string' },
          cookie_store: { type: 'object' },
        },
      },
    },
    required: ['program_name', 'screen_number'],
  },
} as const;

interface LockScreenArgs {
  program_name: string;
  screen_number: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleLockScreen(
  context: HandlerContext,
  args: LockScreenArgs,
) {
  const { connection, logger } = context;
  try {
    const { program_name, screen_number, session_id, session_state } = args;

    if (!program_name || !screen_number) {
      return return_error(new Error('program_name and screen_number are required'));
    }

    if (isCloudConnection()) {
      return return_error(
        new Error('Screens are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'),
      );
    }

    // SESSION MANAGEMENT: Restore session state before making REST calls.
    // restoreSessionInConnection() sets session ID + stateful mode on the connection object.
    // makeAdtRequestWithTimeout() then uses this same connection for HTTP calls.
    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    }

    const programName = program_name.toUpperCase();
    const encodedName = encodeSapObjectName(programName);
    const baseUrl = `/sap/bc/adt/programs/programs/${encodedName}/dynpros/${screen_number}`;

    logger?.info(`Locking screen: ${programName} / ${screen_number}`);

    const lockResponse = await makeAdtRequestWithTimeout(
      connection,
      `${baseUrl}?_action=LOCK&accessMode=MODIFY`,
      'POST',
      'default',
      null,
      undefined,
      { Accept: ACCEPT_LOCK },
    );

    // Parse lock handle from XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const parsed = parser.parse(lockResponse.data || '');
    const lockHandle =
      parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
      lockResponse.headers?.['x-sap-adt-lock-handle'];

    if (!lockHandle) {
      throw new Error(`Failed to obtain lock handle for screen ${programName}/${screen_number}`);
    }

    logger?.info(`Screen locked: ${programName}/${screen_number}`);

    return return_response({
      data: JSON.stringify({
        success: true,
        program_name: programName,
        screen_number: screen_number,
        session_id: session_id || null,
        lock_handle: lockHandle,
        session_state: null, // Session state managed by auth-broker
        message: `Screen ${programName}/${screen_number} locked successfully. Use this lock_handle and session_id for subsequent operations.`,
      }, null, 2),
    } as AxiosResponse);
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    try {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const errorData = error?.response?.data ? parser.parse(error.response.data) : null;
      const errorMsg = errorData?.['exc:exception']?.message?.['#text'] || errorData?.['exc:exception']?.message;
      if (errorMsg) errorMessage = `SAP Error: ${errorMsg}`;
    } catch { /* ignore parse errors */ }

    logger?.error(`Error locking screen: ${errorMessage}`);
    return return_error(new Error(`Failed to lock screen: ${errorMessage}`));
  }
}
```

**Key differences from existing low-level handlers (e.g., `handleLockProgram.ts`):**
1. No `createAdtClient()` call -- uses `makeAdtRequestWithTimeout()` directly
2. Still calls `restoreSessionInConnection()` for session management (same pattern)
3. Manual XML parsing of lock handle (AdtClient does this internally for other object types)
4. Manual URL construction with `encodeSapObjectName()`

---

## Task Flow

### Phase 0: Preparation (1 step)

#### Step 0: Create Directory Structure
**Directories to create:**
- `src/handlers/screen/readonly/`
- `src/handlers/screen/low/`
- `src/handlers/screen/high/`
- `src/handlers/gui_status/readonly/`
- `src/handlers/gui_status/low/`
- `src/handlers/gui_status/high/`

**Acceptance Criteria:**
- [ ] All 6 directories exist

---

### Phase 1: Readonly Handlers + Endpoint Validation (HARD GATE)

Build readonly handlers first, test against real SAP, confirm which ADT endpoints exist before proceeding.

#### Step 1: Create Screen Readonly Handlers (2 files)

**Files:**
- `src/handlers/screen/readonly/handleReadScreen.ts`
- `src/handlers/screen/readonly/handleGetScreensList.ts`

**Implementation:**

**handleReadScreen:**
- Follow `handleGetInclude.ts` pattern (direct return, no zod -- use type/properties schema like other handlers)
- Input: `program_name` (string), `screen_number` (string)
- GET `{baseUrl}/source/main` for flow logic source
- GET `{baseUrl}` for metadata (screen attributes)
- Return both metadata and flow logic source in response
- Use `encodeSapObjectName()` for program name in URL

**handleGetScreensList:**
- Follow `handleGetIncludesList.ts` pattern
- Input: `program_name` (string)
- GET `/sap/bc/adt/programs/programs/{program_name}/dynpros`
- Parse XML response to list screens with numbers, descriptions
- Return array of screen entries

**Acceptance Criteria:**
- [ ] `handleReadScreen` exports `TOOL_DEFINITION` with name `ReadScreen`, `available_in: ['onprem', 'legacy']`
- [ ] `handleReadScreen` exports `handleReadScreen(context, args)` function
- [ ] `handleReadScreen` returns flow logic source code and screen metadata
- [ ] `handleReadScreen` handles 404 (screen not found) gracefully
- [ ] `handleGetScreensList` exports `TOOL_DEFINITION` with name `GetScreensList`, `available_in: ['onprem', 'legacy']`
- [ ] `handleGetScreensList` returns list of screens for a program

#### Step 2: Create GUI Status Readonly Handlers (2 files)

**Files:**
- `src/handlers/gui_status/readonly/handleReadGuiStatus.ts`
- `src/handlers/gui_status/readonly/handleGetGuiStatusList.ts`

**Implementation:**

**handleReadGuiStatus:**
- Same pattern as handleReadScreen
- Input: `program_name` (string), `status_name` (string)
- GET on base URL returns XML definition of the GUI status
- Parse XML and return structured JSON (status type, function keys, menu bars, etc.)

**handleGetGuiStatusList:**
- Input: `program_name` (string)
- GET `/sap/bc/adt/programs/programs/{program_name}/gui_statuses`
- Parse XML response to list statuses with names, types
- Return array of GUI status entries

**Acceptance Criteria:**
- [ ] `handleReadGuiStatus` exports `TOOL_DEFINITION` with name `ReadGuiStatus`, `available_in: ['onprem', 'legacy']`
- [ ] `handleReadGuiStatus` exports `handleReadGuiStatus(context, args)` function
- [ ] `handleReadGuiStatus` returns parsed GUI status definition
- [ ] `handleReadGuiStatus` handles 404 gracefully
- [ ] `handleGetGuiStatusList` exports `TOOL_DEFINITION` with name `GetGuiStatusList`, `available_in: ['onprem', 'legacy']`
- [ ] `handleGetGuiStatusList` returns list of GUI statuses for a program

#### Step 3: Register Readonly Handlers + Test (GATE CHECKPOINT)

**Register in `ReadOnlyHandlersGroup.ts`:**
- 4 imports (handler + TOOL_DEFINITION for each of 4 files, using named import pattern: `{ handleReadScreen, TOOL_DEFINITION as ReadScreen_Tool }`)
- 4 handler entries using pattern: `{ toolDefinition: ReadScreen_Tool, handler: (args: any) => handleReadScreen(this.context, args) }`

**Test against real SAP system:**
1. Call `ReadScreen` with a known program that has screens -- verify response structure
2. Call `GetScreensList` with a known program -- verify it lists screens
3. Call `ReadGuiStatus` with a known program that has GUI statuses -- verify response structure
4. Call `GetGuiStatusList` with a known program -- verify it lists statuses
5. Attempt lock URL manually: `POST {baseUrl}?_action=LOCK&accessMode=MODIFY` -- does it return a lock handle?
6. Attempt check URL manually: `POST {baseUrl}?_action=CHECK` -- does it return 200 or 404/405?
7. Note the XML schema of responses for Create operations

**HARD GATE -- Pass/Fail Criteria:**

**PASS (proceed to Phase 2) if ALL of:**
- [ ] At least one readonly handler returns valid data from SAP
- [ ] List endpoints return screen/status entries
- [ ] Lock/Unlock URLs are confirmed working (lock handle returned)
- [ ] `npm run build` passes with readonly handlers registered

**FAIL (stop and reassess) if ANY of:**
- [ ] Base URLs return 404 (endpoints don't exist at assumed paths)
- [ ] Lock returns 404/405 (locking not supported for sub-objects)
- [ ] XML response schema is fundamentally different from assumptions

**Gate output document:** Record findings in `.omc/plans/screen-gui-status-phase1-findings.md`:
- Confirmed endpoints (with actual URLs)
- Confirmed XML response schemas
- Lock/unlock behavior (sub-object level or parent program level?)
- Which operations ADT supports: Check? Validate? Create? Delete?
- Any URL or schema adjustments needed

---

### Phase 2: Low-Level Handlers (confirmed operations only)

**Prerequisite:** Phase 1 gate passed. Only create handlers for operations confirmed working.

#### Step 4: Create Screen Low-Level Handlers (up to 8 files)

**Always create (core operations):**
- `src/handlers/screen/low/handleLockScreen.ts` -- Use reference template above
- `src/handlers/screen/low/handleUnlockScreen.ts`
- `src/handlers/screen/low/handleActivateScreen.ts`
- `src/handlers/screen/low/handleUpdateScreen.ts`
- `src/handlers/screen/low/handleCreateScreen.ts`
- `src/handlers/screen/low/handleDeleteScreen.ts`

**Create ONLY if Phase 1 confirmed ADT supports them:**
- `src/handlers/screen/low/handleCheckScreen.ts`
- `src/handlers/screen/low/handleValidateScreen.ts`

**Implementation pattern:**
- All follow the reference template (LockScreen) above
- Tool names: `LockScreenLow`, `UnlockScreenLow`, `ActivateScreenLow`, `UpdateScreenLow`, `CreateScreenLow`, `DeleteScreenLow`, and conditionally `CheckScreenLow`, `ValidateScreenLow`
- All include `session_id`/`session_state` in inputSchema
- All include `program_name` and `screen_number` as required inputs
- All call `restoreSessionInConnection()` before `makeAdtRequestWithTimeout()`
- Lock: POST `{baseUrl}?_action=LOCK&accessMode=MODIFY`, parse lock handle from XML
- Unlock: POST `{baseUrl}?_action=UNLOCK&lockHandle=...`, requires `lock_handle` input
- Activate: POST `/sap/bc/adt/activation/activator` with object reference XML
- Create: POST to parent URL with screen definition XML, requires `screen_number`, `description`
- Update: PUT `{baseUrl}/source/main?lockHandle=...&corrNr=...` with flow logic source
- Delete: DELETE `{baseUrl}?lockHandle=...&corrNr=...`
- All mutating handlers include optional `transport_request` / `corrNr` parameter

**Acceptance Criteria:**
- [ ] Each file exports `TOOL_DEFINITION` with `Low` suffix name and `available_in: ['onprem', 'legacy']`
- [ ] Each file exports handler function with `(context, args)` signature
- [ ] Each handler includes `session_id`/`session_state` in inputSchema
- [ ] Each handler calls `restoreSessionInConnection()` when session is provided
- [ ] Lock handler returns `lock_handle` in response
- [ ] All handlers use `makeAdtRequestWithTimeout` (no AdtClient)
- [ ] Error responses parsed via XMLParser for SAP error messages
- [ ] Mutating handlers include `corrNr` parameter

#### Step 5: Create GUI Status Low-Level Handlers (up to 8 files)

**Always create (core operations):**
- `src/handlers/gui_status/low/handleLockGuiStatus.ts`
- `src/handlers/gui_status/low/handleUnlockGuiStatus.ts`
- `src/handlers/gui_status/low/handleActivateGuiStatus.ts`
- `src/handlers/gui_status/low/handleUpdateGuiStatus.ts`
- `src/handlers/gui_status/low/handleCreateGuiStatus.ts`
- `src/handlers/gui_status/low/handleDeleteGuiStatus.ts`

**Create ONLY if Phase 1 confirmed ADT supports them:**
- `src/handlers/gui_status/low/handleCheckGuiStatus.ts`
- `src/handlers/gui_status/low/handleValidateGuiStatus.ts`

**Implementation pattern:** Same as Step 4 but for GUI Status.
- Tool names: `LockGuiStatusLow`, `UnlockGuiStatusLow`, etc.
- Inputs: `program_name` and `status_name` (instead of `screen_number`)
- Update body: XML definition of GUI status (function codes, menus, toolbars) -- schema from Phase 1 findings

**Acceptance Criteria:**
- [ ] Same criteria as Step 4 but for GUI Status entity
- [ ] Input uses `status_name` (string) instead of `screen_number`

---

### Phase 3: High-Level Workflow Handlers

#### Step 6: Create Screen High-Level Handlers (4 files)

**Files:**
- `src/handlers/screen/high/handleCreateScreen.ts`
- `src/handlers/screen/high/handleGetScreen.ts`
- `src/handlers/screen/high/handleUpdateScreen.ts`
- `src/handlers/screen/high/handleDeleteScreen.ts`

**Implementation pattern:**
- **handleGetScreen**: Follow `handleGetProgram.ts` pattern. GET metadata + source, return structured JSON. No session management needed (readonly operation in high-level wrapper).
- **handleCreateScreen**: POST to create, optionally activate. Return structured JSON with `steps_completed`. Include `transport_request` parameter.
- **handleUpdateScreen**: Follow `handleUpdateInclude.ts` pattern exactly. Workflow: lock -> update source -> unlock -> (activate). Return `steps_completed` array. Error cleanup: unlock in catch. Include `transport_request` parameter.
- **handleDeleteScreen**: Follow `handleDeleteInclude.ts` pattern. Lock -> delete -> (unlock on error). Handle 404/423 status codes. Include `transport_request` parameter.
- Tool names: `CreateScreen`, `GetScreen`, `UpdateScreen`, `DeleteScreen`

**Acceptance Criteria:**
- [ ] Each exports `TOOL_DEFINITION` with `available_in: ['onprem', 'legacy']`
- [ ] `handleUpdateScreen` implements lock -> update -> unlock -> (activate) workflow
- [ ] `handleUpdateScreen` returns `steps_completed` array
- [ ] `handleDeleteScreen` handles 404 and 423 errors with clear messages
- [ ] All use `isCloudConnection()` guard
- [ ] Error cleanup: unlock attempt in catch blocks
- [ ] All mutating handlers include `transport_request` parameter

#### Step 7: Create GUI Status High-Level Handlers (4 files)

**Files:**
- `src/handlers/gui_status/high/handleCreateGuiStatus.ts`
- `src/handlers/gui_status/high/handleGetGuiStatus.ts`
- `src/handlers/gui_status/high/handleUpdateGuiStatus.ts`
- `src/handlers/gui_status/high/handleDeleteGuiStatus.ts`

**Implementation pattern:** Same as Step 6 but for GUI Status.
- Tool names: `CreateGuiStatus`, `GetGuiStatus`, `UpdateGuiStatus`, `DeleteGuiStatus`

**Acceptance Criteria:**
- [ ] Same criteria as Step 6 but for GUI Status entity

---

### Phase 4: Registration + Build

#### Step 8: Register All Handlers in Group Files (3 files to modify)

**Files to modify:**
- `src/lib/handlers/groups/ReadOnlyHandlersGroup.ts` -- 4 imports (each: `{ handler, TOOL_DEFINITION as Alias }`) + 4 handler entries
- `src/lib/handlers/groups/LowLevelHandlersGroup.ts` -- up to 16 imports (each: handler function + `TOOL_DEFINITION as Alias` = 2 import lines per file) + up to 16 handler entries. Actual count depends on Phase 1 gate (Check/Validate may be excluded).
- `src/lib/handlers/groups/HighLevelHandlersGroup.ts` -- 8 imports + 8 handler entries

**Registration patterns (match existing style per group):**
- **Read-only:** `{ toolDefinition: ReadScreen_Tool, handler: (args: any) => handleReadScreen(this.context, args) }`
- **Low-level:** `{ toolDefinition: LockScreen_Tool, handler: (args: any) => { return handleLockScreen(this.context, args); } }`
- **High-level:** `{ toolDefinition: CreateScreen_Tool, handler: withContext(handleCreateScreen) }`

**Import count summary (maximum, if all Check/Validate confirmed):**
- ReadOnly: 8 import lines (4 files x 2 named exports each), 4 handler entries
- LowLevel: 32 import lines (16 files x 2 named exports each), 16 handler entries
- HighLevel: 16 import lines (8 files x 2 named exports each), 8 handler entries

**Acceptance Criteria:**
- [ ] All new handlers are registered in their respective group files
- [ ] Import paths are correct (relative to group file location)
- [ ] No duplicate tool names
- [ ] Registration style matches existing entries in each group file
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes (biome)

---

## Verification Strategy

1. **Phase 1 gate:** Readonly handlers work against real SAP, endpoints confirmed
2. **Compile check:** `npm run build` succeeds with zero errors after each phase
3. **Lint check:** `npm run lint` passes (biome)
4. **Tool registration:** All tools appear when listing available tools
5. **Integration test:** Test at least ReadScreen, ReadGuiStatus, LockScreen, UpdateScreen against a known program

---

## Success Criteria

- [ ] Phase 1 gate passed with documented findings
- [ ] All confirmed handler files created following existing codebase patterns exactly
- [ ] 3 registration files updated with all new handlers
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] All tool names follow naming conventions (high-level: `CreateScreen`, low-level: `CreateScreenLow`)
- [ ] All handlers use direct ADT REST with `makeAdtRequestWithTimeout` (no AdtClient)
- [ ] All low-level handlers use `restoreSessionInConnection()` for session management
- [ ] All handlers restricted to onprem+legacy
- [ ] Check/Validate handlers only exist if ADT confirmed support in Phase 1

---

## Open Questions (to be resolved during Phase 1)

- **Locking granularity:** Are screens locked at screen level (the assumed URL) or at parent program level? If parent program level, the lock/unlock URLs need adjustment and handlers may need to lock the program instead.
- **Check/Validate support:** Does ADT expose `_action=CHECK` and `_action=VALIDATE` for screen/GUI status sub-objects? If not, omit those handlers entirely.
- **Create XML schema:** What XML body does POST to the create endpoint expect? Capture at least a skeleton from Phase 1 endpoint probing or SAP documentation.
- **Screen layout manipulation:** Is screen layout (field positions, attributes) modifiable via ADT, or is only flow logic source editable? If layout is read-only, document the limitation.
- **GUI Status update format:** What XML format does PUT expect for updating a GUI status definition? Capture from Phase 1.

---

## RALPLAN-DR Summary

### Principles
1. **Pattern conformity** -- Every new handler must exactly mirror the structure of existing handlers (include handler for direct REST, program handler for workflow patterns)
2. **Direct REST only** -- No AdtClient usage since these object types lack client support
3. **Validate before building** -- Confirm ADT endpoints exist before writing mutation handlers (Phase 1 gate)
4. **Error safety** -- Always attempt unlock in catch blocks when a lock is held; include `corrNr` on all mutating operations
5. **Onprem-only** -- Screens and GUI Statuses are SAP GUI concepts, not available on ABAP Cloud

### Decision Drivers
1. **ADT endpoint uncertainty** -- Screen/GUI Status sub-object endpoints may not support all operations; must validate first
2. **Novel pattern risk** -- First handlers to combine `restoreSessionInConnection` + `makeAdtRequestWithTimeout`; needs a reference template
3. **Consistency with existing codebase patterns** -- Reduces cognitive load and maintenance burden

### Viable Options

#### Option A: Gated Full 3-Level Implementation (RECOMMENDED)
Phase 1 validates endpoints with readonly handlers. Phase 2-3 build low-level and high-level handlers only for confirmed operations. Check/Validate handlers are conditional.

**Pros:**
- Minimizes wasted effort if endpoints differ from assumptions
- Complete feature parity for confirmed operations
- Reference template de-risks the novel pattern
- Includes List handlers for discovery

**Cons:**
- Phased approach takes longer than building everything at once
- Phase 1 gate may block progress if SAP system unavailable

#### Option B: Build Everything Unconditionally (REJECTED)
Build all 30 handlers without validating endpoints first.

**Pros:**
- Faster initial development (no gate delay)
- All code written in one pass

**Cons:**
- **High rework risk** if ADT endpoints differ from assumptions
- Check/Validate handlers may be dead code if ADT doesn't support them for sub-objects
- **Rejected because:** the Critic correctly identified that ADT endpoint assumptions for sub-objects are unverified, and building 16 low-level handlers on wrong assumptions wastes significant effort

#### Option C: High-Level + Readonly Only (REJECTED)
Skip low-level handlers entirely.

**Pros:**
- Smaller scope (14 files instead of up to 30)

**Cons:**
- **Breaks codebase pattern** -- every other object type has all 3 levels
- Loses composability for advanced MCP consumers
- **Rejected because:** inconsistency with established patterns; would need completion later

### ADR

- **Decision:** Gated full 3-level implementation (Option A) with Phase 1 endpoint validation
- **Drivers:** ADT endpoint uncertainty for sub-objects, novel `restoreSessionInConnection` + `makeAdtRequestWithTimeout` combination, pattern conformity
- **Alternatives considered:** Build unconditionally (Option B, rejected for rework risk), High+Readonly only (Option C, rejected for pattern inconsistency)
- **Why chosen:** De-risks ADT assumptions with a cheap validation phase; reference template addresses the novel pattern; conditional Check/Validate avoids dead code
- **Consequences:** Phase 1 gate adds a testing checkpoint before bulk implementation; total file count may be 26-30 depending on Check/Validate support; Phase 1 findings document becomes a prerequisite for Phase 2
- **Follow-ups:** Phase 1 findings document (`screen-gui-status-phase1-findings.md`); integration testing after Phase 4; document any screen layout limitations
