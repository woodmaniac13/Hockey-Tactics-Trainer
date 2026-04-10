#!/usr/bin/env node
/**
 * Scenario content lint script.
 *
 * Walks public/scenarios/, validates every JSON file against ScenarioSchema,
 * then runs lintScenario() on each. Prints a colour-coded summary to the
 * terminal. Exits with code 1 if any errors are found.
 *
 * Usage:
 *   npx tsx scripts/lint-scenarios.ts
 *   npx tsx scripts/lint-scenarios.ts --strict   # exit 1 on warnings too
 *
 * tsx must be available (install with: npm install -D tsx).
 * Alternatively, add it as a project dev dependency and use the npm script:
 *   npm run lint-content
 *
 * This script is a pre-commit authoring tool. The same rules are also enforced
 * by the Vitest suite in src/test/scenarioContentLint.test.ts.
 */

import fs from 'fs';
import path from 'path';
import { ScenarioSchema } from '../src/scenarios/scenarioSchema';
import { lintScenario } from '../src/scenarios/scenarioLint';

// ── Config ────────────────────────────────────────────────────────────────────

const SCENARIOS_DIR = path.resolve(process.cwd(), 'public/scenarios');
const STRICT_MODE = process.argv.includes('--strict');

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = walkDir(SCENARIOS_DIR);
let totalErrors = 0;
let totalWarnings = 0;

console.log(
  `\n🏑  Linting ${files.length} scenario file(s) in ${path.relative(process.cwd(), SCENARIOS_DIR)}/\n`,
);

for (const filePath of files) {
  const relPath = path.relative(SCENARIOS_DIR, filePath);
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // ── Schema validation ────────────────────────────────────────────────────
  const schemaResult = ScenarioSchema.safeParse(raw);
  if (!schemaResult.success) {
    console.error(`  ✗  [SCHEMA] ${relPath}`);
    for (const issue of schemaResult.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`       ${fieldPath} — ${issue.message}`);
      totalErrors++;
    }
    continue; // skip lint if schema fails — errors would be noisy
  }

  // ── Content lint ─────────────────────────────────────────────────────────
  const { errors, warnings } = lintScenario(schemaResult.data);

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`  ✓  ${relPath}`);
  } else if (errors.length === 0) {
    console.log(`  ✓  ${relPath}  (${warnings.length} warning(s))`);
  } else {
    console.error(`  ✗  [LINT] ${relPath}`);
  }

  for (const err of errors) {
    console.error(`       ${err}`);
    totalErrors++;
  }
  for (const warn of warnings) {
    console.warn(`       ⚠  ${warn}`);
    totalWarnings++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n  ─────────────────────────────────────────────────────────────\n');

if (totalErrors > 0) {
  console.error(
    `  ✗  ${totalErrors} error(s), ${totalWarnings} warning(s) — fix errors before committing.\n`,
  );
  process.exit(1);
} else if (STRICT_MODE && totalWarnings > 0) {
  console.error(
    `  ✗  ${totalWarnings} warning(s) in --strict mode — address warnings before committing.\n`,
  );
  process.exit(1);
} else {
  const warnSuffix = totalWarnings > 0 ? `  (${totalWarnings} advisory warning(s))` : '';
  console.log(`  ✓  All scenarios passed.${warnSuffix}\n`);
}
