# ZRFC Backend Setup (SDK-free, SOAP-free, Gateway-free)

The `zrfc` backend exposes the two MCP-required function modules
(`ZMCP_ADT_DISPATCH`, `ZMCP_ADT_TEXTPOOL`) as HTTPS/JSON endpoints
served by a custom ICF handler. Designed for the common ECC / hardened
S/4 situation where:

- **SAP NW RFC SDK is not an option** — paid S-user license, per-host
  install, Visual Studio / GCC toolchain required. Blocks `native` and
  (partially) `gateway`.
- **`/sap/bc/soap/rfc` is closed by company policy** — blocks `soap`.
- **OData Gateway registration is hard on ECC** — no `/IWBEP/REG_SERVICE`
  tooling, no Basis cooperation. Blocks `odata`.

`zrfc` only needs one class + one SICF node on the SAP system.

## Prerequisites

### 1. ABAP objects installed (covered by `/sc4sap:setup` step 9d)

The sc4sap setup wizard installs these automatically when you pick
`SAP_RFC_BACKEND=zrfc`. Manual install:

- **`ZMCP_ADT_UTILS`** function group with `ZMCP_ADT_DISPATCH` +
  `ZMCP_ADT_TEXTPOOL` (same FMs `soap` uses). Source: `abap/zmcp_adt_dispatch.abap`,
  `abap/zmcp_adt_textpool.abap`.
- **`ZCL_MCP_RFC_HTTP_HANDLER`** class. Source: `abap/zcl_mcp_rfc_http_handler.abap`.
  `IF_HTTP_EXTENSION` implementation; routes `/dispatch`, `/textpool`,
  `/call` and handles CSRF.

### 2. SICF node active (manual — MCP cannot automate SICF)

Transaction `SICF`:

```
default_host
  └── sap
       └── bc
            └── rest                       ← activate if inactive
                 └── zmcp_rfc              ← create + activate
                      (Handler List: ZCL_MCP_RFC_HTTP_HANDLER)
                      (Logon Data: default — Basic auth, client-inherited)
```

Right-click → **Activate Service** on the `zmcp_rfc` node (and any
inactive parent in the chain).

### 3. SAP user authorization

The user configured in `.sc4sap/sap.env` (`SAP_USERNAME` / `SAP_PASSWORD`)
needs:

- **`S_ICF`** for service `ZMCP_RFC` (or the standard "anyone can call
  authenticated ICF" policy)
- **`S_RFC`** object with `RFC_NAME = ZMCP_ADT_DISPATCH, ZMCP_ADT_TEXTPOOL`
  (and optionally `RFC_PING` for sanity probes)
- **`S_DEVELOP`** only if the user will invoke operations that write
  source (e.g., `INSERT TEXTPOOL` through `ZMCP_ADT_TEXTPOOL WRITE`)

## Configuration (`.sc4sap/sap.env`)

```env
SAP_URL=https://sap.company.com:44300
SAP_USERNAME=DEVUSER
SAP_PASSWORD=...
SAP_CLIENT=100
SAP_AUTH_TYPE=basic

# --- ZRFC backend ---
SAP_RFC_BACKEND=zrfc
SAP_RFC_ZRFC_BASE_URL=https://sap.company.com:44300/sap/bc/rest/zmcp_rfc
SAP_RFC_ZRFC_CSRF_TTL_SEC=600     # optional, default 600, min 60
```

`SAP_USERNAME` / `SAP_PASSWORD` / `SAP_CLIENT` are reused for Basic Auth
— no separate RFC credentials needed (unlike `native`/`gateway`).

## Verification

### CSRF fetch probe (ICF node + handler active?)

```bash
curl -sSu "$SAP_USERNAME:$SAP_PASSWORD" \
  -H "X-CSRF-Token: Fetch" \
  -o /dev/null -w "status=%{http_code} token=%header{x-csrf-token}\n" \
  "$SAP_RFC_ZRFC_BASE_URL/dispatch?sap-client=$SAP_CLIENT"
```

Expected: `status=200 token=<32-char-uuid>`.

### End-to-end dispatch probe (FMs installed + deny list wired?)

```bash
# 1) Fetch token + cookie
RESPONSE=$(curl -sSu "$SAP_USERNAME:$SAP_PASSWORD" \
  -H "X-CSRF-Token: Fetch" -D - \
  "$SAP_RFC_ZRFC_BASE_URL/dispatch?sap-client=$SAP_CLIENT")
TOKEN=$(echo "$RESPONSE" | grep -i "^x-csrf-token:" | cut -d' ' -f2 | tr -d '\r')
COOKIE=$(echo "$RESPONSE" | grep -i "^set-cookie:" | head -1 | cut -d' ' -f2 | cut -d';' -f1)

# 2) Call /dispatch with CUA_FETCH on a standard program
curl -sSu "$SAP_USERNAME:$SAP_PASSWORD" \
  -H "X-CSRF-Token: $TOKEN" -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"action":"CUA_FETCH","params":"{\"program\":\"RSPARAM\"}"}' \
  "$SAP_RFC_ZRFC_BASE_URL/dispatch?sap-client=$SAP_CLIENT"
```

Expected: HTTP 200 + JSON `{result:"...",subrc:0,message:""}`.

### Deny list check

```bash
# Re-using token + cookie from above
curl -sSu "$SAP_USERNAME:$SAP_PASSWORD" \
  -H "X-CSRF-Token: $TOKEN" -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -w "\nstatus=%{http_code}\n" \
  -d '{"fm":"SXPG_CALL_SYSTEM","params":{}}' \
  "$SAP_RFC_ZRFC_BASE_URL/call?sap-client=$SAP_CLIENT"
```

Expected: `status=403` + JSON `{"error":"... deny list ..."}`.

## Troubleshooting

| Symptom | Root cause | Fix |
|---|---|---|
| `404 Not Found` on CSRF probe | SICF node inactive or URL wrong | `SICF` → navigate to `/default_host/sap/bc/rest/zmcp_rfc` → Activate Service |
| `401 Unauthorized` | Basic auth failed | Check `SAP_USERNAME`/`SAP_PASSWORD` in `sap.env`; verify user is unlocked + valid in client |
| `500 Internal Server Error` on dispatch | `ZMCP_ADT_DISPATCH` / `ZMCP_ADT_TEXTPOOL` missing or inactive | Run `/sc4sap:setup` Step 9a or manually recreate from `abap/*.abap` |
| Empty `X-CSRF-Token` response header | Handler class not activated | `SE24` → `ZCL_MCP_RFC_HTTP_HANDLER` → check active version → Activate |
| `403 "CSRF Token Required"` on every POST | Cookie stripped by reverse proxy | Verify the proxy/WAF preserves `Set-Cookie` on GET responses and `Cookie` on POST requests |
| `403 "... deny list ..."` on legitimate FM | FM hardcoded in `gt_deny_list` | Edit `ZCL_MCP_RFC_HTTP_HANDLER->class_constructor`, remove the line, activate, transport |

## Managing the deny list

The deny list is deliberately **hardcoded** in
`ZCL_MCP_RFC_HTTP_HANDLER->class_constructor` (not a DDIC table):

```abap
METHOD class_constructor.
  APPEND 'RFC_ABAP_INSTALL_AND_RUN'  TO gt_deny_list.
  APPEND 'SXPG_CALL_SYSTEM'          TO gt_deny_list.
  " ...
ENDMETHOD.
```

**Why**: a DDIC table would let any `SM30`-authorized user remove entries
and bypass the control at runtime. Source-level enforcement requires a
transport request and code review to change.

To add an entry: edit the class, activate, include in a transport. To
remove one (e.g., you legitimately need `BAPI_USER_LOCK` for a tooling
workflow): same — edit + activate + transport.

## See also

- [`../../abap/zcl_mcp_rfc_http_handler.abap`](../../abap/zcl_mcp_rfc_http_handler.abap) — class source
- [`../../src/lib/zrfcProxy.ts`](../../src/lib/zrfcProxy.ts) — Node client (CSRF handshake, cache, retry)
- [`RFC_SETUP.md`](./RFC_SETUP.md) — `native` backend (for comparison)
- [`../user-guide/CLIENT_CONFIGURATION.md`](../user-guide/CLIENT_CONFIGURATION.md) — all backend comparison
