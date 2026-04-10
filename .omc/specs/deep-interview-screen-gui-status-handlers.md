# Deep Interview Spec: Screen & GUI Status Handlers

## Metadata
- Interview ID: screen-gui-status-001
- Rounds: 7
- Final Ambiguity Score: 19%
- Type: brownfield
- Generated: 2026-04-10
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 35% | 0.298 |
| Constraint Clarity | 0.80 | 25% | 0.200 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity | 0.75 | 15% | 0.113 |
| **Total Clarity** | | | **0.811** |
| **Ambiguity** | | | **18.9%** |

## Goal

Implement full CRUD handlers for **Screen (Dynpro)** and **GUI Status** ABAP objects in the mcp-abap-adt MCP server. Both entity types follow the full 3-level handler pattern (`high/`, `low/`, `readonly/`) mirroring the program handler architecture. Handlers use direct ADT REST API calls (bypassing AdtClient) and return structured JSON data. The scope of what's creatable/updatable is bounded by what the ADT REST API actually exposes (e.g., screen layout may be read-only if ADT only serves binary layout data).

## Constraints
- **API approach:** Direct ADT REST API calls (like the include handler), not AdtClient methods
- **Environment:** `available_in: ['onprem', 'legacy']` — screens and GUI statuses are dynpro concepts, not available in ABAP Cloud
- **Folder structure:** Full 3-level: `high/` (workflow handlers), `low/` (atomic ops), `readonly/` (get/read)
- **Data format:** Structured JSON responses for Get/Read operations (parsed from ADT XML/text)
- **Scope boundary:** Implement whatever ADT supports. If screen layout is only readable (binary format), accept read-only for layout but full CRUD for flow logic. If ADT exposes full layout CRUD, include it.
- **Pattern reference:** Follow the program handler (`src/handlers/program/`) for 3-level structure; follow the include handler (`src/handlers/include/`) for direct REST API pattern

## Non-Goals
- Cloud system support (dynpros don't exist in ABAP Cloud)
- AdtClient integration (no AdtClient methods exist for screens/statuses)
- Screen Painter visual layout editing (graphical tool, not text-based)
- GUI Status variant management
- Extending AdtClient with new methods

## Acceptance Criteria
- [ ] **GetScreen** returns structured JSON: screen number, program name, field list (names, types, positions if available), flow logic text (PBO/PAI)
- [ ] **CreateScreen** creates a new dynpro on an existing program (screen number + flow logic at minimum)
- [ ] **UpdateScreen** modifies flow logic (and layout if ADT supports it), with lock→update→unlock→activate workflow
- [ ] **DeleteScreen** removes a dynpro from a program
- [ ] **GetGuiStatus** returns structured JSON: status name, program name, function codes, menu bars, toolbar buttons
- [ ] **CreateGuiStatus** creates a new GUI status on an existing program
- [ ] **UpdateGuiStatus** modifies status definition with lock→update→unlock→activate workflow
- [ ] **DeleteGuiStatus** removes a GUI status from a program
- [ ] Low-level handlers exist for both entities: Lock, Unlock, Check, Validate, Activate (separate atomic operations)
- [ ] All handlers registered in appropriate handler groups (HighLevelHandlersGroup, LowLevelHandlersGroup, ReadOnlyHandlersGroup)
- [ ] Integration tests pass against a real SAP on-premise system
- [ ] All handlers marked `available_in: ['onprem', 'legacy']`

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Screen layout is text-editable | Contrarian: layout is binary/graphical data from Screen Painter | Bounded by ADT: implement what API exposes, accept read-only layout if needed |
| Full 3-level structure needed | Simplifier: include handler works fine with just high+readonly | User confirmed full high+low+readonly like program handler |
| Screens exist on cloud | Screens are dynpro-only, not in ABAP Cloud | Confirmed: onprem + legacy only |
| AdtClient has screen methods | Include handler bypasses AdtClient for similar reasons | Confirmed: direct REST API approach |

## Technical Context

### Existing Codebase Patterns

**Reference handler — Program (full 3-level):**
```
src/handlers/program/
├── high/           # handleCreateProgram, handleDeleteProgram, handleGetProgram, handleUpdateProgram
├── low/            # handleActivateProgram, handleCheckProgram, handleCreateProgram, handleDeleteProgram,
│                   # handleLockProgram, handleUnlockProgram, handleValidateProgram, handleUpdateProgram
└── readonly/       # handleGetProgFullCode, handleReadProgram
```

**Reference handler — Include (direct REST API):**
```
src/handlers/include/
├── high/           # handleUpdateInclude, handleDeleteInclude
└── readonly/       # handleGetInclude, handleGetIncludesList
```

**Key implementation details from include handler:**
- Uses `makeAdtRequestWithTimeout()` for HTTP calls
- Uses `XMLParser` from `fast-xml-parser` for XML response parsing
- Uses `encodeSapObjectName()` for URL encoding
- Lock workflow: POST `?_action=LOCK&accessMode=MODIFY` → parse lock handle from XML → use in subsequent calls
- Unlock: POST `?_action=UNLOCK&lockHandle=...`
- Activation: POST to `/sap/bc/adt/activation/activator` with activation XML
- Error cleanup: attempt unlock in catch block if still locked

**ADT endpoints (likely):**
- Screens: `/sap/bc/adt/programs/programs/{program_name}/dynpros/{screen_number}`
- GUI Status: `/sap/bc/adt/programs/programs/{program_name}/gui_statuses/{status_name}` or similar

**Registration:**
- High-level: `src/lib/handlers/groups/HighLevelHandlersGroup.ts`
- Low-level: `src/lib/handlers/groups/LowLevelHandlersGroup.ts`
- Read-only: `src/lib/handlers/groups/ReadOnlyHandlersGroup.ts`

### Target File Structure

```
src/handlers/screen/
├── high/
│   ├── handleCreateScreen.ts
│   ├── handleGetScreen.ts
│   ├── handleUpdateScreen.ts
│   └── handleDeleteScreen.ts
├── low/
│   ├── handleLockScreen.ts
│   ├── handleUnlockScreen.ts
│   ├── handleCheckScreen.ts
│   ├── handleValidateScreen.ts
│   ├── handleActivateScreen.ts
│   ├── handleCreateScreen.ts
│   ├── handleUpdateScreen.ts
│   └── handleDeleteScreen.ts
└── readonly/
    └── handleReadScreen.ts

src/handlers/gui_status/
├── high/
│   ├── handleCreateGuiStatus.ts
│   ├── handleGetGuiStatus.ts
│   ├── handleUpdateGuiStatus.ts
│   └── handleDeleteGuiStatus.ts
├── low/
│   ├── handleLockGuiStatus.ts
│   ├── handleUnlockGuiStatus.ts
│   ├── handleCheckGuiStatus.ts
│   ├── handleValidateGuiStatus.ts
│   ├── handleActivateGuiStatus.ts
│   ├── handleCreateGuiStatus.ts
│   ├── handleUpdateGuiStatus.ts
│   └── handleDeleteGuiStatus.ts
└── readonly/
    └── handleReadGuiStatus.ts
```

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Screen (Dynpro) | core domain | program_name, screen_number, layout (fields, positions, attributes), flow_logic (PBO/PAI modules) | Belongs to Program; identified by program_name + screen_number |
| GUI Status | core domain | status_name, program_name, menus, toolbars, function_codes, title_bars | Belongs to Program; identified by program_name + status_name |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 2 | 2 | - | - | N/A |
| 2 | 2 | 0 | 0 | 2 | 100% |
| 3 | 2 | 0 | 0 | 2 | 100% |
| 4 | 2 | 0 | 0 | 2 | 100% |
| 5 | 2 | 0 | 0 | 2 | 100% |
| 6 | 2 | 0 | 0 | 2 | 100% |
| 7 | 2 | 0 | 0 | 2 | 100% |

## Interview Transcript
<details>
<summary>Full Q&A (7 rounds)</summary>

### Round 1
**Q:** SAP screens (dynpros) and GUI statuses are sub-objects of programs — they don't exist independently. When you say 'screen & gui_status handlers', which CRUD operations do you envision?
**A:** Full CRUD — Create, Read, Update, Delete screens and GUI statuses on programs
**Ambiguity:** 67% (Goal: 0.45, Constraints: 0.30, Criteria: 0.15, Context: 0.40)

### Round 2
**Q:** How will we know these handlers work correctly? Should GetScreen/GetGuiStatus return structured data, raw XML, or structured get with raw update?
**A:** Structured data for both — parse and return structured JSON
**Ambiguity:** 57% (Goal: 0.55, Constraints: 0.30, Criteria: 0.40, Context: 0.40)

### Round 3
**Q:** Should handlers use direct ADT REST API (like include handler) and be restricted to onprem+legacy?
**A:** Direct REST + onprem only (Recommended)
**Ambiguity:** 46% (Goal: 0.55, Constraints: 0.65, Criteria: 0.40, Context: 0.55)

### Round 4
**Q:** For screen CRUD: does Create/Update handle flow logic only, both layout + flow logic, or separate operations?
**A:** Both layout + flow logic in a single operation
**Ambiguity:** 41% (Goal: 0.70, Constraints: 0.65, Criteria: 0.40, Context: 0.55)

### Round 5 (Contrarian)
**Q:** Screen layouts are binary/graphical data. What if full layout CRUD isn't feasible via REST, and the real value is flow logic CRUD + read-only layout?
**A:** Start with what ADT supports — implement whatever ADT exposes
**Ambiguity:** 35% (Goal: 0.75, Constraints: 0.75, Criteria: 0.45, Context: 0.60)

### Round 6
**Q:** Concrete acceptance criteria: which of 7 criteria (Get, Create, Update, Delete for both + registration + tests) are must-haves?
**A:** All 7 are must-haves
**Ambiguity:** 26% (Goal: 0.80, Constraints: 0.75, Criteria: 0.70, Context: 0.65)

### Round 7 (Simplifier)
**Q:** Do you need all 3 folder levels (high+low+readonly) or would the simpler include-style (high+readonly) suffice?
**A:** High + Low + Readonly (full) — like the program handler
**Ambiguity:** 19% (Goal: 0.85, Constraints: 0.80, Criteria: 0.80, Context: 0.75)

</details>
