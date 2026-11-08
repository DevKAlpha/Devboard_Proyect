/**
 * Local identity for team boards: a visible name and a cursor color.
 *
 * There are no accounts yet, so this lives in localStorage. When GitHub /
 * Google / Microsoft sign-in arrives, the name comes from the account and
 * this store keeps the same API.
 */
import { create } from 'zustand';

const KEY = 'devbord:identity';

/** Cursor colors that read well on light and dark themes. */
export const PEER_COLORS = ['#5e5ce6', '#ff6b3d', '#20a464', '#e5487a', '#2f8fe8', '#c8961b'];

interface Identity {
  name: string;
  color: string;
}

const read = (): Identity => {
  const fallback = {
    name: '',
    color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]!,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Identity> | null;
    return {
      name: typeof raw?.name === 'string' ? raw.name : fallback.name,
      color: typeof raw?.color === 'string' ? raw.color : fallback.color,
    };
  } catch {
    return fallback;
  }
};

interface IdentityState extends Identity {
  setName: (name: string) => void;
}

export const useIdentity = create<IdentityState>((set, get) => ({
  ...read(),
  setName: (name) => {
    const next = { name: name.trim().slice(0, 30), color: get().color };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the name lasts for this session */
    }
    set(next);
  },
}));
