# Legacy System Tools - MCP ABAP ADT Server

Generated from code in `src/handlers/**` (not from docs).

Tools available on legacy SAP systems (BASIS < 7.50) connected via RFC.
Legacy systems support a subset of tools — primarily Class, Interface, View, Program, Function Group/Module, Package (read/update/delete), Include, Unit Test, and common utilities.

- Total tools: 164
- Read-Only: 23
- High-Level: 69
- Low-Level: 72

## Navigation

- [Read-Only Group](#read-only-group)
  - [Class](#read-only-class)
    - [ReadClass](#readclass-read-only-class)
  - [Enhancement](#read-only-enhancement)
    - [GetBadiImplementations](#getbadiimplementations-read-only-enhancement)
  - [Function Group](#read-only-function-group)
    - [ReadFunctionGroup](#readfunctiongroup-read-only-function-group)
  - [Function Module](#read-only-function-module)
    - [ReadFunctionModule](#readfunctionmodule-read-only-function-module)
  - [Gui Status](#read-only-gui-status)
    - [GetGuiStatusList](#getguistatuslist-read-only-gui-status)
    - [ReadGuiStatus](#readguistatus-read-only-gui-status)
  - [Include](#read-only-include)
    - [GetInclude](#getinclude-read-only-include)
    - [GetIncludesList](#getincludeslist-read-only-include)
  - [Interface](#read-only-interface)
    - [ReadInterface](#readinterface-read-only-interface)
  - [Package](#read-only-package)
    - [GetPackageContents](#getpackagecontents-read-only-package)
    - [ReadPackage](#readpackage-read-only-package)
  - [Program](#read-only-program)
    - [GetProgFullCode](#getprogfullcode-read-only-program)
    - [ReadProgram](#readprogram-read-only-program)
  - [Screen](#read-only-screen)
    - [GetScreensList](#getscreenslist-read-only-screen)
    - [ReadScreen](#readscreen-read-only-screen)
  - [System](#read-only-system)
    - [GetInactiveObjects](#getinactiveobjects-read-only-system)
    - [GetJobUsage](#getjobusage-read-only-system)
    - [GetSmartFormLayout](#getsmartformlayout-read-only-system)
    - [GetTcodeUsage](#gettcodeusage-read-only-system)
    - [GetUsageSnippets](#getusagesnippets-read-only-system)
    - [GetWhereUsed](#getwhereused-read-only-system)
    - [ReloadProfile](#reloadprofile-read-only-system)
  - [View](#read-only-view)
    - [ReadView](#readview-read-only-view)
- [High-Level Group](#high-level-group)
  - [Class](#high-level-class)
    - [CreateClass](#createclass-high-level-class)
    - [DeleteClass](#deleteclass-high-level-class)
    - [DeleteLocalDefinitions](#deletelocaldefinitions-high-level-class)
    - [DeleteLocalMacros](#deletelocalmacros-high-level-class)
    - [DeleteLocalTestClass](#deletelocaltestclass-high-level-class)
    - [DeleteLocalTypes](#deletelocaltypes-high-level-class)
    - [GetClass](#getclass-high-level-class)
    - [GetLocalDefinitions](#getlocaldefinitions-high-level-class)
    - [GetLocalMacros](#getlocalmacros-high-level-class)
    - [GetLocalTestClass](#getlocaltestclass-high-level-class)
    - [GetLocalTypes](#getlocaltypes-high-level-class)
    - [UpdateClass](#updateclass-high-level-class)
    - [UpdateLocalDefinitions](#updatelocaldefinitions-high-level-class)
    - [UpdateLocalMacros](#updatelocalmacros-high-level-class)
    - [UpdateLocalTestClass](#updatelocaltestclass-high-level-class)
    - [UpdateLocalTypes](#updatelocaltypes-high-level-class)
  - [Common](#high-level-common)
    - [ActivateObjects](#activateobjects-high-level-common)
  - [Function](#high-level-function)
    - [CreateFunctionGroup](#createfunctiongroup-high-level-function)
    - [CreateFunctionModule](#createfunctionmodule-high-level-function)
    - [UpdateFunctionGroup](#updatefunctiongroup-high-level-function)
    - [UpdateFunctionModule](#updatefunctionmodule-high-level-function)
  - [Function Group](#high-level-function-group)
    - [DeleteFunctionGroup](#deletefunctiongroup-high-level-function-group)
    - [GetFunctionGroup](#getfunctiongroup-high-level-function-group)
  - [Function Module](#high-level-function-module)
    - [DeleteFunctionModule](#deletefunctionmodule-high-level-function-module)
    - [GetFunctionModule](#getfunctionmodule-high-level-function-module)
  - [Gui Status](#high-level-gui-status)
    - [CreateGuiStatus](#createguistatus-high-level-gui-status)
    - [DeleteGuiStatus](#deleteguistatus-high-level-gui-status)
    - [GetGuiStatus](#getguistatus-high-level-gui-status)
    - [PatchGuiStatus](#patchguistatus-high-level-gui-status)
    - [UpdateGuiStatus](#updateguistatus-high-level-gui-status)
  - [Include](#high-level-include)
    - [CreateInclude](#createinclude-high-level-include)
    - [DeleteInclude](#deleteinclude-high-level-include)
    - [UpdateInclude](#updateinclude-high-level-include)
  - [Interface](#high-level-interface)
    - [CreateInterface](#createinterface-high-level-interface)
    - [DeleteInterface](#deleteinterface-high-level-interface)
    - [GetInterface](#getinterface-high-level-interface)
    - [UpdateInterface](#updateinterface-high-level-interface)
  - [Package](#high-level-package)
    - [GetPackage](#getpackage-high-level-package)
  - [Program](#high-level-program)
    - [CreateProgram](#createprogram-high-level-program)
    - [DeleteProgram](#deleteprogram-high-level-program)
    - [GetProgram](#getprogram-high-level-program)
    - [UpdateProgram](#updateprogram-high-level-program)
  - [Screen](#high-level-screen)
    - [CreateScreen](#createscreen-high-level-screen)
    - [DeleteScreen](#deletescreen-high-level-screen)
    - [GetScreen](#getscreen-high-level-screen)
    - [UpdateScreen](#updatescreen-high-level-screen)
  - [Text Element](#high-level-text-element)
    - [CreateTextElement](#createtextelement-high-level-text-element)
    - [DeleteTextElement](#deletetextelement-high-level-text-element)
    - [GetTextElement](#gettextelement-high-level-text-element)
    - [ReadTextElementsBulk](#readtextelementsbulk-high-level-text-element)
    - [UpdateTextElement](#updatetextelement-high-level-text-element)
    - [WriteTextElementsBulk](#writetextelementsbulk-high-level-text-element)
  - [Unit Test](#high-level-unit-test)
    - [CreateCdsUnitTest](#createcdsunittest-high-level-unit-test)
    - [CreateUnitTest](#createunittest-high-level-unit-test)
    - [DeleteCdsUnitTest](#deletecdsunittest-high-level-unit-test)
    - [DeleteUnitTest](#deleteunittest-high-level-unit-test)
    - [GetCdsUnitTest](#getcdsunittest-high-level-unit-test)
    - [GetCdsUnitTestResult](#getcdsunittestresult-high-level-unit-test)
    - [GetCdsUnitTestStatus](#getcdsunitteststatus-high-level-unit-test)
    - [GetUnitTest](#getunittest-high-level-unit-test)
    - [GetUnitTestResult](#getunittestresult-high-level-unit-test)
    - [GetUnitTestStatus](#getunitteststatus-high-level-unit-test)
    - [RunUnitTest](#rununittest-high-level-unit-test)
    - [UpdateCdsUnitTest](#updatecdsunittest-high-level-unit-test)
    - [UpdateUnitTest](#updateunittest-high-level-unit-test)
  - [View](#high-level-view)
    - [CreateView](#createview-high-level-view)
    - [DeleteView](#deleteview-high-level-view)
    - [GetView](#getview-high-level-view)
    - [UpdateView](#updateview-high-level-view)
- [Low-Level Group](#low-level-group)
  - [Class](#low-level-class)
    - [ActivateClassLow](#activateclasslow-low-level-class)
    - [ActivateClassTestClassesLow](#activateclasstestclasseslow-low-level-class)
    - [CheckClassLow](#checkclasslow-low-level-class)
    - [CreateClassLow](#createclasslow-low-level-class)
    - [DeleteClassLow](#deleteclasslow-low-level-class)
    - [GetClassUnitTestResultLow](#getclassunittestresultlow-low-level-class)
    - [GetClassUnitTestStatusLow](#getclassunitteststatuslow-low-level-class)
    - [LockClassLow](#lockclasslow-low-level-class)
    - [LockClassTestClassesLow](#lockclasstestclasseslow-low-level-class)
    - [RunClassUnitTestsLow](#runclassunittestslow-low-level-class)
    - [UnlockClassLow](#unlockclasslow-low-level-class)
    - [UnlockClassTestClassesLow](#unlockclasstestclasseslow-low-level-class)
    - [UpdateClassLow](#updateclasslow-low-level-class)
    - [UpdateClassTestClassesLow](#updateclasstestclasseslow-low-level-class)
    - [ValidateClassLow](#validateclasslow-low-level-class)
  - [Common](#low-level-common)
    - [ActivateObjectLow](#activateobjectlow-low-level-common)
  - [Function](#low-level-function)
    - [ActivateFunctionGroupLow](#activatefunctiongrouplow-low-level-function)
    - [ActivateFunctionModuleLow](#activatefunctionmodulelow-low-level-function)
    - [CheckFunctionGroupLow](#checkfunctiongrouplow-low-level-function)
    - [CheckFunctionModuleLow](#checkfunctionmodulelow-low-level-function)
    - [CreateFunctionGroupLow](#createfunctiongrouplow-low-level-function)
    - [CreateFunctionModuleLow](#createfunctionmodulelow-low-level-function)
    - [DeleteFunctionGroupLow](#deletefunctiongrouplow-low-level-function)
    - [DeleteFunctionModuleLow](#deletefunctionmodulelow-low-level-function)
    - [LockFunctionGroupLow](#lockfunctiongrouplow-low-level-function)
    - [LockFunctionModuleLow](#lockfunctionmodulelow-low-level-function)
    - [UnlockFunctionGroupLow](#unlockfunctiongrouplow-low-level-function)
    - [UnlockFunctionModuleLow](#unlockfunctionmodulelow-low-level-function)
    - [UpdateFunctionModuleLow](#updatefunctionmodulelow-low-level-function)
    - [ValidateFunctionGroupLow](#validatefunctiongrouplow-low-level-function)
    - [ValidateFunctionModuleLow](#validatefunctionmodulelow-low-level-function)
  - [Gui Status](#low-level-gui-status)
    - [ActivateGuiStatusLow](#activateguistatuslow-low-level-gui-status)
    - [CreateGuiStatusLow](#createguistatuslow-low-level-gui-status)
    - [DeleteGuiStatusLow](#deleteguistatuslow-low-level-gui-status)
    - [LockGuiStatusLow](#lockguistatuslow-low-level-gui-status)
    - [UnlockGuiStatusLow](#unlockguistatuslow-low-level-gui-status)
    - [UpdateGuiStatusLow](#updateguistatuslow-low-level-gui-status)
  - [Interface](#low-level-interface)
    - [ActivateInterfaceLow](#activateinterfacelow-low-level-interface)
    - [CheckInterfaceLow](#checkinterfacelow-low-level-interface)
    - [CreateInterfaceLow](#createinterfacelow-low-level-interface)
    - [DeleteInterfaceLow](#deleteinterfacelow-low-level-interface)
    - [LockInterfaceLow](#lockinterfacelow-low-level-interface)
    - [UnlockInterfaceLow](#unlockinterfacelow-low-level-interface)
    - [UpdateInterfaceLow](#updateinterfacelow-low-level-interface)
    - [ValidateInterfaceLow](#validateinterfacelow-low-level-interface)
  - [Package](#low-level-package)
    - [CheckPackageLow](#checkpackagelow-low-level-package)
    - [DeletePackageLow](#deletepackagelow-low-level-package)
    - [LockPackageLow](#lockpackagelow-low-level-package)
    - [UnlockPackageLow](#unlockpackagelow-low-level-package)
    - [UpdatePackageLow](#updatepackagelow-low-level-package)
  - [Program](#low-level-program)
    - [ActivateProgramLow](#activateprogramlow-low-level-program)
    - [CheckProgramLow](#checkprogramlow-low-level-program)
    - [CreateProgramLow](#createprogramlow-low-level-program)
    - [DeleteProgramLow](#deleteprogramlow-low-level-program)
    - [LockProgramLow](#lockprogramlow-low-level-program)
    - [UnlockProgramLow](#unlockprogramlow-low-level-program)
    - [UpdateProgramLow](#updateprogramlow-low-level-program)
    - [ValidateProgramLow](#validateprogramlow-low-level-program)
  - [Screen](#low-level-screen)
    - [ActivateScreenLow](#activatescreenlow-low-level-screen)
    - [CreateScreenLow](#createscreenlow-low-level-screen)
    - [DeleteScreenLow](#deletescreenlow-low-level-screen)
    - [LockScreenLow](#lockscreenlow-low-level-screen)
    - [UnlockScreenLow](#unlockscreenlow-low-level-screen)
    - [UpdateScreenLow](#updatescreenlow-low-level-screen)
  - [View](#low-level-view)
    - [ActivateViewLow](#activateviewlow-low-level-view)
    - [CheckViewLow](#checkviewlow-low-level-view)
    - [CreateViewLow](#createviewlow-low-level-view)
    - [DeleteViewLow](#deleteviewlow-low-level-view)
    - [LockViewLow](#lockviewlow-low-level-view)
    - [UnlockViewLow](#unlockviewlow-low-level-view)
    - [UpdateViewLow](#updateviewlow-low-level-view)
    - [ValidateViewLow](#validateviewlow-low-level-view)

---

<a id="read-only-group"></a>
## Read-Only Group

<a id="read-only-class"></a>
### Read-Only / Class

<a id="readclass-read-only-class"></a>
#### ReadClass (Read-Only / Class)
**Description:** [read-only] Read ABAP class source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/class/readonly/handleReadClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-enhancement"></a>
### Read-Only / Enhancement

<a id="getbadiimplementations-read-only-enhancement"></a>
#### GetBadiImplementations (Read-Only / Enhancement)
**Description:** [read-only] Find implementations of a (classic) BAdI definition. Use during symptom analysis when a standard SAP BAdI is implicated — answers 

**Source:** `src/handlers/enhancement/readonly/handleGetBadiImplementations.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `active_only` (boolean, optional (default: true)) - Restrict to active implementations only. Default: true.
- `badi_definition` (string, required) - BAdI definition name (e.g., ME_PROCESS_PO_CUST). Will be uppercased.
- `customer_only` (boolean, optional (default: true)) - Restrict to Z*/Y* implementations. Default: true. Set false to include SAP-shipped implementations.
- `include_methods` (boolean, optional (default: true)) - Include the list of redefined method names per implementation (from SXC_EXIT). Default: true.

---

<a id="read-only-function-group"></a>
### Read-Only / Function Group

<a id="readfunctiongroup-read-only-function-group"></a>
#### ReadFunctionGroup (Read-Only / Function Group)
**Description:** [read-only] Read ABAP function group source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/function_group/readonly/handleReadFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., Z_MY_FG).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-function-module"></a>
### Read-Only / Function Module

<a id="readfunctionmodule-read-only-function-module"></a>
#### ReadFunctionModule (Read-Only / Function Module)
**Description:** [read-only] Read ABAP function module source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/function_module/readonly/handleReadFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name containing the function module (e.g., Z_MY_FG).
- `function_module_name` (string, required) - Function module name (e.g., Z_MY_FM).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-gui-status"></a>
### Read-Only / Gui Status

<a id="getguistatuslist-read-only-gui-status"></a>
#### GetGuiStatusList (Read-Only / Gui Status)
**Description:** [read-only] List all GUI statuses belonging to an ABAP program.

**Source:** `src/handlers/gui_status/readonly/handleGetGuiStatusList.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., SAPMV45A).

---

<a id="readguistatus-read-only-gui-status"></a>
#### ReadGuiStatus (Read-Only / Gui Status)
**Description:** [read-only] Read ABAP GUI Status definition (statuses, function codes, menus, toolbars, titles) for a program.

**Source:** `src/handlers/gui_status/readonly/handleReadGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name (e.g., SAPMV45A).

---

<a id="read-only-include"></a>
### Read-Only / Include

<a id="getinclude-read-only-include"></a>
#### GetInclude (Read-Only / Include)
**Description:** [read-only] Retrieve source code of a specific ABAP include file.

**Source:** `src/handlers/include/readonly/handleGetInclude.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- None

---

<a id="getincludeslist-read-only-include"></a>
#### GetIncludesList (Read-Only / Include)
**Description:** [read-only] Recursively discover and list ALL include files within an ABAP program or include.

**Source:** `src/handlers/include/readonly/handleGetIncludesList.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `detailed` (boolean, optional (default: false)) - If true, returns structured JSON with metadata and raw XML.
- `object_name` (string, required) - Name of the ABAP program or include
- `object_type` (string, required) - ADT object type (e.g. PROG/P, PROG/I, FUGR, CLAS/OC)
- `timeout` (number, optional) - Timeout in ms for each ADT request.

---

<a id="read-only-interface"></a>
### Read-Only / Interface

<a id="readinterface-read-only-interface"></a>
#### ReadInterface (Read-Only / Interface)
**Description:** [read-only] Read ABAP interface source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/interface/readonly/handleReadInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., ZIF_MY_INTERFACE).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-package"></a>
### Read-Only / Package

<a id="getpackagecontents-read-only-package"></a>
#### GetPackageContents (Read-Only / Package)
**Description:** [read-only] Retrieve objects inside an ABAP package as a flat list. Supports recursive traversal of subpackages.

**Source:** `src/handlers/package/readonly/handleGetPackageContents.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- None

---

<a id="readpackage-read-only-package"></a>
#### ReadPackage (Read-Only / Package)
**Description:** [read-only] Read ABAP package definition and metadata (super-package, responsible, description, etc.).

**Source:** `src/handlers/package/readonly/handleReadPackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `package_name` (string, required) - Package name (e.g., Z_MY_PACKAGE).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-program"></a>
### Read-Only / Program

<a id="getprogfullcode-read-only-program"></a>
#### GetProgFullCode (Read-Only / Program)
**Description:** [read-only] Returns the full code for a program or function group, including all includes, in tree traversal order. Use output=

**Source:** `src/handlers/program/readonly/handleGetProgFullCode.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `name` (string, required) - Technical name of the program or function group (e.g., 
- `output` (string, optional (default: inline)) - 
- `type` (string, required) - 

---

<a id="readprogram-read-only-program"></a>
#### ReadProgram (Read-Only / Program)
**Description:** [read-only] Read ABAP program source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/program/readonly/handleReadProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `version` (string, optional (default: active)) - Version to read: 

---

<a id="read-only-screen"></a>
### Read-Only / Screen

<a id="getscreenslist-read-only-screen"></a>
#### GetScreensList (Read-Only / Screen)
**Description:** [read-only] List all screens (dynpros) belonging to an ABAP program.

**Source:** `src/handlers/screen/readonly/handleGetScreensList.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., SAPMV45A).

---

<a id="readscreen-read-only-screen"></a>
#### ReadScreen (Read-Only / Screen)
**Description:** [read-only] Read ABAP Screen (Dynpro) flow logic source code, fields, and metadata.

**Source:** `src/handlers/screen/readonly/handleReadScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name (e.g., SAPMV45A).
- `screen_number` (string, required) - Screen number (e.g., 0100).

---

<a id="read-only-system"></a>
### Read-Only / System

<a id="getinactiveobjects-read-only-system"></a>
#### GetInactiveObjects (Read-Only / System)
**Description:** [read-only] Get a list of inactive ABAP objects — modified but not yet activated, pending activation. Shows classes, tables, CDS views, and other objects awaiting activation.

**Source:** `src/handlers/system/readonly/handleGetInactiveObjects.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- None

---

<a id="getjobusage-read-only-system"></a>
#### GetJobUsage (Read-Only / System)
**Description:** [read-only] Check whether programs are used as background job steps (SM37 jobs, TBTCO/TBTCP): true when the program is a step of a job that is scheduled now (released/ready/active, incl. periodic) or that finished/was cancelled in the last N months. SE38/SA38 dialog runs do not count. `oldest` = start date of the oldest finished job still kept; job reorganization deletes older ones, so when `complete` is false a false means 

**Source:** `src/handlers/system/readonly/handleGetJobUsage.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `months` (number, optional (default: 12)) - Months back including the current one (1-36). Default: 12.
- `programs` (array, required) - ABAP program names to check (e.g. [

---

<a id="getsmartformlayout-read-only-system"></a>
#### GetSmartFormLayout (Read-Only / System)
**Description:** [read-only] Read the page and window layout of a SmartForm: per page the format, orientation, next page, CPI / LPI and style, and per window its type (MAIN / SECONDARY / ...), position and size as stored (value + unit) and converted to millimetres. Layout only: no texts, code or form interface. Needs the ZMCP_SSF_LAYOUT FM and the SSF_LAYOUT dispatcher action.

**Source:** `src/handlers/system/readonly/handleGetSmartFormLayout.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `form_name` (string, required) - SmartForm name (e.g. 
- `language` (string, optional) - Form language (1-char SAP key, e.g. 

---

<a id="gettcodeusage-read-only-system"></a>
#### GetTcodeUsage (Read-Only / System)
**Description:** [read-only] Check whether transactions were used in the last N months, from the ST03N workload monthly aggregates. Returns one boolean per transaction plus `coverage` = months that actually hold workload data; when coverage < months, false means 

**Source:** `src/handlers/system/readonly/handleGetTcodeUsage.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `destination` (string, optional) - SM59 RFC destination (on the connected system) of the system to measure, e.g. the QA or PRD system. Omitted → SAP_USAGE_RFCDEST from the profile sap.env, else the connected system. 
- `months` (number, optional (default: 12)) - Months back including the current one (1-36). Default: 12.
- `tcodes` (array, required) - Transaction codes to check (e.g. [

---

<a id="getusagesnippets-read-only-system"></a>
#### GetUsageSnippets (Read-Only / System)
**Description:** [read-only] Line-level where-used hits: for each referencing object, the source lines that use the searched object, with uri 

**Source:** `src/handlers/system/readonly/handleGetUsageSnippets.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `customer_only` (boolean, optional (default: false)) - With object_name: only customer referencing objects (Z / Y name, or package Z* / Y* / $*). Default: false.
- `include_context` (boolean, optional (default: false)) - Include the multi-line context SAP returns per hit (description). Default: false.
- `max_objects` (number, optional) - 
- `object_identifiers` (array, optional) - object_identifier values from GetWhereUsed references[]. Takes precedence over object_name / object_type.
- `object_name` (string, optional) - Object to search (used when object_identifiers is not given).
- `object_type` (string, optional) - 
- `package` (string, optional) - With object_name: package filter on the referencing objects (exact, or prefix with trailing *).
- `timeout_ms` (number, optional) - Optional request timeout in ms per SAP request (the where-used search and each snippet batch).

---

<a id="getwhereused-read-only-system"></a>
#### GetWhereUsed (Read-Only / System)
**Description:** [read-only] Find where-used references (cross-references, usages, dependencies) for ABAP objects — classes, interfaces, tables, data elements, programs, function modules, etc. Returns list of all referencing objects with their types and packages. On ECC a function module may be given by plain name (no GROUP|FM needed). Widely used SAP standard tables (e.g. VBAK) can take about 60 s and return thousands of references — use customer_only / package / max_results to shrink the answer (filtering happens after the SAP search, so it does not shorten the search time). Pass references[].object_identifier to GetUsageSnippets for line-level hits.

**Source:** `src/handlers/system/readonly/handleGetWhereUsed.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `customer_only` (boolean, optional (default: false)) - Optional. Keep only customer objects: name starting with Z / Y, or package Z* / Y* / $*. Objects in /namespace/ (SAP industry solutions, partners, generated /1.../) are dropped; for a registered customer namespace use package: 
- `enable_all_types` (boolean, optional (default: false)) - If true, searches in all available object types (Eclipse 
- `max_results` (number, optional) - Optional cap on references[] after filtering. Omit or 0 = no cap. truncated=true when more were found.
- `object_name` (string, required) - Name of the ABAP object
- `object_type` (string, required) - 
- `package` (string, optional) - Optional package filter on references[].package_name: exact name, or prefix with a trailing * (e.g. ZSD*).
- `timeout_ms` (number, optional) - Optional request timeout in ms for the SAP search. Default: SAP_TIMEOUT_LONG (120 s) on ECC, SAP_TIMEOUT_DEFAULT (45 s) otherwise.

---

<a id="reloadprofile-read-only-system"></a>
#### ReloadProfile (Read-Only / System)
**Description:** [system] Reload the active SAP profile from .sc4sap/active-profile.txt and reset the cached connection. Called by the sc4sap plugin after switching profiles. Returns the newly active alias, host, tier, and readonly status.

**Source:** `src/handlers/system/readonly/handleReloadProfile.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- None

---

<a id="read-only-view"></a>
### Read-Only / View

<a id="readview-read-only-view"></a>
#### ReadView (Read-Only / View)
**Description:** [read-only] Read ABAP view (CDS view) source code and metadata (package, responsible, description, etc.).

**Source:** `src/handlers/view/readonly/handleReadView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `version` (string, optional (default: active)) - Version to read: 
- `view_name` (string, required) - View name (e.g., Z_MY_VIEW).

---

<a id="high-level-group"></a>
## High-Level Group

<a id="high-level-class"></a>
### High-Level / Class

<a id="createclass-high-level-class"></a>
#### CreateClass (High-Level / Class)
**Description:** Create a new ABAP class in SAP system. Creates the class object in initial state. Use UpdateClass to set source code afterwards.

**Source:** `src/handlers/class/high/handleCreateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `abstract` (boolean, optional) - Mark class as abstract. Default: false
- `class_name` (string, required) - Class name (e.g., ZCL_TEST_CLASS_001).
- `create_protected` (boolean, optional) - Protected constructor. Default: false
- `description` (string, optional) - Class description (defaults to class_name).
- `final` (boolean, optional) - Mark class as final. Default: false
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP).
- `superclass` (string, optional) - Optional superclass name.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteclass-high-level-class"></a>
#### DeleteClass (High-Level / Class)
**Description:** Delete an ABAP class from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/class/high/handleDeleteClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="deletelocaldefinitions-high-level-class"></a>
#### DeleteLocalDefinitions (High-Level / Class)
**Description:** Delete local definitions from an ABAP class by clearing the definitions include. Manages lock, update, unlock, and optional activation.

**Source:** `src/handlers/class/high/handleDeleteLocalDefinitions.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_delete` (boolean, optional (default: false)) - Activate parent class after deleting. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request number.

---

<a id="deletelocalmacros-high-level-class"></a>
#### DeleteLocalMacros (High-Level / Class)
**Description:** Delete local macros from an ABAP class by clearing the macros include. Manages lock, update, unlock, and optional activation. Note: Macros are supported in older ABAP versions but not in newer ones.

**Source:** `src/handlers/class/high/handleDeleteLocalMacros.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_delete` (boolean, optional (default: false)) - Activate parent class after deleting. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request number.

---

<a id="deletelocaltestclass-high-level-class"></a>
#### DeleteLocalTestClass (High-Level / Class)
**Description:** Delete a local test class from an ABAP class by clearing the testclasses include. Manages lock, update, unlock, and optional activation of parent class.

**Source:** `src/handlers/class/high/handleDeleteLocalTestClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_delete` (boolean, optional (default: false)) - Activate parent class after deleting test class. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request number (required for transportable objects).

---

<a id="deletelocaltypes-high-level-class"></a>
#### DeleteLocalTypes (High-Level / Class)
**Description:** Delete local types from an ABAP class by clearing the implementations include. Manages lock, update, unlock, and optional activation.

**Source:** `src/handlers/class/high/handleDeleteLocalTypes.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_delete` (boolean, optional (default: false)) - Activate parent class after deleting. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request number.

---

<a id="getclass-high-level-class"></a>
#### GetClass (High-Level / Class)
**Description:** Retrieve ABAP class source code. Supports reading active or inactive version.

**Source:** `src/handlers/class/high/handleGetClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `output` (string, optional (default: inline)) - 
- `version` (string, optional (default: active)) - 

---

<a id="getlocaldefinitions-high-level-class"></a>
#### GetLocalDefinitions (High-Level / Class)
**Description:** Retrieve local definitions source code from a class (definitions include). Supports reading active or inactive version.

**Source:** `src/handlers/class/high/handleGetLocalDefinitions.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `version` (string, optional (default: active)) - 

---

<a id="getlocalmacros-high-level-class"></a>
#### GetLocalMacros (High-Level / Class)
**Description:** Retrieve local macros source code from a class (macros include). Supports reading active or inactive version. Note: Macros are supported in older ABAP versions but not in newer ones.

**Source:** `src/handlers/class/high/handleGetLocalMacros.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `version` (string, optional (default: active)) - 

---

<a id="getlocaltestclass-high-level-class"></a>
#### GetLocalTestClass (High-Level / Class)
**Description:** Retrieve local test class source code from a class. Supports reading active or inactive version.

**Source:** `src/handlers/class/high/handleGetLocalTestClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `version` (string, optional (default: active)) - 

---

<a id="getlocaltypes-high-level-class"></a>
#### GetLocalTypes (High-Level / Class)
**Description:** Retrieve local types source code from a class (implementations include). Supports reading active or inactive version.

**Source:** `src/handlers/class/high/handleGetLocalTypes.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `version` (string, optional (default: active)) - 

---

<a id="updateclass-high-level-class"></a>
#### UpdateClass (High-Level / Class)
**Description:** Update source code of an existing ABAP class. Locks, checks, updates, unlocks, and optionally activates.

**Source:** `src/handlers/class/high/handleUpdateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after update. Default: false.
- `class_name` (string, required) - Class name (e.g., ZCL_TEST_CLASS_001).
- `source_code` (string, required) - Complete ABAP class source code.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="updatelocaldefinitions-high-level-class"></a>
#### UpdateLocalDefinitions (High-Level / Class)
**Description:** Update local definitions in an ABAP class (definitions include). Manages lock, check, update, unlock, and optional activation.

**Source:** `src/handlers/class/high/handleUpdateLocalDefinitions.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_update` (boolean, optional (default: false)) - Activate parent class after updating. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `definitions_code` (string, required) - Updated source code for local definitions.
- `transport_request` (string, optional) - Transport request number.

---

<a id="updatelocalmacros-high-level-class"></a>
#### UpdateLocalMacros (High-Level / Class)
**Description:** Update local macros in an ABAP class (macros include). Manages lock, check, update, unlock, and optional activation. Note: Macros are supported in older ABAP versions but not in newer ones.

**Source:** `src/handlers/class/high/handleUpdateLocalMacros.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_update` (boolean, optional (default: false)) - Activate parent class after updating. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `macros_code` (string, required) - Updated source code for local macros.
- `transport_request` (string, optional) - Transport request number.

---

<a id="updatelocaltestclass-high-level-class"></a>
#### UpdateLocalTestClass (High-Level / Class)
**Description:** Update a local test class in an ABAP class. Manages lock, check, update, unlock, and optional activation of parent class.

**Source:** `src/handlers/class/high/handleUpdateLocalTestClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_update` (boolean, optional (default: false)) - Activate parent class after updating test class. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `test_class_code` (string, required) - Updated source code for the local test class.
- `transport_request` (string, optional) - Transport request number (required for transportable objects).

---

<a id="updatelocaltypes-high-level-class"></a>
#### UpdateLocalTypes (High-Level / Class)
**Description:** Update local types in an ABAP class (implementations include). Manages lock, check, update, unlock, and optional activation.

**Source:** `src/handlers/class/high/handleUpdateLocalTypes.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate_on_update` (boolean, optional (default: false)) - Activate parent class after updating. Default: false
- `class_name` (string, required) - Parent class name (e.g., ZCL_MY_CLASS).
- `local_types_code` (string, required) - Updated source code for local types.
- `transport_request` (string, optional) - Transport request number.

---

<a id="high-level-common"></a>
### High-Level / Common

<a id="activateobjects-high-level-common"></a>
#### ActivateObjects (High-Level / Common)
**Description:** [high-level] Activate a set of ABAP objects in a single call. Uses the ADT mass-activation endpoint (/sap/bc/adt/activation/runs) so cyclic references between siblings (e.g. main program + multiple cross-referencing includes) resolve in one compilation scope. Returns per-object status, errors, warnings. Falls back to /sap/bc/adt/activation on legacy systems.

**Source:** `src/handlers/common/high/handleActivateObjects.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `objects` (array, required) - Objects to activate in one batch. Supply either explicit uri, or name+type (and parent_name for FUGR/FF, FUGR/I).
- `preaudit` (boolean, optional) - Request pre-audit before activation. Default true.
- `run_timeout_ms` (number, optional) - Max time to wait for the activation run to finish (runs endpoint only). Default 120000.

---

<a id="high-level-function"></a>
### High-Level / Function

<a id="createfunctiongroup-high-level-function"></a>
#### CreateFunctionGroup (High-Level / Function)
**Description:** Create a new ABAP function group in SAP system. Function groups serve as containers for function modules. Uses stateful session for proper lock management.

**Source:** `src/handlers/function/high/handleCreateFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate function group after creation. Default: true. Set to false for batch operations.
- `description` (string, optional) - Function group description. If not provided, function_group_name will be used.
- `function_group_name` (string, required) - Function group name (e.g., ZTEST_FG_001). Must follow SAP naming conventions (start with Z or Y, max 26 chars).
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP for local objects)
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="createfunctionmodule-high-level-function"></a>
#### CreateFunctionModule (High-Level / Function)
**Description:** Create a new ABAP function module within an existing function group. Creates the function module in initial state. Use UpdateFunctionModule to set source code afterwards.

**Source:** `src/handlers/function/high/handleCreateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, optional) - Optional description for the function module
- `function_group_name` (string, required) - Parent function group name (e.g., ZTEST_FG_001)
- `function_module_name` (string, required) - Function module name (e.g., Z_TEST_FUNCTION_001). Must follow SAP naming conventions (start with Z or Y, max 30 chars).
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="updatefunctiongroup-high-level-function"></a>
#### UpdateFunctionGroup (High-Level / Function)
**Description:** Update metadata (description) of an existing ABAP function group. Function groups are containers for function modules and don

**Source:** `src/handlers/function/high/handleUpdateFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - New description for the function group.
- `function_group_name` (string, required) - Function group name (e.g., ZTEST_FG_001). Must exist in the system.
- `transport_request` (string, optional) - Transport request. Optional if the object is local or already in one.

---

<a id="updatefunctionmodule-high-level-function"></a>
#### UpdateFunctionModule (High-Level / Function)
**Description:** Update source code of an existing ABAP function module. Locks the function module, uploads new source code, and unlocks. Optionally activates after update. Use this to modify existing function modules without re-creating metadata.

**Source:** `src/handlers/function/high/handleUpdateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate function module after source update. Default: false. Set to true to activate immediately.
- `function_group_name` (string, required) - Function group name containing the function module (e.g., ZOK_FG_MCP01).
- `function_module_name` (string, required) - Function module name (e.g., Z_TEST_FM_MCP01). Function module must already exist.
- `source_code` (string, required) - Complete ABAP function module source code. Must include FUNCTION statement with parameters and ENDFUNCTION. Example:\n\nFUNCTION Z_TEST_FM\n  IMPORTING\n    VALUE(iv_input) TYPE string\n  EXPORTING\n    VALUE(ev_output) TYPE string.\n  \n  ev_output = iv_input.\nENDFUNCTION.
- `transport_request` (string, optional) - Transport request number (e.g., E19K905635). Required for transportable function modules. For local objects ($TMP package) this can be omitted — the handler defaults to 

---

<a id="high-level-function-group"></a>
### High-Level / Function Group

<a id="deletefunctiongroup-high-level-function-group"></a>
#### DeleteFunctionGroup (High-Level / Function Group)
**Description:** Delete an ABAP function group from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/function_group/high/handleDeleteFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_FUNCTIONGROUP).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="getfunctiongroup-high-level-function-group"></a>
#### GetFunctionGroup (High-Level / Function Group)
**Description:** Retrieve ABAP function group definition. Supports reading active or inactive version.

**Source:** `src/handlers/function_group/high/handleGetFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_FUNCTIONGROUP).
- `version` (string, optional (default: active)) - 

---

<a id="high-level-function-module"></a>
### High-Level / Function Module

<a id="deletefunctionmodule-high-level-function-module"></a>
#### DeleteFunctionModule (High-Level / Function Module)
**Description:** Delete an ABAP function module from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/function_module/high/handleDeleteFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name containing the function module (e.g., Z_MY_FUNCTIONGROUP).
- `function_module_name` (string, required) - FunctionModule name (e.g., Z_MY_FUNCTIONMODULE).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="getfunctionmodule-high-level-function-module"></a>
#### GetFunctionModule (High-Level / Function Module)
**Description:** Retrieve ABAP function module definition. Supports reading active or inactive version.

**Source:** `src/handlers/function_module/high/handleGetFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name containing the function module (e.g., Z_MY_FUNCTIONGROUP).
- `function_module_name` (string, required) - FunctionModule name (e.g., Z_MY_FUNCTIONMODULE).
- `output` (string, optional (default: inline)) - 
- `version` (string, optional (default: active)) - 

---

<a id="high-level-gui-status"></a>
### High-Level / Gui Status

<a id="createguistatus-high-level-gui-status"></a>
#### CreateGuiStatus (High-Level / Gui Status)
**Description:** Create a new ABAP GUI Status on an existing program. Optionally activates after creation.

**Source:** `src/handlers/gui_status/high/handleCreateGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after creation. Default: false.
- `description` (string, optional) - GUI Status description.
- `program_name` (string, required) - Parent program name (e.g., Z_MY_PROGRAM).
- `status_name` (string, required) - GUI Status name to create (e.g., MAIN_STATUS).
- `status_type` (string, optional) - Status type: 
- `transport_request` (string, optional) - Transport request number.

---

<a id="deleteguistatus-high-level-gui-status"></a>
#### DeleteGuiStatus (High-Level / Gui Status)
**Description:** Delete an ABAP GUI Status from a program. Handles lock/unlock automatically.

**Source:** `src/handlers/gui_status/high/handleDeleteGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name.
- `status_name` (string, required) - GUI Status name to delete.
- `transport_request` (string, optional) - Transport request number.

---

<a id="getguistatus-high-level-gui-status"></a>
#### GetGuiStatus (High-Level / Gui Status)
**Description:** Get ABAP GUI Status definition including statuses, function codes, menus, toolbars, and titles.

**Source:** `src/handlers/gui_status/high/handleGetGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name (e.g., SAPMV45A).
- `status_name` (string, optional) - Optional: filter to a specific GUI Status name. If omitted, returns all statuses.

---

<a id="patchguistatus-high-level-gui-status"></a>
#### PatchGuiStatus (High-Level / Gui Status)
**Description:** Row-level merge into an existing ABAP GUI Status definition. Fetches current CUA → merges the caller-supplied changes (by natural key) → writes merged result back. Rows / fields you omit are preserved. Safer default for targeted edits; use UpdateGuiStatus only when you truly want to replace the whole CUA.\n\nMerge keys per table:\n  STA=CODE, FUN=CODE, PFK=CODE+PFNO, BUT=PFK_CODE+CODE+NO, TIT=CODE,\n  MEN=CODE+NO, MTX=CODE, ACT=CODE+NO, SET=STATUS+FUNCTION,\n  DOC=OBJ_TYPE+OBJ_CODE, BIV=CODE+POS.

**Source:** `src/handlers/gui_status/high/handlePatchGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after patch. Default: false.
- `changes` (string, required) - Partial CUA data to merge into the current definition. Same shape as cua_data (ADM / STA / FUN / MEN / MTX / ACT / BUT / PFK / SET / DOC / TIT / BIV). Accepts JSON string or object. Rows matched by natural key are field-merged (changes win). New rows are appended. Omitted tables are left untouched.
- `program_name` (string, required) - Parent program name.
- `skip_validation` (boolean, optional) - Skip client-side validation of the merged result. Default: false.
- `transport_request` (string, optional) - Transport request number.

---

<a id="updateguistatus-high-level-gui-status"></a>
#### UpdateGuiStatus (High-Level / Gui Status)
**Description:** ⚠️ FULL REPLACE — overwrites the entire GUI Status definition (all 12 CUA tables) for the program. Any row or field you omit is DROPPED. Always Read (ReadGuiStatus) → modify → Update, or use PatchGuiStatus for row-level merges. cua_data must include complete STA / FUN / PFK / BUT / TIT rows with all required fields (CODE, PFNO, FUNCODE, ...). Handles lock/unlock automatically.

**Source:** `src/handlers/gui_status/high/handleUpdateGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after update. Default: false.
- `cua_data` (string, required) - Complete CUA data — accepts either a JSON string or a structured object with ADM / STA / FUN / MEN / MTX / ACT / BUT / PFK / SET / DOC / TIT / BIV. Required row fields: STA.CODE, FUN.CODE, PFK.{CODE,PFNO,FUNCODE}, BUT.{PFK_CODE,CODE,NO,PFNO}, TIT.CODE. Missing rows are dropped — this is full-replace semantics.
- `program_name` (string, required) - Parent program name.
- `skip_validation` (boolean, optional) - Skip client-side schema validation. Default: false. Only set true if you know the CUA payload is intentionally partial and SAP will accept it.
- `transport_request` (string, optional) - Transport request number.

---

<a id="high-level-include"></a>
### High-Level / Include

<a id="createinclude-high-level-include"></a>
#### CreateInclude (High-Level / Include)
**Description:** Create a new ABAP Include program (Type I, PROG/I) in SAP system. Creates the include object and registers it under the main program in D010INC. By default also auto-inserts an `INCLUDE <name>.` statement into the main program source so the include is actually used. Use UpdateInclude to set source code afterwards. Unlike CreateProgram with program_type=include (which creates PROG/P), this creates a proper PROG/I include. For mass-activation scenarios (many cross-referencing includes) pass source_code inline, set activate_main_program=false and skip_program_tree_check=true, then call ActivateObjects once with the full set.

**Source:** `src/handlers/include/high/handleCreateInclude.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate_main_program` (boolean, optional) - When inserting INCLUDE statement into the main program, also activate the main program afterwards. Default: true (existing behavior). Set false when batching many includes so that activation is deferred to a single ActivateObjects call.
- `description` (string, optional) - Include description (max 60 chars). If not provided, include_name will be used.
- `include_name` (string, required) - Include program name (e.g., ZPAEK_TEST_INC01). Must follow SAP naming conventions (start with Z or Y).
- `insert_into_main` (boolean, optional) - Auto-insert `INCLUDE <name>.` statement into the main program source. Default: true. Set false to skip main-program modification.
- `main_program` (string, required) - Name of the main/master program that will contain this include (e.g., ZPAEK_TEST003). Required for proper include registration and activation.
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP for local objects).
- `skip_program_tree_check` (boolean, optional) - Skip the post-create program-tree syntax check. Default: false (existing behavior). Set true when batching many cross-referencing includes — an intermediate include in a cycle will necessarily fail the tree check while its siblings are still missing.
- `source_code` (string, optional) - Optional include body. When provided, the handler also locks, writes the source, and unlocks the new include in a single call. Never activates — caller must run a separate activation (ActivateObjects for batch scenarios).
- `transport_request` (string, optional) - Transport request number (e.g., S4HK904224). Required for transportable packages. Optional for local ($TMP) objects.

---

<a id="deleteinclude-high-level-include"></a>
#### DeleteInclude (High-Level / Include)
**Description:** Delete an existing ABAP Include program (Type I) from the SAP system via ADT API. If the include is referenced by a main program, provide main_program so the handler can first remove the `INCLUDE <name>.` line from the main program source before deleting.

**Source:** `src/handlers/include/high/handleDeleteInclude.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `include_name` (string, required) - Include program name to delete.
- `main_program` (string, optional) - Optional. Name of the main program referencing this include. If provided, the `INCLUDE <name>.` line is removed from the main program source first (so the include is no longer referenced and delete succeeds).
- `remove_from_main` (boolean, optional) - Auto-remove `INCLUDE <name>.` line from main program source. Default: true when main_program is provided. Set false to skip the main-program modification.
- `transport_request` (string, optional) - Transport request number. Required for transportable packages. Optional for local ($TMP) objects. Also used for updating the main program if main_program is provided.

---

<a id="updateinclude-high-level-include"></a>
#### UpdateInclude (High-Level / Include)
**Description:** Update source code of an existing ABAP Include program (Type I). Locks the include, uploads new source code, and unlocks. Optionally activates after update. Use this instead of UpdateProgram for Type I include programs.

**Source:** `src/handlers/include/high/handleUpdateInclude.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate include after source update. Default: false. Set to true to activate immediately.
- `include_name` (string, required) - Include program name. Must already exist as Type I include in SAP.
- `main_program` (string, optional) - Name of the parent/master program that contains this include. When provided, a program-wide syntax check is run after the source is uploaded to catch ABAP errors in the new include code. Highly recommended.
- `source_code` (string, required) - Complete ABAP include source code. Do NOT include a REPORT statement — include programs start directly with code or comments.
- `transport_request` (string, optional) - Transport request number. Required for transportable packages.

---

<a id="high-level-interface"></a>
### High-Level / Interface

<a id="createinterface-high-level-interface"></a>
#### CreateInterface (High-Level / Interface)
**Description:** Create a new ABAP interface in SAP system. Creates the interface object in initial state. Use UpdateInterface to set source code afterwards.

**Source:** `src/handlers/interface/high/handleCreateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, optional) - Interface description. If not provided, interface_name will be used.
- `interface_name` (string, required) - Interface name (e.g., ZIF_TEST_INTERFACE_001). Must follow SAP naming conventions (start with Z or Y).
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP for local objects)
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteinterface-high-level-interface"></a>
#### DeleteInterface (High-Level / Interface)
**Description:** Delete an ABAP interface from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/interface/high/handleDeleteInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., Z_MY_INTERFACE).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="getinterface-high-level-interface"></a>
#### GetInterface (High-Level / Interface)
**Description:** Retrieve ABAP interface definition. Supports reading active or inactive version.

**Source:** `src/handlers/interface/high/handleGetInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., Z_MY_INTERFACE).
- `output` (string, optional (default: inline)) - 
- `version` (string, optional (default: active)) - 

---

<a id="updateinterface-high-level-interface"></a>
#### UpdateInterface (High-Level / Interface)
**Description:** Update source code of an existing ABAP interface. Uses stateful session with proper lock/unlock mechanism. Lock handle and transport number are passed in URL parameters.

**Source:** `src/handlers/interface/high/handleUpdateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate interface after update. Default: true.
- `interface_name` (string, required) - Interface name (e.g., ZIF_MY_INTERFACE). Must exist in the system.
- `source_code` (string, required) - Complete ABAP interface source code with INTERFACE...ENDINTERFACE section.
- `transport_request` (string, optional) - Transport request. Optional if the object is local or already in one.

---

<a id="high-level-package"></a>
### High-Level / Package

<a id="getpackage-high-level-package"></a>
#### GetPackage (High-Level / Package)
**Description:** Retrieve ABAP package metadata (description, super-package, etc.). Supports reading active or inactive version.

**Source:** `src/handlers/package/high/handleGetPackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `package_name` (string, required) - Package name (e.g., Z_MY_PACKAGE).
- `version` (string, optional (default: active)) - 

---

<a id="high-level-program"></a>
### High-Level / Program

<a id="createprogram-high-level-program"></a>
#### CreateProgram (High-Level / Program)
**Description:** Create a new ABAP program (report) in SAP system. Creates the program object in initial state. Use UpdateProgram to set source code afterwards.

**Source:** `src/handlers/program/high/handleCreateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `application` (string, optional) - Application area (e.g., 
- `description` (string, optional) - Program description. If not provided, program_name will be used.
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP for local objects)
- `program_name` (string, required) - Program name (e.g., Z_TEST_PROGRAM_001). Must follow SAP naming conventions (start with Z or Y).
- `program_type` (string, optional) - Program type: 
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteprogram-high-level-program"></a>
#### DeleteProgram (High-Level / Program)
**Description:** Delete an ABAP program from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/program/high/handleDeleteProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="getprogram-high-level-program"></a>
#### GetProgram (High-Level / Program)
**Description:** Retrieve ABAP program definition. Supports reading active or inactive version.

**Source:** `src/handlers/program/high/handleGetProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `output` (string, optional (default: inline)) - 
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `version` (string, optional (default: active)) - 

---

<a id="updateprogram-high-level-program"></a>
#### UpdateProgram (High-Level / Program)
**Description:** Update source code of an existing ABAP program. Locks the program, checks new code, uploads new source code, and unlocks. Optionally activates after update. Use this to modify existing programs without re-creating metadata.

**Source:** `src/handlers/program/high/handleUpdateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate program after source update. Default: false. Set to true to activate immediately, or use ActivateObject for batch activation.
- `program_name` (string, required) - Program name (e.g., Z_TEST_PROGRAM_001). Program must already exist.
- `source_code` (string, required) - Complete ABAP program source code.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="high-level-screen"></a>
### High-Level / Screen

<a id="createscreen-high-level-screen"></a>
#### CreateScreen (High-Level / Screen)
**Description:** Create a new ABAP Screen (Dynpro) on an existing program. Optionally activates.

**Source:** `src/handlers/screen/high/handleCreateScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after creation. Default: false.
- `description` (string, optional) - Screen description.
- `dynpro_data` (string, optional) - Full screen definition as JSON. If omitted, creates minimal screen.
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number to create (e.g., 0100).
- `transport_request` (string, optional) - Transport request number.

---

<a id="deletescreen-high-level-screen"></a>
#### DeleteScreen (High-Level / Screen)
**Description:** Delete an ABAP Screen (Dynpro) from a program. Handles lock/unlock automatically.

**Source:** `src/handlers/screen/high/handleDeleteScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number to delete.
- `transport_request` (string, optional) - Transport request number.

---

<a id="getscreen-high-level-screen"></a>
#### GetScreen (High-Level / Screen)
**Description:** Get ABAP Screen (Dynpro) definition including metadata, fields, and flow logic source code.

**Source:** `src/handlers/screen/high/handleGetScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name (e.g., SAPMV45A).
- `screen_number` (string, required) - Screen number (e.g., 0100).

---

<a id="updatescreen-high-level-screen"></a>
#### UpdateScreen (High-Level / Screen)
**Description:** Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON. Handles lock/unlock automatically.

**Source:** `src/handlers/screen/high/handleUpdateScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after update. Default: false.
- `dynpro_data` (string, required) - Complete screen definition as JSON (from GetScreen/ReadScreen).
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number (e.g., 0100).
- `transport_request` (string, optional) - Transport request number.

---

<a id="high-level-text-element"></a>
### High-Level / Text Element

<a id="createtextelement-high-level-text-element"></a>
#### CreateTextElement (High-Level / Text Element)
**Description:** Add a text element (text symbol, selection text, program title, or list heading) to an ABAP program. Optionally activates after write.

**Source:** `src/handlers/text_element/high/handleCreateTextElement.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate the parent program after write. Default: false.
- `key` (string, optional) - Row key. For 
- `language` (string, optional) - Language key (1-char). Defaults to SAP logon language.
- `program_name` (string, required) - Parent program name (e.g., Z_MY_PROGRAM).
- `text` (string, required) - 
- `text_type` (string, required) - 
- `transport_request` (string, optional) - Transport request number.

---

<a id="deletetextelement-high-level-text-element"></a>
#### DeleteTextElement (High-Level / Text Element)
**Description:** Delete a text element from an ABAP program text pool. key=

**Source:** `src/handlers/text_element/high/handleDeleteTextElement.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate the parent program after write. Default: false.
- `key` (string, optional) - Row key, or 
- `language` (string, optional) - Language key. Defaults to SAP logon language.
- `program_name` (string, required) - Parent program name.
- `text_type` (string, required) - 
- `transport_request` (string, optional) - Transport request number.

---

<a id="gettextelement-high-level-text-element"></a>
#### GetTextElement (High-Level / Text Element)
**Description:** Read ABAP program text pool (text symbols, selection texts, title, headings). Optionally filter by text_type / key.

**Source:** `src/handlers/text_element/high/handleGetTextElement.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `key` (string, optional) - Optional: filter by row key (e.g., 
- `language` (string, optional) - Language key (1-char, e.g., 
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `text_type` (string, optional) - Filter by ID: 

---

<a id="readtextelementsbulk-high-level-text-element"></a>
#### ReadTextElementsBulk (High-Level / Text Element)
**Description:** Read every text element (R/I/S/H) of a program in ONE call via the TPOOL RFC. Partitions rows by type and returns structured arrays. Use this instead of calling GetTextElement per row.

**Source:** `src/handlers/text_element/high/handleReadTextElementsBulk.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `language` (string, optional) - 1-char language. Defaults to SAP logon language.
- `program_name` (string, required) - Program name.

---

<a id="updatetextelement-high-level-text-element"></a>
#### UpdateTextElement (High-Level / Text Element)
**Description:** Update an existing text element in an ABAP program text pool. Handles lock/unlock automatically.

**Source:** `src/handlers/text_element/high/handleUpdateTextElement.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate the parent program after write. Default: false.
- `key` (string, optional) - Row key. Required except for 
- `language` (string, optional) - Language key. Defaults to SAP logon language.
- `program_name` (string, required) - Parent program name.
- `text` (string, required) - 
- `text_type` (string, required) - 
- `transport_request` (string, optional) - Transport request number.

---

<a id="writetextelementsbulk-high-level-text-element"></a>
#### WriteTextElementsBulk (High-Level / Text Element)
**Description:** Register many ABAP text elements (R/I/S/H) in ONE tool call via a single TPOOL RFC write. Use instead of calling CreateTextElement N times. With activate=false (default) the pool is staged INACTIVE — the parent program\

**Source:** `src/handlers/text_element/high/handleWriteTextElementsBulk.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - false (default) — stage as INACTIVE (program activation promotes). true — write ACTIVE immediately.
- `language` (string, optional) - 1-char language key (e.g. 
- `program_name` (string, required) - Parent program name.
- `replace_existing` (boolean, optional) - If true (default), the TPOOL is replaced with the provided entries only. If false, existing rows are preserved and provided rows merge by (type, key).
- `text_elements` (array, required) - Array of entries. Each: { type: 
- `transport_request` (string, optional) - Transport request number (informational).

---

<a id="high-level-unit-test"></a>
### High-Level / Unit Test

<a id="createcdsunittest-high-level-unit-test"></a>
#### CreateCdsUnitTest (High-Level / Unit Test)
**Description:** Create a CDS unit test class with CDS validation. Creates the test class in initial state.

**Source:** `src/handlers/unit_test/high/handleCreateCdsUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `cds_view_name` (string, required) - CDS view name to validate for unit test doubles.
- `class_name` (string, required) - Global test class name (e.g., ZCL_CDS_TEST).
- `description` (string, optional) - Optional description for the global test class.
- `package_name` (string, required) - Package name (e.g., ZOK_TEST_PKG_01, $TMP).
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="createunittest-high-level-unit-test"></a>
#### CreateUnitTest (High-Level / Unit Test)
**Description:** Start an ABAP Unit test run for provided class test definitions. Returns run_id for status/result queries.

**Source:** `src/handlers/unit_test/high/handleCreateUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `context` (string, optional) - Optional context string shown in SAP tools.
- `duration` (object, optional) - 
- `risk_level` (object, optional) - 
- `scope` (object, optional) - 
- `tests` (array, required) - List of container/test class pairs to execute.
- `title` (string, optional) - Optional title for the ABAP Unit run.

---

<a id="deletecdsunittest-high-level-unit-test"></a>
#### DeleteCdsUnitTest (High-Level / Unit Test)
**Description:** Delete a CDS unit test class (global class).

**Source:** `src/handlers/unit_test/high/handleDeleteCdsUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Global test class name (e.g., ZCL_CDS_TEST).
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteunittest-high-level-unit-test"></a>
#### DeleteUnitTest (High-Level / Unit Test)
**Description:** Delete an ABAP Unit test run. Note: ADT does not support deleting unit test runs and will return an error.

**Source:** `src/handlers/unit_test/high/handleDeleteUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by CreateUnitTest/RunUnitTest.

---

<a id="getcdsunittest-high-level-unit-test"></a>
#### GetCdsUnitTest (High-Level / Unit Test)
**Description:** Retrieve CDS unit test run status and result for a previously started run_id.

**Source:** `src/handlers/unit_test/high/handleGetCdsUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by unit test run.

---

<a id="getcdsunittestresult-high-level-unit-test"></a>
#### GetCdsUnitTestResult (High-Level / Unit Test)
**Description:** Retrieve CDS unit test run result for a run_id.

**Source:** `src/handlers/unit_test/high/handleGetCdsUnitTestResult.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `format` (string, optional) - Result format: abapunit or junit.
- `run_id` (string, required) - Run identifier returned by unit test run.
- `with_navigation_uris` (boolean, optional (default: false)) - Include navigation URIs in result if supported.

---

<a id="getcdsunitteststatus-high-level-unit-test"></a>
#### GetCdsUnitTestStatus (High-Level / Unit Test)
**Description:** Retrieve CDS unit test run status for a run_id.

**Source:** `src/handlers/unit_test/high/handleGetCdsUnitTestStatus.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by unit test run.
- `with_long_polling` (boolean, optional (default: true)) - Enable long polling while waiting for status.

---

<a id="getunittest-high-level-unit-test"></a>
#### GetUnitTest (High-Level / Unit Test)
**Description:** Retrieve ABAP Unit test run status and result for a previously started run_id.

**Source:** `src/handlers/unit_test/high/handleGetUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by RunUnitTest.

---

<a id="getunittestresult-high-level-unit-test"></a>
#### GetUnitTestResult (High-Level / Unit Test)
**Description:** Retrieve ABAP Unit test run result for a run_id.

**Source:** `src/handlers/unit_test/high/handleGetUnitTestResult.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `format` (string, optional) - Result format: abapunit or junit.
- `run_id` (string, required) - Run identifier returned by unit test run.
- `with_navigation_uris` (boolean, optional (default: false)) - Include navigation URIs in result if supported.

---

<a id="getunitteststatus-high-level-unit-test"></a>
#### GetUnitTestStatus (High-Level / Unit Test)
**Description:** Retrieve ABAP Unit test run status for a run_id.

**Source:** `src/handlers/unit_test/high/handleGetUnitTestStatus.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by unit test run.
- `with_long_polling` (boolean, optional (default: true)) - Enable long polling while waiting for status.

---

<a id="rununittest-high-level-unit-test"></a>
#### RunUnitTest (High-Level / Unit Test)
**Description:** Start an ABAP Unit test run for provided test definitions. Returns run_id for status/result queries. 

**Source:** `src/handlers/unit_test/high/handleRunUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `context` (string, optional) - Optional context string shown in SAP tools.
- `duration` (object, optional) - 
- `risk_level` (object, optional) - 
- `scope` (object, optional) - 
- `tests` (array, required) - List of container/test class pairs to execute.
- `title` (string, optional) - Optional title for the ABAP Unit run.

---

<a id="updatecdsunittest-high-level-unit-test"></a>
#### UpdateCdsUnitTest (High-Level / Unit Test)
**Description:** Update a CDS unit test class local test class source code.

**Source:** `src/handlers/unit_test/high/handleUpdateCdsUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Global test class name (e.g., ZCL_CDS_TEST).
- `test_class_source` (string, required) - Updated local test class ABAP source code.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="updateunittest-high-level-unit-test"></a>
#### UpdateUnitTest (High-Level / Unit Test)
**Description:** Update an ABAP Unit test run. Note: ADT does not support updating unit test runs and will return an error.

**Source:** `src/handlers/unit_test/high/handleUpdateUnitTest.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by CreateUnitTest/RunUnitTest.

---

<a id="high-level-view"></a>
### High-Level / View

<a id="createview-high-level-view"></a>
#### CreateView (High-Level / View)
**Description:** Create CDS View or Classic View in SAP. Creates the view object in initial state. Use UpdateView to set DDL source code afterwards.

**Source:** `src/handlers/view/high/handleCreateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, optional) - Optional description (defaults to view_name).
- `package_name` (string, required) - Package name (e.g., ZOK_LAB, $TMP for local objects)
- `transport_request` (string, optional) - Transport request. Required for transportable packages.
- `view_name` (string, required) - View name (e.g., ZOK_R_TEST_0002, Z_I_MY_VIEW).

---

<a id="deleteview-high-level-view"></a>
#### DeleteView (High-Level / View)
**Description:** Delete an ABAP view from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.

**Source:** `src/handlers/view/high/handleDeleteView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).
- `view_name` (string, required) - View name (e.g., Z_MY_VIEW).

---

<a id="getview-high-level-view"></a>
#### GetView (High-Level / View)
**Description:** Retrieve ABAP view definition. Supports reading active or inactive version.

**Source:** `src/handlers/view/high/handleGetView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `version` (string, optional (default: active)) - 
- `view_name` (string, required) - View name (e.g., Z_MY_VIEW).

---

<a id="updateview-high-level-view"></a>
#### UpdateView (High-Level / View)
**Description:** Update DDL source code of an existing CDS View or Classic View. Locks the view, checks new code, uploads new DDL source, unlocks, and optionally activates.

**Source:** `src/handlers/view/high/handleUpdateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `activate` (boolean, optional) - Activate after update. Default: false.
- `ddl_source` (string, required) - Complete DDL source code.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.
- `view_name` (string, required) - View name (e.g., ZOK_R_TEST_0002).

---

<a id="low-level-group"></a>
## Low-Level Group

<a id="low-level-class"></a>
### Low-Level / Class

<a id="activateclasslow-low-level-class"></a>
#### ActivateClassLow (Low-Level / Class)
**Description:** [low-level] Activate an ABAP class. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/class/low/handleActivateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="activateclasstestclasseslow-low-level-class"></a>
#### ActivateClassTestClassesLow (Low-Level / Class)
**Description:** [low-level] Activate ABAP Unit test classes include for an existing class. Should be executed after updating and unlocking test classes.

**Source:** `src/handlers/class/low/handleActivateClassTestClasses.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `test_class_name` (string, optional) - Optional ABAP Unit test class name (e.g., LTCL_MY_CLASS). Defaults to auto-detected value.

---

<a id="checkclasslow-low-level-class"></a>
#### CheckClassLow (Low-Level / Class)
**Description:** [low-level] Perform syntax check on an ABAP class. Can check existing class (active/inactive) or hypothetical source code. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/class/low/handleCheckClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS)
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `source_code` (string, optional) - Optional: source code to validate. If provided, validates hypothetical code without creating object. Must include complete CLASS DEFINITION and IMPLEMENTATION sections.
- `version` (string, optional) - Version to check: 

---

<a id="createclasslow-low-level-class"></a>
#### CreateClassLow (Low-Level / Class)
**Description:** [low-level] Create a new ABAP class. - use CreateClass (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/class/low/handleCreateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `abstract` (boolean, optional (default: false).)) - Mark class as abstract (optional, default: false).
- `class_name` (string, required) - Class name (e.g., ZCL_TEST_CLASS_001). Must follow SAP naming conventions.
- `create_protected` (boolean, optional (default: false).)) - Create protected section (optional, default: false).
- `description` (string, required) - Class description.
- `final` (boolean, optional (default: false).)) - Mark class as final (optional, default: false).
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip post-create syntax check. Default: false. When false, runs a syntax check on the newly created class shell and surfaces any errors with line numbers.
- `superclass` (string, optional) - Superclass name (optional).
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteclasslow-low-level-class"></a>
#### DeleteClassLow (Low-Level / Class)
**Description:** [low-level] Delete an ABAP class from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/class/low/handleDeleteClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="getclassunittestresultlow-low-level-class"></a>
#### GetClassUnitTestResultLow (Low-Level / Class)
**Description:** [low-level] Retrieve ABAP Unit run result (ABAPUnit or JUnit XML) for a completed run_id.

**Source:** `src/handlers/class/low/handleGetClassUnitTestResult.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `format` (string, optional) - Preferred response format. Defaults to 
- `run_id` (string, required) - Run identifier returned by RunClassUnitTestsLow.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `with_navigation_uris` (boolean, optional) - Optional flag to request navigation URIs in SAP response (default true).

---

<a id="getclassunitteststatuslow-low-level-class"></a>
#### GetClassUnitTestStatusLow (Low-Level / Class)
**Description:** [low-level] Retrieve ABAP Unit run status XML for a previously started run_id.

**Source:** `src/handlers/class/low/handleGetClassUnitTestStatus.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `run_id` (string, required) - Run identifier returned by RunClassUnitTestsLow.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `with_long_polling` (boolean, optional) - Optional flag to enable SAP long-polling (default true).

---

<a id="lockclasslow-low-level-class"></a>
#### LockClassLow (Low-Level / Class)
**Description:** [low-level] Lock an ABAP class for modification. Uses session from HandlerContext. Returns lock handle that must be used in subsequent update/unlock operations.

**Source:** `src/handlers/class/low/handleLockClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).

---

<a id="lockclasstestclasseslow-low-level-class"></a>
#### LockClassTestClassesLow (Low-Level / Class)
**Description:** [low-level] Lock ABAP Unit test classes include (CLAS/OC testclasses) for the specified class. Returns a test_classes_lock_handle for subsequent update/unlock operations using the same session.

**Source:** `src/handlers/class/low/handleLockClassTestClasses.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="runclassunittestslow-low-level-class"></a>
#### RunClassUnitTestsLow (Low-Level / Class)
**Description:** [low-level] Start an ABAP Unit test run for provided class test definitions. Returns run_id extracted from SAP response headers.

**Source:** `src/handlers/class/low/handleRunClassUnitTests.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `context` (string, optional) - Optional context string shown in SAP tools.
- `duration` (object, optional) - 
- `risk_level` (object, optional) - 
- `scope` (object, optional) - 
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `tests` (array, required) - List of container/test class pairs to execute.
- `title` (string, optional) - Optional title for the ABAP Unit run.

---

<a id="unlockclasslow-low-level-class"></a>
#### UnlockClassLow (Low-Level / Class)
**Description:** [low-level] Unlock an ABAP class after modification. Uses session from HandlerContext. Must use the same lock_handle from LockClass operation.

**Source:** `src/handlers/class/low/handleUnlockClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `lock_handle` (string, required) - Lock handle from LockClass operation.

---

<a id="unlockclasstestclasseslow-low-level-class"></a>
#### UnlockClassTestClassesLow (Low-Level / Class)
**Description:** [low-level] Unlock ABAP Unit test classes include for a class using the test_classes_lock_handle obtained from LockClassTestClassesLow.

**Source:** `src/handlers/class/low/handleUnlockClassTestClasses.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `lock_handle` (string, required) - Lock handle returned by LockClassTestClassesLow.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="updateclasslow-low-level-class"></a>
#### UpdateClassLow (Low-Level / Class)
**Description:** [low-level] Update source code of an existing ABAP class. Uses session from HandlerContext. Requires lock handle from LockClass operation. - use UpdateClass (high-level) for full workflow with lock/unlock/activate.

**Source:** `src/handlers/class/low/handleUpdateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_TEST_CLASS_001). Class must already exist.
- `lock_handle` (string, required) - Lock handle from LockClass operation. Required for update operation.
- `skip_check` (boolean, optional) - Skip pre-write syntax check on source_code. Default: false. When false, runs a syntax check on the proposed code BEFORE uploading it and surfaces any errors with line numbers — the broken source never lands on SAP.
- `source_code` (string, required) - Complete ABAP class source code including CLASS DEFINITION and IMPLEMENTATION sections.

---

<a id="updateclasstestclasseslow-low-level-class"></a>
#### UpdateClassTestClassesLow (Low-Level / Class)
**Description:** [low-level] Upload ABAP Unit test include source code for an existing class. Requires test_classes_lock_handle from LockClassTestClassesLow.

**Source:** `src/handlers/class/low/handleUpdateClassTestClasses.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name (e.g., ZCL_MY_CLASS).
- `lock_handle` (string, required) - Test classes lock handle from LockClassTestClassesLow.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip post-write syntax check. Default: false. When false, runs a syntax check on the parent class after updating the test-classes include and surfaces any errors with line numbers.
- `test_class_source` (string, required) - Complete ABAP Unit test class source code.

---

<a id="validateclasslow-low-level-class"></a>
#### ValidateClassLow (Low-Level / Class)
**Description:** [low-level] Validate an ABAP class name before creation. Checks if the name is valid, available, and validates package, description, and superclass if provided. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/class/low/handleValidateClass.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `class_name` (string, required) - Class name to validate (e.g., ZCL_MY_CLASS)
- `description` (string, required) - Description for validation (required).
- `package_name` (string, required) - Package name for validation (required).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `superclass` (string, optional) - Optional superclass name for validation (e.g., CL_OBJECT)

---

<a id="low-level-common"></a>
### Low-Level / Common

<a id="activateobjectlow-low-level-common"></a>
#### ActivateObjectLow (Low-Level / Common)
**Description:** [low-level] Activate one or multiple ABAP repository objects. Works with any object type; URI is auto-generated from name and type.

**Source:** `src/handlers/common/low/handleActivateObject.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `objects` (array, required) - Array of objects to activate. Each object must have 
- `preaudit` (boolean, optional) - Request pre-audit before activation. Default: true

---

<a id="low-level-function"></a>
### Low-Level / Function

<a id="activatefunctiongrouplow-low-level-function"></a>
#### ActivateFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Activate an ABAP function group. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleActivateFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., Z_FG_TEST).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="activatefunctionmodulelow-low-level-function"></a>
#### ActivateFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Activate an ABAP function module. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleActivateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., Z_FG_TEST).
- `function_module_name` (string, required) - Function module name (e.g., Z_FM_TEST).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="checkfunctiongrouplow-low-level-function"></a>
#### CheckFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Perform syntax check on an ABAP function group. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleCheckFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="checkfunctionmodulelow-low-level-function"></a>
#### CheckFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Perform syntax check on an ABAP function module. Returns syntax errors, warnings, and messages. Requires function group name. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleCheckFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., Z_FUGR_TEST_0001)
- `function_module_name` (string, required) - Function module name (e.g., Z_TEST_FM)
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `version` (string, optional) - Version to check: 

---

<a id="createfunctiongrouplow-low-level-function"></a>
#### CreateFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Create a new ABAP function group. - use CreateFunctionGroup (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/function/low/handleCreateFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - Function group description.
- `function_group_name` (string, required) - Function group name (e.g., ZFG_MY_GROUP). Must follow SAP naming conventions.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="createfunctionmodulelow-low-level-function"></a>
#### CreateFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Create a new ABAP function module. - use CreateFunctionModule (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/function/low/handleCreateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - Function module description.
- `function_group_name` (string, required) - Function group name (e.g., ZFG_MY_GROUP).
- `function_module_name` (string, required) - Function module name (e.g., Z_MY_FUNCTION).
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deletefunctiongrouplow-low-level-function"></a>
#### DeleteFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Delete an ABAP function group from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/function/low/handleDeleteFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_PROGRAM).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="deletefunctionmodulelow-low-level-function"></a>
#### DeleteFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Delete an ABAP function module from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/function/low/handleDeleteFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., ZFG_MY_GROUP).
- `function_module_name` (string, required) - Function module name (e.g., Z_MY_FUNCTION).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="lockfunctiongrouplow-low-level-function"></a>
#### LockFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Lock an ABAP function group for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.

**Source:** `src/handlers/function/low/handleLockFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="lockfunctionmodulelow-low-level-function"></a>
#### LockFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Lock an ABAP function module for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.

**Source:** `src/handlers/function/low/handleLockFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., ZFG_MY_GROUP).
- `function_module_name` (string, required) - Function module name (e.g., Z_MY_FUNCTION).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="unlockfunctiongrouplow-low-level-function"></a>
#### UnlockFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Unlock an ABAP function group after modification. Must use the same session_id and lock_handle from LockFunctionGroup operation.

**Source:** `src/handlers/function/low/handleUnlockFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - FunctionGroup name (e.g., Z_MY_PROGRAM).
- `lock_handle` (string, required) - Lock handle from LockFunctionGroup operation.
- `session_id` (string, required) - Session ID from LockFunctionGroup operation. Must be the same as used in LockFunctionGroup.
- `session_state` (object, optional) - Session state from LockFunctionGroup (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="unlockfunctionmodulelow-low-level-function"></a>
#### UnlockFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Unlock an ABAP function module after modification. Must use the same session_id and lock_handle from LockFunctionModule operation.

**Source:** `src/handlers/function/low/handleUnlockFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name (e.g., ZFG_MY_GROUP).
- `function_module_name` (string, required) - Function module name (e.g., Z_MY_FUNCTION).
- `lock_handle` (string, required) - Lock handle from LockFunctionModule operation.
- `session_id` (string, required) - Session ID from LockFunctionModule operation. Must be the same as used in LockFunctionModule.
- `session_state` (object, optional) - Session state from LockFunctionModule (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="updatefunctionmodulelow-low-level-function"></a>
#### UpdateFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Update source code of an existing ABAP function module. Requires lock handle from LockObject and function group name. - use UpdateFunctionModule (high-level) for full workflow with lock/unlock/activate.

**Source:** `src/handlers/function/low/handleUpdateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `function_group_name` (string, required) - Function group name containing the function module (e.g., Z_TEST_FG).
- `function_module_name` (string, required) - Function module name (e.g., Z_TEST_FM). Function module must already exist.
- `lock_handle` (string, required) - Lock handle from LockFunctionModule. Required for update operation.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip post-write syntax check. Default: false. When false, runs a syntax check on the staged inactive version after update and surfaces any errors with line numbers.
- `source_code` (string, required) - Complete ABAP function module source code.
- `transport_request` (string, optional) - Transport request number (e.g., E19K905635). Required for transportable objects locked in a request.

---

<a id="validatefunctiongrouplow-low-level-function"></a>
#### ValidateFunctionGroupLow (Low-Level / Function)
**Description:** [low-level] Validate an ABAP function group name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleValidateFunctionGroup.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, optional) - Optional description for validation
- `function_group_name` (string, required) - FunctionGroup name to validate (e.g., Z_MY_PROGRAM).
- `package_name` (string, optional) - Package name for validation (optional but recommended).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="validatefunctionmodulelow-low-level-function"></a>
#### ValidateFunctionModuleLow (Low-Level / Function)
**Description:** [low-level] Validate an ABAP function module name before creation. Checks if the name is valid and available. Requires function group name. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/function/low/handleValidateFunctionModule.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, optional) - Optional description for validation
- `function_group_name` (string, required) - Function group name (e.g., Z_FUGR_TEST_0001)
- `function_module_name` (string, required) - Function module name to validate (e.g., Z_TEST_FM)
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="low-level-gui-status"></a>
### Low-Level / Gui Status

<a id="activateguistatuslow-low-level-gui-status"></a>
#### ActivateGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Activate an ABAP program to make GUI Status changes active.

**Source:** `src/handlers/gui_status/low/handleActivateGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="createguistatuslow-low-level-gui-status"></a>
#### CreateGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Create a new ABAP GUI Status on an existing program.

**Source:** `src/handlers/gui_status/low/handleCreateGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `description` (string, optional) - GUI Status description.
- `program_name` (string, required) - Parent program name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `status_name` (string, required) - GUI Status name to create (e.g., MAIN_STATUS).
- `status_type` (string, optional) - Status type: 
- `transport_request` (string, optional) - Transport request number.

---

<a id="deleteguistatuslow-low-level-gui-status"></a>
#### DeleteGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Delete an ABAP GUI Status from a program.

**Source:** `src/handlers/gui_status/low/handleDeleteGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockGuiStatusLow.
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `status_name` (string, required) - GUI Status name to delete. Use 
- `transport_request` (string, optional) - Transport request number.

---

<a id="lockguistatuslow-low-level-gui-status"></a>
#### LockGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Lock a program for GUI Status modification. Returns lock handle for subsequent update/unlock operations.

**Source:** `src/handlers/gui_status/low/handleLockGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name (e.g., SAPMV45A).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `status_name` (string, optional) - GUI Status name (for reference only).

---

<a id="unlockguistatuslow-low-level-gui-status"></a>
#### UnlockGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Unlock a program after GUI Status modification. Requires lock handle from LockGuiStatusLow.

**Source:** `src/handlers/gui_status/low/handleUnlockGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockGuiStatusLow.
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="updateguistatuslow-low-level-gui-status"></a>
#### UpdateGuiStatusLow (Low-Level / Gui Status)
**Description:** [low-level] Update an ABAP GUI Status definition. Provide full CUA data (from ReadGuiStatus) with modifications.

**Source:** `src/handlers/gui_status/low/handleUpdateGuiStatus.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `cua_data` (string, required) - Complete CUA data as JSON string (from ReadGuiStatus/GetGuiStatus). Modify and pass back.
- `lock_handle` (string, required) - Lock handle from LockGuiStatusLow.
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `transport_request` (string, optional) - Transport request number.

---

<a id="low-level-interface"></a>
### Low-Level / Interface

<a id="activateinterfacelow-low-level-interface"></a>
#### ActivateInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Activate an ABAP interface. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/interface/low/handleActivateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., ZIF_MY_INTERFACE).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="checkinterfacelow-low-level-interface"></a>
#### CheckInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Perform syntax check on an ABAP interface. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/interface/low/handleCheckInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="createinterfacelow-low-level-interface"></a>
#### CreateInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Create a new ABAP interface. - use CreateInterface (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/interface/low/handleCreateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - Interface description.
- `interface_name` (string, required) - Interface name (e.g., ZIF_TEST_INTERFACE). Must follow SAP naming conventions.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteinterfacelow-low-level-interface"></a>
#### DeleteInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Delete an ABAP interface from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/interface/low/handleDeleteInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., Z_MY_PROGRAM).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="lockinterfacelow-low-level-interface"></a>
#### LockInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Lock an ABAP interface for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.

**Source:** `src/handlers/interface/low/handleLockInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., ZIF_MY_INTERFACE).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="unlockinterfacelow-low-level-interface"></a>
#### UnlockInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Unlock an ABAP interface after modification. Must use the same session_id and lock_handle from LockInterface operation.

**Source:** `src/handlers/interface/low/handleUnlockInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., Z_MY_PROGRAM).
- `lock_handle` (string, required) - Lock handle from LockInterface operation.
- `session_id` (string, required) - Session ID from LockInterface operation. Must be the same as used in LockInterface.
- `session_state` (object, optional) - Session state from LockInterface (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="updateinterfacelow-low-level-interface"></a>
#### UpdateInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Update source code of an existing ABAP interface. Requires lock handle from LockObject. - use UpdateInterface (high-level) for full workflow with lock/unlock/activate.

**Source:** `src/handlers/interface/low/handleUpdateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `interface_name` (string, required) - Interface name (e.g., ZIF_TEST_INTERFACE). Interface must already exist.
- `lock_handle` (string, required) - Lock handle from LockObject. Required for update operation.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `source_code` (string, required) - Complete ABAP interface source code.

---

<a id="validateinterfacelow-low-level-interface"></a>
#### ValidateInterfaceLow (Low-Level / Interface)
**Description:** [low-level] Validate an ABAP interface name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/interface/low/handleValidateInterface.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - Interface description. Required for validation.
- `interface_name` (string, required) - Interface name to validate (e.g., Z_MY_PROGRAM).
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="low-level-package"></a>
### Low-Level / Package

<a id="checkpackagelow-low-level-package"></a>
#### CheckPackageLow (Low-Level / Package)
**Description:** [low-level] Perform syntax check on an ABAP package. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/package/low/handleCheckPackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `package_name` (string, required) - Package name (e.g., ZOK_TEST_0002).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `super_package` (string, required) - Super package (parent package) name (e.g., ZOK_PACKAGE). Required.

---

<a id="deletepackagelow-low-level-package"></a>
#### DeletePackageLow (Low-Level / Package)
**Description:** [low-level] Delete an ABAP package from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/package/low/handleDeletePackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `connection_config` (object, optional) - Optional SAP connection config to create a fresh connection for deletion. Useful when the existing connection config is unavailable.
- `force_new_connection` (boolean, optional) - Force creation of a new connection (bypass cache). Useful when package was locked/unlocked and needs to be deleted in a fresh session. Default: false.
- `package_name` (string, required) - Package name (e.g., Z_MY_PROGRAM).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="lockpackagelow-low-level-package"></a>
#### LockPackageLow (Low-Level / Package)
**Description:** [low-level] Lock an ABAP package for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id. Requires super_package.

**Source:** `src/handlers/package/low/handleLockPackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `package_name` (string, required) - Package name (e.g., ZOK_TEST_0002).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `super_package` (string, required) - Super package (parent package) name (e.g., ZOK_PACKAGE). Required.

---

<a id="unlockpackagelow-low-level-package"></a>
#### UnlockPackageLow (Low-Level / Package)
**Description:** [low-level] Unlock an ABAP package after modification. Requires lock handle from LockObject and superPackage. - must use the same session_id and lock_handle from LockObject.

**Source:** `src/handlers/package/low/handleUnlockPackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockObject operation
- `package_name` (string, required) - Package name (e.g., ZOK_TEST_0002). Package must already exist.
- `session_id` (string, required) - Session ID from LockObject operation. Must be the same as used in LockObject.
- `session_state` (object, optional) - Session state from LockObject (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `super_package` (string, required) - Super package (parent package) name. Required for package operations.

---

<a id="updatepackagelow-low-level-package"></a>
#### UpdatePackageLow (Low-Level / Package)
**Description:** [low-level] Update description of an existing ABAP package. Requires lock handle from LockObject and superPackage. - use UpdatePackageSource for full workflow with lock/unlock.

**Source:** `src/handlers/package/low/handleUpdatePackage.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockObject. Required for update operation.
- `package_name` (string, required) - Package name (e.g., ZOK_TEST_0002). Package must already exist.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `super_package` (string, required) - Super package (parent package) name. Required for package operations.
- `updated_description` (string, required) - New description for the package.

---

<a id="low-level-program"></a>
### Low-Level / Program

<a id="activateprogramlow-low-level-program"></a>
#### ActivateProgramLow (Low-Level / Program)
**Description:** [low-level] Activate an ABAP program. Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/program/low/handleActivateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="checkprogramlow-low-level-program"></a>
#### CheckProgramLow (Low-Level / Program)
**Description:** [low-level] Perform syntax check on an ABAP program. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/program/low/handleCheckProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="createprogramlow-low-level-program"></a>
#### CreateProgramLow (Low-Level / Program)
**Description:** [low-level] Create a new ABAP program. - use CreateProgram (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/program/low/handleCreateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `application` (string, optional (default: *').)) - Application area (optional, default: 
- `description` (string, required) - Program description.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `program_name` (string, required) - Program name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.
- `program_type` (string, optional) - Program type: 
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip the post-create syntax check on the newly created program shell. Default: false. Set to true when chaining multiple low-level calls where the caller will run CheckProgramLow explicitly later.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.

---

<a id="deleteprogramlow-low-level-program"></a>
#### DeleteProgramLow (Low-Level / Program)
**Description:** [low-level] Delete an ABAP program from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/program/low/handleDeleteProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).

---

<a id="lockprogramlow-low-level-program"></a>
#### LockProgramLow (Low-Level / Program)
**Description:** [low-level] Lock an ABAP program for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.

**Source:** `src/handlers/program/low/handleLockProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="unlockprogramlow-low-level-program"></a>
#### UnlockProgramLow (Low-Level / Program)
**Description:** [low-level] Unlock an ABAP program after modification. Must use the same session_id and lock_handle from LockProgram operation.

**Source:** `src/handlers/program/low/handleUnlockProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockProgram operation.
- `program_name` (string, required) - Program name (e.g., Z_MY_PROGRAM).
- `session_id` (string, required) - Session ID from LockProgram operation. Must be the same as used in LockProgram.
- `session_state` (object, optional) - Session state from LockProgram (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="updateprogramlow-low-level-program"></a>
#### UpdateProgramLow (Low-Level / Program)
**Description:** [low-level] Update source code of an existing ABAP program. Requires lock handle from LockObject. - use UpdateProgram (high-level) for full workflow with lock/unlock/activate.

**Source:** `src/handlers/program/low/handleUpdateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockObject. Required for update operation.
- `program_name` (string, required) - Program name (e.g., Z_TEST_PROGRAM). Program must already exist.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip the pre-write syntax check of the new source. Default: false. Set to true when chaining multiple low-level calls where the caller will run CheckProgramLow explicitly before this update.
- `source_code` (string, required) - Complete ABAP program source code.

---

<a id="validateprogramlow-low-level-program"></a>
#### ValidateProgramLow (Low-Level / Program)
**Description:** [low-level] Validate an ABAP program name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/program/low/handleValidateProgram.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `description` (string, required) - Program description. Required for validation.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.
- `program_name` (string, required) - Program name to validate (e.g., Z_MY_PROGRAM).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.

---

<a id="low-level-screen"></a>
### Low-Level / Screen

<a id="activatescreenlow-low-level-screen"></a>
#### ActivateScreenLow (Low-Level / Screen)
**Description:** [low-level] Activate an ABAP program to make Screen changes active.

**Source:** `src/handlers/screen/low/handleActivateScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="createscreenlow-low-level-screen"></a>
#### CreateScreenLow (Low-Level / Screen)
**Description:** [low-level] Create a new ABAP Screen (Dynpro) on an existing program.

**Source:** `src/handlers/screen/low/handleCreateScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `description` (string, optional) - Screen description.
- `dynpro_data` (string, optional) - Full screen definition as JSON (header, containers, fields_to_containers, flow_logic). If omitted, creates a minimal empty screen.
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number to create (e.g., 0100).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `skip_check` (boolean, optional) - Skip post-write syntax check. Default: false. When false, runs a program-tree syntax check on the parent program after DYNPRO_INSERT and surfaces any flow-logic errors with line numbers.

---

<a id="deletescreenlow-low-level-screen"></a>
#### DeleteScreenLow (Low-Level / Screen)
**Description:** [low-level] Delete an ABAP Screen (Dynpro) from a program.

**Source:** `src/handlers/screen/low/handleDeleteScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockScreenLow.
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number (e.g., 0100).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="lockscreenlow-low-level-screen"></a>
#### LockScreenLow (Low-Level / Screen)
**Description:** [low-level] Lock a program for Screen modification. Returns lock handle for subsequent operations.

**Source:** `src/handlers/screen/low/handleLockScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, optional) - Screen number (for reference).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="unlockscreenlow-low-level-screen"></a>
#### UnlockScreenLow (Low-Level / Screen)
**Description:** [low-level] Unlock a program after Screen modification.

**Source:** `src/handlers/screen/low/handleUnlockScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockScreenLow.
- `program_name` (string, required) - Parent program name.
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.

---

<a id="updatescreenlow-low-level-screen"></a>
#### UpdateScreenLow (Low-Level / Screen)
**Description:** [low-level] Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON.

**Source:** `src/handlers/screen/low/handleUpdateScreen.ts`

**Available in:** `onprem`, `legacy`

**Parameters:**
- `dynpro_data` (string, required) - Complete screen definition as JSON (header, containers, fields_to_containers, flow_logic).
- `lock_handle` (string, required) - Lock handle from LockScreenLow.
- `program_name` (string, required) - Parent program name.
- `screen_number` (string, required) - Screen number (e.g., 0100).
- `session_id` (string, optional) - Session ID from GetSession.
- `session_state` (object, optional) - Session state from GetSession.
- `skip_check` (boolean, optional) - Skip post-write syntax check. Default: false. When false, runs a program-tree syntax check on the parent program after DYNPRO_INSERT and surfaces any flow-logic errors with line numbers.

---

<a id="low-level-view"></a>
### Low-Level / View

<a id="activateviewlow-low-level-view"></a>
#### ActivateViewLow (Low-Level / View)
**Description:** [low-level] Activate an ABAP view (CDS view). Returns activation status and any warnings/errors. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/view/low/handleActivateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `view_name` (string, required) - View name (e.g., ZVW_MY_VIEW).

---

<a id="checkviewlow-low-level-view"></a>
#### CheckViewLow (Low-Level / View)
**Description:** [low-level] Perform syntax check on an ABAP view. Returns syntax errors, warnings, and messages. Can use session_id and session_state from GetSession to maintain the same session. If ddl_source is provided, validates new/unsaved code (will be base64 encoded in request).

**Source:** `src/handlers/view/low/handleCheckView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `ddl_source` (string, optional) - Optional DDL source code to validate (for checking new/unsaved code). If provided, code will be base64 encoded and sent in check request body.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `version` (string, optional) - Version to check: 
- `view_name` (string, required) - View name (e.g., Z_MY_PROGRAM).

---

<a id="createviewlow-low-level-view"></a>
#### CreateViewLow (Low-Level / View)
**Description:** [low-level] Create a new ABAP view. - use CreateView (high-level) for full workflow with validation, lock, update, check, unlock, and activate.

**Source:** `src/handlers/view/low/handleCreateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `application` (string, optional (default: *').)) - Application area (optional, default: 
- `description` (string, required) - View description.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects).
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip post-create syntax check. Default: false. When false, runs a syntax check on the freshly created view shell and surfaces any errors with line numbers.
- `transport_request` (string, optional) - Transport request. Required for transportable packages.
- `view_name` (string, required) - View name (e.g., Z_TEST_PROGRAM). Must follow SAP naming conventions.
- `view_type` (string, optional) - View type: 

---

<a id="deleteviewlow-low-level-view"></a>
#### DeleteViewLow (Low-Level / View)
**Description:** [low-level] Delete an ABAP view from the SAP system via ADT deletion API. Transport request optional for $TMP objects.

**Source:** `src/handlers/view/low/handleDeleteView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `transport_request` (string, optional) - Transport request. Required unless the object is local ($TMP).
- `view_name` (string, required) - View name (e.g., Z_MY_PROGRAM).

---

<a id="lockviewlow-low-level-view"></a>
#### LockViewLow (Low-Level / View)
**Description:** [low-level] Lock an ABAP view for modification. Returns lock handle that must be used in subsequent update/unlock operations with the same session_id.

**Source:** `src/handlers/view/low/handleLockView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `view_name` (string, required) - View name (e.g., Z_MY_PROGRAM).

---

<a id="unlockviewlow-low-level-view"></a>
#### UnlockViewLow (Low-Level / View)
**Description:** [low-level] Unlock an ABAP view after modification. Must use the same session_id and lock_handle from LockView operation.

**Source:** `src/handlers/view/low/handleUnlockView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `lock_handle` (string, required) - Lock handle from LockView operation.
- `session_id` (string, required) - Session ID from LockView operation. Must be the same as used in LockView.
- `session_state` (object, optional) - Session state from LockView (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `view_name` (string, required) - View name (e.g., Z_MY_PROGRAM).

---

<a id="updateviewlow-low-level-view"></a>
#### UpdateViewLow (Low-Level / View)
**Description:** [low-level] Update DDL source code of an existing CDS View or Classic View. Requires lock handle from LockObject. - use UpdateView (high-level) for full workflow with lock/unlock/activate.

**Source:** `src/handlers/view/low/handleUpdateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `ddl_source` (string, required) - Complete DDL source code. CDS: include @AbapCatalog.sqlViewName and other annotations. Classic: plain 
- `lock_handle` (string, required) - Lock handle from LockObject. Required for update operation.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `skip_check` (boolean, optional) - Skip pre-write syntax check on ddl_source. Default: false. When false, runs a syntax check on the proposed code BEFORE uploading it and surfaces any errors with line numbers — the broken source never lands on SAP.
- `view_name` (string, required) - View name (e.g., ZOK_R_TEST_0002). View must already exist.

---

<a id="validateviewlow-low-level-view"></a>
#### ValidateViewLow (Low-Level / View)
**Description:** [low-level] Validate an ABAP view name before creation. Checks if the name is valid and available. Returns validation result with success status and message. Can use session_id and session_state from GetSession to maintain the same session.

**Source:** `src/handlers/view/low/handleValidateView.ts`

**Available in:** `onprem`, `cloud`, `legacy`

**Parameters:**
- `description` (string, required) - View description. Required for validation.
- `package_name` (string, required) - Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.
- `session_id` (string, optional) - Session ID from GetSession. If not provided, a new session will be created.
- `session_state` (object, optional) - Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.
- `view_name` (string, required) - View name to validate (e.g., Z_MY_PROGRAM).

---

*Last updated: 2026-10-16*
