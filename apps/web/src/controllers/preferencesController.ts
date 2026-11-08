/**
 * User preferences that are not part of any board: whether onboarding was
 * completed and the preferred profile (pre-selected when creating boards).
 *
 * Stored in localStorage. When accounts arrive (API), this moves server-side
 * behind the same hook API.
 */
import { create } from 'zustand';
import { ProfileSchema, type Profile } from '@devbord/shared';

const KEY = 'devbord:prefs';

interface Prefs {
  onboarded: boolean;
  profile: Profile;
}

const DEFAULTS: Prefs = { onboarded: false, profile: 'simple' };

const read = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return {
      onboarded: raw.onboarded === true,
      profile: ProfileSchema.catch(DEFAULTS.profile).parse(raw.profile),
    };
  } catch {
    return DEFAULTS;
  }
};

const write = (prefs: Prefs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked: preferences last for this session only */
  }
};

interface PreferencesState extends Prefs {
  completeOnboarding: (profile: Profile) => void;
  setProfile: (profile: Profile) => void;
}

export const usePreferences = create<PreferencesState>((set, get) => {
  const save = (patch: Partial<Prefs>) => {
    const next = { onboarded: get().onboarded, profile: get().profile, ...patch };
    write(next);
    set(next);
  };
  return {
    ...read(),
    completeOnboarding: (profile) => save({ onboarded: true, profile }),
    setProfile: (profile) => save({ profile }),
  };
});
