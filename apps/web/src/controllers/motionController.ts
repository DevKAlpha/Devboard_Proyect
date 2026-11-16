/**
 * Motion controller: the animations switch in the top bar.
 *
 * Devbord picks a level from the device (design/motion.ts). People whose
 * machine still struggles can force lite mode, and the choice is remembered.
 */
import { create } from 'zustand';
import {
  holdLoops,
  isMotionLite,
  motionChosen,
  sampleFrames,
  setMotionLite,
  setMotionLiteForSession,
} from '../design';
import { useCursorController } from './cursorController';

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

/** Median frame time above this (under ~40 fps) means the device is struggling. */
const SLOW_FRAME_MS = 25;
/** Sampling: a first check after the app settles, then now and then. */
const FIRST_CHECK_MS = 3000;
const CHECK_EVERY_MS = 45000;

/**
 * Adapts to the machine: while the person has not chosen a level, the frame
 * rate is sampled now and then (2 s, only when visible), and a device that
 * cannot keep up goes to lite for this session. Also pauses the decorative
 * loops while a card is dragged, so the drag gets the whole frame budget.
 */
export function watchMotion() {
  let timer = 0;
  const check = async () => {
    if (!motionChosen() && !isMotionLite()) {
      const median = await sampleFrames();
      if (median !== null && median > SLOW_FRAME_MS && !motionChosen()) {
        setMotionLiteForSession();
        useMotion.setState({ lite: true });
        return; // lite now: nothing more to watch
      }
    }
    timer = window.setTimeout(check, CHECK_EVERY_MS);
  };
  timer = window.setTimeout(check, FIRST_CHECK_MS);

  let release: (() => void) | null = null;
  const unsubscribe = useCursorController.subscribe((s, prev) => {
    if (s.dragging === prev.dragging) return;
    if (s.dragging) release = holdLoops();
    else {
      release?.();
      release = null;
    }
  });
  return () => {
    window.clearTimeout(timer);
    unsubscribe();
    release?.();
  };
}
