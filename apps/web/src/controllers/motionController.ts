/**
 * Motion controller: the animations switch in the top bar.
 *
 * Devbord picks a level from the device (design/motion.ts). People whose
 * machine still struggles can force lite mode, and the choice is remembered.
 */
import { create } from 'zustand';
import { isMotionLite, setMotionLite } from '../design';

interface MotionState {
  lite: boolean;
  toggle: () => void;
}

export const useMotion = create<MotionState>((set, get) => ({
  lite: isMotionLite(),
  toggle: () => {
    const lite = !get().lite;
    setMotionLite(lite);
    set({ lite });
  },
}));
