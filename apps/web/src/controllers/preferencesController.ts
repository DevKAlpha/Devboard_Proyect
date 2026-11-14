/**
 * User preferences that are not part of any board: whether onboarding was
 * completed and the preferred profile (pre-selected when creating boards).
 *
 * Stored in localStorage. When accounts arrive (API), this moves server-side
 * behind the same hook API.
 */
import { create } from 'zustand';
import { BoardSkinSchema, ProfileSchema, type BoardSkin, type Profile } from '@devbord/shared';

const KEY = 'devbord:prefs';

interface Prefs {
  onboarded: boolean;
  profile: Profile;
  /** Theme of the last board opened: the costume of our duck in the home bath. */
  lastSkin: BoardSkin;
}

const DEFAULTS: Prefs = { onboarded: false, profile: 'simple', lastSkin: 'default' };

const read = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return {
      onboarded: raw.onboarded === true,
      profile: ProfileSchema.catch(DEFAULTS.profile).parse(raw.profile),
      lastSkin: BoardSkinSchema.catch(DEFAULTS.lastSkin).parse(raw.lastSkin),
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
  setLastSkin: (skin: BoardSkin) => void;
}

export const usePreferences = create<PreferencesState>((set, get) => {
  const save = (patch: Partial<Prefs>) => {
    const { onboarded, profile, lastSkin } = get();
    const next = { onboarded, profile, lastSkin, ...patch };
    write(next);
    set(next);
  };
  return {
    ...read(),
    completeOnboarding: (profile) => save({ onboarded: true, profile }),
    setProfile: (profile) => save({ profile }),
    setLastSkin: (lastSkin) => get().lastSkin !== lastSkin && save({ lastSkin }),
  };
});
