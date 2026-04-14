<p align="center">
  <img src="logo.png" alt="MCP ABAP ADT" width="160" />
</p>

# MCP ABAP ADT

**🌐 Language / 언어**: **English** · [한국어](README.ko.md)

[![npm version](https://img.shields.io/npm/v/@mcp-abap-adt/core)](https://www.npmjs.com/package/@mcp-abap-adt/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-purple)](https://claude.com/claude-code)

**Model Context Protocol (MCP) server for SAP ABAP development** — enables AI assistants and code editors to interact with SAP systems via ABAP Developer Toolkit (ADT) APIs.

Read, create, update, and delete ABAP objects directly from Claude Code, Cline, Cursor, Windsurf, or any MCP-compatible client. Supports ABAP Cloud (BTP), On-Premise, and Legacy SAP systems.

---

## Table of Contents

- [Features](#features)
- [Supported SAP Environments](#supported-sap-environments)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Claude Code Plugin](#claude-code-plugin)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Available Tools](#available-tools)
- [Transport Protocols](#transport-protocols)
- [Client Configuration](#client-configuration)
- [Handler Architecture](#handler-architecture)
- [Docker Deployment](#docker-deployment)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Features

- **287 MCP Tools** for comprehensive SAP ABAP development
- **30+ ABAP object types** supported (Classes, Interfaces, CDS Views, Tables, RAP, and more)
- **Multiple transport protocols**: stdio, HTTP (StreamableHTTP), SSE
- **Flexible authentication**: JWT/XSUAA (OAuth2), Basic Auth, Service Key
- **Multi-environment**: ABAP Cloud (BTP), On-Premise, Legacy (BASIS < 7.50)
- **Runtime diagnostics**: Profiling, dump analysis, SQL queries
- **Handler groups**: Read-Only, High-Level, Low-Level, Compact, System, Search
- **Embeddable**: Use as a standalone server or embed handlers into existing MCP servers
- **Auto-configurator**: `@mcp-abap-adt/configurator` for automated client setup
- **Health endpoint**: `GET /mcp/health` for HTTP/SSE transports

---

## Supported SAP Environments

| Environment | Auth Methods | Notes |
|------------|-------------|-------|
| **ABAP Cloud (BTP)** | JWT/XSUAA, Service Key | Full RAP/CDS support |
| **On-Premise** | Basic Auth, JWT | Programs, Screens, GUI Statuses available |
| **Legacy** (BASIS < 7.50) | Basic Auth | Limited ADT API surface |

---

## Quick Start

### 1. Install

```bash
npm install -g @mcp-abap-adt/core
```

### 2. Configure environment

```bash
# Create .env file in your working directory
cat > .env << 'EOF'
SAP_URL=https://your-sap-system.com
SAP_CLIENT=100
SAP_AUTH_TYPE=basic
SAP_USERNAME=your_username
SAP_PASSWORD=your_password
EOF
```

### 3. Run

```bash
# stdio (for MCP clients like Claude Code, Cline, Cursor)
mcp-abap-adt

# HTTP server
mcp-abap-adt --transport=http --port 3000

# SSE server
mcp-abap-adt --transport=sse --port 3000
```

---

## Installation

### From npm (Recommended)

```bash
npm install -g @mcp-abap-adt/core
```

### From source

```bash
git clone --recurse-submodules https://github.com/babamba2/abap-mcp-adt-powerup.git
cd abap-mcp-adt-powerup
npm install
npm run build
npm start
```

### Platform-specific guides

- [Windows Installation](docs/installation/platforms/INSTALL_WINDOWS.md)
- [macOS Installation](docs/installation/platforms/INSTALL_MACOS.md)
- [Linux Installation](docs/installation/platforms/INSTALL_LINUX.md)

---

## Claude Code Plugin

This repository is also distributed as a **Claude Code plugin** via the marketplace.

### Install via marketplace

```bash
# Add this marketplace (once)
/plugin marketplace add babamba2/abap-mcp-adt-powerup

# Install the plugin
/plugin install abap-mcp-adt-powerup
```

After install, configure the SAP connection through environment variables (see [Configuration](#configuration)) or use the auto-configurator:

```bash
npx @mcp-abap-adt/configurator
```

### Manual plugin directory

If you're editing this repo locally, it already resolves as a plugin from:

```
~/.claude/plugins/marketplaces/abap-mcp-adt-powerup
```

Reload Claude Code (`/plugin` → *Reload*) to pick up changes.

---

## Configuration

### Environment Variables (.env)

```env
# SAP connection
SAP_URL=https://your-abap-system.com
SAP_CLIENT=100
SAP_LANGUAGE=en

# System type: cloud (default), onprem, or legacy
SAP_SYSTEM_TYPE=cloud

# TLS: set to 0 for self-signed certificates (dev only)
TLS_REJECT_UNAUTHORIZED=0

# Authentication
SAP_AUTH_TYPE=xsuaa          # 'xsuaa' for JWT, 'basic' for username/password
SAP_JWT_TOKEN=your_jwt_token # For JWT auth
# SAP_USERNAME=your_username # For basic auth
# SAP_PASSWORD=your_password # For basic auth

# On-premise context (required for create/update on on-prem)
# SAP_MASTER_SYSTEM=DEV
# SAP_RESPONSIBLE=your_username

# Timeouts (milliseconds)
SAP_TIMEOUT_DEFAULT=45000    # General operations (default: 45s)
SAP_TIMEOUT_CSRF=15000       # CSRF token requests (default: 15s)
SAP_TIMEOUT_LONG=60000       # Long-running operations (default: 60s)
```

### CLI Options

```bash
mcp-abap-adt [options]

Options:
  --transport=<type>    Transport protocol: stdio (default), http, sse
  --port <number>       Server port for http/sse (default: 3000)
  --host <address>      Bind address for http/sse (default: localhost)
  --env <destination>   Destination name for multi-system setups
  --env-path <path>     Path to .env file
```

### YAML Configuration

Alternative to CLI arguments. See [YAML Config Guide](docs/configuration/YAML_CONFIG.md).

---

## Authentication

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

Place your service key JSON file and configure via the configurator (`@mcp-abap-adt/configurator`).

### Header-based Auth (HTTP/SSE transports)

For multi-tenant or proxy setups, pass SAP connection details via HTTP headers (`x-sap-*`). See [Authentication Guide](docs/user-guide/AUTHENTICATION.md).

---

## Available Tools

The server provides **287 tools** organized into handler groups:

### Tool Categories

| Category | Count | Description |
|----------|-------|-------------|
| **Read-Only** | 52 | Query and retrieve objects without modification |
| **High-Level** | 113 | User-friendly CRUD operations |
| **Low-Level** | 122 | Direct ADT API operations with granular control |
| **Compact** | 22 | Streamlined access to common operations |
| **System** | - | Runtime analysis, profiling, dumps, SQL queries |
| **Search** | - | Object discovery, where-used analysis |

### Supported ABAP Object Types

| Object Type | Read | Create | Update | Delete |
|------------|:----:|:------:|:------:|:------:|
| Classes (CLAS) | O | O | O | O |
| Interfaces (INTF) | O | O | O | O |
| Programs (PROG) | O | O | O | O |
| Includes | O | O | O | O |
| Tables (TABL) | O | O | O | O |
| Structures | O | O | O | O |
| CDS Views (DDLS) | O | O | O | O |
| Domains | O | O | O | O |
| Data Elements (DTEL) | O | O | O | O |
| Function Groups (FUGR) | O | O | O | O |
| Function Modules (FUNC) | O | O | O | O |
| Packages (DEVC) | O | O | O | O |
| Transports | O | O | - | - |
| Service Definitions (SRVD) | O | O | O | O |
| Service Bindings (SRVB) | O | O | O | O |
| Behavior Definitions (BDEF) | O | O | O | O |
| Behavior Implementations (BIMP) | O | O | O | O |
| Metadata Extensions (DDLX) | O | O | O | O |
| Screens (DYNP) | O | O | O | O |
| GUI Statuses | O | O | O | O |
| Text Elements | O | O | O | O |
| Unit Tests | O | O | O | O |
| CDS Unit Tests | O | O | O | O |
| Enhancements | O | - | - | - |

### Runtime & System Tools

- **Runtime Profiling** - Profile class and program execution with trace analysis
- **Dump Analysis** - List and analyze ABAP runtime dumps
- **SQL Queries** - Execute SQL queries via ADT (`GetSqlQuery`)
- **Table Contents** - Read table data (`GetTableContents`)
- **Object Search** - Find objects by name, type, package (`SearchObject`)
- **Where-Used** - Cross-reference analysis (`GetWhereUsed`)
- **Type Info** - Retrieve type information (`GetTypeInfo`)
- **Inactive Objects** - List objects pending activation (`GetInactiveObjects`)
- **AST / Semantic Analysis** - Parse ABAP syntax tree and semantic info

For the complete tool reference, see [AVAILABLE_TOOLS.md](docs/user-guide/AVAILABLE_TOOLS.md).

---

## Transport Protocols

### stdio (Default)

Standard input/output transport for MCP clients. Used by Claude Code, Cline, Cursor, and other MCP-compatible tools.

```bash
mcp-abap-adt
# or explicitly:
mcp-abap-adt --transport=stdio
```

### HTTP (StreamableHTTP)

REST API with JSON streaming responses. Ideal for web clients and multi-user deployments.

```bash
mcp-abap-adt --transport=http --port 3000 --host 0.0.0.0
```

Health check: `GET /mcp/health`

### SSE (Server-Sent Events)

Long-polling transport with session management.

```bash
mcp-abap-adt --transport=sse --port 3000
```

---

## Client Configuration

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

### Auto-Configuration

Use the configurator for automated setup:

```bash
npx @mcp-abap-adt/configurator
```

See [Client Configuration Guide](docs/user-guide/CLIENT_CONFIGURATION.md) for more examples.

---

## Handler Architecture

The server organizes tools into composable handler groups:

```
handlers/
├── behavior_definition/    # BDEF CRUD
├── behavior_implementation/# BIMP CRUD
├── class/                  # CLAS CRUD
├── compact/                # Shorthand tools
├── common/                 # Shared handlers
├── data_element/           # DTEL CRUD
├── ddlx/                   # Metadata Extension CRUD
├── domain/                 # Domain CRUD
├── enhancement/            # Enhancement read-only
├── function/               # Function-related
├── function_group/         # FUGR CRUD
├── function_module/        # FUNC CRUD
├── gui_status/             # GUI Status CRUD
├── include/                # Include CRUD
├── interface/              # INTF CRUD
├── metadata_extension/     # DDLX CRUD
├── package/                # DEVC CRUD
├── program/                # PROG CRUD
├── screen/                 # Screen/Dynpro CRUD
├── search/                 # Object search & where-used
├── service_binding/        # SRVB CRUD
├── service_definition/     # SRVD CRUD
├── structure/              # Structure CRUD
├── system/                 # Runtime diagnostics
├── table/                  # TABL CRUD
├── text_element/           # Text Element CRUD
├── transport/              # Transport management
├── unit_test/              # Unit test CRUD & run
└── view/                   # CDS View CRUD
```

Each handler category contains subdirectories:
- `high/` - High-level, user-friendly operations
- `low/` - Low-level, direct ADT API operations
- `readonly/` - Safe read-only queries

### Embedding Handlers

For integrating into existing MCP servers (e.g., CAP/CDS applications):

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

## Docker Deployment

### Using Docker Compose

```bash
# Build and run
npm run docker:build
npm run docker:up

# Or with pre-built package
npm run docker:build:package
npm run docker:up:package
```

### Manual Docker Build

```bash
cd docker
docker-compose build
docker-compose up -d
```

See [Docker Deployment Guide](docs/deployment/DOCKER.md) for full details.

---

## Development

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **TypeScript** 5.9+

### Setup

```bash
git clone --recurse-submodules https://github.com/babamba2/abap-mcp-adt-powerup.git
cd abap-mcp-adt-powerup
npm install
npm run build
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Lint + compile TypeScript |
| `npm run build:fast` | Compile only (skip lint) |
| `npm run dev` | Build + launch MCP Inspector (stdio) |
| `npm run dev:http` | Build + launch HTTP dev server |
| `npm run dev:sse` | Build + launch SSE dev server |
| `npm run lint` | Run Biome linter with auto-fix |
| `npm run format` | Format code with Biome |
| `npm start` | Run MCP server (stdio) |
| `npm run start:http` | Run MCP server (HTTP) |
| `npm run start:sse` | Run MCP server (SSE) |
| `npm run docs:tools` | Regenerate tool documentation |

### Project Structure

```
mcp-abap-adt/
├── bin/                    # CLI entry points
│   ├── mcp-abap-adt.js    # Main CLI
│   └── mcp-abap-adt-v2.js # V2 server variant
├── src/
│   ├── handlers/           # 30 handler categories (287 tools)
│   ├── lib/
│   │   ├── auth/           # Auth broker, JWT/XSUAA
│   │   ├── config/         # Configuration management
│   │   ├── handlers/       # Handler registry & utilities
│   │   ├── stores/         # Session/token storage
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils.ts        # Core utilities
│   ├── server/
│   │   ├── BaseMcpServer.ts         # MCP server extension
│   │   ├── StdioServer.ts           # stdio transport
│   │   ├── SseServer.ts             # SSE transport
│   │   ├── StreamableHttpServer.ts  # HTTP transport
│   │   └── launcher.ts              # Server startup
│   └── utils/              # Utility modules
├── docker/                 # Docker deployment
├── docs/                   # Documentation
├── tests/                  # Test configuration
├── tools/                  # Dev tools & scripts
└── package.json
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mcp-abap-adt/adt-clients` | ADT REST API clients |
| `@mcp-abap-adt/connection` | SAP connection management |
| `@mcp-abap-adt/auth-broker` | Authentication token management |
| `@mcp-abap-adt/auth-providers` | Auth strategy implementations |
| `@modelcontextprotocol/sdk` | MCP protocol SDK |
| `fast-xml-parser` | XML parsing for ADT responses |

---

## Testing

### Integration Tests

Integration tests run against a real SAP system in two modes:

- **Soft mode** (default): Calls handlers directly, no MCP subprocess
- **Hard mode**: Spawns full MCP server via stdio, calls tools through MCP protocol

### Setup

```bash
# Create test config from template
npm run test:init

# Edit only the lines marked "# <- CHANGE"
# - environment.env (session .env file)
# - environment.system_type (onprem/cloud/legacy)
# - environment.default_package
# - environment.default_transport
```

### Running Tests

```bash
# Unit tests
npm test

# All integration tests (soft mode)
npm run test:integration

# High-level handler tests only
npm run test:high

# Low-level handler tests only
npm run test:low

# Type check test files
npm run test:check
```

See [Testing Guide](docs/development/tests/TESTING_GUIDE.md) for full details.

---

## Troubleshooting

### `self-signed certificate in certificate chain`

Your SAP system uses a self-signed TLS certificate. For development only:

```env
TLS_REJECT_UNAUTHORIZED=0
```

For production, install the SAP CA certificate into the Node.js trust store.

### `401 Unauthorized` / `403 Forbidden`

- **Basic Auth**: confirm `SAP_USERNAME` / `SAP_PASSWORD` and that the user has ADT authorization (`S_DEVELOP`, `S_RFC`, `S_TCODE`).
- **JWT/XSUAA**: the token may be expired — refresh via the configurator or service key.
- **Client mismatch**: verify `SAP_CLIENT` matches the logon client.

### `CSRF token validation failed` on Update/Create

The session lost its CSRF token. Most handlers refresh automatically; if it persists:

- Increase `SAP_TIMEOUT_CSRF` (default 15s).
- Confirm cookies are not being stripped by a proxy.

### `transport required` on On-Premise

Create or update on on-prem systems requires a transport request. Set:

```env
SAP_MASTER_SYSTEM=DEV
SAP_RESPONSIBLE=your_username
```

…and pass `transport=<TRKORR>` to the handler, or use a local package (`$TMP`).

### Claude Code doesn't see the MCP server

1. Restart Claude Code after editing config.
2. Check logs: `~/.claude/logs/` (stderr from the MCP process).
3. Run `mcp-abap-adt` directly in a shell — it must start without errors before Claude can connect.

### `Programs not available` on Cloud

Programs (`PROG`) are on-premise / legacy only. Use Classes or CDS on ABAP Cloud.

---

## FAQ

**Q. Does this work with S/4HANA Cloud, public edition?**
Yes — via ABAP Cloud (BTP) with JWT/XSUAA or a service key. RAP/CDS objects are fully supported; classic objects (Programs, Screens, GUI Statuses) are not available on cloud.

**Q. Can I use this without Claude Code?**
Yes. Any MCP-compatible client works: Cline, Cursor, Windsurf, VS Code MCP extension, or a custom client built with `@modelcontextprotocol/sdk`.

**Q. How do I limit which tools are exposed?**
Use the `HandlerExporter` to select handler groups when embedding, or set environment flags to disable groups. See [Handler Management](docs/user-guide/HANDLERS_MANAGEMENT.md).

**Q. Is it safe to use against a productive SAP system?**
The server respects SAP authorization — whatever your user cannot do in SE80/ADT, it cannot do here either. Still, we recommend a dedicated development user and running against non-prod first.

**Q. How do I run against multiple SAP systems?**
Use `--env <destination>` with per-destination `.env` files, or the YAML config. For HTTP/SSE deployments, pass `x-sap-*` headers per request.

**Q. Does it support RFC?**
Yes, for legacy systems where ADT HTTP APIs are unavailable. Set `connection_type: rfc` in the test config (or equivalent env) — requires the SAP NW RFC SDK installed locally.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Installation](docs/installation/INSTALLATION.md) | Platform-specific installation |
| [Client Configuration](docs/user-guide/CLIENT_CONFIGURATION.md) | MCP client setup |
| [Authentication](docs/user-guide/AUTHENTICATION.md) | Auth methods & destinations |
| [Available Tools](docs/user-guide/AVAILABLE_TOOLS.md) | Complete tool reference (287 tools) |
| [CLI Options](docs/user-guide/CLI_OPTIONS.md) | Command-line reference |
| [YAML Config](docs/configuration/YAML_CONFIG.md) | YAML configuration guide |
| [Architecture](docs/architecture/ARCHITECTURE.md) | System architecture overview |
| [Stateful Sessions](docs/architecture/STATEFUL_SESSION_GUIDE.md) | Lock/update/unlock flow |
| [Handler Architecture](docs/architecture/TOOLS_ARCHITECTURE.md) | Tool & handler structure |
| [Docker Deployment](docs/deployment/DOCKER.md) | Container deployment |
| [Testing Guide](docs/development/tests/TESTING_GUIDE.md) | Test setup & execution |
| [Handler Management](docs/user-guide/HANDLERS_MANAGEMENT.md) | Enable/disable handler groups |

---

## Contributing

We welcome contributions! Please see the [development documentation](docs/development/) for setup instructions.

### Contributors

- **Oleksii Kyslytsia** ([@fr0ster](https://github.com/fr0ster)) - Main maintainer (539+ commits)
- **mario-andreschak** ([@mario-andreschak](https://github.com/mario-andreschak)) - Original project maintainer
- **Henry Mao** ([@calclavia](https://github.com/calclavia)) - Contributor
- **Aleksandr Razinkin** ([@raaleksandr-epam](https://github.com/raaleksandr-epam)) - Contributor
- **Frank Fiegel** ([@punkpeye](https://github.com/punkpeye)) - Contributor

---

## Acknowledgments

This project was originally inspired by [mario-andreschak/mcp-abap-adt](https://github.com/mario-andreschak/mcp-abap-adt) and [fr0ster/mcp-abap-adt](https://github.com/fr0ster/mcp-abap-adt/tree/main/src). We started with the core concept and evolved it into an independent project with our own architecture and features.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 백승현 (Paek Seunghyun)
