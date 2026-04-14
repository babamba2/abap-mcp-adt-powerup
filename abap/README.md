# ABAP Function Modules for MCP ADT

This directory contains ABAP source code for the `ZMCP_ADT_UTILS` function group, required by the `mcp-abap-adt` MCP server for Screen, GUI Status, and Text Element operations.

## Function Group: ZMCP_ADT_UTILS

### ZMCP_ADT_DISPATCH
JSON-based dispatcher for Screen (Dynpro) and GUI Status (CUA) operations.

**Interface:**
| Parameter | Type | Direction | Description |
|-----------|------|-----------|-------------|
| IV_ACTION | STRING | Import | Action: DYNPRO_INSERT, DYNPRO_READ, DYNPRO_DELETE, CUA_FETCH, CUA_WRITE, CUA_DELETE |
| IV_PARAMS | STRING | Import | JSON string with action-specific parameters |
| EV_SUBRC | I | Export | Return code (0 = success) |
| EV_MESSAGE | STRING | Export | Error/info message |
| EV_RESULT | STRING | Export | JSON string with result data |

### ZMCP_ADT_TEXTPOOL
Dedicated text pool (text elements) read/write function.

**Interface:**
| Parameter | Type | Direction | Description |
|-----------|------|-----------|-------------|
| IV_ACTION | STRING | Import | Action: READ or WRITE |
| IV_PROGRAM | STRING | Import | ABAP program name |
| IV_LANGUAGE | STRING | Import | Language key (1 char, defaults to logon language) |
| IV_TEXTPOOL_JSON | STRING | Import | JSON array of text pool rows (for WRITE) |
| EV_SUBRC | I | Export | Return code (0 = success) |
| EV_MESSAGE | STRING | Export | Error/info message |
| EV_RESULT | STRING | Export | JSON result (array of rows for READ) |

## Installation

These are automatically created during `/sc4sap:setup` (step after MCP connection check).
The setup uses `CreateFunctionGroup` and `CreateFunctionModule` MCP tools followed by `UpdateFunctionModule` to set the source code.

## Requirements
- `/UI2/CL_JSON` must be available (standard in S/4HANA and ECC 7.40+)
- Both function modules must be **RFC-enabled**
- Package: `$TMP` (local) or transportable Z-package
