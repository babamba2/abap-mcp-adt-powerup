# MCP ABAP ADT

**🌐 Language / 언어 / 言語**: [English](README.md) · **한국어** · [日本語](README.ja.md)

[![npm version](https://img.shields.io/npm/v/@mcp-abap-adt/core)](https://www.npmjs.com/package/@mcp-abap-adt/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-purple)](https://claude.com/claude-code)

## 감사의 말

이 프로젝트는 [mario-andreschak/mcp-abap-adt](https://github.com/mario-andreschak/mcp-abap-adt)와 [fr0ster/mcp-abap-adt](https://github.com/fr0ster/mcp-abap-adt/tree/main/src)에서 영감을 받아 시작되었습니다. 핵심 아이디어를 출발점 삼아 자체 아키텍처와 기능을 갖춘 독립 프로젝트로 발전시켰습니다. 원 저자들과 모든 [컨트리뷰터](#컨트리뷰터) 분들께 깊이 감사드립니다 — 이분들의 작업 없이는 지금의 모습이 불가능했습니다.

---

**SAP ABAP 개발을 위한 Model Context Protocol(MCP) 서버** — AI 어시스턴트 및 코드 에디터가 ABAP Developer Toolkit(ADT) API를 통해 SAP 시스템과 직접 상호작용할 수 있게 해줍니다.

Claude Code, Cline, Cursor, Windsurf 등 MCP 호환 클라이언트에서 ABAP 오브젝트를 조회·생성·수정·삭제할 수 있으며, ABAP Cloud(BTP), On-Premise, Legacy SAP 시스템을 모두 지원합니다.

---

## 목차

- [주요 기능](#주요-기능)
- [지원 SAP 환경](#지원-sap-환경)
- [빠른 시작](#빠른-시작)
- [설치](#설치)
- [Claude Code 플러그인](#claude-code-플러그인)
- [환경 설정](#환경-설정)
- [인증](#인증)
- [제공 툴](#제공-툴)
- [전송 프로토콜](#전송-프로토콜)
- [클라이언트 설정](#클라이언트-설정)
- [핸들러 아키텍처](#핸들러-아키텍처)
- [Docker 배포](#docker-배포)
- [개발](#개발)
- [테스트](#테스트)
- [문제 해결](#문제-해결)
- [자주 묻는 질문](#자주-묻는-질문)
- [문서](#문서)
- [선택 기능: 데이터 조회 차단](#선택-기능-데이터-조회-차단)
- [기여](#기여)
- [라이선스](#라이선스)

---

## 주요 기능

- **287개의 MCP 툴** — SAP ABAP 개발 전반 지원
- **30종 이상의 ABAP 오브젝트 타입** (Class, Interface, CDS View, Table, RAP 등)
- **다중 전송 프로토콜**: stdio, HTTP(StreamableHTTP), SSE
- **유연한 인증**: JWT/XSUAA(OAuth2), Basic Auth, Service Key
- **멀티 환경**: ABAP Cloud(BTP), On-Premise, Legacy(BASIS < 7.50)
- **런타임 진단**: 프로파일링, 덤프 분석, SQL 쿼리
- **핸들러 그룹**: Read-Only, High-Level, Low-Level, Compact, System, Search
- **임베딩 지원**: 독립 서버로 실행하거나 기존 MCP 서버에 핸들러를 내장
- **자동 설정**: `@mcp-abap-adt/configurator`로 클라이언트 자동 구성
- **헬스 엔드포인트**: HTTP/SSE 전송에서 `GET /mcp/health`
- **선택적 데이터 조회 차단**: 민감 테이블(개인정보, 인증, 급여, 은행) 행 데이터 조회를 서버 단에서 차단하는 opt-in 블로킹(`SC4SAP_POLICY=on`) — 호출 주체에 관계없이 적용됨 — [선택 기능: 데이터 조회 차단](#선택-기능-데이터-조회-차단) 참조

---

## 지원 SAP 환경

| 환경 | 인증 방식 | 비고 |
|------|-----------|------|
| **ABAP Cloud (BTP)** | JWT/XSUAA, Service Key | RAP/CDS 완전 지원 |
| **On-Premise** | Basic Auth, JWT | Program, Screen, GUI Status 사용 가능 |
| **Legacy** (BASIS < 7.50) | Basic Auth | ADT API 일부만 지원 |

---

## 빠른 시작

### 1. 설치

```bash
npm install -g @mcp-abap-adt/core
```

### 2. 환경 변수 설정

```bash
cat > .env << 'EOF'
SAP_URL=https://your-sap-system.com
SAP_CLIENT=100
SAP_AUTH_TYPE=basic
SAP_USERNAME=your_username
SAP_PASSWORD=your_password
EOF
```

### 3. 실행

```bash
# stdio (Claude Code, Cline, Cursor 등)
mcp-abap-adt

# HTTP 서버
mcp-abap-adt --transport=http --port 3000

# SSE 서버
mcp-abap-adt --transport=sse --port 3000
```

---

## 설치

### npm (권장)

```bash
npm install -g @mcp-abap-adt/core
```

### 소스에서 설치

```bash
git clone --recurse-submodules https://github.com/babamba2/abap-mcp-adt-powerup.git
cd abap-mcp-adt-powerup
npm install
npm run build
npm start
```

### 플랫폼별 가이드

- [Windows 설치](docs/installation/platforms/INSTALL_WINDOWS.md)
- [macOS 설치](docs/installation/platforms/INSTALL_MACOS.md)
- [Linux 설치](docs/installation/platforms/INSTALL_LINUX.md)

---

## Claude Code 플러그인

이 저장소는 Claude Code 마켓플레이스 플러그인 형태로도 제공됩니다.

### 마켓플레이스로 설치

```bash
# 마켓플레이스 등록 (최초 1회)
/plugin marketplace add babamba2/abap-mcp-adt-powerup

# 플러그인 설치
/plugin install abap-mcp-adt-powerup
```

설치 후 [환경 설정](#환경-설정)대로 변수를 채우거나 자동 설정 CLI를 사용하세요.

```bash
npx @mcp-abap-adt/configurator
```

### 로컬 플러그인 경로

로컬에서 이 저장소를 수정 중이라면 아래 경로에서 이미 플러그인으로 인식됩니다.

```
~/.claude/plugins/marketplaces/abap-mcp-adt-powerup
```

Claude Code에서 `/plugin` → *Reload*로 반영됩니다.

---

## 환경 설정

### 환경 변수 (.env)

```env
# SAP 접속
SAP_URL=https://your-abap-system.com
SAP_CLIENT=100
SAP_LANGUAGE=en

# 시스템 유형: cloud(기본) / onprem / legacy
SAP_SYSTEM_TYPE=cloud

# TLS: 자체 서명 인증서 허용 (개발용)
TLS_REJECT_UNAUTHORIZED=0

# 인증
SAP_AUTH_TYPE=xsuaa          # JWT는 'xsuaa', 아이디/비번은 'basic'
SAP_JWT_TOKEN=your_jwt_token
# SAP_USERNAME=your_username
# SAP_PASSWORD=your_password

# On-Premise 생성/수정 시 필요
# SAP_MASTER_SYSTEM=DEV
# SAP_RESPONSIBLE=your_username

# 타임아웃 (ms)
SAP_TIMEOUT_DEFAULT=45000
SAP_TIMEOUT_CSRF=15000
SAP_TIMEOUT_LONG=60000
```

### CLI 옵션

```bash
mcp-abap-adt [options]

옵션:
  --transport=<type>    전송 프로토콜: stdio(기본), http, sse
  --port <number>       포트 (http/sse, 기본 3000)
  --host <address>      바인드 주소 (http/sse, 기본 localhost)
  --env <destination>   멀티 시스템용 destination 이름
  --env-path <path>     .env 파일 경로
```

### YAML 설정

CLI 인자 대신 YAML로 구성 가능. [YAML Config 가이드](docs/configuration/YAML_CONFIG.md) 참고.

---

## 인증

### Basic Auth (On-Premise)

```env
SAP_AUTH_TYPE=basic
SAP_USERNAME=developer
SAP_PASSWORD=secret123
```

### JWT / XSUAA (Cloud / On-Premise)

```env
SAP_AUTH_TYPE=xsuaa
SAP_JWT_TOKEN=eyJhbGciOiJSUzI1NiIs...
```

### Service Key (BTP)

서비스 키 JSON 파일을 두고 configurator(`@mcp-abap-adt/configurator`)로 구성합니다.

### HTTP 헤더 기반 인증 (HTTP/SSE)

멀티 테넌트·프록시 환경에서는 `x-sap-*` 헤더로 접속 정보를 전달합니다. [인증 가이드](docs/user-guide/AUTHENTICATION.md) 참고.

---

## 제공 툴

**287개** 툴이 핸들러 그룹으로 나뉘어 제공됩니다.

### 카테고리

| 카테고리 | 개수 | 설명 |
|---------|-----:|------|
| **Read-Only** | 52 | 변경 없이 조회 전용 |
| **High-Level** | 113 | 사용자 친화적 CRUD |
| **Low-Level** | 122 | ADT API 직접 제어 |
| **Compact** | 22 | 자주 쓰는 동작 간소화 |
| **System** | - | 런타임 분석, 프로파일링, 덤프, SQL |
| **Search** | - | 오브젝트 검색, Where-used |

### 지원 ABAP 오브젝트 타입

| 오브젝트 | 조회 | 생성 | 수정 | 삭제 |
|---------|:---:|:---:|:---:|:---:|
| Class (CLAS) | O | O | O | O |
| Interface (INTF) | O | O | O | O |
| Program (PROG) | O | O | O | O |
| Include | O | O | O | O |
| Table (TABL) | O | O | O | O |
| Structure | O | O | O | O |
| CDS View (DDLS) | O | O | O | O |
| Domain | O | O | O | O |
| Data Element (DTEL) | O | O | O | O |
| Function Group (FUGR) | O | O | O | O |
| Function Module (FUNC) | O | O | O | O |
| Package (DEVC) | O | O | O | O |
| Transport | O | O | - | - |
| Service Definition (SRVD) | O | O | O | O |
| Service Binding (SRVB) | O | O | O | O |
| Behavior Definition (BDEF) | O | O | O | O |
| Behavior Implementation (BIMP) | O | O | O | O |
| Metadata Extension (DDLX) | O | O | O | O |
| Screen (DYNP) | O | O | O | O |
| GUI Status | O | O | O | O |
| Text Element | O | O | O | O |
| Unit Test | O | O | O | O |
| CDS Unit Test | O | O | O | O |
| Enhancement | O | - | - | - |

### 런타임·시스템 툴

- **런타임 프로파일링** — Class/Program 실행 추적
- **덤프 분석** — ABAP 런타임 덤프 조회·분석
- **SQL 쿼리** — `GetSqlQuery` via ADT
- **테이블 조회** — `GetTableContents`
- **오브젝트 검색** — `SearchObject`
- **Where-used 분석** — `GetWhereUsed`
- **타입 정보** — `GetTypeInfo`
- **비활성 오브젝트** — `GetInactiveObjects`
- **AST / 시맨틱 분석** — ABAP 구문 트리 파싱

전체 레퍼런스는 [AVAILABLE_TOOLS.md](docs/user-guide/AVAILABLE_TOOLS.md).

---

## 전송 프로토콜

### stdio (기본)

Claude Code, Cline, Cursor 등 MCP 클라이언트에서 사용.

```bash
mcp-abap-adt
# 또는
mcp-abap-adt --transport=stdio
```

### HTTP (StreamableHTTP)

웹 클라이언트·다중 사용자 배포에 적합.

```bash
mcp-abap-adt --transport=http --port 3000 --host 0.0.0.0
```

헬스 체크: `GET /mcp/health`

### SSE (Server-Sent Events)

세션 관리가 포함된 long-polling 전송.

```bash
mcp-abap-adt --transport=sse --port 3000
```

---

## 클라이언트 설정

### Claude Code

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "npx",
      "args": ["-y", "@mcp-abap-adt/core"],
      "env": {
        "SAP_URL": "https://your-sap-system.com",
        "SAP_CLIENT": "100",
        "SAP_AUTH_TYPE": "basic",
        "SAP_USERNAME": "developer",
        "SAP_PASSWORD": "secret"
      }
    }
  }
}
```

### Cline / Cursor / VS Code

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "npx",
      "args": ["-y", "@mcp-abap-adt/core"],
      "env": {
        "SAP_URL": "https://your-sap-system.com",
        "SAP_CLIENT": "100",
        "SAP_AUTH_TYPE": "xsuaa",
        "SAP_JWT_TOKEN": "eyJhbGciOiJSUzI1NiIs..."
      }
    }
  }
}
```

### 자동 설정

```bash
npx @mcp-abap-adt/configurator
```

더 많은 예시는 [클라이언트 설정 가이드](docs/user-guide/CLIENT_CONFIGURATION.md) 참고.

---

## 핸들러 아키텍처

핸들러 그룹 구조로 구성되어 있으며 각 카테고리는 `high/`, `low/`, `readonly/` 하위 디렉토리를 갖습니다. 자세한 내용은 영문 README와 [TOOLS_ARCHITECTURE.md](docs/architecture/TOOLS_ARCHITECTURE.md) 참고.

### 핸들러 임베딩

기존 MCP 서버(CAP/CDS 등)에 통합:

```typescript
import { HandlerExporter } from '@mcp-abap-adt/core/handlers';

const exporter = new HandlerExporter({
  includeReadOnly: true,
  includeHighLevel: true,
  includeLowLevel: false,
  includeSystem: true,
  includeSearch: true,
});

exporter.registerOnServer(mcpServer, () => connection);
```

---

## Docker 배포

```bash
# 빌드 + 실행
npm run docker:build
npm run docker:up

# 사전 빌드된 패키지 사용
npm run docker:build:package
npm run docker:up:package
```

자세한 내용은 [Docker 배포 가이드](docs/deployment/DOCKER.md).

---

## 개발

### 요구사항

- **Node.js** ≥ 20.0.0
- **npm** ≥ 9.0.0
- **TypeScript** 5.9+

### 셋업

```bash
git clone --recurse-submodules https://github.com/babamba2/abap-mcp-adt-powerup.git
cd abap-mcp-adt-powerup
npm install
npm run build
```

### 주요 스크립트

| 명령 | 설명 |
|------|------|
| `npm run build` | Lint + TypeScript 컴파일 |
| `npm run build:fast` | 컴파일만 (lint 생략) |
| `npm run dev` | 빌드 + MCP Inspector(stdio) |
| `npm run dev:http` | 빌드 + HTTP 개발 서버 |
| `npm run dev:sse` | 빌드 + SSE 개발 서버 |
| `npm run lint` | Biome 린트 + 자동 수정 |
| `npm run format` | Biome 포맷 |
| `npm start` | MCP 서버 실행 (stdio) |
| `npm run start:http` | HTTP 서버 실행 |
| `npm run start:sse` | SSE 서버 실행 |
| `npm run docs:tools` | 툴 문서 재생성 |

---

## 테스트

### 통합 테스트

- **Soft 모드** (기본): 핸들러를 직접 호출
- **Hard 모드**: MCP 서버를 stdio로 기동해 프로토콜 경유

### 실행

```bash
npm run test:init          # 템플릿에서 설정 생성
npm test                   # 유닛 테스트
npm run test:integration   # 통합(Soft)
npm run test:high          # High-level만
npm run test:low           # Low-level만
npm run test:check         # 타입 체크
```

자세한 내용은 [테스트 가이드](docs/development/tests/TESTING_GUIDE.md).

---

## 문제 해결

### `self-signed certificate in certificate chain`

개발 환경에서만:

```env
TLS_REJECT_UNAUTHORIZED=0
```

운영에서는 SAP CA 인증서를 Node.js 트러스트 스토어에 설치하세요.

### `401 Unauthorized` / `403 Forbidden`

- **Basic**: `SAP_USERNAME`/`SAP_PASSWORD`, ADT 권한(`S_DEVELOP`, `S_RFC`, `S_TCODE`) 확인
- **JWT/XSUAA**: 토큰 만료 — configurator/서비스 키로 갱신
- **Client 불일치**: `SAP_CLIENT`이 로그온 client와 일치하는지 확인

### Update/Create 시 `CSRF token validation failed`

세션이 CSRF 토큰을 잃은 경우입니다. 지속되면:

- `SAP_TIMEOUT_CSRF` 증가 (기본 15s)
- 프록시가 쿠키를 제거하는지 확인

### On-Premise 에서 `transport required`

On-Prem 생성/수정에는 TR이 필요합니다.

```env
SAP_MASTER_SYSTEM=DEV
SAP_RESPONSIBLE=your_username
```

그리고 핸들러에 `transport=<TRKORR>`를 넘기거나 로컬 패키지(`$TMP`)를 사용하세요.

### Claude Code에서 MCP 서버가 보이지 않을 때

1. 설정 수정 후 Claude Code 재시작
2. 로그 확인: `~/.claude/logs/`
3. 쉘에서 `mcp-abap-adt`를 직접 실행해 에러 없이 기동되는지 확인

### Cloud에서 `Programs not available`

Program(`PROG`)은 On-Prem/Legacy 전용입니다. ABAP Cloud에서는 Class나 CDS를 사용하세요.

---

## 자주 묻는 질문

**Q. S/4HANA Cloud, public edition 지원하나요?**
네. ABAP Cloud(BTP)에서 JWT/XSUAA 또는 서비스 키로 접속합니다. RAP/CDS는 완전 지원, 클래식 오브젝트(Program, Screen, GUI Status)는 클라우드에서 사용 불가.

**Q. Claude Code 없이도 쓸 수 있나요?**
네. Cline, Cursor, Windsurf, VS Code MCP 확장, `@modelcontextprotocol/sdk` 기반 커스텀 클라이언트 등 MCP 호환이면 모두 가능합니다.

**Q. 제공 툴을 일부만 노출하려면?**
임베딩 시 `HandlerExporter`로 그룹을 선택하거나, 환경 플래그로 비활성화합니다. [Handler Management](docs/user-guide/HANDLERS_MANAGEMENT.md) 참고.

**Q. 운영 시스템에서 써도 안전한가요?**
SAP 권한을 그대로 따릅니다 — SE80/ADT에서 못하는 것은 여기서도 못합니다. 그래도 전용 개발 계정, 비운영 우선 테스트를 권장합니다.

**Q. 여러 SAP 시스템을 동시에 쓰려면?**
`--env <destination>` + destination 별 `.env` 파일을 쓰거나 YAML 설정을 사용하세요. HTTP/SSE 배포에서는 요청마다 `x-sap-*` 헤더를 전달합니다.

**Q. RFC도 지원하나요?**
ADT HTTP API가 없는 Legacy 시스템용으로 지원됩니다. 테스트 설정에 `connection_type: rfc`로 전환하며, 로컬에 SAP NW RFC SDK가 필요합니다.

---

## 문서

| 가이드 | 설명 |
|-------|------|
| [Installation](docs/installation/INSTALLATION.md) | 플랫폼별 설치 |
| [Client Configuration](docs/user-guide/CLIENT_CONFIGURATION.md) | MCP 클라이언트 설정 |
| [Authentication](docs/user-guide/AUTHENTICATION.md) | 인증·Destination |
| [Available Tools](docs/user-guide/AVAILABLE_TOOLS.md) | 287 툴 레퍼런스 |
| [CLI Options](docs/user-guide/CLI_OPTIONS.md) | CLI 레퍼런스 |
| [YAML Config](docs/configuration/YAML_CONFIG.md) | YAML 설정 |
| [Architecture](docs/architecture/ARCHITECTURE.md) | 시스템 아키텍처 |
| [Stateful Sessions](docs/architecture/STATEFUL_SESSION_GUIDE.md) | Lock/Update/Unlock 흐름 |
| [Handler Architecture](docs/architecture/TOOLS_ARCHITECTURE.md) | 툴·핸들러 구조 |
| [Docker Deployment](docs/deployment/DOCKER.md) | 컨테이너 배포 |
| [Testing Guide](docs/development/tests/TESTING_GUIDE.md) | 테스트 실행 |
| [Handler Management](docs/user-guide/HANDLERS_MANAGEMENT.md) | 핸들러 그룹 on/off |

---

## 선택 기능: 데이터 조회 차단

행(row) 데이터를 반환하는 툴(`GetTableContents`, `GetSqlQuery`)은 민감한 업무 데이터 — 개인정보, 인증, 급여, 은행, 거래 재무 — 를 노출할 수 있습니다. 본 서버는 이런 호출이 SAP에 도달하기 전에 서버 단에서 차단하는 **opt-in 블로킹 기능**을 내장하고 있으며, 호출 주체(Claude, 다른 LLM, 직접 JSON-RPC, 외부 스크립트)와 무관하게 동작합니다.

이 기능은 **기본 비활성** 입니다 — 명시적으로 켜지 않는 한 아무것도 차단되지 않습니다.

### 활성화

```bash
export SC4SAP_POLICY=on                    # 또는 strict | standard | minimal | custom
export SC4SAP_POLICY_PROFILE=strict        # 선택 (SC4SAP_POLICY=on일 때 기본값)
export SC4SAP_BLOCKLIST_PATH=/path/to/table_exception.md   # 선택 (추가 목록)
export SC4SAP_ALLOW_TABLE=TAB1,TAB2        # 세션 한정 긴급 예외 (로그 기록)
```

### 프로파일

| 프로파일 | 차단 범위 |
|----------|-----------|
| `strict` (`SC4SAP_POLICY=on` 기본값) | PII + 인증 + HR + 거래 재무 + 감사 로그 + 워크플로우 |
| `standard` | PII + 인증 + HR + 거래 재무 |
| `minimal` | PII + 인증 + HR + Tax (일반 비즈니스 테이블 허용) |
| `custom` | 내장 목록 무시, `blocklist-custom.txt` 만 사용 |

### 동작

차단된 테이블에 접근하면 서버가 `isError: true`와 카테고리 별 이유를 반환하며 **SAP에는 요청이 전송되지 않습니다**. 스키마/DDIC 메타데이터(`GetTable`, `GetStructure`, `GetView`, `GetDataElement`, `GetDomain`), 존재 확인(`SearchObject`), `GetSqlQuery`의 집계-only(COUNT/SUM) 쿼리는 정상 허용됩니다.

내장 차단 목록은 은행(BNKA, KNBK, LFBK, REGUH), 고객/거래처 PII(KNA1, LFA1, BUT000, BUT0ID), 주소(ADRC, ADR6, ADRP), 인증(USR02, RFCDES, AGR_1251), HR/급여(`PA*` / `HRP*` / `PCL*`), 세금 ID, 보호 대상 거래 데이터(VBAK/BKPF/ACDOCA), 감사 로그, 커스텀 `Z*` PII 패턴 등 100+ 테이블/패턴을 포함합니다.

본 기능은 [sc4sap](https://github.com/babamba2/superclaude-for-sap) 플러그인과 함께 쓰이도록 설계되었지만 **sc4sap에 종속되지 않습니다** — 어떤 MCP 클라이언트든 이 기능의 혜택을 받을 수 있습니다.

---

## 기여

기여를 환영합니다. 셋업은 [개발 문서](docs/development/)를 참고하세요.

### 컨트리뷰터

- **Paek Seunghyun** ([@babamba2](https://github.com/babamba2)) - 기능 개선 및 추가본 배포
- **Oleksii Kyslytsia** ([@fr0ster](https://github.com/fr0ster)) — 메인 메인테이너 (539+ 커밋)
- **mario-andreschak** ([@mario-andreschak](https://github.com/mario-andreschak)) — 원작 프로젝트 메인테이너
- **Henry Mao** ([@calclavia](https://github.com/calclavia))
- **Aleksandr Razinkin** ([@raaleksandr-epam](https://github.com/raaleksandr-epam))
- **Frank Fiegel** ([@punkpeye](https://github.com/punkpeye))
---

## 라이선스

[MIT](LICENSE) — Copyright (c) 2026 백승현 (Paek Seunghyun)
