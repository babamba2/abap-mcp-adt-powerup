/**
 * UpdateClass Handler - Update ABAP Class Source Code
 *
 * Uses AdtClient.updateClass from @mcp-abap-adt/adt-clients.
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
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'UpdateClassLow',
  available_in: ['onprem', 'cloud', 'legacy'] as const,
  description:
    '[low-level] Update source code of an existing ABAP class. Uses session from HandlerContext. Requires lock handle from LockClass operation. - use UpdateClass (high-level) for full workflow with lock/unlock/activate.',
  inputSchema: {
    type: 'object',
    properties: {
      class_name: {
        type: 'string',
        description:
          'Class name (e.g., ZCL_TEST_CLASS_001). Class must already exist.',
      },
      source_code: {
        type: 'string',
        description:
          'Complete ABAP class source code including CLASS DEFINITION and IMPLEMENTATION sections.',
      },
      lock_handle: {
        type: 'string',
        description:
          'Lock handle from LockClass operation. Required for update operation.',
      },
      skip_check: {
        type: 'boolean',
        description:
          'Skip pre-write syntax check on source_code. Default: false. When false, runs a syntax check on the proposed code BEFORE uploading it and surfaces any errors with line numbers — the broken source never lands on SAP.',
      },
    },
    required: ['class_name', 'source_code', 'lock_handle'],
  },
} as const;

interface UpdateClassArgs {
  class_name: string;
  source_code: string;
  lock_handle: string;
  skip_check?: boolean;
}

/**
 * Main handler for UpdateClass MCP tool
 *
 * Uses AdtClient.updateClass - low-level single method call
 */
export async function handleUpdateClass(
  context: HandlerContext,
  args: UpdateClassArgs,
) {
  const { connection, logger } = context;
  try {
    const { class_name, source_code, lock_handle, skip_check } =
      args as UpdateClassArgs;

    // Validation
    if (!class_name || !source_code || !lock_handle) {
      return return_error(
        new Error('class_name, source_code, and lock_handle are required'),
      );
    }

    const client = createAdtClient(connection, logger);

    const className = class_name.toUpperCase();

    logger?.info(`Starting class update: ${className}`);

    try {
      // Pre-write syntax check on the proposed source (unless skipped).
      // Surfaces ALL compile errors with line numbers via the raw
      // /checkruns inline-artifact path, so the broken source never
      // lands on SAP.
      if (skip_check !== true) {
        const checkResult = await runSyntaxCheck(
          { connection, logger },
          { kind: 'class', name: className, sourceCode: source_code },
        );
        assertNoCheckErrors(checkResult, 'Class', className);
      }

      // Update class with source code
      const updateState = await client
        .getClass()
        .update(
          { className, sourceCode: source_code },
          { lockHandle: lock_handle },
        );
      const updateResult = updateState.updateResult;

      if (!updateResult) {
        throw new Error(
          `Update did not return a response for class ${className}`,
        );
      }

      logger?.info(`✅ UpdateClass completed: ${className}`);

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            class_name: className,
            message: `Class ${className} updated successfully. Remember to unlock using UnlockClassLow.`,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      // PreCheck syntax-check failures carry full structured diagnostics —
      // forward them as-is so the caller sees every error with line numbers.
      if (error?.isPreCheckFailure) {
        logger?.error(`Error updating class ${className}: ${error.message}`);
        return return_error(error);
      }

      logger?.error(
        `Error updating class ${className}: ${error?.message || error}`,
      );

      // Parse error message
      let errorMessage = `Failed to update class: ${error.message || String(error)}`;

      if (error.response?.status === 404) {
        errorMessage = `Class ${className} not found.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Class ${className} is locked by another user or lock handle is invalid.`;
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
