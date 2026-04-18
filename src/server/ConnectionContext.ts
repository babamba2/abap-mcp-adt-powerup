import type { SapConfig } from '@babamba2/mcp-abap-connection';

/**
 * Connection context for MCP server
 * Contains connection parameters and session information
 */
export interface ConnectionContext {
  /**
   * Connection parameters (SAP URL, auth, client)
   */
  connectionParams: SapConfig;

  /**
   * Session ID for this connection context
   */
  sessionId: string;

  /**
   * Optional metadata for additional context information
   */
  metadata?: Record<string, any>;
}
