/**
 * Animation level as app state, so the top-bar toggle re-renders.
 * The level itself is applied by design/motion.ts (`<html data-motion>`).
 */
import { create } from 'zustand';
import { autoMotionLevel, setMotionLevel, storedMotionLevel, type MotionLevel } from '../design';

interface MotionState {
  level: MotionLevel;
  /** Flips between full and lite and remembers it (overrides the automatic choice). */
  toggle: () => void;
}

export const useMotion = create<MotionState>((set, get) => ({
  level: storedMotionLevel() ?? autoMotionLevel(),
  toggle: () => {
    const level: MotionLevel = get().level === 'full' ? 'lite' : 'full';
    setMotionLevel(level);
    set({ level });
  },
}));
