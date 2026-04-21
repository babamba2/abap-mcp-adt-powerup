"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReloadProfile = handleReloadProfile;
const profile_1 = require("../../../lib/profile");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReloadProfile',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[system] Reload the active SAP profile from .sc4sap/active-profile.txt and reset the cached connection. Called by the sc4sap plugin after switching profiles. Returns the newly active alias, host, tier, and readonly status.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
async function handleReloadProfile(context, _args) {
    const { logger } = context;
    try {
        const loaded = (0, profile_1.activateProfile)();
        (0, utils_1.invalidateConnectionCache)();
        const host = loaded.envVars.SAP_URL ?? '';
        const client = loaded.envVars.SAP_CLIENT ?? '';
        const description = loaded.envVars.SAP_DESCRIPTION ?? '';
        logger?.info(`[ReloadProfile] alias=${loaded.alias ?? '(legacy)'} tier=${loaded.tier} readonly=${loaded.readonly} host=${host} client=${client}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                ok: true,
                alias: loaded.alias ?? null,
                legacy: loaded.legacy,
                tier: loaded.tier,
                readonly: loaded.readonly,
                host,
                client,
                description,
                sourcePath: loaded.sourcePath,
            }, null, 2),
        });
    }
    catch (error) {
        logger?.error('[ReloadProfile] error:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleReloadProfile.js.map