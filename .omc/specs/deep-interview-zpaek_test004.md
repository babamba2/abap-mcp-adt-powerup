# Deep Interview Spec: STO 상태 조회 리스트 (ZPAEK_TEST004)

## Metadata
- Interview ID: zpaek_test004-2026-04-11
- Rounds: 15
- Final Ambiguity Score: 2.4% (after Round 15 coding standards)
- Threshold: 5% (사용자 지정, 기본 20%에서 하향)
- Type: brownfield (기존 SAP 시스템에 신규 ABAP 객체 생성)
- Generated: 2026-04-11
- Status: PASSED

## Clarity Breakdown

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.98 | 0.35 | 0.343 |
| Constraint Clarity | 0.99 | 0.25 | 0.248 |
| Success Criteria | 0.97 | 0.25 | 0.243 |
| Context Clarity | 0.95 | 0.15 | 0.143 |
| **Total Clarity** | | | **0.976** |
| **Ambiguity** | | | **0.024 (2.4%)** |

## Goal

ABAP 보고서 프로그램 `ZPAEK_TEST004`를 **Form-based(FORM/PERFORM) 절차형 스타일**로, **6개 include(TOP/SEL/CLS/O01/I01/F01)로 모듈화**하여 개발한다. 프로그램은 **더이(delivery) 기반 STO**의 라이프사이클 현황을 **EKPO 라인 아이템 단위 1행**으로 **CL_GUI_ALV_GRID**(docking container, 전용 화면 0100)에 표시한다. 각 행은 **더이/GI/운송/GR 단계의 날짜 + 수량 + 현재상태 텍스트**를 조합 형태로 보여주며, 상태 판정 로직은 **수량 기반 state machine**을 따르는 **pure function FORM**으로 구현되어 **ABAP Unit Test**(로컬 테스트 클래스)로 검증된다.

## Constraints

### 기술 스택 & 스타일
- 프로그램 유형: REPORT (executable program)
- 스타일: **Form-based (FORM/PERFORM 절차형)**. OOP는 이벤트 핸들러/테스트 클래스에만 한정
- ALV 컴포넌트: **CL_GUI_ALV_GRID** (CL_SALV_TABLE 아님)
- 컨테이너: **CL_GUI_DOCKING_CONTAINER** (기본값)
- 부모 화면: **전용 화면 0100** (SE51로 생성, PBO/PAI 모듈 포함)
- GUI STATUS: `STATUS_0100` (화면 0100에 SET PF-STATUS)
- 타이틀바: `TITLE_0100` — "STO 상태 조회"

### 개발 환경
- 패키지: `ZPAEK`
- Transport (CTS): `S4HK904224`
- SAP 시스템: 현재 MCP 세션에 연결된 **onprem** 시스템 (GetSession으로 사전 확인)

### 선택화면 (SELECTION-SCREEN / SELECT-OPTIONS)
| 파라미터 | 테이블-필드 | 종류 | 기본값 | 비고 |
|---------|-------------|------|--------|------|
| s_ebeln | EKKO-EBELN | SELECT-OPTIONS | (비움) | PO 번호 |
| s_werks | EKPO-WERKS | SELECT-OPTIONS | (비움) | 입고공장 |
| s_reswk | EKPO-RESWK | SELECT-OPTIONS | (비움) | 출고공장 |
| s_bedat | EKKO-BEDAT | SELECT-OPTIONS | sy-datum-30 ~ sy-datum | PO 생성일 |
| s_lifnr | EKKO-LIFNR | SELECT-OPTIONS | (비움) | 공급업체 |
| s_bsart | EKKO-BSART | SELECT-OPTIONS | `UB` (default) | 문서유형, 여러 값 허용 |
| s_matnr | EKPO-MATNR | SELECT-OPTIONS | (비움) | 자재코드 |
| p_stat | char4 | RADIOBUTTON GROUP | `ALL` | ALL/INCO(미완료)/GIWT(GI대기)/GRWT(GR대기) |
| p_exdel | XFELD | CHECKBOX | `X` | 삭제표시 EKPO 제외 (기본 X) |

### 데이터 소스 경로 (delivery-based STO only)
```
EKKO (S_BSART IN ('UB','NB'))
 ├─ EKPO (line)               ← row 단위
 │   └─ VBFA (VBTYP_V='V', VBELV=EKPO-EBELN, POSNV=EKPO-EBELP)
 │        └─ LIKP/LIPS        ← delivery 정보 (VBELN, LFDAT, LFIMG)
 │             └─ MSEG        ← mvt 641 (GI: supplying plant), 101 (GR: receiving plant)
```
EKPO-LOEKZ ≠ ' ' 항목은 `p_exdel = X` 일 때 제외.

### 출력 컬럼 (ALV field catalog 순서)
1. EBELN — PO 번호 (hotspot, 더블클릭 → ME23N via PARAMETER ID 'BES')
2. EBELP — PO 항목
3. BSART — 문서유형
4. MATNR — 자재
5. MAKTX — 자재명
6. RESWK — 출고공장
7. WERKS — 입고공장
8. MENGE — 발주수량
9. MEINS — 단위
10. VBELN — 더이번호 (hotspot, 더블클릭 → VL03N via PARAMETER ID 'VL')
11. LFIMG — 더이수량
12. GI_DATE — GI 전기일 (MSEG-BUDAT, mvt 641)
13. GI_QTY — GI 수량 (MSEG-MENGE, mvt 641 합계)
14. GR_DATE — GR 전기일 (MSEG-BUDAT, mvt 101)
15. GR_QTY — GR 수량 (MSEG-MENGE, mvt 101 합계)
16. OPEN_QTY — 미처리 수량 (MENGE − GR_QTY)
17. STATUS — 현재상태 텍스트 (state machine 출력)
18. LIGHTS — traffic light 아이콘 (1=적/2=황/3=녹, STATUS 파생)

기본 정렬: EBELN ASC, EBELP ASC.
Layout save (`is_variant`) 허용, `optimize_column_width = X`.
Top-of-page 집계 라인 (총 건수 + 상태별 건수).

### GUI STATUS `STATUS_0100` 구성
- 표준 BACK(F3) / EXIT(Shift+F3) / CANCEL(F12) → PAI에서 `LEAVE PROGRAM`
- 사용자 버튼 1개: **REFRESH** (F5, 아이콘 ICON_REFRESH, 데이터 재조회 후 ALV refresh)
- DETAIL 버튼은 생성하지 않음 — ME23N/VL03N 전이는 ALV hotspot/double-click으로 처리

### 상태 판정 규칙 (state machine, build_status FORM)
입력: `ls_item TYPE ty_row` (EKPO 1라인) + 계산된 GI/GR 합계
출력: `STATUS`, `LIGHTS`

```
IF menge <= 0.                              " 방어: 발주수량 0
  status = 'INVALID'.    lights = '1'.
ELSEIF gr_qty >= menge.
  status = '완료'.       lights = '3'.
ELSEIF gi_qty > 0 AND gr_qty < menge AND gi_qty > gr_qty.
  status = '운송중'.     lights = '2'.
ELSEIF gr_qty > 0 AND gr_qty < menge.       " 부분수령 (GI=GR 인 경우 포함)
  status = '부분수령'.   lights = '2'.
ELSEIF lfimg > 0 AND gi_qty = 0.
  status = 'GI대기'.     lights = '1'.
ELSE.                                       " 더이 없음
  status = '더이대기'.   lights = '1'.
ENDIF.
```

### 프로그램 구조 (Form-based, Include 분할)

**메인 프로그램 `ZPAEK_TEST004`** — 본체는 INCLUDE 선언 + event block만:
```abap
REPORT zpaek_test004 MESSAGE-ID zpaek.

INCLUDE zpaek_test004_top.   " TABLES / TYPES / DATA / CONSTANTS
INCLUDE zpaek_test004_sel.   " SELECT-OPTIONS / PARAMETERS / INITIALIZATION
INCLUDE zpaek_test004_cls.   " lcl_event_handler + ltc_app FOR TESTING
INCLUDE zpaek_test004_o01.   " PBO modules (STATUS_0100)
INCLUDE zpaek_test004_i01.   " PAI modules (USER_COMMAND_0100)
INCLUDE zpaek_test004_f01.   " FORMs

START-OF-SELECTION.
  PERFORM get_data         CHANGING gt_rows.
  PERFORM build_status     CHANGING gt_rows.
  PERFORM filter_by_status CHANGING gt_rows.
  IF gt_rows IS INITIAL.
    MESSAGE '조회된 STO가 없습니다' TYPE 'S'.
    LEAVE LIST-PROCESSING.
  ENDIF.
  CALL SCREEN 0100.
```

**Include 1: `ZPAEK_TEST004_TOP`** — 전역 선언
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_TOP
*&---------------------------------------------------------------------*
TABLES: ekko, ekpo.

TYPES: BEGIN OF ty_row,
         ebeln    TYPE ekpo-ebeln,
         ebelp    TYPE ekpo-ebelp,
         bsart    TYPE ekko-bsart,
         matnr    TYPE ekpo-matnr,
         maktx    TYPE makt-maktx,
         reswk    TYPE ekpo-reswk,
         werks    TYPE ekpo-werks,
         menge    TYPE ekpo-menge,
         meins    TYPE ekpo-meins,
         vbeln    TYPE lips-vbeln,
         lfimg    TYPE lips-lfimg,
         gi_date  TYPE mseg-budat,
         gi_qty   TYPE mseg-menge,
         gr_date  TYPE mseg-budat,
         gr_qty   TYPE mseg-menge,
         open_qty TYPE ekpo-menge,
         status   TYPE string,
         lights   TYPE c LENGTH 1,
       END OF ty_row.

DATA: gt_rows    TYPE STANDARD TABLE OF ty_row,
      gs_row     TYPE ty_row,
      go_docking TYPE REF TO cl_gui_docking_container,
      go_grid    TYPE REF TO cl_gui_alv_grid,
      go_handler TYPE REF TO lcl_event_handler,   " forward ref; 정의는 CLS
      gv_ok_code TYPE sy-ucomm.
```

**Include 2: `ZPAEK_TEST004_SEL`** — 선택화면 + INITIALIZATION
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_SEL
*&---------------------------------------------------------------------*
SELECTION-SCREEN BEGIN OF BLOCK b0 WITH FRAME TITLE text-b00.
SELECT-OPTIONS: s_ebeln FOR ekko-ebeln,
                s_werks FOR ekpo-werks,
                s_reswk FOR ekpo-reswk,
                s_bedat FOR ekko-bedat,
                s_lifnr FOR ekko-lifnr,
                s_bsart FOR ekko-bsart DEFAULT 'UB',
                s_matnr FOR ekpo-matnr.
PARAMETERS:     p_exdel AS CHECKBOX DEFAULT 'X'.
SELECTION-SCREEN END OF BLOCK b0.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE text-b01.
PARAMETERS: p_all   RADIOBUTTON GROUP g1 DEFAULT 'X',
            p_inco  RADIOBUTTON GROUP g1,
            p_giwt  RADIOBUTTON GROUP g1,
            p_grwt  RADIOBUTTON GROUP g1.
SELECTION-SCREEN END OF BLOCK b1.

INITIALIZATION.
  s_bedat-sign   = 'I'.
  s_bedat-option = 'BT'.
  s_bedat-low    = sy-datum - 30.
  s_bedat-high   = sy-datum.
  APPEND s_bedat.
```

**Include 3: `ZPAEK_TEST004_CLS`** — 로컬 클래스 (이벤트 핸들러 + Unit Test)
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_CLS
*&---------------------------------------------------------------------*
CLASS lcl_event_handler DEFINITION.
  PUBLIC SECTION.
    METHODS on_double_click
      FOR EVENT double_click OF cl_gui_alv_grid
      IMPORTING e_row e_column.
ENDCLASS.

CLASS lcl_event_handler IMPLEMENTATION.
  METHOD on_double_click.
    READ TABLE gt_rows INTO gs_row INDEX e_row-index.
    IF sy-subrc <> 0. RETURN. ENDIF.
    CASE e_column-fieldname.
      WHEN 'EBELN'.
        SET PARAMETER ID 'BES' FIELD gs_row-ebeln.
        CALL TRANSACTION 'ME23N'.
      WHEN 'VBELN'.
        SET PARAMETER ID 'VL' FIELD gs_row-vbeln.
        CALL TRANSACTION 'VL03N'.
    ENDCASE.
  ENDMETHOD.
ENDCLASS.

CLASS ltc_app DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    METHODS:
      test_delivery_pending FOR TESTING,
      test_gi_pending       FOR TESTING,
      test_in_transit       FOR TESTING,
      test_partial_gr       FOR TESTING,
      test_completed        FOR TESTING,
      test_exact_match      FOR TESTING,   " GR = PO 경계값
      test_zero_po_qty      FOR TESTING.   " 방어
    METHODS call_determine
      IMPORTING iv_menge TYPE ekpo-menge
                iv_lfimg TYPE lips-lfimg
                iv_gi    TYPE mseg-menge
                iv_gr    TYPE mseg-menge
      EXPORTING ev_status TYPE string
                ev_lights TYPE c.
ENDCLASS.

CLASS ltc_app IMPLEMENTATION.
  METHOD call_determine.
    PERFORM determine_status
      USING iv_menge iv_lfimg iv_gi iv_gr
      CHANGING ev_status ev_lights.
  ENDMETHOD.
  " test_* 구현에서 call_determine 호출 후 cl_abap_unit_assert=>assert_equals
  " (상세: Acceptance Criteria 7 테스트 케이스 참조)
ENDCLASS.
```

**Include 4: `ZPAEK_TEST004_O01`** — PBO 모듈
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_O01
*&---------------------------------------------------------------------*
MODULE status_0100 OUTPUT.
  SET PF-STATUS 'STATUS_0100'.
  SET TITLEBAR  'TITLE_0100'.
  PERFORM display_alv.
ENDMODULE.
```

**Include 5: `ZPAEK_TEST004_I01`** — PAI 모듈
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_I01
*&---------------------------------------------------------------------*
MODULE user_command_0100 INPUT.
  CASE gv_ok_code.
    WHEN 'BACK' OR 'EXIT' OR 'CANCEL'.
      LEAVE PROGRAM.
    WHEN 'REFRESH'.
      PERFORM get_data         CHANGING gt_rows.
      PERFORM build_status     CHANGING gt_rows.
      PERFORM filter_by_status CHANGING gt_rows.
      go_grid->refresh_table_display( ).
  ENDCASE.
  CLEAR gv_ok_code.
ENDMODULE.
```

**Include 6: `ZPAEK_TEST004_F01`** — FORM 서브루틴
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_F01
*&---------------------------------------------------------------------*
FORM get_data          CHANGING ct_rows TYPE STANDARD TABLE.
  " EKKO/EKPO 기본 SELECT (s_ebeln/s_werks/s_reswk/s_bedat/s_lifnr/s_bsart/s_matnr)
  " p_exdel = X 면 EKPO-LOEKZ = SPACE 필터
  " VBFA(VBTYP_V='V') → LIPS → LIKP 로 더이 정보 집계
  " MSEG (BWART IN ('641','642','101','102')) 로 GI/GR 합계 (역분개 차감)
ENDFORM.

FORM build_status CHANGING ct_rows TYPE STANDARD TABLE.
  DATA: ls_row TYPE ty_row.
  LOOP AT ct_rows INTO ls_row.
    PERFORM determine_status
      USING ls_row-menge ls_row-lfimg ls_row-gi_qty ls_row-gr_qty
      CHANGING ls_row-status ls_row-lights.
    ls_row-open_qty = ls_row-menge - ls_row-gr_qty.
    MODIFY ct_rows FROM ls_row INDEX sy-tabix.
  ENDLOOP.
ENDFORM.

FORM filter_by_status CHANGING ct_rows TYPE STANDARD TABLE.
  " p_all=X 이면 skip
  " p_inco: status <> '완료' 만 남김
  " p_giwt: status = 'GI대기' or '더이대기' 만 남김
  " p_grwt: status IN ('운송중','부분수령') 만 남김
ENDFORM.

FORM display_alv.
  " CREATE OBJECT go_docking (side=dock_at_left, ratio=90, repid=sy-repid, dynnr='0100')
  " CREATE OBJECT go_grid (i_parent=go_docking)
  " 필드카탈로그 18열 (위 '출력 컬럼' 순서대로)
  " layout-cwidth_opt = 'X', layout-zebra = 'X', layout-excp_fname = 'LIGHTS'
  " sort by EBELN/EBELP ASC
  " go_grid->set_table_for_first_display(...)
  " SET HANDLER go_handler->on_double_click FOR go_grid
ENDFORM.

FORM determine_status
  USING    iv_menge TYPE ekpo-menge
           iv_lfimg TYPE lips-lfimg
           iv_gi    TYPE mseg-menge
           iv_gr    TYPE mseg-menge
  CHANGING ev_status TYPE string
           ev_lights TYPE c.
  " state machine (Constraints § "상태 판정 규칙" 참조)
  " 전역 변수 참조 금지 — 100% pure
ENDFORM.
```
`determine_status`는 전역 변수를 절대 참조하지 않는 **pure function** — `ltc_app` 테스트 메서드가 `PERFORM determine_status`로 직접 호출해서 검증.

**Include 생성 순서** (compile 의존성):
1. `ZPAEK_TEST004_TOP` (TYPES/DATA 선언 먼저)
2. `ZPAEK_TEST004_SEL` (SELECT-OPTIONS)
3. `ZPAEK_TEST004_CLS` (TOP의 DATA 참조)
4. `ZPAEK_TEST004_F01` (FORM 정의 — CLS 전에 필요할 수 있음, 아래 주의 참조)
5. `ZPAEK_TEST004_O01`
6. `ZPAEK_TEST004_I01`

> ⚠️ `ltc_app` 구현에서 `PERFORM determine_status`를 호출하려면 F01 include가 CLS보다 먼저 선언되거나, FORM을 forward-declaration 해야 함. 가장 안전한 순서는 **TOP → SEL → F01 → CLS → O01 → I01**. 실제 Create 순서는 이 순서를 따른다.

### 코딩 표준 (mandatory)
1. **ABAP 7.40+ 문법 우선**
   - Inline declaration: `DATA(lt_ekpo) = ...`, `FIELD-SYMBOL(<fs>)`
   - Constructor expressions: `VALUE #( )`, `NEW #( )`, `CORRESPONDING #( )`, `REDUCE #( )`, `FILTER #( )`, `CONV #( )`
   - `FOR ... IN` table comprehension, `LINES OF`, `FOR IN WHERE`
   - String templates `|...{ var }...|` 대신 `CONCATENATE` 금지
   - 메서드/함수형 스타일 `cl_xx=>create( )` 사용, 구식 `CREATE OBJECT` 은 이벤트 핸들러 등 필수 상황에만
2. **Open SQL 최적화**
   - `SELECT *` 금지 — 필요한 필드만 나열
   - 하나의 SELECT으로 가능하면 JOIN/FOR ALL ENTRIES 로 round-trip 최소화 (MSEG는 크기 때문에 FOR ALL ENTRIES + 필터)
   - `ORDER BY PRIMARY KEY` 명시, `INTO TABLE @DATA(...)` inline 사용
   - index hint 필요 시 주석으로 근거 기재
   - `PACKAGE SIZE`는 본 리포트 범위에서는 불필요 (선택화면 제약으로 결과 셋 작음 가정)
3. **간결 주석(Concise Comments)**
   - 로직의 **의도(why)**, S/4HANA 특이사항(예: CDS view 대안, suite HANA 컬럼스토어 고려), 비자명한 결정만 주석
   - 코드를 말로 반복하는 주석(`" loop gt_rows`) 금지
   - 각 include 헤더에 purpose 1줄
4. **구조화 & 가독성**
   - 한 FORM 30 lines 이내 목표, 100 lines 초과 시 sub-form 분할
   - 매직 넘버 금지 — constants로 (`co_bwart_gi TYPE bwart VALUE '641'`)
   - FORM의 USING/CHANGING 타입은 반드시 명시 (TYPE STANDARD TABLE만 쓰지 말고 `LIKE gt_rows` 또는 typed table type)
5. **S/4HANA 관점 메모**
   - EKKO/EKPO/LIKP/LIPS/MSEG는 S/4에서도 호환 유지 테이블(테이블 이름 동일). MATDOC(새 singleton)은 MSEG를 커버하는 compatibility view이므로 본 리포트는 MSEG 직접 SELECT 유지
   - 향후 개선 여지로 `I_StockTransferOrder*` CDS view 전환 가능 — 현재 구현 범위 아님, 주석에만 언급

### F01 include — 즉시 실행 가능한 샘플 (ABAP 7.40+)
```abap
*&---------------------------------------------------------------------*
*& Include          ZPAEK_TEST004_F01
*& Purpose: Data retrieval, status determination, ALV display FORMs
*&---------------------------------------------------------------------*

CONSTANTS:
  co_bwart_gi  TYPE bwart VALUE '641',   " STO GI at supplying plant
  co_bwart_gir TYPE bwart VALUE '642',   " GI reversal
  co_bwart_gr  TYPE bwart VALUE '101',   " GR at receiving plant
  co_bwart_grr TYPE bwart VALUE '102',   " GR reversal
  co_vbtyp_v   TYPE vbtyp_v VALUE 'V'.   " Purchase order in VBFA

FORM get_data CHANGING ct_rows TYPE STANDARD TABLE.

  CLEAR ct_rows.

  " 1) EKKO/EKPO base set — only needed fields
  SELECT h~ebeln, h~bsart, h~bedat, h~lifnr,
         p~ebelp, p~matnr, p~werks, p~reswk,
         p~menge, p~meins, p~loekz
    FROM ekko AS h
    INNER JOIN ekpo AS p ON p~ebeln = h~ebeln
    WHERE h~ebeln IN @s_ebeln
      AND h~bedat IN @s_bedat
      AND h~lifnr IN @s_lifnr
      AND h~bsart IN @s_bsart
      AND p~werks IN @s_werks
      AND p~reswk IN @s_reswk
      AND p~matnr IN @s_matnr
    INTO TABLE @DATA(lt_ekpo).

  IF p_exdel = abap_true.
    DELETE lt_ekpo WHERE loekz <> space.
  ENDIF.
  IF lt_ekpo IS INITIAL. RETURN. ENDIF.

  " 2) MAKTX — language EN, single batch
  SELECT matnr, maktx
    FROM makt
    FOR ALL ENTRIES IN @lt_ekpo
    WHERE matnr = @lt_ekpo-matnr
      AND spras = @sy-langu
    INTO TABLE @DATA(lt_makt).

  " 3) VBFA → 더이 연결 (STO item → outbound delivery item)
  SELECT vbelv, posnv, vbeln, posnn
    FROM vbfa
    FOR ALL ENTRIES IN @lt_ekpo
    WHERE vbelv  = @lt_ekpo-ebeln
      AND posnv  = @lt_ekpo-ebelp
      AND vbtyp_v = @co_vbtyp_v
    INTO TABLE @DATA(lt_vbfa).

  " 4) LIPS 더이 수량
  DATA(lt_lips) = VALUE lips_tt( ).
  IF lt_vbfa IS NOT INITIAL.
    SELECT vbeln, posnr, lfimg, meins
      FROM lips
      FOR ALL ENTRIES IN @lt_vbfa
      WHERE vbeln = @lt_vbfa-vbeln
        AND posnr = @lt_vbfa-posnn
      INTO TABLE @lt_lips.
  ENDIF.

  " 5) MSEG 이동 (GI/GR + reversal) — EBELN/EBELP 기준 직결
  SELECT ebeln, ebelp, bwart, budat, menge, shkzg
    FROM mseg
    FOR ALL ENTRIES IN @lt_ekpo
    WHERE ebeln = @lt_ekpo-ebeln
      AND ebelp = @lt_ekpo-ebelp
      AND bwart IN ( @co_bwart_gi, @co_bwart_gir, @co_bwart_gr, @co_bwart_grr )
    INTO TABLE @DATA(lt_mseg).

  " 6) Aggregate to ty_row (functional style)
  LOOP AT lt_ekpo ASSIGNING FIELD-SYMBOL(<ls_ekpo>).

    DATA(ls_row) = VALUE ty_row(
      ebeln = <ls_ekpo>-ebeln
      ebelp = <ls_ekpo>-ebelp
      bsart = <ls_ekpo>-bsart
      matnr = <ls_ekpo>-matnr
      maktx = VALUE #( lt_makt[ matnr = <ls_ekpo>-matnr ]-maktx OPTIONAL )
      reswk = <ls_ekpo>-reswk
      werks = <ls_ekpo>-werks
      menge = <ls_ekpo>-menge
      meins = <ls_ekpo>-meins ).

    " delivery (if any — 첫 번째 매칭만 사용, 통상 STO item 당 1 더이)
    ASSIGN lt_vbfa[ vbelv = <ls_ekpo>-ebeln posnv = <ls_ekpo>-ebelp ]
      TO FIELD-SYMBOL(<ls_vbfa>).
    IF sy-subrc = 0.
      ls_row-vbeln = <ls_vbfa>-vbeln.
      ls_row-lfimg = VALUE #( lt_lips[ vbeln = <ls_vbfa>-vbeln posnr = <ls_vbfa>-posnn ]-lfimg OPTIONAL ).
    ENDIF.

    " GI 합계 (출고 − 역분개). REDUCE FOR IN WHERE + COND.
    ls_row-gi_qty = REDUCE mseg-menge(
      INIT q = CONV mseg-menge( 0 )
      FOR <m> IN lt_mseg
        WHERE ( ebeln = <ls_ekpo>-ebeln AND ebelp = <ls_ekpo>-ebelp
            AND ( bwart = co_bwart_gi OR bwart = co_bwart_gir ) )
      NEXT q = q + COND #( WHEN <m>-shkzg = 'H' THEN <m>-menge ELSE <m>-menge * -1 ) ).
    " shkzg H = credit/GI, S = debit/reversal ; STO 641은 H(출고), 642는 S(반대)
    ls_row-gi_qty = abs( ls_row-gi_qty ).

    " GI 최신일
    ls_row-gi_date = REDUCE mseg-budat(
      INIT d = CONV mseg-budat( '00000000' )
      FOR <m> IN lt_mseg
        WHERE ( ebeln = <ls_ekpo>-ebeln AND ebelp = <ls_ekpo>-ebelp AND bwart = co_bwart_gi )
      NEXT d = COND #( WHEN <m>-budat > d THEN <m>-budat ELSE d ) ).

    " GR 합계
    ls_row-gr_qty = REDUCE mseg-menge(
      INIT q = CONV mseg-menge( 0 )
      FOR <m> IN lt_mseg
        WHERE ( ebeln = <ls_ekpo>-ebeln AND ebelp = <ls_ekpo>-ebelp
            AND ( bwart = co_bwart_gr OR bwart = co_bwart_grr ) )
      NEXT q = q + COND #( WHEN <m>-shkzg = 'S' THEN <m>-menge ELSE <m>-menge * -1 ) ).
    ls_row-gr_qty = abs( ls_row-gr_qty ).

    ls_row-gr_date = REDUCE mseg-budat(
      INIT d = CONV mseg-budat( '00000000' )
      FOR <m> IN lt_mseg
        WHERE ( ebeln = <ls_ekpo>-ebeln AND ebelp = <ls_ekpo>-ebelp AND bwart = co_bwart_gr )
      NEXT d = COND #( WHEN <m>-budat > d THEN <m>-budat ELSE d ) ).

    APPEND ls_row TO ct_rows.
  ENDLOOP.

  " NOTE: S/4HANA migration candidate — I_StockTransferOrderItem +
  "       I_GoodsMovement CDS views. 현재는 호환 테이블 사용.
ENDFORM.

FORM build_status CHANGING ct_rows TYPE STANDARD TABLE.
  LOOP AT ct_rows ASSIGNING FIELD-SYMBOL(<ls>).
    PERFORM determine_status
      USING    <ls>-menge <ls>-lfimg <ls>-gi_qty <ls>-gr_qty
      CHANGING <ls>-status <ls>-lights.
    <ls>-open_qty = <ls>-menge - <ls>-gr_qty.
  ENDLOOP.
ENDFORM.

FORM filter_by_status CHANGING ct_rows TYPE STANDARD TABLE.
  " Radio button filter — p_all 이면 no-op
  IF p_all = abap_true. RETURN. ENDIF.

  DELETE ct_rows WHERE
      ( p_inco = abap_true AND status = '완료' )
   OR ( p_giwt = abap_true AND status <> 'GI대기' AND status <> '더이대기' )
   OR ( p_grwt = abap_true AND status <> '운송중' AND status <> '부분수령' ).
ENDFORM.

FORM determine_status
  USING    iv_menge TYPE ekpo-menge
           iv_lfimg TYPE lips-lfimg
           iv_gi    TYPE mseg-menge
           iv_gr    TYPE mseg-menge
  CHANGING ev_status TYPE string
           ev_lights TYPE c.

  " Pure function — 전역 참조 금지. 수량 기반 state machine.
  IF iv_menge <= 0.
    ev_status = 'INVALID'. ev_lights = '1'. RETURN.
  ENDIF.
  IF iv_gr >= iv_menge.
    ev_status = '완료'.    ev_lights = '3'. RETURN.
  ENDIF.
  IF iv_gi > 0 AND iv_gi > iv_gr AND iv_gr < iv_menge.
    ev_status = '운송중'.  ev_lights = '2'. RETURN.
  ENDIF.
  IF iv_gr > 0 AND iv_gr < iv_menge.
    ev_status = '부분수령'. ev_lights = '2'. RETURN.
  ENDIF.
  IF iv_lfimg > 0 AND iv_gi = 0.
    ev_status = 'GI대기'.  ev_lights = '1'. RETURN.
  ENDIF.
  ev_status = '더이대기'.  ev_lights = '1'.
ENDFORM.

FORM display_alv.
  IF go_grid IS NOT INITIAL.
    go_grid->refresh_table_display( ).
    RETURN.
  ENDIF.

  go_docking = NEW #(
    side                        = cl_gui_docking_container=>dock_at_left
    extension                   = 9999   " 최대 확장
    repid                       = sy-repid
    dynnr                       = '0100' ).

  go_grid = NEW #( i_parent = go_docking ).

  DATA(ls_layout) = VALUE lvc_s_layo(
    cwidth_opt = abap_true
    zebra      = abap_true
    excp_fname = 'LIGHTS'
    sel_mode   = 'A' ).

  DATA(lt_sort) = VALUE lvc_t_sort(
    ( spos = 1 fieldname = 'EBELN' up = abap_true )
    ( spos = 2 fieldname = 'EBELP' up = abap_true ) ).

  go_grid->set_table_for_first_display(
    EXPORTING
      i_structure_name = 'TY_ROW'       " will use field catalog from program TYPE
      is_layout        = ls_layout
    CHANGING
      it_sort          = lt_sort
      it_outtab        = gt_rows ).

  go_handler = NEW #( ).
  SET HANDLER go_handler->on_double_click FOR go_grid.
ENDFORM.
```

> Note: `i_structure_name = 'TY_ROW'`은 program-local TYPE 이므로 실제로는 `build_fieldcat` FORM에서 `LVC_T_FCAT`를 수동으로 만들어 `it_fieldcatalog` 로 넘기는 편이 안전하다. 구현 단계에서 이 변환을 포함한다.

## Non-Goals (명시적 제외)
- 더이 없는 STO(1-step/2-step without delivery)는 대상 아님
- 송장(IV, MIRO) 연계 상태는 포함하지 않음
- 편집/수정 기능 없음 — 조회 전용
- 기존 STO 리포트(MB5T, ME2O, ME2ST) 기능 복제 시도 하지 않음
- GR 완료 플래그(EKPO-ELIKZ) 기반 판정 사용 안 함 — 수량 기반으로 통일
- DETAIL 버튼 없음 (hotspot 더블클릭만)
- 인터컴퍼니 STO 전용 처리 로직 없음 (BSART 필터만 제공)

## Acceptance Criteria

### 컴파일 & 활성화
- [ ] 6개 include를 `CreateInclude` 로 생성 (순서: TOP → SEL → F01 → CLS → O01 → I01)
  - [ ] `ZPAEK_TEST004_TOP`
  - [ ] `ZPAEK_TEST004_SEL`
  - [ ] `ZPAEK_TEST004_F01`
  - [ ] `ZPAEK_TEST004_CLS`
  - [ ] `ZPAEK_TEST004_O01`
  - [ ] `ZPAEK_TEST004_I01`
- [ ] `CreateProgram`으로 ZPAEK_TEST004 메인 프로그램 생성 (6개 INCLUDE 선언 + event block)
- [ ] Syntax Check 0 error (각 include + 메인)
- [ ] `CreateScreen` 으로 화면 0100 생성 + PBO/PAI 모듈 연결 0 error
- [ ] `CreateGuiStatus` 로 STATUS_0100 생성 (BACK/EXIT/CANCEL + REFRESH) + TITLE_0100
- [ ] 모든 객체(메인 프로그램 + 6 include + 화면 + GUI status) TR S4HK904224 에 등록
- [ ] Activate 후 Inactive 객체 0개

### 기능 (Smoke)
- [ ] SE38에서 `ZPAEK_TEST004` 실행 → 선택화면 표시, BSART 기본값 'UB' 확인
- [ ] BEDAT 기본값 `sy-datum-30 ~ sy-datum` 확인
- [ ] 실 STO 1건 조회 → ALV 그리드가 docking container로 화면 0100에 표시
- [ ] REFRESH 버튼 클릭 → 데이터 재조회 + ALV 갱신
- [ ] BACK/EXIT/CANCEL → 프로그램 종료
- [ ] EBELN 더블클릭 → ME23N으로 전이
- [ ] VBELN 더블클릭 → VL03N으로 전이
- [ ] 조회 결과 0건일 때 `MESSAGE 'S'` 표시 후 종료

### ABAP Unit Test (ltc_app, `RunUnitTest`)
7개 메서드 모두 통과:
- [ ] `test_delivery_pending` — 더이 없음 → '더이대기' / lights='1'
- [ ] `test_gi_pending` — 더이 존재, GI=0 → 'GI대기' / lights='1'
- [ ] `test_in_transit` — GI>0, GI>GR, GR<PO → '운송중' / lights='2'
- [ ] `test_partial_gr` — GR∈(0, PO), GI=GR → '부분수령' / lights='2'
- [ ] `test_completed` — GR>PO → '완료' / lights='3'
- [ ] `test_exact_match` — GR=PO 경계값 → '완료' / lights='3'
- [ ] `test_zero_po_qty` — PO 수량=0 방어 → 'INVALID' / lights='1'
각 테스트는 `determine_status` FORM을 PERFORM으로 직접 호출하고 `cl_abap_unit_assert=>assert_equals`로 검증.

### 품질
- [ ] Extended Program Check (SLIN) 신규 warning 0
- [ ] Code Inspector (SCI) 기본 variant 통과
- [ ] 삭제 EKPO 항목 `p_exdel=X` 일 때 제외됨을 수동 확인

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "STO 상태" = 단일 진리 | Round 1 (Goal): 무엇을 보여줄 것인가? | STO item 전체 라이프사이클 (EKPO 1라인 = 1 row) |
| 선택화면은 뻔하다 | Round 2 (Constraint): 확장 세트 | EBELN/WERKS/RESWK/BEDAT/LIFNR/BSART/MATNR + 상태 라디오 + 삭제제외 |
| 단계 = Y/N 아이콘 | Round 3 (Goal): 표현 방식 | 조합형 (날짜 + 수량 + 현재상태 텍스트) |
| smoke만 충분 | Round 4 (Contrarian): 무엇을 포기 | smoke + ABAP Unit Test 둘 다 |
| 패키지/TR 자명 | Round 5 (Context) | 패키지 ZPAEK, TR S4HK904224 |
| 로컬 테스트 클래스면 OOP 불가피 | Round 6 (Simplifier) | Pure FORM + 테스트 전용 local class (build_status는 pure function FORM) |
| Form-based는 테스트 어려움 | Round 7 (재합의) | PERFORM을 테스트 메서드에서 직접 호출. build_status USING/CHANGING만 사용 |
| 모든 STO 유형 처리 | Round 8 (Goal 데이터 전략) | 더이 기반 STO only (VBFA → LIKP/LIPS → MSEG 경로) |
| state machine은 자명 | Round 9 (Success 규칙) | 수량 기반 5+α 상태 (완료/운송중/부분수령/GI대기/더이대기/INVALID) |
| 상태당 1 테스트 | Round 10 (Ontologist): 경계값? | 5 상태 + 경계값(GR=PO) + 방어(PO=0) = 7 테스트 메서드 |
| CL_SALV_TABLE 사용 | Round 11 (ALV 기능) | **CL_GUI_ALV_GRID** + **docking container** + 고급 기능(traffic light/집계/툴팁) |
| docking은 리스트 화면에 붙인다 | Round 12 (화면 구조) | 전용 화면 0100 + docking container + PF-STATUS |
| GUI status 표준 CUA | Round 13 | Refresh + Cancel만 (DETAIL 없음) |
| 메인 프로그램 단일 소스 | Round 14 (사용자 재지시) | 6개 include로 분할 (TOP/SEL/CLS/O01/I01/F01, SAP 표준 네이밍). 테스트용 `PERFORM determine_status` 때문에 Create 순서는 TOP → SEL → F01 → CLS → O01 → I01 |
| 코드 스타일은 자명 | Round 15 (사용자 재지시) | ABAP 7.40+ 문법(Inline DATA, VALUE#, NEW#, REDUCE, FOR IN WHERE) + Open SQL 최적화(SELECT 필드 나열, FOR ALL ENTRIES, `INTO TABLE @DATA`) + 간결 주석(의도/S/4HANA 특이사항만) + 매직넘버 constants화. F01 샘플은 placeholder가 아닌 즉시 실행 가능한 코드로 승격 |

## Technical Context
- 시스템: 현재 MCP 세션에 연결된 onprem SAP (GetSession 사전 확인)
- 패키지: `ZPAEK`
- Transport: `S4HK904224`
- 참조 MCP 도구:
  - `CreateProgram`, `UpdateProgram` (메인 프로그램 본체)
  - `CreateInclude`, `UpdateInclude` (6개 include: TOP/SEL/CLS/O01/I01/F01)
  - `CreateScreen` (화면 0100)
  - `CreateGuiStatus` (STATUS_0100)
  - `CreateUnitTest`, `RunUnitTest` (ABAP Unit — CLS include에 내장)
  - `ListTransports`/`GetSession` (사전 체크)
- 참고: MEMORY에 기록된 "GUI Status & Screen handler rewrite" — CUAD/DYNP는 RFC/SOAP 경로. 해당 핸들러의 현재 상태 먼저 확인 필요

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| StoHeader (EKKO) | core domain | EBELN, BSART, BEDAT, LIFNR | has many StoItem |
| StoItem (EKPO) | core domain (row) | EBELN, EBELP, MATNR, WERKS, RESWK, MENGE, MEINS, LOEKZ | belongs to StoHeader; sourced by Delivery; consumed by GoodsMovement |
| Delivery (LIKP/LIPS) | core domain | VBELN, LFDAT, LFIMG | refers to StoItem via VBFA (VBTYP_V='V') |
| GoodsMovement (MSEG) | core domain | MBLNR, BWART(641/101), BUDAT, MENGE | linked to StoItem (EBELN/EBELP) |
| StoItemRow (ty_row) | output | 18 cols | aggregates StoItem + Delivery + GoodsMovement |
| StatusVerdict | output | STATUS, LIGHTS | derived by build_status/determine_status |
| SelectionCriteria | constraint | 7 SELECT-OPTIONS + 1 radio + 1 checkbox | filters StoItem |
| DockingContainer | UI | CL_GUI_DOCKING_CONTAINER | parent of AlvGrid |
| AlvGrid | UI | CL_GUI_ALV_GRID | displays StoItemRow[] |
| GuiEventHandler (lcl_event_handler) | OOP | on_double_click | handles AlvGrid events |
| UnitTestSuite (ltc_app) | test | 7 test methods | exercises determine_status |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 3 | 3 | - | - | N/A |
| 2 | 6 | 3 | 0 | 3 | 50% |
| 3 | 7 | 1 | 0 | 6 | 86% |
| 4 | 8 | 1 | 0 | 7 | 88% |
| 5 | 8 | 0 | 0 | 8 | 100% |
| 6 | 8 | 0 | 0 | 8 | 100% |
| 7 | 9 | 1 (UnitTestSuite) | 0 | 8 | 89% |
| 8 | 9 | 0 | 0 | 9 | 100% |
| 9 | 10 | 1 (StatusVerdict) | 0 | 9 | 90% |
| 10 | 10 | 0 | 0 | 10 | 100% |
| 11 | 11 | 2 (DockingContainer, AlvGrid) − 1 (merged) | 0 | 10 | 91% |
| 12 | 11 | 1 (Screen0100 merged) | 0 | 11 | 100% |
| 13 | 11 | 0 | 0 | 11 | 100% |

**5 라운드 연속 100% stability — 도메인 모델 완전 수렴.**

## Interview Transcript

<details>
<summary>Full Q&A (13 rounds)</summary>

### Round 1 — Goal Clarity targeting
**Q:** 리스트 한 줄은 어떤 단위로, 무엇을 보여주실 건가요? (EKPO item 전체 라이프사이클 / 수량중심 / 현재단계만 / 더이단위)
**A:** STO Item 전체 라이프사이클
**Ambiguity:** 72.5%

### Round 2 — Constraint Clarity (선택화면)
**Q:** ZPAEK_TEST004 선택화면 구성? (표준/최소/확장)
**A:** 확장 세트 (EBELN/WERKS/RESWK/BEDAT/LIFNR/BSART/MATNR + 상태 radio + 삭제제외)
**Ambiguity:** 56.1%

### Round 3 — Goal Clarity (컬럼 표현)
**Q:** 각 단계를 ALV 컬럼에 어떻게 표현?
**A:** 조합형 (날짜 + 수량 + 현재상태)
**Ambiguity:** 44.5%

### Round 4 — Success Criteria (Contrarian)
**Q:** 완성 검증 수준? (smoke / 기능검증 / 전체품질)
**A:** smoke + unit test 둘다 해야함
**Ambiguity:** 32.0%

### Round 5 — Context Clarity (패키지/TR)
**Q:** 패키지 및 TR?
**A:** ZPAEK 패키지 및 CTS는 S4HK904224
**Ambiguity:** 23.6%

### Round 6 — Success Criteria (Simplifier)
**Q:** ABAP Unit Test 구조? (로컬 / 글로벌 분리 / smoke만)
**A:** 프로그램 내 로컬 클래스
**Ambiguity:** 13.1% (이 시점 임계치 20% 통과)

### Round 6.5 — 사용자 개입: 임계치 5%로 하향 + Form-based 제약 추가
재계산: Ambiguity 30.3%

### Round 7 — 재합의 (Form + Unit Test)
**Q:** Form-based와 Unit Test 충돌 해결?
**A:** 순수 Form 구조 + 테스트 전용 local class (Recommended)
**Ambiguity:** 17.5%

### Round 8 — Goal Clarity (데이터 소스)
**Q:** STO 유형 및 데이터 소스?
**A:** 더이 기반 STO 만 (Recommended)
**Ambiguity:** 13.6%

### Round 9 — Goal + Success (state machine)
**Q:** 상태 판정 규칙?
**A:** 수량 기반 단계별 (Recommended)
**Ambiguity:** 9.5%

### Round 10 — Success Criteria (Ontologist)
**Q:** 테스트 메서드 구성?
**A:** 5 상태 × 정상 × 경계값 (7 메서드)
**Ambiguity:** 7.5%

### Round 11 — Constraint (ALV 기능) — 스택 변경
**Q:** ALV 기능 세트?
**A:** 고급 확장인데, **SALV가 아닌 Screen Based CL_GUI_ALV_GRID 사용, 컨테이너는 docking container 기본값**
**Ambiguity:** 9.5% (스택 변경으로 잠시 증가)

### Round 12 — Goal (화면 구조)
**Q:** docking 어디에 붙일지?
**A:** **전용 화면 0100 + PF-STATUS**
**Ambiguity:** 7.0%

### Round 13 — 마감 (GUI status + defaults + 시스템)
**Q1:** GUI STATUS 구성? → **Refresh + Cancel만 (DETAIL 없음)**
**Q2:** 선택화면 기본값? → **BSART default = 'UB'** + BEDAT -30일 + 삭제제외 X
**Q3:** 대상 시스템? → **현재 MCP 연결 onprem**
**Ambiguity:** **3.3% ✅ (1차 임계치 5% 통과)**

### Round 14 — 스펙 수정 (사용자 재지시: include 분할)
**사용자 재지시:** "메인 프로그램 안에 Top / Selection screen / Class / PBO / PAI / Form 에 대한 include를 만들고 그 안에 각 영역에 맞는 로직을 집어넣어야 함."
**Q:** Include 네이밍 규칙? → **SAP 표준 O01/I01/F01 스타일** (ZPAEK_TEST004_TOP/SEL/CLS/O01/I01/F01)
**Ambiguity:** **2.7%**

### Round 15 — 스펙 수정 (사용자 재지시: 코딩 표준)
**사용자 재지시:** "즉시 실행 가능한 ABAP 코드 우선 + ABAP 7.40+ 문법(Inline DATA, VALUE, NEW, CONV 등) + Open SQL 최적화(SELECT * 금지, 필요한 필드만, round-trip 최소화) + 간결 주석(로직 의도/S/4HANA 특이사항) + 구조화"
**결과:** "코딩 표준" 섹션 추가 + F01 샘플을 즉시 실행 가능한 ABAP 7.40+ 코드로 승격 (JOIN/FOR ALL ENTRIES/REDUCE FOR IN WHERE/VALUE#/NEW#/constants) + S/4HANA CDS view migration 주석
**Ambiguity:** **2.4% ✅ (최종)**

</details>

## 주의 사항 (CLAUDE.md workflow rules reminder)

이 스펙을 집행(execution)하는 단계에서는 반드시:

1. **[Rule 1] Diff 표시** — 기존 객체가 있으면 Update* 호출 전에 Before/After diff를 사용자에게 보여줄 것. 신규 생성(Create*)은 이 규칙 대상 아님, 단 선택화면·로직 초안을 먼저 보여주고 Create 호출.
2. **[Rule 2] Notion 로깅** — SAP에 활성화 완료 후 Team2↔Team3 Code History DB에 Before/After 포함 엔트리 기록.
3. **프로그램에 대해 Preflight 체크** — memory의 preflight rollout 상태 확인, ZPAEK_TEST004 Create/Update에 preflight 적용 가능하면 적용.
