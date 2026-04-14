FUNCTION zmcp_adt_dispatch.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(IV_ACTION) TYPE  STRING
*"     VALUE(IV_PARAMS) TYPE  STRING
*"  EXPORTING
*"     VALUE(EV_SUBRC) TYPE  I
*"     VALUE(EV_MESSAGE) TYPE  STRING
*"     VALUE(EV_RESULT) TYPE  STRING
*"----------------------------------------------------------------------
* ZMCP_ADT_DISPATCH - JSON-based dispatcher for Screen/GUI Status operations
* Called via SOAP RFC from mcp-abap-adt MCP server.
*
* Supported actions:
*   DYNPRO_INSERT  - Create screen (RPY_DYNPRO_INSERT)
*   DYNPRO_READ    - Read screen (RPY_DYNPRO_READ)
*   DYNPRO_DELETE  - Delete screen (RPY_DYNPRO_DELETE)
*   CUA_FETCH      - Read GUI status (RS_CUA_INTERNAL_FETCH)
*   CUA_WRITE      - Write GUI status (RS_CUA_INTERNAL_WRITE)
*   CUA_DELETE      - Delete GUI status (RS_CUA_DELETE)
*----------------------------------------------------------------------

  DATA: lv_json    TYPE string,
        lv_program TYPE syrepid,
        lv_dynpro  TYPE sydynnr.

* Parse common params from JSON
  DATA(lo_params) = /ui2/cl_json=>generate( json = iv_params ).

  CLEAR: ev_subrc, ev_message, ev_result.

  TRY.
      CASE iv_action.

*------ DYNPRO (Screen) operations ------
        WHEN 'DYNPRO_INSERT'.
          PERFORM dynpro_insert USING iv_params
                                CHANGING ev_subrc ev_message ev_result.

        WHEN 'DYNPRO_READ'.
          PERFORM dynpro_read USING iv_params
                              CHANGING ev_subrc ev_message ev_result.

        WHEN 'DYNPRO_DELETE'.
          PERFORM dynpro_delete USING iv_params
                                CHANGING ev_subrc ev_message ev_result.

*------ CUA (GUI Status) operations ------
        WHEN 'CUA_FETCH'.
          PERFORM cua_fetch USING iv_params
                            CHANGING ev_subrc ev_message ev_result.

        WHEN 'CUA_WRITE'.
          PERFORM cua_write USING iv_params
                            CHANGING ev_subrc ev_message ev_result.

        WHEN 'CUA_DELETE'.
          PERFORM cua_delete USING iv_params
                             CHANGING ev_subrc ev_message ev_result.

        WHEN OTHERS.
          ev_subrc = 4.
          ev_message = |Unknown action: { iv_action }|.
      ENDCASE.

    CATCH cx_root INTO DATA(lx_root).
      ev_subrc = 8.
      ev_message = lx_root->get_text( ).
  ENDTRY.

ENDFUNCTION.


*&---------------------------------------------------------------------*
*& Form DYNPRO_INSERT
*&---------------------------------------------------------------------*
FORM dynpro_insert USING iv_params TYPE string
                   CHANGING ev_subrc TYPE i
                            ev_message TYPE string
                            ev_result TYPE string.

  TYPES: BEGIN OF ty_flow_line,
           line TYPE string,
         END OF ty_flow_line.

  DATA: ls_header     TYPE rpy_dyhead,
        lt_containers TYPE TABLE OF rpy_dycatt,
        lt_fields     TYPE TABLE OF rpy_dyfield,
        lt_flow_src   TYPE swbse_max_line_tab,
        lt_params     TYPE abap_trans_srcbind_tab.

* Deserialize JSON to get dynpro_data
  DATA: lv_program    TYPE string,
        lv_dynpro     TYPE string,
        lv_dynpro_data TYPE string.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = DATA(ls_params_raw) ).

* Extract parameters from JSON
  DATA(lo_json) = /ui2/cl_json=>generate( json = iv_params ).
  DATA(lo_map) = CAST /ui2/cl_abap_json_stringer( lo_json ).

  FIELD-SYMBOLS: <program> TYPE any,
                 <dynpro>  TYPE any,
                 <data>    TYPE any.

  DATA: BEGIN OF ls_input,
          program     TYPE string,
          dynpro      TYPE string,
          dynpro_data TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

  lv_program = to_upper( ls_input-program ).
  lv_dynpro  = ls_input-dynpro.

* Parse dynpro_data JSON into ABAP structures
  DATA: BEGIN OF ls_dynpro,
          header              TYPE rpy_dyhead,
          containers          TYPE TABLE OF rpy_dycatt WITH DEFAULT KEY,
          fields_to_containers TYPE TABLE OF rpy_dyfield WITH DEFAULT KEY,
        END OF ls_dynpro.

  DATA: lt_flow_logic TYPE TABLE OF ty_flow_line WITH DEFAULT KEY.

  DATA: BEGIN OF ls_dynpro_full,
          header              TYPE rpy_dyhead,
          containers          TYPE TABLE OF rpy_dycatt WITH DEFAULT KEY,
          fields_to_containers TYPE TABLE OF rpy_dyfield WITH DEFAULT KEY,
          flow_logic          TYPE TABLE OF ty_flow_line WITH DEFAULT KEY,
        END OF ls_dynpro_full.

  /ui2/cl_json=>deserialize(
    EXPORTING json = ls_input-dynpro_data
    CHANGING  data = ls_dynpro_full ).

  ls_header = ls_dynpro_full-header.
  lt_containers = ls_dynpro_full-containers.
  lt_fields = ls_dynpro_full-fields_to_containers.

* Build flow logic source
  DATA(lt_flow) = VALUE swbse_max_line_tab(
    FOR ls_fl IN ls_dynpro_full-flow_logic
    ( ls_fl-line ) ).

  CALL FUNCTION 'RPY_DYNPRO_INSERT'
    EXPORTING
      header                 = ls_header
      suppress_exist_checks  = abap_true
    TABLES
      containers             = lt_containers
      fields_to_containers   = lt_fields
      flow_logic             = lt_flow
    EXCEPTIONS
      already_exists         = 1
      cancelled              = 2
      permission_error       = 3
      name_not_allowed       = 4
      not_found              = 5
      OTHERS                 = 6.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RPY_DYNPRO_INSERT failed (sy-subrc={ sy-subrc })|.
  ELSE.
    ev_message = |Screen { lv_program }/{ lv_dynpro } created|.
    ev_result = '{}'.
  ENDIF.

ENDFORM.


*&---------------------------------------------------------------------*
*& Form DYNPRO_READ
*&---------------------------------------------------------------------*
FORM dynpro_read USING iv_params TYPE string
                 CHANGING ev_subrc TYPE i
                          ev_message TYPE string
                          ev_result TYPE string.

  DATA: BEGIN OF ls_input,
          program TYPE string,
          dynpro  TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

  DATA: ls_header   TYPE rpy_dyhead,
        lt_cont     TYPE TABLE OF rpy_dycatt,
        lt_fields   TYPE TABLE OF rpy_dyfield,
        lt_flow     TYPE swbse_max_line_tab.

  CALL FUNCTION 'RPY_DYNPRO_READ'
    EXPORTING
      progname             = CONV syrepid( to_upper( ls_input-program ) )
      dynnr                = CONV sydynnr( ls_input-dynpro )
    IMPORTING
      header               = ls_header
    TABLES
      containers           = lt_cont
      fields_to_containers = lt_fields
      flow_logic           = lt_flow
    EXCEPTIONS
      cancelled            = 1
      not_found            = 2
      permission_error     = 3
      OTHERS               = 4.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RPY_DYNPRO_READ failed (sy-subrc={ sy-subrc })|.
  ELSE.
    DATA: BEGIN OF ls_result,
            header              TYPE rpy_dyhead,
            containers          TYPE TABLE OF rpy_dycatt WITH DEFAULT KEY,
            fields_to_containers TYPE TABLE OF rpy_dyfield WITH DEFAULT KEY,
            flow_logic          TYPE swbse_max_line_tab,
          END OF ls_result.
    ls_result-header = ls_header.
    ls_result-containers = lt_cont.
    ls_result-fields_to_containers = lt_fields.
    ls_result-flow_logic = lt_flow.
    ev_result = /ui2/cl_json=>serialize( data = ls_result ).
    ev_message = 'OK'.
  ENDIF.

ENDFORM.


*&---------------------------------------------------------------------*
*& Form DYNPRO_DELETE
*&---------------------------------------------------------------------*
FORM dynpro_delete USING iv_params TYPE string
                   CHANGING ev_subrc TYPE i
                            ev_message TYPE string
                            ev_result TYPE string.

  DATA: BEGIN OF ls_input,
          program TYPE string,
          dynpro  TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

  CALL FUNCTION 'RPY_DYNPRO_DELETE'
    EXPORTING
      progname       = CONV syrepid( to_upper( ls_input-program ) )
      dynnr          = CONV sydynnr( ls_input-dynpro )
    EXCEPTIONS
      cancelled      = 1
      not_found      = 2
      permission_error = 3
      OTHERS         = 4.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RPY_DYNPRO_DELETE failed (sy-subrc={ sy-subrc })|.
  ELSE.
    ev_message = |Screen { ls_input-program }/{ ls_input-dynpro } deleted|.
    ev_result = '{}'.
  ENDIF.

ENDFORM.


*&---------------------------------------------------------------------*
*& Form CUA_FETCH
*&---------------------------------------------------------------------*
FORM cua_fetch USING iv_params TYPE string
               CHANGING ev_subrc TYPE i
                        ev_message TYPE string
                        ev_result TYPE string.

  DATA: BEGIN OF ls_input,
          program TYPE string,
          language TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

  DATA: ls_adm    TYPE rsmpe_adm,
        lt_sta    TYPE TABLE OF rsmpe_stat,
        lt_fun    TYPE TABLE OF rsmpe_funt,
        lt_men    TYPE TABLE OF rsmpe_men,
        lt_mtx    TYPE TABLE OF rsmpe_mnlt,
        lt_act    TYPE TABLE OF rsmpe_act,
        lt_but    TYPE TABLE OF rsmpe_but,
        lt_pfk    TYPE TABLE OF rsmpe_pfk,
        lt_set    TYPE TABLE OF rsmpe_staf,
        lt_doc    TYPE TABLE OF rsmpe_atrt,
        lt_tit    TYPE TABLE OF rsmpe_tit,
        lt_biv    TYPE TABLE OF rsmpe_buts.

  DATA: lv_lang TYPE sy-langu.
  IF ls_input-language IS NOT INITIAL.
    lv_lang = ls_input-language(1).
  ELSE.
    lv_lang = sy-langu.
  ENDIF.

  CALL FUNCTION 'RS_CUA_INTERNAL_FETCH'
    EXPORTING
      program         = CONV syrepid( to_upper( ls_input-program ) )
      language        = lv_lang
      state           = 'A'
    IMPORTING
      adm             = ls_adm
    TABLES
      sta             = lt_sta
      fun             = lt_fun
      men             = lt_men
      mtx             = lt_mtx
      act             = lt_act
      but             = lt_but
      pfk             = lt_pfk
      set             = lt_set
      doc             = lt_doc
      tit             = lt_tit
      biv             = lt_biv
    EXCEPTIONS
      not_found       = 1
      unknown_version = 2
      OTHERS          = 3.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RS_CUA_INTERNAL_FETCH failed (sy-subrc={ sy-subrc })|.
  ELSE.
    DATA: BEGIN OF ls_result,
            adm TYPE rsmpe_adm,
            sta TYPE TABLE OF rsmpe_stat WITH DEFAULT KEY,
            fun TYPE TABLE OF rsmpe_funt WITH DEFAULT KEY,
            men TYPE TABLE OF rsmpe_men WITH DEFAULT KEY,
            mtx TYPE TABLE OF rsmpe_mnlt WITH DEFAULT KEY,
            act TYPE TABLE OF rsmpe_act WITH DEFAULT KEY,
            but TYPE TABLE OF rsmpe_but WITH DEFAULT KEY,
            pfk TYPE TABLE OF rsmpe_pfk WITH DEFAULT KEY,
            set TYPE TABLE OF rsmpe_staf WITH DEFAULT KEY,
            doc TYPE TABLE OF rsmpe_atrt WITH DEFAULT KEY,
            tit TYPE TABLE OF rsmpe_tit WITH DEFAULT KEY,
            biv TYPE TABLE OF rsmpe_buts WITH DEFAULT KEY,
          END OF ls_result.
    ls_result-adm = ls_adm.
    ls_result-sta = lt_sta.
    ls_result-fun = lt_fun.
    ls_result-men = lt_men.
    ls_result-mtx = lt_mtx.
    ls_result-act = lt_act.
    ls_result-but = lt_but.
    ls_result-pfk = lt_pfk.
    ls_result-set = lt_set.
    ls_result-doc = lt_doc.
    ls_result-tit = lt_tit.
    ls_result-biv = lt_biv.
    ev_result = /ui2/cl_json=>serialize( data = ls_result ).
    ev_message = 'OK'.
  ENDIF.

ENDFORM.


*&---------------------------------------------------------------------*
*& Form CUA_WRITE
*&---------------------------------------------------------------------*
FORM cua_write USING iv_params TYPE string
               CHANGING ev_subrc TYPE i
                        ev_message TYPE string
                        ev_result TYPE string.

  DATA: BEGIN OF ls_input,
          program  TYPE string,
          language TYPE string,
          cua_data TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

* Deserialize CUA data from JSON
  DATA: BEGIN OF ls_cua,
          adm TYPE rsmpe_adm,
          sta TYPE TABLE OF rsmpe_stat WITH DEFAULT KEY,
          fun TYPE TABLE OF rsmpe_funt WITH DEFAULT KEY,
          men TYPE TABLE OF rsmpe_men WITH DEFAULT KEY,
          mtx TYPE TABLE OF rsmpe_mnlt WITH DEFAULT KEY,
          act TYPE TABLE OF rsmpe_act WITH DEFAULT KEY,
          but TYPE TABLE OF rsmpe_but WITH DEFAULT KEY,
          pfk TYPE TABLE OF rsmpe_pfk WITH DEFAULT KEY,
          set TYPE TABLE OF rsmpe_staf WITH DEFAULT KEY,
          doc TYPE TABLE OF rsmpe_atrt WITH DEFAULT KEY,
          tit TYPE TABLE OF rsmpe_tit WITH DEFAULT KEY,
          biv TYPE TABLE OF rsmpe_buts WITH DEFAULT KEY,
        END OF ls_cua.

  /ui2/cl_json=>deserialize(
    EXPORTING json = ls_input-cua_data
    CHANGING  data = ls_cua ).

  DATA: lv_lang TYPE sy-langu.
  IF ls_input-language IS NOT INITIAL.
    lv_lang = ls_input-language(1).
  ELSE.
    lv_lang = sy-langu.
  ENDIF.

  CALL FUNCTION 'RS_CUA_INTERNAL_WRITE'
    EXPORTING
      program   = CONV syrepid( to_upper( ls_input-program ) )
      language  = lv_lang
      adm       = ls_cua-adm
      state     = 'A'
    TABLES
      sta       = ls_cua-sta
      fun       = ls_cua-fun
      men       = ls_cua-men
      mtx       = ls_cua-mtx
      act       = ls_cua-act
      but       = ls_cua-but
      pfk       = ls_cua-pfk
      set       = ls_cua-set
      doc       = ls_cua-doc
      tit       = ls_cua-tit
      biv       = ls_cua-biv
    EXCEPTIONS
      not_found       = 1
      unknown_version = 2
      OTHERS          = 3.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RS_CUA_INTERNAL_WRITE failed (sy-subrc={ sy-subrc })|.
  ELSE.
    ev_message = |CUA written for { ls_input-program }|.
    ev_result = '{"written":true}'.
  ENDIF.

ENDFORM.


*&---------------------------------------------------------------------*
*& Form CUA_DELETE
*&---------------------------------------------------------------------*
FORM cua_delete USING iv_params TYPE string
                CHANGING ev_subrc TYPE i
                         ev_message TYPE string
                         ev_result TYPE string.

  DATA: BEGIN OF ls_input,
          program TYPE string,
          status  TYPE string,
        END OF ls_input.

  /ui2/cl_json=>deserialize(
    EXPORTING json = iv_params
    CHANGING  data = ls_input ).

  CALL FUNCTION 'RS_CUA_DELETE'
    EXPORTING
      report     = CONV syrepid( to_upper( ls_input-program ) )
    EXCEPTIONS
      not_found  = 1
      OTHERS     = 2.

  ev_subrc = sy-subrc.
  IF sy-subrc <> 0.
    ev_message = |RS_CUA_DELETE failed (sy-subrc={ sy-subrc })|.
  ELSE.
    ev_message = |CUA deleted for { ls_input-program }|.
    ev_result = '{"deleted":true}'.
  ENDIF.

ENDFORM.
