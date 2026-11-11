"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToolProfile = resolveToolProfile;
exports.isToolInProfile = isToolInProfile;
/** Reads SAP_TOOL_PROFILE; unknown or empty → 'dev'. */
function resolveToolProfile(value = process.env.SAP_TOOL_PROFILE) {
    const v = (value ?? '').trim().toLowerCase();
    if (v === 'biz' || v === 'all')
        return v;
    return 'dev';
}
/** True when a tool with the given tool_profile is exposed under `setting`. */
function isToolInProfile(toolProfile, setting) {
    if (setting === 'all')
        return true;
    const tags = toolProfile && toolProfile.length > 0 ? toolProfile : ['dev'];
    return tags.includes(setting);
}
//# sourceMappingURL=interfaces.js.map