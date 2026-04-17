/**
 * ActivateObjects — High-level mass activation for a set of ABAP objects.
 *
 * Hits `/sap/bc/adt/activation/runs` exactly once for the entire batch,
 * regardless of object count. Designed for scenarios where objects carry
 * cyclic references (e.g. 5 includes referencing each other's TYPES/FORMs)
 * that cannot be activated one-by-one because each individual activation
 * would fail on unresolved references to still-inactive siblings.
 *
 * Falls back to the legacy sync `/sap/bc/adt/activation` endpoint on
 * NetWeaver systems where `/runs` is unavailable.
 *
 * This is additive — the existing `ActivateObjectLow` and per-handler
 * inline activation paths are untouched.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type ActivationObjectInput,
  activateObjectsLocal,
} from '../../../lib/localGroupActivation';
import { return_error, return_response } from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ActivateObjects',
  available_in: ['onprem', 'cloud', 'legacy'] as const,
  description:
    '[high-level] Activate a set of ABAP objects in a single call. Uses the ADT mass-activation endpoint (/sap/bc/adt/activation/runs) so cyclic references between siblings (e.g. main program + multiple cross-referencing includes) resolve in one compilation scope. Returns per-object status, errors, warnings. Falls back to /sap/bc/adt/activation on legacy systems.',
  inputSchema: {
    type: 'object',
    properties: {
      objects: {
        type: 'array',
        minItems: 1,
        description:
          'Objects to activate in one batch. Supply either explicit uri, or name+type (and parent_name for FUGR/FF, FUGR/I).',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Object name (will be uppercased).',
            },
            type: {
              type: 'string',
              description:
                "ADT object type code, e.g. 'PROG/P' (program), 'PROG/I' (include), 'CLAS/OC' (class), 'FUGR/FF' (function module).",
            },
            uri: {
              type: 'string',
              description:
                'Explicit ADT URI. When provided, overrides name-based URI resolution.',
            },
            parent_name: {
              type: 'string',
              description:
                'Parent name — required for FUGR/FF (function group) and FUGR/I (function-group include).',
            },
          },
          required: ['name'],
        },
      },
      preaudit: {
        type: 'boolean',
        description: 'Request pre-audit before activation. Default true.',
      },
      run_timeout_ms: {
        type: 'number',
        description:
          'Max time to wait for the activation run to finish (runs endpoint only). Default 120000.',
      },
    },
    required: ['objects'],
  },
} as const;

interface ActivateObjectsArgs {
  objects: Array<{
    name: string;
    type?: string;
    uri?: string;
    parent_name?: string;
  }>;
  preaudit?: boolean;
  run_timeout_ms?: number;
}

export async function handleActivateObjects(
  context: HandlerContext,
  args: ActivateObjectsArgs,
) {
  const { connection, logger } = context;
  try {
    if (
      !args?.objects ||
      !Array.isArray(args.objects) ||
      args.objects.length === 0
    ) {
      return return_error(
        new Error(
          'Missing required parameter: objects (must be a non-empty array)',
        ),
      );
    }

    for (const obj of args.objects) {
      if (!obj?.name && !obj?.uri) {
        return return_error(
          new Error('Each object must carry at least "name" (or "uri")'),
        );
      }
    }

    const inputs: ActivationObjectInput[] = args.objects.map((o) => ({
      name: o.name,
      type: o.type ?? '',
      uri: o.uri,
      parent_name: o.parent_name,
    }));

    logger?.info(
      `ActivateObjects: ${inputs.length} object(s) → /sap/bc/adt/activation/runs`,
    );

    const result = await activateObjectsLocal(connection, inputs, {
      preauditRequested: args.preaudit !== false,
      runTimeoutMs: args.run_timeout_ms,
    });

    const failed = result.objects.filter((o) => o.status === 'failed').length;
    const summary = {
      success: result.success,
      endpoint: result.endpoint,
      run_id: result.run_id,
      activated: result.activated,
      checked: result.checked,
      generated: result.generated,
      objects_count: result.objects.length,
      failed_count: failed,
      objects: result.objects,
      errors: result.errors,
      warnings: result.warnings,
      message: result.success
        ? `Activated ${result.objects.length} object(s) via ${result.endpoint} endpoint`
        : `Activation finished with ${result.errors.length} error(s) across ${failed} object(s)`,
    };

    return return_response({
      data: JSON.stringify(summary, null, 2),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  } catch (error: any) {
    const message = error?.message || String(error);
    logger?.error(`ActivateObjects failed: ${message}`);
    return return_error(new Error(`ActivateObjects failed: ${message}`));
  }
}
