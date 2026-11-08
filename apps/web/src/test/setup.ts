// Test environment setup: DOM matchers + in-memory IndexedDB for Dexie.
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals, so RTL cannot register its auto-cleanup.
afterEach(cleanup);
