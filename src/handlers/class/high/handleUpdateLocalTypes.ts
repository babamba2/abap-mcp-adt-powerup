/**
 * UpdateLocalTypes Handler - Update Local Types via AdtClient
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  assertNoCheckErrors,
  runSyntaxCheck,
} from '../../../lib/preCheckBeforeActivation';
import {
  type AxiosResponse,
  extractAdtErrorMessage,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'UpdateLocalTypes',
  available_in: ['onprem', 'cloud', 'legacy'] as const,
  description:
    'Update local types in an ABAP class (implementations include). Manages lock, check, update, unlock, and optional activation.',
  inputSchema: {
    type: 'object',
    properties: {
      class_name: {
        type: 'string',
        description: 'Parent class name (e.g., ZCL_MY_CLASS).',
      },
      local_types_code: {
        type: 'string',
        description: 'Updated source code for local types.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
      activate_on_update: {
        type: 'boolean',
        description: 'Activate parent class after updating. Default: false',
        default: false,
      },
    },
    required: ['class_name', 'local_types_code'],
  },
} as const;

interface UpdateLocalTypesArgs {
  class_name: string;
  local_types_code: string;
  transport_request?: string;
  activate_on_update?: boolean;
}

export async function handleUpdateLocalTypes(
  context: HandlerContext,
  args: UpdateLocalTypesArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      class_name,
      local_types_code,
      transport_request,
      activate_on_update = false,
    } = args as UpdateLocalTypesArgs;

    if (!class_name || !local_types_code) {
      return return_error(
        new Error('class_name and local_types_code are required'),
      );
    }

    const client = createAdtClient(connection, logger);
    const className = class_name.toUpperCase();

    logger?.info(`Updating local types for ${className}`);

    try {
      const localTypes = client.getLocalTypes();
      const updateResult = await localTypes.update(
        {
          className,
          localTypesCode: local_types_code,
          transportRequest: transport_request,
        },
        { activateOnUpdate: activate_on_update },
      );

      if (!updateResult) {
        throw new Error(`Update did not return a result for ${className}`);
      }

      logger?.info(`✅ UpdateLocalTypes completed successfully: ${className}`);

      // Post-update class-level syntax check (see handleUpdateLocalDefinitions for rationale).
      let checkWarnings: Array<{
        type: string;
        text: string;
        line?: string | number;
      }> = [];
      try {
        const checkResult = await runSyntaxCheck(
          { connection, logger },
          { kind: 'class', name: className },
        );
        assertNoCheckErrors(checkResult, 'Class', className);
        checkWarnings = checkResult.warnings;
        logger?.debug(
          `Post-update syntax check passed: ${className} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`,
        );
      } catch (checkErr: any) {
        if (checkErr?.isPreCheckFailure) {
          logger?.error(
            `Local types of ${className} were updated but the class failed post-update syntax check: ${checkErr.message}`,
          );
          return return_error(checkErr);
        }
        logger?.warn(
          `Post-update check had issues for ${className}: ${
            checkErr instanceof Error ? checkErr.message : String(checkErr)
          }`,
        );
      }

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            class_name: className,
            transport_request: transport_request || null,
            activated: activate_on_update,
            message: `Local types updated successfully in ${className}.`,
            check_warnings:
              checkWarnings.length > 0 ? checkWarnings : undefined,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      if (error?.isPreCheckFailure) {
        return return_error(error);
      }
      logger?.error(
        `Error updating local types for ${className}: ${error?.message || error}`,
      );

      const detailedError = extractAdtErrorMessage(
        error,
        `Failed to update local types in ${className}`,
      );
      let errorMessage = `Failed to update local types: ${detailedError}`;

      if (error.response?.status === 404) {
        errorMessage = `Local types for ${className} not found.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Class ${className} is locked by another user.`;
      }

      return return_error(new Error(errorMessage));
    }
  } catch (error: any) {
    return return_error(error);
  }
}
