/**
 * Prompt template loader — reads markdown template files from disk.
 *
 * This module is intended for use in Node.js scripts only (e.g. `scripts/`).
 * It reads the prompt template `.md` files from `docs/llm_scenario_generation/`
 * relative to the project root.
 *
 * For browser / Vite / test contexts, use the `PROMPT_TEMPLATES` constants
 * exported below, which are inlined at build time.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Path to the docs/llm_scenario_generation/ directory relative to this file. */
const TEMPLATES_DIR = resolve(__dirname, '../../docs/llm_scenario_generation');

/**
 * Reads a prompt template file synchronously.
 *
 * @param filename - Filename inside `docs/llm_scenario_generation/` (e.g. `"pass_a_system_prompt.md"`).
 * @returns The raw markdown string.
 * @throws If the file cannot be read.
 */
export function loadPromptTemplate(filename: string): string {
  const fullPath = resolve(TEMPLATES_DIR, filename);
  return readFileSync(fullPath, 'utf-8');
}

/** Names of all known template files. */
export const TEMPLATE_FILES = {
  passASystem: 'pass_a_system_prompt.md',
  passAUser: 'pass_a_user_template.md',
  passBSystem: 'pass_b_system_prompt.md',
  passBUser: 'pass_b_user_template.md',
  repairSystem: 'repair_system_prompt.md',
  repairUser: 'repair_user_template.md',
} as const;

/** Loads all six prompt templates from disk and returns them as an object. */
export function loadAllPromptTemplates(): {
  passASystem: string;
  passAUser: string;
  passBSystem: string;
  passBUser: string;
  repairSystem: string;
  repairUser: string;
} {
  return {
    passASystem: loadPromptTemplate(TEMPLATE_FILES.passASystem),
    passAUser: loadPromptTemplate(TEMPLATE_FILES.passAUser),
    passBSystem: loadPromptTemplate(TEMPLATE_FILES.passBSystem),
    passBUser: loadPromptTemplate(TEMPLATE_FILES.passBUser),
    repairSystem: loadPromptTemplate(TEMPLATE_FILES.repairSystem),
    repairUser: loadPromptTemplate(TEMPLATE_FILES.repairUser),
  };
}
