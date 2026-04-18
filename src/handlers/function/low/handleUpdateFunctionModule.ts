/**
 * UpdateFunctionModule Handler - Update ABAP Function Module Source Code
 *
 * Uses AdtClient.updateFunctionModule from @babamba2/mcp-abap-adt-clients.
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
  name: 'UpdateFunctionModuleLow',
  available_in: ['onprem', 'cloud', 'legacy'] as const,
  description:
    '[low-level] Update source code of an existing ABAP function module. Requires lock handle from LockObject and function group name. - use UpdateFunctionModule (high-level) for full workflow with lock/unlock/activate.',
  inputSchema: {
    type: 'object',
    properties: {
      function_module_name: {
        type: 'string',
        description:
          'Function module name (e.g., Z_TEST_FM). Function module must already exist.',
      },
      function_group_name: {
        type: 'string',
        description:
          'Function group name containing the function module (e.g., Z_TEST_FG).',
      },
      source_code: {
        type: 'string',
        description: 'Complete ABAP function module source code.',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Required for transportable objects locked in a request.',
      },
      lock_handle: {
        type: 'string',
        description:
          'Lock handle from LockFunctionModule. Required for update operation.',
      },
      skip_check: {
        type: 'boolean',
        description:
          'Skip post-write syntax check. Default: false. When false, runs a syntax check on the staged inactive version after update and surfaces any errors with line numbers.',
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
    required: [
      'function_module_name',
      'function_group_name',
      'source_code',
      'lock_handle',
    ],
  },
} as const;

interface UpdateFunctionModuleArgs {
  function_module_name: string;
  function_group_name: string;
  source_code: string;
  transport_request?: string;
  lock_handle: string;
  skip_check?: boolean;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

/**
 * Main handler for UpdateFunctionModule MCP tool
 *
 * Uses AdtClient.updateFunctionModule - low-level single method call
 */
export async function handleUpdateFunctionModule(
  context: HandlerContext,
  args: UpdateFunctionModuleArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      function_module_name,
      function_group_name,
      source_code,
      transport_request,
      lock_handle,
      skip_check,
      session_id,
      session_state,
    } = args as UpdateFunctionModuleArgs;

    // Validation
    if (
      !function_module_name ||
      !function_group_name ||
      !source_code ||
      !lock_handle
    ) {
      return return_error(
        new Error(
          'function_module_name, function_group_name, source_code, and lock_handle are required',
        ),
      );
    }

    const client = createAdtClient(connection);
    // Restore session state if provided
    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    } else {
      // Ensure connection is established
    }

    const functionModuleName = function_module_name.toUpperCase();
    const functionGroupName = function_group_name.toUpperCase();

    logger?.info(
      `Starting function module update: ${functionModuleName} in ${functionGroupName}`,
    );

    try {
      // Update function module with source code
      const updateState = await client.getFunctionModule().update(
        {
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName,
          sourceCode: source_code,
          transportRequest: transport_request,
        },
        { lockHandle: lock_handle },
      );
      const updateResult = updateState.updateResult;

      if (!updateResult) {
        throw new Error(
          `Update did not return a response for function module ${functionModuleName}`,
        );
      }

      // Post-write syntax check on the staged inactive version (unless
      // explicitly skipped). Surfaces ALL compile errors with line numbers.
      let checkWarnings: Array<{
        type: string;
        text: string;
        line?: string | number;
      }> = [];
      if (skip_check !== true) {
        const checkResult = await runSyntaxCheck(
          { connection, logger },
          {
            kind: 'functionModule',
            name: functionModuleName,
            functionGroupName,
          },
        );
        assertNoCheckErrors(checkResult, 'Function module', functionModuleName);
        checkWarnings = checkResult.warnings;
      }

      // Get updated session state after update

      logger?.info(`✅ UpdateFunctionModule completed: ${functionModuleName}`);

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            function_module_name: functionModuleName,
            function_group_name: functionGroupName,
            transport_request: transport_request || null,
            lock_handle: lock_handle,
            session_id: session_id || null,
            session_state: null, // Session state management is now handled by auth-broker,
            message: `Function module ${functionModuleName} updated successfully. Remember to unlock using UnlockFunctionModule.`,
            check_warnings:
              checkWarnings.length > 0 ? checkWarnings : undefined,
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
          `Error updating function module ${functionModuleName}: ${error.message}`,
        );
        return return_error(error);
      }

      logger?.error(
        `Error updating function module ${functionModuleName}: ${error?.message || error}`,
      );

      // Parse error message
      let errorMessage = `Failed to update function module: ${error.message || String(error)}`;

      if (error.response?.status === 404) {
        errorMessage = `Function module ${functionModuleName} not found.`;
      } else if (error.response?.status === 400 && !transport_request) {
        errorMessage = `Update failed for ${functionModuleName}. The object may be assigned to a transport request. Pass transport_request explicitly.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Function module ${functionModuleName} is locked by another user or lock handle is invalid.`;
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
