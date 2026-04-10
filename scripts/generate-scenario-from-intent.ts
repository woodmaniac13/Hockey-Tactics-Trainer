#!/usr/bin/env node
/**
 * generate-scenario-from-intent.ts
 *
 * Converts a ScenarioIntent JSON file into a draft Scenario JSON file with
 * resolved coordinates, then runs the content lint on the output.
 *
 * Usage:
 *   npx tsx scripts/generate-scenario-from-intent.ts <intent.json> [--out <output.json>]
 *   npx tsx scripts/generate-scenario-from-intent.ts <intent.json> --print
 *
 * Options:
 *   --out <file>   Write output to this file (default: <input>_draft.json)
 *   --print        Print the generated scenario to stdout instead of writing a file
 *   --no-lint      Skip content lint on the output
 *
 * Example:
 *   npx tsx scripts/generate-scenario-from-intent.ts /tmp/my-intent.json --print
 *
 * The intent JSON must conform to ScenarioIntentSchema.
 * After generation, review the draft and adjust any PLACEHOLDER regions.
 */

import fs from 'fs';
import path from 'path';
import { ScenarioIntentSchema, intentToScenario } from '../src/scenarios/scenarioIntent';
import { ScenarioSchema } from '../src/scenarios/scenarioSchema';
import { lintScenario } from '../src/scenarios/scenarioLint';

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
  Usage: npx tsx scripts/generate-scenario-from-intent.ts <intent.json> [options]

  Options:
    --out <file>   Write output to this file (default: <input>_draft.json)
    --print        Print to stdout instead of writing a file
    --no-lint      Skip content lint on the output
    --help         Show this message
  `);
  process.exit(0);
}

const inputFile = args[0]!;
const printOnly = args.includes('--print');
const skipLint = args.includes('--no-lint');
const outIdx = args.indexOf('--out');
const outFile =
  outIdx !== -1 && args[outIdx + 1]
    ? args[outIdx + 1]!
    : inputFile.replace(/\.json$/, '_draft.json');

// ── Load and parse intent ─────────────────────────────────────────────────────

if (!fs.existsSync(inputFile)) {
  console.error(`\n  ✗  File not found: ${inputFile}\n`);
  process.exit(1);
}

let rawIntent: unknown;
try {
  rawIntent = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
} catch {
  console.error(`\n  ✗  Failed to parse JSON: ${inputFile}\n`);
  process.exit(1);
}

const intentResult = ScenarioIntentSchema.safeParse(rawIntent);
if (!intentResult.success) {
  console.error(`\n  ✗  Intent schema validation failed:\n`);
  for (const issue of intentResult.error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    console.error(`       ${field} — ${issue.message}`);
  }
  console.error('');
  process.exit(1);
}

// ── Convert intent to scenario ────────────────────────────────────────────────

let scenario;
try {
  scenario = intentToScenario(intentResult.data);
} catch (err) {
  console.error(`\n  ✗  Conversion failed: ${(err as Error).message}\n`);
  process.exit(1);
}

const scenarioJson = JSON.stringify(scenario, null, 2);

// ── Validate output schema ────────────────────────────────────────────────────

const schemaResult = ScenarioSchema.safeParse(scenario);
if (!schemaResult.success) {
  console.warn(`\n  ⚠  Draft scenario has schema issues (may need manual fixes):\n`);
  for (const issue of schemaResult.error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    console.warn(`       ${field} — ${issue.message}`);
  }
}

// ── Run content lint ──────────────────────────────────────────────────────────

if (!skipLint && schemaResult.success) {
  console.log(`\n  🏑  Running content lint on generated scenario...\n`);
  const { errors, warnings } = lintScenario(schemaResult.data);

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`  ✓  Lint passed — no errors or warnings.\n`);
  } else {
    for (const err of errors) {
      console.error(`  ✗  ${err}`);
    }
    for (const warn of warnings) {
      console.warn(`  ⚠  ${warn}`);
    }
    if (errors.length > 0) {
      console.error(`\n  ${errors.length} error(s) must be fixed before this scenario is usable.\n`);
    }
    if (warnings.length > 0) {
      console.warn(`\n  ${warnings.length} warning(s) to review.\n`);
    }
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

if (printOnly) {
  console.log(scenarioJson);
} else {
  fs.writeFileSync(outFile, scenarioJson, 'utf-8');
  console.log(`\n  ✓  Draft scenario written to: ${path.relative(process.cwd(), outFile)}\n`);
  console.log(
    `  Next steps:\n` +
      `    1. Review the draft and fix any PLACEHOLDER regions (search for "PLACEHOLDER").\n` +
      `    2. Adjust entity coordinates if needed (current positions are from CANONICAL_POSITION_ANCHORS).\n` +
      `    3. Run: npx tsx scripts/lint-scenarios.ts --strict\n` +
      `    4. Move to public/scenarios/<category>/ and add to the manifest.\n`,
  );
}
