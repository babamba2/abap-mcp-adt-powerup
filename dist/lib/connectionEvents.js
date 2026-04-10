"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConnectionResetHook = registerConnectionResetHook;
exports.notifyConnectionResetListeners = notifyConnectionResetListeners;
exports.clearConnectionResetHooks = clearConnectionResetHooks;
const connectionResetHooks = new Set();
function registerConnectionResetHook(hook) {
    connectionResetHooks.add(hook);
}
function notifyConnectionResetListeners() {
    for (const hook of connectionResetHooks) {
        try {
            hook();
        }
        catch {
            // Hooks are best-effort only; errors are intentionally swallowed
        }
    }
}
function clearConnectionResetHooks() {
    connectionResetHooks.clear();
}
//# sourceMappingURL=connectionEvents.js.map