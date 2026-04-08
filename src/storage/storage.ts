import { z } from 'zod';
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

// Zod schemas for runtime validation of stored data
const ReasoningOptionSchema = z.enum(['create_passing_angle', 'provide_cover', 'enable_switch', 'support_under_pressure']);

const ProgressRecordSchema = z.object({
  version: z.number(),
  best_score: z.number(),
  last_score: z.number(),
  attempt_count: z.number(),
  last_played: z.number(),
});

const AttemptRecordSchema = z.object({
  version: z.number(),
  score: z.number(),
  result_type: z.enum(['IDEAL', 'VALID', 'ALTERNATE_VALID', 'PARTIAL', 'INVALID', 'ERROR']),
  position: z.object({ x: z.number(), y: z.number() }),
  reasoning: ReasoningOptionSchema.optional(),
  timestamp: z.number(),
});

const AppSettingsSchema = z.object({
  show_overlays: z.boolean(),
  enable_reasoning_prompt: z.boolean(),
  debug_mode: z.boolean(),
});

const ProgressStoreSchema = z.record(z.string(), ProgressRecordSchema);
const AttemptsStoreSchema = z.record(z.string(), z.array(AttemptRecordSchema));

function safeGet<T>(key: string, fallback: T, schema?: z.ZodType<T>): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        console.warn(`Stored data at "${key}" failed validation, using fallback:`, result.error.issues);
        return fallback;
      }
      return result.data;
    }
    return parsed as T;
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
  return safeGet<Record<string, ProgressRecord>>(KEYS.PROGRESS, {}, ProgressStoreSchema);
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
  return safeGet<Record<string, AttemptRecord[]>>(KEYS.ATTEMPTS, {}, AttemptsStoreSchema);
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
    const raw: unknown = JSON.parse(jsonString);
    if (typeof raw !== 'object' || raw === null) return false;
    const data = raw as Record<string, unknown>;

    if (data.progress !== undefined) {
      const progressResult = ProgressStoreSchema.safeParse(data.progress);
      if (!progressResult.success) {
        console.warn('Import: progress data failed validation, skipping:', progressResult.error.issues);
      } else {
        setProgress(progressResult.data);
      }
    }

    if (data.attempts !== undefined) {
      const attemptsResult = AttemptsStoreSchema.safeParse(data.attempts);
      if (!attemptsResult.success) {
        // Attempt per-scenario recovery: keep valid entries, drop invalid
        if (typeof data.attempts === 'object' && data.attempts !== null && !Array.isArray(data.attempts)) {
          const recovered: Record<string, AttemptRecord[]> = {};
          for (const [id, entries] of Object.entries(data.attempts as Record<string, unknown>)) {
            const entriesResult = z.array(AttemptRecordSchema).safeParse(entries);
            if (entriesResult.success) {
              recovered[id] = entriesResult.data;
            } else {
              console.warn(`Import: attempts for scenario "${id}" failed validation, skipping`);
            }
          }
          safeSet(KEYS.ATTEMPTS, recovered);
        } else {
          console.warn('Import: attempts data is not a valid object, skipping');
        }
      } else {
        safeSet(KEYS.ATTEMPTS, attemptsResult.data);
      }
    }

    if (data.settings !== undefined) {
      const settingsResult = AppSettingsSchema.safeParse(data.settings);
      if (!settingsResult.success) {
        console.warn('Import: settings data failed validation, skipping:', settingsResult.error.issues);
      } else {
        setSettings(settingsResult.data);
      }
    }

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
