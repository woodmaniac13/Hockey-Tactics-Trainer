/**
 * Repair loop utilities — parse model output, run validation, and accumulate
 * issues for the repair prompt.
 *
 * The repair loop is stateless: each call receives a raw JSON string and
 * returns a structured result containing the parsed value (if valid) or the
 * accumulated issues (if invalid). The caller controls the loop.
 */

import { ScenarioSchema, ConsequenceFrameSchema } from '../scenarios/scenarioSchema';
import { lintScenario } from '../scenarios/scenarioLint';
import { lintGeneratedScenario } from './validateGeneratedScenario';
import type { Scenario, ConsequenceFrame } from '../types';

/** Result of attempting to parse and validate a Pass A raw output. */
export type ScenarioParseResult =
  | { ok: true; scenario: Scenario; warnings: string[] }
  | { ok: false; issues: string[] };

/** Result of attempting to parse and validate a Pass B raw output. */
export type ConsequenceFrameParseResult =
  | { ok: true; consequenceFrame: ConsequenceFrame; warnings: string[] }
  | { ok: false; issues: string[] };

/**
 * Attempts to extract a JSON object from a raw model response string.
 *
 * Models sometimes wrap JSON in markdown code fences or add prose before/after.
 * This function strips the most common wrapping patterns before parsing.
 */
export function extractJson(raw: string): unknown {
  const stripped = raw.trim();

  // Try to extract JSON from a markdown code block (```json ... ``` or ``` ... ```)
  const codeBlockMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1]?.trim() ?? '');
  }

  // Try the raw string directly
  return JSON.parse(stripped);
}

/**
 * Parses a raw model string as a Scenario, validates the schema, runs the
 * standard content lint, and runs the generated-content lint.
 *
 * @param raw - Raw string output from the model (Pass A or repair).
 * @returns `{ ok: true, scenario, warnings }` or `{ ok: false, issues }`.
 */
export function parseAndValidateScenario(raw: string): ScenarioParseResult {
  const issues: string[] = [];

  // Step 1: JSON parse
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, issues: ['Output is not valid JSON — ensure the response contains only a JSON object'] };
  }

  // Step 2: Zod schema parse
  const schemaResult = ScenarioSchema.safeParse(parsed);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      issues.push(`Schema error — ${path}${issue.message}`);
    }
    return { ok: false, issues };
  }

  const scenario = schemaResult.data as Scenario;

  // Step 3: Standard content lint
  const lintResult = lintScenario(scenario);
  if (lintResult.errors.length > 0) {
    return { ok: false, issues: [...lintResult.errors] };
  }

  // Step 4: Generated-content lint (stricter checks, but no consequence_frame required at Pass A)
  const generatedLint = lintGeneratedScenario(scenario, { requireConsequenceFrame: false });
  if (generatedLint.errors.length > 0) {
    return { ok: false, issues: generatedLint.errors };
  }

  const allWarnings = [...lintResult.warnings, ...generatedLint.warnings];
  return { ok: true, scenario, warnings: allWarnings };
}

/**
 * Parses a raw model string as a ConsequenceFrame and validates the schema.
 *
 * @param raw      - Raw string output from the model (Pass B or repair).
 * @param scenario - The accepted Pass A scenario, used for entity ID cross-checks.
 * @returns `{ ok: true, consequenceFrame, warnings }` or `{ ok: false, issues }`.
 */
export function parseAndValidateConsequenceFrame(
  raw: string,
  scenario: Scenario,
): ConsequenceFrameParseResult {
  const issues: string[] = [];

  // Step 1: JSON parse
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, issues: ['Output is not valid JSON — ensure the response contains only a JSON object'] };
  }

  // Step 2: Zod schema parse
  const schemaResult = ConsequenceFrameSchema.safeParse(parsed);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      issues.push(`Schema error — ${path}${issue.message}`);
    }
    return { ok: false, issues };
  }

  const consequenceFrame = schemaResult.data as ConsequenceFrame;

  // Step 3: Entity ID cross-check — ensure all referenced IDs exist in the scenario.
  const knownIds = new Set([
    ...scenario.teammates.map(e => e.id),
    ...scenario.opponents.map(e => e.id),
    'ball',
  ]);

  const warnings: string[] = [];

  function checkOutcome(
    outcome: ConsequenceFrame['on_success'],
    branch: 'on_success' | 'on_failure',
  ): void {
    if (!outcome) return;

    for (const arrow of outcome.arrows ?? []) {
      if (arrow.from_entity_id && !knownIds.has(arrow.from_entity_id)) {
        issues.push(`${branch}.arrows references unknown entity "${arrow.from_entity_id}" in from_entity_id`);
      }
      if (arrow.to_entity_id && !knownIds.has(arrow.to_entity_id)) {
        issues.push(`${branch}.arrows references unknown entity "${arrow.to_entity_id}" in to_entity_id`);
      }
    }

    for (const shift of outcome.entity_shifts ?? []) {
      if (!knownIds.has(shift.entity_id)) {
        issues.push(`${branch}.entity_shifts references unknown entity "${shift.entity_id}"`);
      }
    }

    for (const pos of outcome.pass_option_states ?? []) {
      if (!knownIds.has(pos.from_entity_id)) {
        issues.push(`${branch}.pass_option_states references unknown entity "${pos.from_entity_id}" in from_entity_id`);
      }
      if (!knownIds.has(pos.to_entity_id)) {
        issues.push(`${branch}.pass_option_states references unknown entity "${pos.to_entity_id}" in to_entity_id`);
      }
    }

    if ((outcome.arrows?.length ?? 0) > 3) {
      warnings.push(`${branch}.arrows has ${outcome.arrows!.length} entries — limit to 3 to avoid board clutter`);
    }
    if ((outcome.entity_shifts?.length ?? 0) > 2) {
      warnings.push(`${branch}.entity_shifts has ${outcome.entity_shifts!.length} entries — limit to 2 shifts`);
    }
  }

  checkOutcome(consequenceFrame.on_success, 'on_success');
  checkOutcome(consequenceFrame.on_failure, 'on_failure');

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // Step 4: Generated-content visual primitive check (consequence_frame is present by definition)
  const frameAsScenario: Scenario = { ...scenario, consequence_frame: consequenceFrame };
  const generatedLint = lintGeneratedScenario(frameAsScenario, { requireConsequenceFrame: true });

  // Only return errors related to the consequence_frame
  const frameErrors = generatedLint.errors.filter(e => e.includes('consequence_frame'));
  const frameWarnings = generatedLint.warnings.filter(w => w.includes('consequence_frame'));

  if (frameErrors.length > 0) {
    return { ok: false, issues: frameErrors };
  }

  return { ok: true, consequenceFrame, warnings: [...warnings, ...frameWarnings] };
}
