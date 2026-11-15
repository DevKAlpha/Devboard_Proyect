import { describe, expect, it } from 'vitest';
import { usePreferences } from './preferencesController';

describe('preferencesController', () => {
  it('setLastSkin returns nothing, even when the skin did not change', () => {
    // BoardPage calls it from an effect: a returned `false` was taken as a
    // clean-up, and React crashed the whole app when leaving the board.
    const { setLastSkin } = usePreferences.getState();
    expect(setLastSkin('christmas')).toBeUndefined();
    expect(setLastSkin('christmas')).toBeUndefined();
    expect(usePreferences.getState().lastSkin).toBe('christmas');
  });
});
