import type { AuthBroker } from '@babamba2/mcp-abap-adt-auth-broker';
import type { Logger } from '@babamba2/mcp-abap-adt-logger';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { noopLogger } from '../lib/handlerLogger.js';
import type { IHandlersRegistry } from '../lib/handlers/interfaces.js';
import { registerProfileChangeHook } from '../lib/profileEvents.js';
import { BaseMcpServer } from './BaseMcpServer.js';

const DEFAULT_VERSION = process.env.npm_package_version ?? '1.0.0';

export interface StdioServerOptions {
  name?: string;
  version?: string;
  logger?: Logger;
}

/**
 * Minimal stdio server implementation based on BaseMcpServer.
 * Sets connection context once at startup and connects stdio transport.
 */
export class StdioServer extends BaseMcpServer {
  constructor(
    private readonly handlersRegistry: IHandlersRegistry,
    private readonly broker: AuthBroker,
    opts?: StdioServerOptions,
  ) {
    super({
      name: opts?.name ?? 'mcp-abap-adt',
      version: opts?.version ?? DEFAULT_VERSION,
      logger: opts?.logger ?? noopLogger,
    });
  }

  async start(destination: string): Promise<void> {
    await this.setConnectionContext(destination, this.broker);
    // One process, one context: follow ReloadProfile instead of staying on
    // the system that was active at boot. (Per-request SSE/HTTP servers
    // build a fresh context per request and do not need this.)
    registerProfileChangeHook((loaded) => {
      if (!this.rebindToProfile(loaded)) {
        throw new Error(
          `connection could not be rebound to profile ${loaded.alias ?? '(legacy)'} — restart the MCP server`,
        );
      }
    });
    this.registerHandlers(this.handlersRegistry);

    const transport = new StdioServerTransport();
    await this.connect(transport);
  }
}
