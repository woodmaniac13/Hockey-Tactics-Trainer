/**
 * Pass A prompt builder — constructs the system and user prompts for generating
 * a core field hockey scenario (without consequence_frame).
 *
 * Usage:
 *   const { systemPrompt, userPrompt } = buildPassAPrompt(brief, systemTemplate, userTemplate);
 *   const raw = await callModel(systemPrompt, userPrompt);
 */

import type { ScenarioGenerationBrief } from './promptTypes';

/**
 * Placeholder substitution map for the Pass A user template.
 *
 * Keys correspond to `{{placeholder}}` tokens in `pass_a_user_template.md`.
 */
type PassAPlaceholders = {
  scenario_archetype: string;
  phase: string;
  difficulty: string;
  field_zone: string;
  line_group: string;
  target_role_family: string;
  primary_concept: string;
  secondary_concepts_json_array: string;
  learning_stage: string;
  curriculum_group: string;
  title_seed: string;
};

/** Replaces `{{key}}` tokens in a template string with the provided values. */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in values ? values[key]! : match;
  });
}

/**
 * Builds the Pass A system and user prompts from a generation brief.
 *
 * @param brief          - The typed generation brief specifying what to generate.
 * @param systemTemplate - Content of `pass_a_system_prompt.md`.
 * @param userTemplate   - Content of `pass_a_user_template.md`.
 * @returns `{ systemPrompt, userPrompt }` ready to send to a model.
 */
export function buildPassAPrompt(
  brief: ScenarioGenerationBrief,
  systemTemplate: string,
  userTemplate: string,
): { systemPrompt: string; userPrompt: string } {
  const placeholders: PassAPlaceholders = {
    scenario_archetype: brief.scenario_archetype,
    phase: brief.phase,
    difficulty: String(brief.difficulty),
    field_zone: brief.field_zone,
    line_group: brief.line_group,
    target_role_family: brief.target_role_family,
    primary_concept: brief.primary_concept,
    secondary_concepts_json_array: JSON.stringify(brief.secondary_concepts ?? []),
    learning_stage: brief.learning_stage !== undefined ? String(brief.learning_stage) : 'not specified',
    curriculum_group: brief.curriculum_group ?? 'not specified',
    title_seed: brief.title_seed ?? 'not specified',
  };

  return {
    systemPrompt: systemTemplate.trim(),
    userPrompt: fillTemplate(userTemplate, placeholders).trim(),
  };
}
