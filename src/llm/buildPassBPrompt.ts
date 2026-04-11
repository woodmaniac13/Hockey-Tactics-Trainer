/**
 * Pass B prompt builder — constructs prompts for generating the consequence_frame
 * of an accepted Pass A scenario.
 *
 * Pass B is always run from an accepted (validated + linted) scenario JSON.
 * The scenario is serialised and injected into the user template.
 *
 * Usage:
 *   const { systemPrompt, userPrompt } = buildPassBPrompt(scenario, systemTemplate, userTemplate);
 *   const raw = await callModel(systemPrompt, userPrompt);
 */

import type { Scenario } from '../types';

/** Replaces `{{key}}` tokens in a template string with the provided values. */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in values ? values[key]! : match;
  });
}

/**
 * Builds the Pass B system and user prompts from an accepted scenario.
 *
 * The accepted scenario is serialised as indented JSON and injected into the
 * `{{scenario_json}}` placeholder in `pass_b_user_template.md`.
 *
 * @param scenario       - The validated and linted Pass A scenario.
 * @param systemTemplate - Content of `pass_b_system_prompt.md`.
 * @param userTemplate   - Content of `pass_b_user_template.md`.
 * @returns `{ systemPrompt, userPrompt }` ready to send to a model.
 */
export function buildPassBPrompt(
  scenario: Scenario,
  systemTemplate: string,
  userTemplate: string,
): { systemPrompt: string; userPrompt: string } {
  // Strip consequence_frame from the injected JSON — Pass B should not see
  // a pre-existing frame, ensuring a clean generation from scenario state alone.
  const { consequence_frame: _, ...scenarioWithoutFrame } = scenario;
  const scenarioJson = JSON.stringify(scenarioWithoutFrame, null, 2);

  return {
    systemPrompt: systemTemplate.trim(),
    userPrompt: fillTemplate(userTemplate, { scenario_json: scenarioJson }).trim(),
  };
}
