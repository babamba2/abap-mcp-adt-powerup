"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProfileChangeHook = registerProfileChangeHook;
exports.notifyProfileChanged = notifyProfileChanged;
exports.clearProfileChangeHooks = clearProfileChangeHooks;
const profileChangeHooks = new Set();
function registerProfileChangeHook(hook) {
    profileChangeHooks.add(hook);
    return () => {
        profileChangeHooks.delete(hook);
    };
}
/** Returns the errors of hooks that threw, so the caller can report them. */
function notifyProfileChanged(loaded) {
    const errors = [];
    for (const hook of profileChangeHooks) {
        try {
            hook(loaded);
        }
        catch (e) {
            errors.push(e instanceof Error ? e : new Error(String(e)));
        }
    }
    return errors;
}
function clearProfileChangeHooks() {
    profileChangeHooks.clear();
}
//# sourceMappingURL=profileEvents.js.map