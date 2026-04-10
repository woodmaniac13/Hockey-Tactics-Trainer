/**
 * Generation pipeline orchestration — two-pass LLM scenario generation with
 * validation, repair loop, and consequence frame merging.
 *
 * This module does not call any model directly. Callers supply a `ModelCallFn`
 * which accepts system/user prompts and returns a raw text response. This
 * decouples the pipeline from any specific model provider.
 *
 * ## Pipeline overview
 *
 * Pass A:
 *   1. Build Pass A prompts from the generation brief.
 *   2. Call the model.
 *   3. Parse and validate the response.
 *   4. If invalid: build a repair prompt, call the model, re-validate.
 *   5. Repeat up to `maxRepairAttempts` times.
 *   6. If still invalid: throw with accumulated issues.
 *
 * Pass B:
 *   1. Build Pass B prompts from the accepted Pass A scenario.
 *   2. Call the model.
 *   3. Parse and validate the consequence frame.
 *   4. If invalid: repair loop (same as Pass A).
 *   5. Merge the accepted consequence frame into the scenario.
 *
 * ## Example usage
 *
 * ```typescript
 * import { runGenerationPipeline } from './src/llm/generateScenario';
 *
 * const scenario = await runGenerationPipeline(
 *   brief,
 *   async (system, user) => {
 *     // your model call here
 *     return callOpenAI(system, user);
 *   },
 *   { maxRepairAttempts: 2 },
 * );
 * ```
 */

import type { ScenarioGenerationBrief, ModelCallFn, GenerationOptions, GenerationPipelineState } from './promptTypes';
import type { Scenario } from '../types';
import { buildPassAPrompt } from './buildPassAPrompt';
import { buildPassBPrompt } from './buildPassBPrompt';
import { buildRepairPrompt } from './buildRepairPrompt';
import { parseAndValidateScenario, parseAndValidateConsequenceFrame } from './repairScenario';
import { mergeConsequenceFrame } from './mergeConsequenceFrame';

const DEFAULT_MAX_REPAIR_ATTEMPTS = 2;

/**
 * Creates a fresh pipeline state object for the given brief.
 */
export function createPipelineState(brief: ScenarioGenerationBrief): GenerationPipelineState {
  return {
    brief,
    passARawOutput: null,
    acceptedScenario: null,
    passBRawOutput: null,
    acceptedConsequenceFrame: null,
    finalScenario: null,
    errors: [],
    warnings: [],
    repairAttempts: 0,
  };
}

/**
 * Runs the full two-pass generation pipeline.
 *
 * Pass A generates the core scenario; Pass B generates the consequence_frame.
 * Both passes include a repair loop on validation failure.
 *
 * @param brief        - The typed generation brief.
 * @param callModel    - Async function that calls the model with system + user prompts.
 * @param templates    - The six prompt template strings (loaded from docs/llm_scenario_generation/).
 * @param options      - Optional configuration (maxRepairAttempts).
 * @returns The final complete Scenario with consequence_frame.
 * @throws If the pipeline cannot produce a valid scenario after all repair attempts.
 */
export async function runGenerationPipeline(
  brief: ScenarioGenerationBrief,
  callModel: ModelCallFn,
  templates: {
    passASystem: string;
    passAUser: string;
    passBSystem: string;
    passBUser: string;
    repairSystem: string;
    repairUser: string;
  },
  options?: GenerationOptions,
): Promise<Scenario> {
  const maxRepairs = options?.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS;
  const state = createPipelineState(brief);

  // ── Pass A: generate core scenario ────────────────────────────────────────

  const passAPrompts = buildPassAPrompt(brief, templates.passASystem, templates.passAUser);
  let passARaw = await callModel(passAPrompts.systemPrompt, passAPrompts.userPrompt);
  state.passARawOutput = passARaw;

  let passAResult = parseAndValidateScenario(passARaw);

  // Pass A repair loop
  for (let attempt = 0; !passAResult.ok && attempt < maxRepairs; attempt++) {
    state.repairAttempts++;
    state.errors.push(...passAResult.issues);

    const repairPrompts = buildRepairPrompt(
      passARaw,
      passAResult.issues,
      'scenario',
      templates.repairSystem,
      templates.repairUser,
    );

    passARaw = await callModel(repairPrompts.systemPrompt, repairPrompts.userPrompt);
    passAResult = parseAndValidateScenario(passARaw);
  }

  if (!passAResult.ok) {
    state.errors.push(...passAResult.issues);
    throw new Error(
      `Pass A failed after ${maxRepairs} repair attempt(s).\n` +
        `Issues:\n${passAResult.issues.map(i => `  - ${i}`).join('\n')}`,
    );
  }

  state.acceptedScenario = passAResult.scenario;
  state.warnings.push(...passAResult.warnings);

  // ── Pass B: generate consequence_frame ────────────────────────────────────

  const passBPrompts = buildPassBPrompt(passAResult.scenario, templates.passBSystem, templates.passBUser);
  let passBRaw = await callModel(passBPrompts.systemPrompt, passBPrompts.userPrompt);
  state.passBRawOutput = passBRaw;

  let passBResult = parseAndValidateConsequenceFrame(passBRaw, passAResult.scenario);

  // Pass B repair loop
  for (let attempt = 0; !passBResult.ok && attempt < maxRepairs; attempt++) {
    state.repairAttempts++;
    state.errors.push(...passBResult.issues);

    const repairPrompts = buildRepairPrompt(
      passBRaw,
      passBResult.issues,
      'consequence_frame',
      templates.repairSystem,
      templates.repairUser,
    );

    passBRaw = await callModel(repairPrompts.systemPrompt, repairPrompts.userPrompt);
    passBResult = parseAndValidateConsequenceFrame(passBRaw, passAResult.scenario);
  }

  if (!passBResult.ok) {
    state.errors.push(...passBResult.issues);
    throw new Error(
      `Pass B failed after ${maxRepairs} repair attempt(s).\n` +
        `Issues:\n${passBResult.issues.map(i => `  - ${i}`).join('\n')}`,
    );
  }

  state.acceptedConsequenceFrame = passBResult.consequenceFrame;
  state.warnings.push(...passBResult.warnings);

  // ── Merge and return ────────────────────────────────────────────────────────

  const finalScenario = mergeConsequenceFrame(passAResult.scenario, passBResult.consequenceFrame);
  state.finalScenario = finalScenario;

  return finalScenario;
}
