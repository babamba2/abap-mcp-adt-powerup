# Open Questions

## screen-gui-status-handlers - 2026-04-10 (Revised v2)
- [ ] Are the assumed ADT endpoints correct for Screen sub-objects (`/sap/bc/adt/programs/programs/{name}/dynpros/{number}`)? -- Incorrect endpoints will cause 404s and require URL adjustments. **Phase 1 gate will resolve this.**
- [ ] Does ADT support Screen layout manipulation (field positions, element properties) via REST, or only flow logic source code? -- If layout is read-only via ADT, the Update handler should document this limitation and only update flow logic
- [ ] What XML schema does ADT expect for GUI Status creation (function codes, menu structure, toolbar buttons)? -- Needed for the Create handler body; capture from Phase 1 endpoint probing
- [ ] Does `_action=CHECK` and `_action=VALIDATE` work for Screen/GUI Status sub-objects? -- If not supported (404/405), omit Check/Validate handlers entirely. **Phase 1 gate will resolve this.**
- [ ] Can Screen objects be created via ADT POST, or must they be created via SE51 transaction only? -- Some ADT sub-object endpoints are read-only; creation may not be supported. **Phase 1 gate will resolve this.**
- [ ] Locking granularity: Are screens locked at screen level or at parent program level? -- If parent program level, lock/unlock URLs need adjustment. **Phase 1 gate will resolve this.**
- [ ] Does combining `restoreSessionInConnection()` + `makeAdtRequestWithTimeout()` work correctly for stateful sessions? -- Novel pattern not used elsewhere in codebase. First handler (LockScreen) should verify session continuity. **Phase 2 will validate with reference handler.**
- [ ] What XML format does PUT expect for updating a GUI Status definition? -- Needed for UpdateGuiStatus handler body. **Phase 1 gate will capture sample responses.**
