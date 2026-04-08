import type { ProgressRecord, AttemptRecord, AppSettings } from '../types';

const KEYS = {
  PROGRESS: 'fhtt.progress.v1',
  ATTEMPTS: 'fhtt.attempts.v1',
  SETTINGS: 'fhtt.settings.v1',
  META: 'fhtt.meta.v1',
};

const MAX_ATTEMPTS_PER_SCENARIO = 10;

const DEFAULT_SETTINGS: AppSettings = {
  show_overlays: true,
  enable_reasoning_prompt: true,
  debug_mode: false,
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if storage is unavailable
  }
}

export function getProgress(): Record<string, ProgressRecord> {
  return safeGet<Record<string, ProgressRecord>>(KEYS.PROGRESS, {});
}

export function setProgress(data: Record<string, ProgressRecord>): void {
  safeSet(KEYS.PROGRESS, data);
}

export function updateProgress(scenarioId: string, record: ProgressRecord): void {
  const current = getProgress();
  current[scenarioId] = record;
  setProgress(current);
}

export function getAttempts(): Record<string, AttemptRecord[]> {
  return safeGet<Record<string, AttemptRecord[]>>(KEYS.ATTEMPTS, {});
}

export function addAttempt(scenarioId: string, attempt: AttemptRecord): void {
  const current = getAttempts();
  if (!current[scenarioId]) current[scenarioId] = [];
  current[scenarioId].push(attempt);
  if (current[scenarioId].length > MAX_ATTEMPTS_PER_SCENARIO) {
    current[scenarioId] = current[scenarioId].slice(-MAX_ATTEMPTS_PER_SCENARIO);
  }
  safeSet(KEYS.ATTEMPTS, current);
}

export function getSettings(): AppSettings {
  const stored = safeGet<Partial<AppSettings>>(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function setSettings(settings: AppSettings): void {
  safeSet(KEYS.SETTINGS, settings);
}

export function exportData(): string {
  return JSON.stringify({
    progress: getProgress(),
    attempts: getAttempts(),
    settings: getSettings(),
    exported_at: Date.now(),
  });
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString) as {
      progress?: Record<string, ProgressRecord>;
      attempts?: Record<string, AttemptRecord[]>;
      settings?: AppSettings;
    };
    if (data.progress) setProgress(data.progress);
    if (data.attempts) safeSet(KEYS.ATTEMPTS, data.attempts);
    if (data.settings) setSettings(data.settings);
    return true;
  } catch {
    return false;
  }
}

export function resetAll(): void {
  Object.values(KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
}
