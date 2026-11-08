/**
 * Profile capabilities.
 *
 * There is ONE board UI. Profiles only toggle optional features and wording,
 * so a "simple" user can grow into "technical" by flipping a setting, with
 * no data migration.
 */
import type { Profile } from './schemas';

export interface ProfileFeatures {
  /** Show the task/feature/bug selector and badge. */
  cardTypes: boolean;
  /** Show the priority selector and indicator. */
  priority: boolean;
  /** Show developer vocabulary (e.g. "Backlog", "Issue") in hints. */
  devVocabulary: boolean;
}

export const PROFILE_FEATURES: Readonly<Record<Profile, ProfileFeatures>> = {
  technical: { cardTypes: true, priority: true, devVocabulary: true },
  simple: { cardTypes: false, priority: false, devVocabulary: false },
};

/** Human-facing copy for the profile picker. */
export const PROFILE_INFO: Readonly<Record<Profile, { title: string; description: string }>> = {
  technical: {
    title: 'Técnico',
    description: 'Sprints, bugs, prioridades. Para equipos de desarrollo y DevOps.',
  },
  simple: {
    title: 'Sencillo',
    description: 'Tareas claras sin jerga. Para el día a día, estudios o negocio.',
  },
};
