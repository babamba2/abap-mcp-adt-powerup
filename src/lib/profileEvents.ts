import type { LoadedProfile } from './profile';

/**
 * Fan-out for in-session profile switches (ReloadProfile).
 *
 * Connection-reset hooks (./connectionEvents) also fire on token refresh, so
 * they must not re-read connection parameters. Profile-change hooks fire only
 * after a new profile has been applied to process.env, and receive it, so a
 * listener can rebind anything it captured at boot (stdio connection params,
 * RFC CSRF sessions, ...).
 */
export type ProfileChangeHook = (loaded: LoadedProfile) => void;

const profileChangeHooks = new Set<ProfileChangeHook>();

export function registerProfileChangeHook(hook: ProfileChangeHook): () => void {
  profileChangeHooks.add(hook);
  return () => {
    profileChangeHooks.delete(hook);
  };
}

/** Returns the errors of hooks that threw, so the caller can report them. */
export function notifyProfileChanged(loaded: LoadedProfile): Error[] {
  const errors: Error[] = [];
  for (const hook of profileChangeHooks) {
    try {
      hook(loaded);
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  return errors;
}

export function clearProfileChangeHooks() {
  profileChangeHooks.clear();
}
