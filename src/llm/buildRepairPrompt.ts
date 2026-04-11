/**
 * Repair prompt builder — constructs prompts for the validation-repair loop.
 *
 * When Pass A or Pass B output fails schema validation or content linting,
 * a repair prompt is built from:
 *   - The current (broken) JSON output.
 *   - The list of specific issues to fix.
 *   - The repair mode ('scenario' or 'consequence_frame').
 *
 * The repair prompt is designed so the model preserves valid content and
 * makes only the minimum changes needed to fix the listed issues.
 *
 * Usage:
 *   const { systemPrompt, userPrompt } = buildRepairPrompt(
 *     currentJson, issues, 'scenario', systemTemplate, userTemplate
 *   );
 *   const raw = await callModel(systemPrompt, userPrompt);
 */

import type { RepairMode } from './promptTypes';

/** Replaces `{{key}}` tokens in a template string with the provided values. */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in values ? values[key]! : match;
  });
}

/**
 * Formats a list of issues as a numbered markdown list for injection into the
 * repair user template.
 */
function formatIssuesList(issues: string[]): string {
  if (issues.length === 0) return '(no specific issues listed — verify the output format and schema compliance)';
  return issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n');
}

/**
 * Builds repair system and user prompts.
 *
 * @param currentJson    - The JSON string (raw model output) that failed validation.
 * @param issues         - Specific error and warning messages from schema/lint validation.
 * @param mode           - Whether we are repairing a full scenario or a consequence_frame.
 * @param systemTemplate - Content of `repair_system_prompt.md`.
 * @param userTemplate   - Content of `repair_user_template.md`.
 * @returns `{ systemPrompt, userPrompt }` ready to send to a model.
 */
export function buildRepairPrompt(
  currentJson: string,
  issues: string[],
  mode: RepairMode,
  systemTemplate: string,
  userTemplate: string,
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: systemTemplate.trim(),
    userPrompt: fillTemplate(userTemplate, {
      repair_mode: mode,
      issues_list: formatIssuesList(issues),
      current_json: currentJson,
    }).trim(),
  };
}
