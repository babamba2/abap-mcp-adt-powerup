/**
 * CreateMetadataExtension Handler - Create ABAP Metadata Extension
 *
 * Uses AdtClient.createMetadataExtension from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  assertNoCheckErrors,
  runSyntaxCheck,
} from '../../../lib/preCheckBeforeActivation';
import {
  type AxiosResponse,
  restoreSessionInConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'CreateMetadataExtensionLow',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[low-level] Create a new ABAP Metadata Extension. - use CreateMetadataExtension (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Metadata Extension name (e.g., ZI_MY_DDLX).',
      },
      description: {
        type: 'string',
        description: 'Metadata Extension description.',
      },
      package_name: {
        type: 'string',
        description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Optional for local objects.',
      },
      master_language: {
        type: 'string',
        description: "Master language (optional, e.g., 'EN').",
      },
      skip_check: {
        type: 'boolean',
        description:
          "Skip post-create syntax check. Default: false. NOTE: SAP's /checkruns reporter is weak for DDLX — may return empty results for some error classes.",
      },
      session_id: {
        type: 'string',
        description:
          'Session ID from GetSession. If not provided, a new session will be created.',
      },
      session_state: {
        type: 'object',
        description:
          'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
        properties: {
          cookies: { type: 'string' },
          csrf_token: { type: 'string' },
          cookie_store: { type: 'object' },
        },
      },
    },
    required: ['name', 'description', 'package_name'],
  },
} as const;

interface CreateMetadataExtensionArgs {
  name: string;
  description: string;
  package_name: string;
  transport_request?: string;
  master_language?: string;
  skip_check?: boolean;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

/**
 * Main handler for CreateMetadataExtension MCP tool
 *
 * Uses AdtClient.createMetadataExtension - low-level single method call
 */
export async function handleCreateMetadataExtension(
  context: HandlerContext,
  args: CreateMetadataExtensionArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      name,
      description,
      package_name,
      transport_request,
      master_language,
      skip_check,
      session_id,
      session_state,
    } = args as CreateMetadataExtensionArgs;

    // Validation
    if (!name || !description || !package_name) {
      return return_error(
        new Error('name, description, and package_name are required'),
      );
    }

    const client = createAdtClient(connection);

    // Restore session state if provided
    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    }

    const ddlxName = name.toUpperCase();

    logger?.info(`Starting metadata extension creation: ${ddlxName}`);

    try {
      // Create metadata extension
      const createState = await client.getMetadataExtension().create({
        name: ddlxName,
        description,
        packageName: package_name,
        transportRequest: transport_request,
      });
      const createResult = createState.createResult;

      if (!createResult) {
        throw new Error(
          `Create did not return a response for metadata extension ${ddlxName}`,
        );
      }

      // Post-create syntax check (unless skipped). Surfaces ALL compile
      // errors with structured diagnostics. NOTE: SAP's /checkruns
      // reporter is weak for DDLX — may return empty for some errors.
      if (skip_check !== true) {
        const checkResult = await runSyntaxCheck(
          { connection, logger },
          { kind: 'metadataExtension', name: ddlxName },
        );
        assertNoCheckErrors(checkResult, 'Metadata Extension', ddlxName);
      }

      // Get updated session state after create

      logger?.info(`✅ CreateMetadataExtension completed: ${ddlxName}`);

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            name: ddlxName,
            description,
            package_name: package_name,
            transport_request: transport_request || null,
            session_id: session_id || null,
            session_state: null, // Session state management is now handled by auth-broker,
            message: `Metadata Extension ${ddlxName} created successfully. Use LockMetadataExtension and UpdateMetadataExtension to add source code, then UnlockMetadataExtension and ActivateObject.`,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      // PreCheck syntax-check failures carry full structured diagnostics —
      // forward them as-is so the caller sees every error with line numbers.
      if (error?.isPreCheckFailure) {
        logger?.error(
          `Error creating metadata extension ${ddlxName}: ${error.message}`,
        );
        return return_error(error);
      }

      logger?.error(
        `Error creating metadata extension ${ddlxName}: ${error?.message || error}`,
      );

      // Parse error message
      let errorMessage = `Failed to create metadata extension: ${error.message || String(error)}`;

      if (error.response?.status === 409) {
        errorMessage = `Metadata Extension ${ddlxName} already exists.`;
      } else if (
        error.response?.data &&
        typeof error.response.data === 'string'
      ) {
        try {
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
          });
          const errorData = parser.parse(error.response.data);
          const errorMsg =
            errorData['exc:exception']?.message?.['#text'] ||
            errorData['exc:exception']?.message;
          if (errorMsg) {
            errorMessage = `SAP Error: ${errorMsg}`;
          }
        } catch (_parseError) {
          // Ignore parse errors
        }
      }

      return return_error(new Error(errorMessage));
    }
  } catch (error: any) {
    return return_error(error);
  }
}
