*"----------------------------------------------------------------------
*" Function Module : ZMCP_ADT_TEXTPOOL
*" Function Group  : ZMCP_ADT_UTILS
*" Description     : Read/write ABAP program text pool (TEXTPOOL) via
*"                   SOAP RFC. Sibling of ZMCP_ADT_DISPATCH — dedicated
*"                   to text elements (text symbols, selection texts,
*"                   program title, list headings) because text pool
*"                   has no ADT URI and cannot be edited from REST.
*"
*" Interface:
*"   IV_ACTION         'READ' | 'WRITE'
*"   IV_PROGRAM        Program / include name
*"   IV_LANGUAGE       Language key (defaults to SY-LANGU when empty)
*"   IV_TEXTPOOL_JSON  JSON array of TEXTPOOL rows (for WRITE)
*"
*"   EV_RESULT         JSON array (READ) or '{"written":true}' (WRITE)
*"   EV_SUBRC          0 on success, non-zero on failure
*"   EV_MESSAGE        Error/info text
*"
*" Attribute: must be flagged as Remote-Enabled Module (SE37 →
*"            Attributes → Processing Type) so the SOAP RFC endpoint
*"            /sap/bc/soap/rfc can dispatch to it.
*"
*" JSON row shape (UPPERCASE keys — /ui2/cl_json default):
*"   { "ID": "I"|"S"|"R"|"H",
*"     "KEY": "001" | "P_PARAM" | "",
*"     "ENTRY": "text up to 132 chars",
*"     "LENGTH": 11 }
*"
*" Selection-text header convention:
*"   SAP's SE38 Selection Text editor reads ENTRY starting at offset
*"   8. Positions 0-7 are a fixed header block (position 0 = flag,
*"   positions 1-7 = padding). Free-text override requires the first
*"   char to be space (not 'D', which means DDIC reference).
*"
*"   This FM therefore auto-prefixes ID='S' writes with 8 space
*"   characters and strips that header on read, so callers never
*"   have to know about it.
*"
*" WRITE semantics:
*"   INSERT TEXTPOOL iv_program FROM lt LANGUAGE iv_language
*"                         STATE 'A'
*"   STATE 'A' matches RS_CUA_INTERNAL_WRITE — the active pool is
*"   overwritten in one round-trip so callers do not need a separate
*"   ADT activation step for the text pool. INSERT TEXTPOOL fully
*"   REPLACES the language-specific pool, so every caller must
*"   fetch, modify, and write back the complete array.
*"
*" Notes (gotchas learned the hard way):
*"   - Backtick literals `   ` preserve all whitespace. Single-quote
*"     char literals '   ' get trailing spaces stripped when
*"     converted to TYPE string — which silently collapsed an 8-char
*"     prefix to 1 character.
*"   - `LOOP AT itab ASSIGNING <fs>` plus field-symbol modification
*"     did not persist updates through /ui2/cl_json=>serialize in
*"     this kernel. Using `LOOP INTO ls + MODIFY itab FROM ls
*"     INDEX sy-tabix` with a `TYPE string`-entry output struct is
*"     the reliable path.
*"   - ABAP's `REGEX` keyword is POSIX Basic where `+` is a literal.
*"     Use `PCRE` or plain substring for "strip leading spaces".
*"   - `/ui2/cl_json` serializes CHAR fields by trimming trailing
*"     spaces. Use an output struct with `entry TYPE string` if you
*"     need to control exact output length.
*"----------------------------------------------------------------------

FUNCTION zmcp_adt_textpool
  IMPORTING
    VALUE(iv_action) TYPE string
    VALUE(iv_program) TYPE syrepid
    VALUE(iv_language) TYPE sylangu DEFAULT sy-langu
    VALUE(iv_textpool_json) TYPE string OPTIONAL
  EXPORTING
    VALUE(ev_result) TYPE string
    VALUE(ev_subrc) TYPE i
    VALUE(ev_message) TYPE string.

  CONSTANTS c_sel_prefix     TYPE string VALUE `        `.   " 8 spaces
  CONSTANTS c_sel_prefix_len TYPE i      VALUE 8.

  TYPES: BEGIN OF ty_out,
           id     TYPE c LENGTH 1,
           key    TYPE c LENGTH 8,
           entry  TYPE string,
           length TYPE i,
         END OF ty_out.

  DATA: lt_textpool TYPE STANDARD TABLE OF textpool,
        ls_row      TYPE textpool,
        lt_out      TYPE STANDARD TABLE OF ty_out,
        ls_out      TYPE ty_out,
        lv_action   TYPE string,
        lv_language TYPE sylangu,
        lv_entry    TYPE string,
        lv_first    TYPE string,
        lv_len      TYPE i.

  CLEAR: ev_result, ev_subrc, ev_message.

  lv_action = iv_action.
  TRANSLATE lv_action TO UPPER CASE.

  lv_language = iv_language.
  IF lv_language IS INITIAL.
    lv_language = sy-langu.
  ENDIF.

  CASE lv_action.

    WHEN 'READ' OR 'READ_RAW'.
      READ TEXTPOOL iv_program
        INTO lt_textpool
        LANGUAGE lv_language.
      IF sy-subrc <> 0.
        CLEAR lt_textpool.
      ENDIF.

*     Copy into a TYPES-based output struct where ENTRY is TYPE
*     string — avoids CHAR 132 round-trip quirks. For READ, strip
*     the 8-char selection-text header from ID='S' free-text rows.
      CLEAR lt_out.
      LOOP AT lt_textpool INTO ls_row.
        CLEAR ls_out.
        ls_out-id     = ls_row-id.
        ls_out-key    = ls_row-key.
        ls_out-entry  = ls_row-entry.
        ls_out-length = ls_row-length.

        IF lv_action = 'READ' AND ls_out-id = 'S' AND ls_out-entry IS NOT INITIAL.
          lv_entry = ls_out-entry.
          lv_len   = strlen( lv_entry ).
          IF lv_len >= 1.
            lv_first = substring( val = lv_entry off = 0 len = 1 ).
            IF lv_first <> 'D' AND lv_len > c_sel_prefix_len.
              ls_out-entry  = substring(
                val = lv_entry
                off = c_sel_prefix_len
                len = lv_len - c_sel_prefix_len ).
              ls_out-length = lv_len - c_sel_prefix_len.
            ENDIF.
          ENDIF.
        ENDIF.

        APPEND ls_out TO lt_out.
      ENDLOOP.

      TRY.
          ev_result = /ui2/cl_json=>serialize(
            data        = lt_out
            compress    = abap_false
            pretty_name = /ui2/cl_json=>pretty_mode-none ).
        CATCH cx_root INTO DATA(lx_read).
          ev_subrc   = 8.
          ev_message = |JSON serialize failed: { lx_read->get_text( ) }|.
          RETURN.
      ENDTRY.

    WHEN 'WRITE'.
      IF iv_textpool_json IS INITIAL.
        ev_subrc   = 4.
        ev_message = 'IV_TEXTPOOL_JSON is required for action WRITE'.
        RETURN.
      ENDIF.

*     Deserialize into the STRING-entry struct first, then copy
*     into the real TEXTPOOL struct so we control length precisely.
      CLEAR lt_out.
      TRY.
          /ui2/cl_json=>deserialize(
            EXPORTING json = iv_textpool_json
            CHANGING  data = lt_out ).
        CATCH cx_root INTO DATA(lx_write).
          ev_subrc   = 8.
          ev_message = |JSON deserialize failed: { lx_write->get_text( ) }|.
          RETURN.
      ENDTRY.

      CLEAR lt_textpool.
      LOOP AT lt_out INTO ls_out.
        CLEAR ls_row.
        ls_row-id  = ls_out-id.
        ls_row-key = ls_out-key.

        IF ls_out-id = 'S' AND ls_out-entry IS NOT INITIAL.
          lv_entry = ls_out-entry.
          lv_len   = strlen( lv_entry ).
          IF lv_len >= 1.
            lv_first = substring( val = lv_entry off = 0 len = 1 ).
            IF lv_first <> 'D'.
*             Defensive strip of an existing 8-char prefix so
*             callers can round-trip our READ output without
*             accumulating prefixes.
              IF lv_len > c_sel_prefix_len.
                DATA(lv_head) = substring(
                  val = lv_entry
                  off = 0
                  len = c_sel_prefix_len ).
                IF lv_head = c_sel_prefix.
                  lv_entry = substring(
                    val = lv_entry
                    off = c_sel_prefix_len
                    len = lv_len - c_sel_prefix_len ).
                ENDIF.
              ENDIF.
              lv_entry = c_sel_prefix && lv_entry.
            ENDIF.
          ENDIF.
          ls_row-entry  = lv_entry.
          ls_row-length = strlen( lv_entry ).
        ELSE.
          ls_row-entry  = ls_out-entry.
          ls_row-length = strlen( ls_out-entry ).
        ENDIF.

        APPEND ls_row TO lt_textpool.
      ENDLOOP.

*     Write directly active — matches RS_CUA_INTERNAL_WRITE so the
*     caller does not need a separate ADT activation round-trip.
      INSERT TEXTPOOL iv_program
        FROM lt_textpool
        LANGUAGE lv_language
        STATE 'A'.
      IF sy-subrc <> 0.
        ev_subrc   = sy-subrc.
        ev_message = |INSERT TEXTPOOL failed for { iv_program } ({ lv_language }) subrc={ sy-subrc }|.
        RETURN.
      ENDIF.

      ev_result = '{"written":true}'.

    WHEN OTHERS.
      ev_subrc   = 4.
      ev_message = |Unknown action '{ iv_action }'|.

  ENDCASE.

ENDFUNCTION.
