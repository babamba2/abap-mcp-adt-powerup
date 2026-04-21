/**
 * ReloadProfile Handler — reload the active profile and reset the SAP connection.
 *
 * Reads `<cwd>/.sc4sap/active-profile.txt`, loads the referenced profile env
 * from `~/.sc4sap/profiles/<alias>/sap.env`, overwrites `process.env.SAP_*`,
 * invalidates the cached connection, and returns metadata about the newly
 * active profile. The next tool call rebuilds the ABAP connection from the
 * fresh env automatically via the existing `notifyConnectionResetListeners`
 * fan-out.
 *
 * This tool is always allowed regardless of tier (handled in readonlyGuard).
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { activateProfile } from '../../../lib/profile';
import {
  type AxiosResponse,
  invalidateConnectionCache,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ReloadProfile',
  available_in: ['onprem', 'cloud', 'legacy'] as const,
  description:
    '[system] Reload the active SAP profile from .sc4sap/active-profile.txt and reset the cached connection. Called by the sc4sap plugin after switching profiles. Returns the newly active alias, host, tier, and readonly status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
} as const;

export async function handleReloadProfile(context: HandlerContext, _args: any) {
  const { logger } = context;
  try {
    const loaded = activateProfile();
    invalidateConnectionCache();

    const host = loaded.envVars.SAP_URL ?? '';
    const client = loaded.envVars.SAP_CLIENT ?? '';
    const description = loaded.envVars.SAP_DESCRIPTION ?? '';

    logger?.info(
      `[ReloadProfile] alias=${loaded.alias ?? '(legacy)'} tier=${loaded.tier} readonly=${loaded.readonly} host=${host} client=${client}`,
    );

    return return_response({
      data: JSON.stringify(
        {
          ok: true,
          alias: loaded.alias ?? null,
          legacy: loaded.legacy,
          tier: loaded.tier,
          readonly: loaded.readonly,
          host,
          client,
          description,
          sourcePath: loaded.sourcePath,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    logger?.error('[ReloadProfile] error:', error);
    return return_error(error);
  }
}
