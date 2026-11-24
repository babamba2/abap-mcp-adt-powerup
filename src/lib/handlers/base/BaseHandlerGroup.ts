import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from '../../../handlers/interfaces.js';
import { guardTool } from '../../readonlyGuard.js';
import {
  resolveSourceFileArg,
  withSourceFileSchema,
} from '../../sourceFileInput.js';
import {
  attachPatchedInfo,
  resolveSourcePatchesArg,
  runWithPatchRestore,
  withSourcePatchesSchema,
} from '../../sourcePatchInput.js';
import type {
  HandlerEntry,
  IHandlerGroup,
  ToolHandler,
} from '../interfaces.js';
import { jsonSchemaToZod } from '../utils/schemaUtils.js';

/**
 * Base class for handler groups
 * Provides common functionality for registering handlers
 */
export abstract class BaseHandlerGroup implements IHandlerGroup {
  protected abstract groupName: string;
  protected context: HandlerContext;

  constructor(context: HandlerContext) {
    this.context = context;
  }
  /**
   * Gets the name of the handler group
   */
  getName(): string {
    return this.groupName;
  }

  /**
   * Gets all handler entries in this group
   * Must be implemented by subclasses
   */
  abstract getHandlers(): HandlerEntry[];

  /**
   * Registers all handlers from this group on the MCP server
   */
  registerHandlers(server: McpServer): void {
    const handlers = this.getHandlers();
    for (const entry of handlers) {
      this.registerToolOnServer(
        server,
        entry.toolDefinition.name,
        entry.toolDefinition.description,
        entry.toolDefinition.inputSchema,
        entry.handler,
      );
    }
  }

  /**
   * Helper function to register a tool on McpServer
   * Wraps handler to convert our response format to MCP format
   */
  protected registerToolOnServer(
    server: McpServer,
    toolName: string,
    description: string,
    inputSchema: any,
    handler: ToolHandler,
  ): void {
    // Convert JSON Schema to Zod if needed, otherwise pass as-is
    const schema = withSourcePatchesSchema(
      toolName,
      withSourceFileSchema(toolName, inputSchema),
    );
    const zodSchema =
      schema &&
      typeof schema === 'object' &&
      schema.type === 'object' &&
      schema.properties
        ? jsonSchemaToZod(schema)
        : schema;

    server.registerTool(
      toolName,
      {
        description,
        inputSchema: zodSchema,
      },
      async (args: any) => {
        // Server-side readonly enforcement for non-DEV SAP profiles.
        // Fires BEFORE the handler runs so mutations never reach SAP.
        guardTool(toolName);

        const resolved = await resolveSourcePatchesArg(
          toolName,
          inputSchema,
          resolveSourceFileArg(toolName, inputSchema, args),
          this.context,
        );
        // A failed patch never leaves its source behind (undo inside).
        const result = attachPatchedInfo(
          await runWithPatchRestore(resolved, this.context, (a) =>
            Promise.resolve(handler(this.context, a)),
          ),
          resolved.patched,
        );

        // If error, throw it
        if (result.isError) {
          const errorText =
            result.content
              ?.map((item: any) => {
                if (item?.type === 'json' && item.json !== undefined) {
                  return JSON.stringify(item.json);
                }
                return item?.text || String(item);
              })
              .join('\n') || 'Unknown error';
          throw new McpError(ErrorCode.InternalError, errorText);
        }

        // Convert content to MCP format - JSON items become text
        const content = (result.content || []).map((item: any) => {
          if (item?.type === 'json' && item.json !== undefined) {
            return {
              type: 'text' as const,
              text: JSON.stringify(item.json),
            };
          }
          return {
            type: 'text' as const,
            text: item?.text || String(item || ''),
          };
        });

        return { content };
      },
    );
  }
}
