*&---------------------------------------------------------------------*
*& Class ZCL_MCP_RFC_HTTP_HANDLER
*&---------------------------------------------------------------------*
*& HTTP/REST handler for the `zrfc` MCP backend.
*&
*& Exposes the two MCP-required RFC function modules as HTTPS/JSON
*& endpoints so the MCP server (abap-mcp-adt-powerup) can operate
*& WITHOUT any of:
*&   - SAP NW RFC SDK on the developer's host
*&   - /sap/bc/soap/rfc ICF node (closed at many Korean customers)
*&   - OData Gateway registration (hard on ECC)
*&
*& SICF mount:  /default_host/sap/bc/rest/zmcp_rfc
*& Handler:     this class (IF_HTTP_EXTENSION~HANDLE_REQUEST)
*&
*& Endpoints (POST only, Basic Auth + CSRF token required):
*&   POST /sap/bc/rest/zmcp_rfc/dispatch
*&        body: {"action":"...", "params":"<JSON string>"}
*&        → CALL FUNCTION 'ZMCP_ADT_DISPATCH'
*&
*&   POST /sap/bc/rest/zmcp_rfc/textpool
*&        body: {"action":"...", "program":"...", "language":"...", "textpoolJson":"..."}
*&        → CALL FUNCTION 'ZMCP_ADT_TEXTPOOL'
*&
*&   POST /sap/bc/rest/zmcp_rfc/call
*&        body: {"fm":"...", "params":{...}}
*&        → deny-list check → FUNCTION_EXISTS → dynamic CALL FUNCTION
*&          (stub: returns 501 until generic invocation is implemented)
*&
*& CSRF handshake (double-submit cookie, stateless):
*&   GET  /...  with header "X-CSRF-Token: Fetch"
*&     → 200 + response header "X-CSRF-Token: <uuid>"
*&       + Set-Cookie "zrfc_csrf=<same-uuid>; Path=/sap/bc/rest/zmcp_rfc"
*&   POST /... with header "X-CSRF-Token: <uuid>" + the cookie above
*&     → handler compares header = cookie; mismatch → 403
*&
*& Deny list is HARDCODED in class_constructor (below). Rationale:
*&   a DDIC table would let any SM30-authorized user remove entries and
*&   bypass controls. Source-level deny list is trust-worthy and requires
*&   a transport to change, matching the security posture of the rest of
*&   the MCP utility package.
*&---------------------------------------------------------------------*
CLASS zcl_mcp_rfc_http_handler DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_http_extension.

    CLASS-METHODS class_constructor.

  PRIVATE SECTION.
    CLASS-DATA gt_deny_list TYPE STANDARD TABLE OF string WITH EMPTY KEY.

    METHODS:
      route
        IMPORTING server TYPE REF TO if_http_server,

      handle_csrf_preflight
        IMPORTING server TYPE REF TO if_http_server,

      handle_dispatch
        IMPORTING server TYPE REF TO if_http_server,

      handle_textpool
        IMPORTING server TYPE REF TO if_http_server,

      handle_call
        IMPORTING server TYPE REF TO if_http_server,

      is_fm_denied
        IMPORTING iv_fm           TYPE string
        RETURNING VALUE(rv_denied) TYPE abap_bool,

      verify_csrf
        IMPORTING server       TYPE REF TO if_http_server
        RETURNING VALUE(rv_ok) TYPE abap_bool,

      send_json
        IMPORTING server  TYPE REF TO if_http_server
                  iv_code TYPE i
                  iv_json TYPE string,

      send_error
        IMPORTING server    TYPE REF TO if_http_server
                  iv_code   TYPE i
                  iv_reason TYPE string
                  iv_error  TYPE string,

      json_escape
        IMPORTING iv_in         TYPE string
        RETURNING VALUE(rv_out) TYPE string.

ENDCLASS.


CLASS zcl_mcp_rfc_http_handler IMPLEMENTATION.

  METHOD class_constructor.
    " Hardcoded deny list — see class header for rationale.
    " Diagnostic-only FMs (RFC_PING, RFC_SYSTEM_INFO) are NOT denied.
    APPEND 'RFC_ABAP_INSTALL_AND_RUN'  TO gt_deny_list.
    APPEND 'SXPG_CALL_SYSTEM'          TO gt_deny_list.
    APPEND 'SXPG_COMMAND_EXECUTE'      TO gt_deny_list.
    APPEND 'SXPG_COMMAND_EXECUTE_LONG' TO gt_deny_list.
    APPEND 'DB_EXECUTE_SQL'            TO gt_deny_list.
    APPEND 'TH_GREP'                   TO gt_deny_list.
    APPEND 'TH_FILE_DELETE'            TO gt_deny_list.
    APPEND 'TH_FILE_WRITE'             TO gt_deny_list.
    APPEND 'BAPI_USER_CREATE1'         TO gt_deny_list.
    APPEND 'BAPI_USER_CHANGE'          TO gt_deny_list.
    APPEND 'BAPI_USER_DELETE'          TO gt_deny_list.
    APPEND 'BAPI_USER_LOCK'            TO gt_deny_list.
    APPEND 'BAPI_USER_UNLOCK'          TO gt_deny_list.
  ENDMETHOD.


  METHOD if_http_extension~handle_request.
    route( server ).
  ENDMETHOD.


  METHOD route.
    DATA(lv_method) = server->request->get_method( ).
    DATA(lv_path)   = server->request->get_header_field( name = '~path_info' ).

    TRANSLATE lv_path TO LOWER CASE.

    " ---- CSRF preflight: any GET carrying "X-CSRF-Token: Fetch" ----
    IF lv_method = if_http_request=>co_request_method_get.
      handle_csrf_preflight( server ).
      RETURN.
    ENDIF.

    " ---- All mutating methods must carry a valid CSRF token ----
    IF verify_csrf( server ) = abap_false.
      send_error( server    = server
                  iv_code   = 403
                  iv_reason = 'CSRF Token Required'
                  iv_error  = 'Missing or mismatched X-CSRF-Token header/cookie' ).
      RETURN.
    ENDIF.

    " ---- Route by path suffix ----
    IF lv_path CS '/dispatch'.
      handle_dispatch( server ).
    ELSEIF lv_path CS '/textpool'.
      handle_textpool( server ).
    ELSEIF lv_path CS '/call'.
      handle_call( server ).
    ELSE.
      send_error( server    = server
                  iv_code   = 404
                  iv_reason = 'Not Found'
                  iv_error  = |Unknown endpoint: { lv_path }| ).
    ENDIF.
  ENDMETHOD.


  METHOD handle_csrf_preflight.
    DATA(lv_req) = server->request->get_header_field( 'X-CSRF-Token' ).
    TRANSLATE lv_req TO LOWER CASE.

    IF lv_req = 'fetch'.
      DATA lv_token TYPE string.
      lv_token = cl_system_uuid=>create_uuid_c32_static( ).
      server->response->set_header_field( name = 'X-CSRF-Token' value = lv_token ).
      server->response->set_cookie(
        name  = 'zrfc_csrf'
        value = lv_token
        path  = '/sap/bc/rest/zmcp_rfc' ).
      server->response->set_status( code = 200 reason = 'OK' ).
      RETURN.
    ENDIF.

    " Plain GET — return a short identity/health payload
    send_json( server  = server
               iv_code = 200
               iv_json = '{"service":"zrfc","status":"ok"}' ).
  ENDMETHOD.


  METHOD verify_csrf.
    DATA: lv_hdr_token    TYPE string,
          lv_cookie_token TYPE string.

    lv_hdr_token = server->request->get_header_field( 'X-CSRF-Token' ).

    " Some releases ship `get_cookie` without a RETURNING parameter —
    " use the EXPORTING/IMPORTING signature which is portable.
    server->request->get_cookie(
      EXPORTING name  = 'zrfc_csrf'
      IMPORTING value = lv_cookie_token ).

    rv_ok = xsdbool( lv_hdr_token IS NOT INITIAL
                 AND lv_cookie_token IS NOT INITIAL
                 AND lv_hdr_token = lv_cookie_token ).
  ENDMETHOD.


  METHOD handle_dispatch.
    TYPES: BEGIN OF ty_req,
             action TYPE string,
             params TYPE string,
           END OF ty_req.
    TYPES: BEGIN OF ty_resp,
             result  TYPE string,
             subrc   TYPE i,
             message TYPE string,
           END OF ty_resp.

    DATA: ls_req  TYPE ty_req,
          ls_resp TYPE ty_resp.

    TRY.
        DATA(lv_body) = server->request->get_cdata( ).
        /ui2/cl_json=>deserialize(
          EXPORTING json        = lv_body
                    pretty_name = /ui2/cl_json=>pretty_mode-camel_case
          CHANGING  data        = ls_req ).

        CALL FUNCTION 'ZMCP_ADT_DISPATCH'
          EXPORTING
            iv_action  = ls_req-action
            iv_params  = ls_req-params
          IMPORTING
            ev_subrc   = ls_resp-subrc
            ev_message = ls_resp-message
            ev_result  = ls_resp-result.

        DATA(lv_json) = /ui2/cl_json=>serialize(
                          data        = ls_resp
                          pretty_name = /ui2/cl_json=>pretty_mode-camel_case ).

        send_json( server = server iv_code = 200 iv_json = lv_json ).

      CATCH cx_root INTO DATA(lx).
        send_error( server    = server
                    iv_code   = 500
                    iv_reason = 'Internal Error'
                    iv_error  = lx->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD handle_textpool.
    TYPES: BEGIN OF ty_req,
             action        TYPE string,
             program       TYPE string,
             language      TYPE string,
             textpool_json TYPE string,
           END OF ty_req.
    TYPES: BEGIN OF ty_resp,
             result  TYPE string,
             subrc   TYPE i,
             message TYPE string,
           END OF ty_resp.

    DATA: ls_req  TYPE ty_req,
          ls_resp TYPE ty_resp.

    TRY.
        DATA(lv_body) = server->request->get_cdata( ).
        /ui2/cl_json=>deserialize(
          EXPORTING json        = lv_body
                    pretty_name = /ui2/cl_json=>pretty_mode-camel_case
          CHANGING  data        = ls_req ).

        CALL FUNCTION 'ZMCP_ADT_TEXTPOOL'
          EXPORTING
            iv_action        = ls_req-action
            iv_program       = ls_req-program
            iv_language      = ls_req-language
            iv_textpool_json = ls_req-textpool_json
          IMPORTING
            ev_subrc   = ls_resp-subrc
            ev_message = ls_resp-message
            ev_result  = ls_resp-result.

        DATA(lv_json) = /ui2/cl_json=>serialize(
                          data        = ls_resp
                          pretty_name = /ui2/cl_json=>pretty_mode-camel_case ).

        send_json( server = server iv_code = 200 iv_json = lv_json ).

      CATCH cx_root INTO DATA(lx).
        send_error( server    = server
                    iv_code   = 500
                    iv_reason = 'Internal Error'
                    iv_error  = lx->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD handle_call.
    TYPES: BEGIN OF ty_req,
             fm TYPE string,
           END OF ty_req.

    DATA ls_req TYPE ty_req.

    TRY.
        DATA(lv_body) = server->request->get_cdata( ).
        /ui2/cl_json=>deserialize(
          EXPORTING json        = lv_body
                    pretty_name = /ui2/cl_json=>pretty_mode-camel_case
          CHANGING  data        = ls_req ).

        TRANSLATE ls_req-fm TO UPPER CASE.

        IF ls_req-fm IS INITIAL.
          send_error( server    = server
                      iv_code   = 400
                      iv_reason = 'Bad Request'
                      iv_error  = 'Missing "fm" field in request body' ).
          RETURN.
        ENDIF.

        " Security gate: deny list
        IF is_fm_denied( ls_req-fm ) = abap_true.
          send_error( server    = server
                      iv_code   = 403
                      iv_reason = 'FM Denied'
                      iv_error  = |Function module '{ ls_req-fm }' is on the deny list| ).
          RETURN.
        ENDIF.

        " Security gate: FM must exist
        CALL FUNCTION 'FUNCTION_EXISTS'
          EXPORTING
            funcname           = CONV rs38l-name( ls_req-fm )
          EXCEPTIONS
            function_not_exist = 1
            OTHERS             = 2.
        IF sy-subrc <> 0.
          send_error( server    = server
                      iv_code   = 404
                      iv_reason = 'FM Not Found'
                      iv_error  = |Function module '{ ls_req-fm }' does not exist| ).
          RETURN.
        ENDIF.

        " MVP stub: dynamic parameter marshalling is TBD.
        " The routing + deny list + existence checks above are fully wired,
        " so the MVP can be upgraded by replacing just this branch.
        send_error( server    = server
                    iv_code   = 501
                    iv_reason = 'Not Implemented'
                    iv_error  = |Generic /call is a stub. Use /dispatch or /textpool. Dynamic invocation of '{ ls_req-fm }' is not yet implemented.| ).

      CATCH cx_root INTO DATA(lx).
        send_error( server    = server
                    iv_code   = 500
                    iv_reason = 'Internal Error'
                    iv_error  = lx->get_text( ) ).
    ENDTRY.
  ENDMETHOD.


  METHOD is_fm_denied.
    rv_denied = xsdbool( line_exists( gt_deny_list[ table_line = iv_fm ] ) ).
  ENDMETHOD.


  METHOD send_json.
    server->response->set_status( code = iv_code reason = 'OK' ).
    server->response->set_header_field(
      name  = 'Content-Type'
      value = 'application/json; charset=utf-8' ).
    server->response->set_cdata( data = iv_json ).
  ENDMETHOD.


  METHOD send_error.
    DATA(lv_safe) = json_escape( iv_error ).
    DATA(lv_json) = |\{"error":"{ lv_safe }"\}|.

    server->response->set_status( code = iv_code reason = iv_reason ).
    server->response->set_header_field(
      name  = 'Content-Type'
      value = 'application/json; charset=utf-8' ).

    IF iv_code = 403 AND iv_reason CS 'CSRF'.
      server->response->set_header_field( name = 'X-CSRF-Token' value = 'Required' ).
    ENDIF.

    server->response->set_cdata( data = lv_json ).
  ENDMETHOD.


  METHOD json_escape.
    rv_out = iv_in.
    REPLACE ALL OCCURRENCES OF '\' IN rv_out WITH '\\'.
    REPLACE ALL OCCURRENCES OF '"' IN rv_out WITH '\"'.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>cr_lf   IN rv_out WITH '\n'.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>newline IN rv_out WITH '\n'.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>horizontal_tab IN rv_out WITH '\t'.
  ENDMETHOD.

ENDCLASS.
