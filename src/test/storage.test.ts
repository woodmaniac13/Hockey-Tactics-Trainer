import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import {
  getProgress,
  updateProgress,
  getAttempts,
  addAttempt,
  getSettings,
  setSettings,
  exportData,
  importData,
  resetAll,
} from '../storage/storage';

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('progress storage', () => {
  it('returns empty object initially', () => {
    expect(getProgress()).toEqual({});
  });

  it('stores and retrieves progress', () => {
    updateProgress('S1', { version: 1, best_score: 85, last_score: 85, attempt_count: 1, last_played: 0 });
    const p = getProgress();
    expect(p['S1']).toBeDefined();
    expect(p['S1'].best_score).toBe(85);
  });
});

describe('attempt storage', () => {
  it('returns empty object initially', () => {
    expect(getAttempts()).toEqual({});
  });

  it('adds attempt and retrieves it', () => {
    addAttempt('S1', { version: 1, score: 70, result_type: 'VALID', position: { x: 50, y: 50 }, timestamp: 0 });
    const a = getAttempts();
    expect(a['S1']).toHaveLength(1);
  });

  it('limits to 10 attempts', () => {
    for (let i = 0; i < 15; i++) {
      addAttempt('S1', { version: 1, score: i, result_type: 'VALID', position: { x: 50, y: 50 }, timestamp: i });
    }
    const a = getAttempts();
    expect(a['S1'].length).toBeLessThanOrEqual(10);
  });
});

describe('settings storage', () => {
  it('returns defaults when nothing stored', () => {
    const s = getSettings();
    expect(s.show_overlays).toBe(true);
    expect(s.enable_reasoning_prompt).toBe(true);
    expect(s.debug_mode).toBe(false);
  });

  it('stores and retrieves settings', () => {
    setSettings({ show_overlays: false, enable_reasoning_prompt: false, debug_mode: true });
    const s = getSettings();
    expect(s.show_overlays).toBe(false);
    expect(s.debug_mode).toBe(true);
  });
});

describe('export/import', () => {
  it('export returns valid JSON string', () => {
    const data = exportData();
    expect(() => JSON.parse(data)).not.toThrow();
  });

  it('import returns true on valid data', () => {
    const data = exportData();
    expect(importData(data)).toBe(true);
  });

  it('import returns false on invalid data', () => {
    expect(importData('not valid json{{')).toBe(false);
  });
});

describe('resetAll', () => {
  it('clears all stored data', () => {
    updateProgress('S1', { version: 1, best_score: 85, last_score: 85, attempt_count: 1, last_played: 0 });
    resetAll();
    expect(getProgress()).toEqual({});
  });
});
