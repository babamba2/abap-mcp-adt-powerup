# Deep Interview Spec: PO-GR Worklist ABAP Report

## Metadata
- Interview ID: po-gr-worklist
- Rounds: 5
- Final Ambiguity Score: 15.2%
- Type: greenfield (ABAP 새 프로그램)
- Generated: 2026-04-10
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.40 | 0.368 |
| Constraint Clarity | 0.78 | 0.30 | 0.234 |
| Success Criteria | 0.82 | 0.30 | 0.246 |
| **Total Clarity** | | | **0.848** |
| **Ambiguity** | | | **0.152 (15.2%)** |

## Goal

PO-GR 작업용 대화형 ABAP 리포트. 선택화면으로 조회 범위를 받아 **상단 ALV(PO Line 단위)** 와 **하단 ALV(GR Line 단위)** 를 Master-Detail 구조로 표시하고, 사용자가 GR 포스팅(101/103/105/161), GR 취소(102), MIGO 표시 진입을 한 화면에서 수행할 수 있게 한다. Container는 `CL_GUI_DOCKING_CONTAINER`(상하 Split), ALV는 모두 `CL_GUI_ALV_GRID`를 사용하고, 코드는 Procedural (PERFORM 기반) 스타일로 작성한다.

## Constraints

### 기술 제약
- Language: ABAP 7.54+ (S/4HANA on-prem)
- Container: `CL_GUI_DOCKING_CONTAINER` (상하 2개 Split)
- ALV: `CL_GUI_ALV_GRID` × 2 (Master: PO Line / Detail: GR Line)
- 프로그래밍 스타일: **Procedural (PERFORM)** — 전역 DATA 선언 후 FORM 루틴 호출
- 이벤트 핸들러는 로컬 클래스(LCL_EVENTS) 필요 (이벤트 시스템 특성상 불가피) — 단, 실제 비즈니스 로직은 PERFORM으로 위임
- Tree ALV 금지 → Master-Detail 평면 구조로 계층 표현
- Hierarchical Display (sub-row) 금지 → 상단/하단 그리드 분리

### 데이터 제약
- 삭제된 PO 라인은 항상 자동 제외 (`EKPO-LOEKZ = SPACE`)
- "오픈 PO" 정의: `EKPO-ELIKZ ≠ 'X' AND (EKPO-MENGE > 누적 WEMNG)`
- Material Doc 연결: `EKBE` 테이블로 PO ↔ MSEG 매핑 (VGABE='1' for GR, VGABE='6' for IR)
- MBLNR 컬럼은 하단 그리드에서 Hotspot 활성화

### 선택화면 범위
```abap
SELECTION-SCREEN BLOCK b1 WITH FRAME TITLE TEXT-001.
  SELECT-OPTIONS: s_bukrs FOR ekko-bukrs OBLIGATORY,  " 회사코드 (필수)
                  s_werks FOR ekpo-werks,              " 플랜트
                  s_ekorg FOR ekko-ekorg,              " 구매조직
                  s_ekgrp FOR ekko-ekgrp,              " 구매그룹
                  s_ebeln FOR ekko-ebeln,              " PO 번호
                  s_bedat FOR ekko-bedat DEFAULT       " PO 전표일자 (기본 최근 90일)
                           sy-datum - 90 TO sy-datum,
                  s_lifnr FOR ekko-lifnr,              " 공급사
                  s_matnr FOR ekpo-matnr,              " 자재
                  s_bsart FOR ekko-bsart,              " PO 문서유형
                  s_eindt FOR eket-eindt.              " 납기일
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BLOCK b2 WITH FRAME TITLE TEXT-002.
  PARAMETERS: p_open  RADIOBUTTON GROUP rg1 DEFAULT 'X',  " 오픈 PO만
              p_all   RADIOBUTTON GROUP rg1.              " 전체 (GR 완료 포함)
SELECTION-SCREEN END OF BLOCK b2.
```

- **최대 건수 제한 없음** (사용자가 선택 조건으로 제어)
- **권한 체크:** 표준 AUTHORITY-CHECK (M_MATE_WRK / M_MSEG_WMB / M_BEST_BSA) — 실행 단계에서 확정

## Non-Goals
- **단건 처리 UI 불필요** — 다건 선택 기본 지원
- **Tree/hierarchical ALV 구현 안 함** — Master-Detail로 대체
- **인라인 편집 안 함** — 모든 입력은 팝업
- **161 이외의 반품 시나리오(122/124 등)는 지원 안 함**
- **MIGO 포스팅 이관 안 함** — 프로그램 내부에서 BAPI 직접 호출
- **배치 관리 자재의 SU 관리(storage unit)는 기본 BAPI 동작 유지, 특수 처리 없음**
- **Custom Transaction 등록은 이 Spec의 범위 밖**
- **Classical Report 출력 안 함** — 전부 ALV

## Acceptance Criteria

### A1. 선택화면 & 데이터 조회
- [ ] A1.1 필수 항목 (S_BUKRS) 미입력 시 필수 에러로 실행 차단
- [ ] A1.2 "오픈 PO만" 라디오 선택 시 `ELIKZ ≠ 'X' AND 미입고 수량 > 0` 조건 적용
- [ ] A1.3 "전체" 라디오 선택 시 모든 PO 라인 포함 (삭제 제외)
- [ ] A1.4 기본 전표일자 = `sy-datum - 90 TO sy-datum`
- [ ] A1.5 BEDAT 및 EINDT 범위 동시 적용 가능

### A2. 상단 ALV (PO Line)
- [ ] A2.1 1 행 = 1 EKPO 라인 (EBELN + EBELP 복합키)
- [ ] A2.2 컬럼: PO번호, 라인번호, 공급사, 공급사명(LFA1-NAME1), 자재, 자재설명(MAKT-MAKTX), 플랜트, PO수량, 단위, 누적입고량, 잔여수량, 전표일자, 납기일, 문서유형, 상태(Open/Completed)
- [ ] A2.3 기본 정렬: PO번호 ↑, 라인번호 ↑
- [ ] A2.4 Row selection 이벤트 → 하단 그리드를 선택된 PO 라인의 GR 목록으로 refresh
- [ ] A2.5 Optimize column width 활성화

### A3. 하단 ALV (GR Line)
- [ ] A3.1 1 행 = 1 MSEG 라인 (MBLNR + MJAHR + ZEILE)
- [ ] A3.2 컬럼: **MBLNR(Hotspot)**, 연도, 아이템, 이동유형, 수량, 단위, 저장위치, 배치, 전기일자, 등록자, 등록일, 상태(101/103/105/161 구분)
- [ ] A3.3 MBLNR 컬럼은 Hotspot으로 표시 (링크 스타일)
- [ ] A3.4 MBLNR Hotspot 클릭 → MIGO **display 모드** 진입 (H05 or A04 action)
- [ ] A3.5 기본 정렬: 전기일자 ↓ (최신 GR이 위에 표시)

### A4. 상단 툴바 - GR 서브메뉴
- [ ] A4.1 상단 그리드 툴바에 "GR ▼" 버튼 추가 (서브메뉴)
- [ ] A4.2 서브메뉴 항목: "GR (101)", "GR Blocked (103)", "Return (161)"
- [ ] A4.3 "Release Blocked (105)"는 상단 메뉴에 **없음** (103 상태인 GR 라인에만 적용되므로)
- [ ] A4.4 상단 그리드에서 다건 선택 가능 → 선택된 N개 라인에 대해 순차 팝업 처리

### A5. 하단 툴바 - Release / Cancel
- [ ] A5.1 하단 그리드 툴바에 "Release Blocked (105)" 버튼 — 선택된 GR 라인이 `BWART = 103`일 때만 활성화
- [ ] A5.2 하단 그리드 툴바에 "Cancel GR (102)" 버튼 — 선택된 GR 라인이 101/103/105 이고 취소 안 된 상태일 때만 활성화
- [ ] A5.3 Cancel 시 BAPI_GOODSMVT_CANCEL 호출

### A6. GR Post 팝업 (동적 레이아웃)
- [ ] A6.1 팝업 헤더: 대상 PO / Item / 자재 / 잔여수량 정보 표시 (read-only)
- [ ] A6.2 이동유형 드롭다운 **없음** — 서브메뉴에서 선택한 BWART가 팝업 타이틀에 표시되고 고정
- [ ] A6.3 **공통 필드**: Quantity (기본=잔여수량), Storage Location (기본=EKPO-LGORT), Batch, Posting Date (기본=sy-datum), Document Date (기본=sy-datum), Delivery Note, Bill of Lading, Header Text
- [ ] A6.4 **161 전용 추가 필드**: Return Reason (`T157F`), Reference Material Doc (원본 GR — 선택된 PO 라인의 기존 101 GR 목록에서 선택)
- [ ] A6.5 수량 유효성: `0 < Quantity ≤ 잔여수량` (101/103/105), `0 < Quantity ≤ 해당 GR의 원본수량` (161)
- [ ] A6.6 전기일자가 해당 회계기간 밖이면 에러 처리 (BAPI가 반환하는 메시지 전달)
- [ ] A6.7 [OK] 클릭 시 BAPI_GOODSMVT_CREATE 호출, [Cancel] 클릭 시 팝업만 닫기 (아무 동작 없음)

### A7. 다건 처리 플로우 (Best-effort)
- [ ] A7.1 상단 그리드에서 N개 선택 + GR 서브메뉴 클릭 → 선택된 라인 순회
- [ ] A7.2 각 라인마다 팝업 오픈 (사용자가 확인 후 OK 또는 Skip)
- [ ] A7.3 한 라인에서 에러가 발생해도 다음 라인으로 계속 진행
- [ ] A7.4 각 BAPI 호출의 RETURN 테이블을 collect
- [ ] A7.5 **완료 후 요약 팝업**: 성공 건수, 실패 건수, 각 실패의 PO/Item + 에러 메시지 전문 표시
- [ ] A7.6 성공/실패 여부는 상태바 메시지로도 즉시 표시

### A8. 성공 피드백 & 동기화
- [ ] A8.1 Post 성공 시 BAPI_TRANSACTION_COMMIT 호출
- [ ] A8.2 성공한 라인의 상단 그리드 "누적입고량" / "잔여수량" / "상태" 컬럼 재계산 후 refresh
- [ ] A8.3 하단 그리드에 새로 생성된 MBLNR 행 즉시 추가 (EKBE 재조회 또는 BAPI 결과에서 MBLNR 취득)
- [ ] A8.4 Cancel 성공 시 취소된 GR 라인의 상태 컬럼을 "Cancelled"로 업데이트 + 상단 그리드의 누적입고량 / 잔여수량 재계산

### A9. 103 → 105 연쇄 워크플로우
- [ ] A9.1 상단 서브메뉴의 "GR Blocked (103)" 클릭 → 팝업 포스팅 → 하단 그리드에 BWART=103 로 표시
- [ ] A9.2 하단 그리드에서 103 라인 선택 → "Release Blocked (105)" 버튼 활성화
- [ ] A9.3 Release 클릭 시 해당 103 전표를 참조하여 105 포스팅 (BAPI_GOODSMVT_CREATE with GM_CODE='02')
- [ ] A9.4 105 포스팅 성공 시 원본 103 라인의 상태를 "Released"로 마킹

### A10. 에러 처리
- [ ] A10.1 BAPI Return Type = E / A 는 실패로 처리
- [ ] A10.2 BAPI Return Type = W / S / I 는 성공이지만 메시지만 수집
- [ ] A10.3 모든 수집된 메시지는 요약 팝업에서 전체 공개
- [ ] A10.4 예상치 못한 예외 (CATCH cx_sy_...) 발생 시 상태바에 덤프 방지 메시지 + 로그

## Assumptions Exposed & Resolved

| Assumption | Challenge (Round) | Resolution |
|------------|-------------------|------------|
| Row 하나가 무엇인지 명확하다 | Round 1 Ontology | 1 PO Line 또는 1 GR Line — Master/Detail 분리 |
| CL_GUI_ALV_GRID가 모든 요구를 충족한다 | Round 2 — Tree 선택과 충돌 | Split Docking + 2× CL_GUI_ALV_GRID로 해결 |
| "all PO-GR" = 모든 PO (unbounded) | Round 3 | 10개 SELECT-OPTIONS + 상태 필터로 scope 제한 |
| GR 버튼은 101만 처리한다 | Round 4 | 101/103/105/161 모두 지원 |
| GR 버튼은 즉시 posting한다 | Round 4 Contrarian | 팝업 입력 방식으로 확정 (안전성 우선) |
| MIGO로 보내는 게 맞다 | Round 4 Contrarian | 빠른 처리/일괄 처리 요구로 BAPI 직접 호출 결정 |
| 이동유형을 팝업에서 고른다 | Round 5 | 상단 서브메뉴에서 선택 후 팝업 — 팝업에는 드롭다운 없음 |
| 실패 시 전체 롤백 | Round 5 | Best-effort + 각 건별 commit + 최종 요약 |
| MIGO 진입 경로는 없다 | Round 5 (사용자 추가 요구) | MBLNR Hotspot → MIGO display 모드 |

## Technical Context

### 권장 프로그램 구조 (ZPAEK_TEST003 템플릿 재사용)

```
ZPAEK_GR_WKLST                 (main, REPORT 선언 + 선택화면 + INCLUDE 문)
├── ZPAEK_GR_WKLST_TOP          (전역 TYPES, DATA, CLASS-DATA: LCL_EVENTS의 reference 포함)
├── ZPAEK_GR_WKLST_SEL          (SELECTION-SCREEN 블록 2개)
├── ZPAEK_GR_WKLST_CL           (LCL_EVENTS 클래스: toolbar / user_command / hotspot_click / row_selected 이벤트만 담당, 실제 로직은 PERFORM 위임)
├── ZPAEK_GR_WKLST_O            (PBO: CALL SCREEN 100의 MODULE STATUS_0100 / MODULE INITIALIZE_ALV)
├── ZPAEK_GR_WKLST_I            (PAI: MODULE USER_COMMAND_0100)
└── ZPAEK_GR_WKLST_F            (FORM 루틴 모음 — 대부분의 로직이 여기 존재)
```

### 주요 FORM 루틴 (F include)

```abap
FORM get_po_data.                " 상단 ALV 데이터 조회 (EKKO+EKPO+EKBE 집계)
FORM get_gr_data USING ps_po.    " 하단 ALV 데이터 조회 (선택된 PO 라인의 EKBE/MSEG)
FORM build_po_fieldcat CHANGING ct_fcat.
FORM build_gr_fieldcat CHANGING ct_fcat.
FORM init_docking_containers.    " 상·하 Split 2개 생성
FORM init_po_grid.
FORM init_gr_grid.
FORM handle_po_row_selected USING iv_row_id. " → get_gr_data + refresh 하단
FORM handle_gr_function_code USING iv_fcode. " 툴바 버튼 → 각 처리 FORM 디스패치
FORM open_gr_post_popup USING iv_bwart ct_po_selected ct_result.
FORM post_goodsmvt_create USING is_input iv_bwart ct_return.
FORM post_goodsmvt_cancel USING is_gr ct_return.
FORM post_release_blocked USING is_gr_103 ct_return.
FORM call_migo_display USING iv_mblnr iv_mjahr.
FORM show_summary_popup USING ct_success ct_failure.
FORM refresh_po_row USING iv_ebeln iv_ebelp.
FORM append_new_gr_row USING iv_mblnr iv_mjahr.
```

### 사용 BAPI / FM
- `BAPI_GOODSMVT_CREATE` — GM_CODE '01'=101, '02'=105, '03'=161 , '04' 기타 → GoodsmvtHeader, GoodsmvtItem, GoodsmvtCode
- `BAPI_GOODSMVT_CANCEL` — 102 역분개
- `BAPI_TRANSACTION_COMMIT` / `BAPI_TRANSACTION_ROLLBACK`
- MIGO 진입: `CALL TRANSACTION 'MIGO'` with BDC `OKCODE = OK_GO_M_GRPO` 또는 `SET PARAMETER ID + CALL TRANSACTION`

### 권장 Screen 설계
- Screen 0100: Docking Container 용 (Custom Control 불필요 — docking은 코드에서 붙임)
- GUI Status: 'MAIN100' (BACK/EXIT/CANCEL + 필요 시 Refresh/Save)
- Title Bar: 'T100'

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| PO Line | core domain | EBELN, EBELP, MATNR, WERKS, LGORT, MENGE, WEMNG(집계), MEINS, BSART, ELIKZ, LOEKZ | belongs to EKKO, has many GR Lines (via EKBE) |
| GR Line | core domain | MBLNR, MJAHR, ZEILE, BWART, MENGE, MEINS, LGORT, CHARG, BUDAT | references PO Line (EBELN+EBELP), part of Material Document |
| Material Document | core domain | MBLNR, MJAHR, BLART, BUDAT, USNAM, CPUDT | has many GR Lines (MKPF header) |
| MovementType | supporting | BWART (101/103/105/161/102) | classifies GR Line |
| Selection Set | supporting | S_BUKRS, S_WERKS, ..., P_OPEN/P_ALL | input to PO Line query |
| Popup Layout | supporting | fields per BWART (161은 Return Reason + Ref MBLNR 추가) | determines GR Post popup structure |
| BAPI Result Summary | supporting | success_count, failure_count, messages[] | output of multi-row processing |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 2 | 2 | - | - | N/A |
| 2 | 2 | 0 | 0 | 2 | 100% |
| 3 | 3 | 1 | 0 | 2 | 67% |
| 4 | 5 | 2 | 0 | 3 | 60% |
| 5 | 7 | 2 | 0 | 5 | 71% |

Entities grew steadily without renames or removals — domain model stable.

## Interview Transcript

<details>
<summary>Round 1 — ALV 행 단위 결정</summary>

**Q1:** ALV 한 줄이 의미하는 것은? (a~e 옵션)
**A1:** (d) Tree로 진행
**Result:** Tree 선택은 CL_GUI_ALV_GRID와 충돌 → Round 2로 이관
**Scores:** Goal 0.50 / Constraint 0.20 / Success 0.15 → 70%

</details>

<details>
<summary>Round 2 — 기술 충돌 해결</summary>

**Q2:** CL_GUI_ALV_GRID vs CL_GUI_ALV_TREE (a~d 옵션)
**A2:** (c) Master-Detail 구조 유지 (2× CL_GUI_ALV_GRID + Split Docking)
**Scores:** Goal 0.70 / Constraint 0.20 / Success 0.15 → 62%

</details>

<details>
<summary>Round 3 — 선택화면 범위</summary>

**Q3:** SELECT-OPTIONS 항목 선택 (필수/추가/상태 필터)
**A3:** "추가로 자주 쓰는것 다 포함. 최대 건수는 필요없음. 상태 필터 모두 포함. 기본값은 알아서"
**Result:** 10개 SELECT-OPTIONS + 상태 2-radio + 삭제 자동 제외
**Scores:** Goal 0.70 / Constraint 0.65 / Success 0.15 → 48%

</details>

<details>
<summary>Round 4 — GR 액션 동작 (Contrarian 모드)</summary>

**Q4:** 입력방식 / 이동유형 / 다중처리 / Cancel / Contrarian 질문
**A4:** ① b (팝업), ② b+c (101/103/105/161), ③ b (다건 순차), ④ b (하단 선택 → Cancel), 빠른/일괄 처리 필요로 BAPI 직접 호출, MBLNR Hotspot으로 MIGO display 진입 필수
**Scores:** Goal 0.85 / Constraint 0.70 / Success 0.55 → 29%

</details>

<details>
<summary>Round 5 — 팝업 & 피드백</summary>

**Q5:** 팝업 레이아웃 / 이동유형 UX / 103-105 워크플로우 / 다건 처리 / 피드백
**A5:** ① B안 (동적), ② C안 (서브메뉴), ③ b (연쇄), ④ b+메시지 필수, ⑤ d (refresh + append)
**Scores:** Goal 0.92 / Constraint 0.78 / Success 0.82 → **15.2% ✅**

</details>

## Open Items for Execution Phase

이 Spec이 가이드하지 않는 항목 — 실행 단계에서 확정 필요:

1. **프로그램명** (예: `ZPAEK_GR_WKLST`, `ZPAEK_PO_GR_WORKLIST`)
2. **Package** (예: `$TMP` vs `ZPAEK`)
3. **Transport Request** (기존 사용: `S4HK904224`)
4. **Authorization objects** — AUTHORITY-CHECK 구체 대상 (M_MATE_WRK, M_MSEG_WMB, M_BEST_BSA 중 어떤 걸 얼마나 엄격히)
5. **MIGO display 진입 방법** — SET PARAMETER + CALL TRANSACTION (간단) vs BDC Mode 'E' (safer)
6. **Screen 0100의 GUI Status 이름** — 기본 'MAIN100' 제안
7. **ALV Layout 저장 기능** — 필요 여부 (기본 yes, `i_save = 'A'`)
