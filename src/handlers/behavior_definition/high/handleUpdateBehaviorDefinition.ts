/**
 * UpdateBehaviorDefinition Handler - ABAP Behavior Definition Update via ADT API
 */

import type { IBehaviorDefinitionConfig } from '@babamba2/mcp-abap-adt-clients';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  assertNoCheckErrors,
  runSyntaxCheck,
} from '../../../lib/preCheckBeforeActivation';
import {
  extractAdtErrorMessage,
  return_error,
  return_response,
} from '../../../lib/utils';
export const TOOL_DEFINITION = {
  name: 'UpdateBehaviorDefinition',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Update source code of an ABAP Behavior Definition (BDEF). Modifies RAP business object behavior: CRUD operations, validations, determinations, actions, and draft handling.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Behavior Definition name',
      },
      source_code: {
        type: 'string',
        description: 'New source code',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Required for transportable packages.',
      },
      lock_handle: {
        type: 'string',
        description:
          'Lock handle from LockObject. If not provided, will attempt to lock internally (not recommended for stateful flows).',
      },
      activate: {
        type: 'boolean',
        description: 'Activate after update. Default: true',
      },
    },
    required: ['name', 'source_code'],
  },
} as const;

interface UpdateBehaviorDefinitionArgs {
  name: string;
  source_code: string;
  transport_request?: string;
  lock_handle?: string;
  activate?: boolean;
}

export async function handleUpdateBehaviorDefinition(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: UpdateBehaviorDefinitionArgs = params;

  if (!args.name || !args.source_code) {
    return return_error(new Error('Missing required parameters'));
  }

  const name = args.name.toUpperCase();
  // Get connection from session context (set by ProtocolHandler)
  // Connection is managed and cached per session, with proper token refresh via AuthBroker
  logger?.info(`Starting BDEF update: ${name}`);

  try {
    const client = createAdtClient(connection, logger);
    const shouldActivate = args.activate !== false;
    let lockHandle = args.lock_handle;
    const lockedByUs = !args.lock_handle;

    // Lock if not provided - using types from adt-clients
    if (!lockHandle) {
      const lockConfig: Pick<IBehaviorDefinitionConfig, 'name'> = {
        name,
      };
      lockHandle = await client.getBehaviorDefinition().lock(lockConfig);
    }

    try {
      // Update - using types from adt-clients
      const updateConfig: Pick<
        IBehaviorDefinitionConfig,
        'name' | 'sourceCode'
      > & { transportRequest?: string } = {
        name,
        sourceCode: args.source_code,
        transportRequest: args.transport_request,
      };
      await client
        .getBehaviorDefinition()
        .update(updateConfig, { lockHandle: lockHandle });

      // Post-write syntax check on the staged inactive version.
      // Surfaces ALL compile errors with structured diagnostics.
      const checkResult = await runSyntaxCheck(
        { connection, logger },
        { kind: 'behaviorDefinition', name },
      );
      assertNoCheckErrors(checkResult, 'Behavior Definition', name);
    } finally {
      // Unlock if we locked it internally - mandatory after lock
      if (lockedByUs && lockHandle) {
        try {
          const unlockConfig: Pick<IBehaviorDefinitionConfig, 'name'> = {
            name,
          };
          await client.getBehaviorDefinition().unlock(unlockConfig, lockHandle);
        } catch (unlockError: any) {
          logger?.warn(
            `Failed to unlock BDEF ${name}: ${unlockError?.message || unlockError}`,
          );
        }
      }
    }

    // Activate if requested - using types from adt-clients
    if (shouldActivate) {
      const activateConfig: Pick<IBehaviorDefinitionConfig, 'name'> = {
        name,
      };
      await client.getBehaviorDefinition().activate(activateConfig);
    }

    const result = {
      success: true,
      name: name,
      message: shouldActivate
        ? `Behavior Definition ${name} updated and activated successfully`
        : `Behavior Definition ${name} updated successfully`,
    };

    return return_response({
      data: JSON.stringify(result, null, 2),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  } catch (error: any) {
    // PreCheck syntax-check failures carry full structured diagnostics —
    // forward them as-is so the caller sees every error with line numbers.
    if (error?.isPreCheckFailure) {
      logger?.error(`Error updating BDEF ${name}: ${error.message}`);
      return return_error(error);
    }
    const detailedError = extractAdtErrorMessage(
      error,
      `Failed to update behavior definition ${name}`,
    );
    logger?.error(`Error updating BDEF ${name}: ${detailedError}`);
    return return_error(new Error(detailedError));
  }
}
