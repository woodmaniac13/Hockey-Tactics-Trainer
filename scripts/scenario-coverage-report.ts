#!/usr/bin/env node
/**
 * scenario-coverage-report.ts
 *
 * Reads all authored scenario files and produces a coverage matrix showing:
 *   - Which archetypes have scenarios (and how many)
 *   - Which situations are covered
 *   - Which field_zones are represented
 *   - Which line_groups are covered
 *   - Which primary_concept × situation combinations exist
 *
 * This report gives the LLM generation process a clear brief of what is
 * missing: "generate 2 scenarios for forward_press_angle with situation:
 * high_press — none currently exist."
 *
 * Usage:
 *   npx tsx scripts/scenario-coverage-report.ts
 *   npx tsx scripts/scenario-coverage-report.ts --out coverage.md
 *
 * Options:
 *   --out <file>   Write the report to a markdown file instead of stdout
 */

import fs from 'fs';
import path from 'path';
import { ScenarioSchema } from '../src/scenarios/scenarioSchema';
import type { Scenario } from '../src/types';
import type {
  ScenarioArchetype,
  SituationVocab,
  FieldZone,
  LineGroup,
  PrimaryConceptVocab,
} from '../src/types';

// ── Config ────────────────────────────────────────────────────────────────────

const SCENARIOS_DIR = path.resolve(process.cwd(), 'public/scenarios');

const ALL_ARCHETYPES: ScenarioArchetype[] = [
  'back_outlet_support',
  'fullback_escape_option',
  'midfield_triangle_restore',
  'interior_support_under_press',
  'forward_width_hold',
  'forward_press_angle',
  'help_side_cover',
  'central_recovery_cover',
  'sideline_trap_support',
  'weak_side_balance',
];

const ALL_SITUATIONS: SituationVocab[] = [
  'build_out_under_press',
  'settled_attack',
  'defensive_shape',
  'high_press',
  'recovery_defence',
  'counter_attack',
  'sideline_trap',
  'free_hit_shape',
  'circle_entry_support',
];

const ALL_FIELD_ZONES: FieldZone[] = [
  'defensive_third_left', 'defensive_third_central', 'defensive_third_right',
  'middle_third_left', 'middle_third_central', 'middle_third_right',
  'attacking_third_left', 'attacking_third_central', 'attacking_third_right',
  'circle_edge_left', 'circle_edge_central', 'circle_edge_right',
];

const ALL_LINE_GROUPS: LineGroup[] = ['back', 'midfield', 'forward'];

const ALL_PRIMARY_CONCEPTS: PrimaryConceptVocab[] = [
  'support', 'cover', 'transfer', 'spacing',
  'pressure_response', 'width_depth', 'recovery_shape', 'pressing_angle',
];

// ── File discovery ────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.json')) results.push(fullPath);
  }
  return results;
}

const files = walkDir(SCENARIOS_DIR);
const scenarios: Scenario[] = [];

for (const filePath of files) {
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = ScenarioSchema.safeParse(raw);
  if (result.success) scenarios.push(result.data);
}

// ── Build coverage maps ───────────────────────────────────────────────────────

function countBy<T extends string>(
  values: T[],
  key: (s: Scenario) => T | undefined,
): Map<T, number> {
  const map = new Map<T, number>(values.map(v => [v, 0]));
  for (const s of scenarios) {
    const v = key(s);
    if (v && map.has(v)) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

const archetypeCounts = countBy(ALL_ARCHETYPES, s => s.scenario_archetype);
const situationCounts = countBy(ALL_SITUATIONS, s => s.situation);
const fieldZoneCounts = countBy(ALL_FIELD_ZONES, s => s.field_zone);
const lineGroupCounts = countBy(ALL_LINE_GROUPS, s => s.line_group);

// concept × situation matrix
const conceptSituationMatrix = new Map<string, number>();
for (const concept of ALL_PRIMARY_CONCEPTS) {
  for (const situation of ALL_SITUATIONS) {
    conceptSituationMatrix.set(`${concept}×${situation}`, 0);
  }
}
for (const s of scenarios) {
  if (s.primary_concept && s.situation) {
    const key = `${s.primary_concept}×${s.situation}`;
    conceptSituationMatrix.set(key, (conceptSituationMatrix.get(key) ?? 0) + 1);
  }
}

// ── Format markdown report ────────────────────────────────────────────────────

function cell(n: number): string {
  return n === 0 ? '—' : String(n);
}

function tableRow(cols: string[]): string {
  return `| ${cols.join(' | ')} |`;
}

const lines: string[] = [];

lines.push(`# Scenario Coverage Report`);
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Total scenarios: **${scenarios.length}**`);
lines.push('');

// ── Archetype coverage ────────────────────────────────────────────────────────
lines.push('## Archetype Coverage');
lines.push('');
lines.push(tableRow(['Archetype', 'Count', 'Status']));
lines.push(tableRow(['---', '---', '---']));
for (const [archetype, count] of archetypeCounts) {
  const status = count === 0 ? '⚠ **MISSING**' : count === 1 ? '✓ Covered' : `✓ ${count}x`;
  lines.push(tableRow([archetype, cell(count), status]));
}
lines.push('');

// ── Situation coverage ────────────────────────────────────────────────────────
lines.push('## Situation Coverage');
lines.push('');
lines.push(tableRow(['Situation', 'Count', 'Status']));
lines.push(tableRow(['---', '---', '---']));
for (const [situation, count] of situationCounts) {
  const status = count === 0 ? '⚠ **MISSING**' : count === 1 ? '✓ Covered' : `✓ ${count}x`;
  lines.push(tableRow([situation, cell(count), status]));
}
lines.push('');

// ── Field zone coverage ───────────────────────────────────────────────────────
lines.push('## Field Zone Coverage');
lines.push('');
lines.push(tableRow(['Field Zone', 'Count', 'Status']));
lines.push(tableRow(['---', '---', '---']));
for (const [zone, count] of fieldZoneCounts) {
  const status = count === 0 ? '—' : `✓ ${count}`;
  lines.push(tableRow([zone, cell(count), status]));
}
lines.push('');

// ── Line group coverage ───────────────────────────────────────────────────────
lines.push('## Line Group Coverage');
lines.push('');
lines.push(tableRow(['Line Group', 'Count', 'Status']));
lines.push(tableRow(['---', '---', '---']));
for (const [group, count] of lineGroupCounts) {
  const status = count === 0 ? '⚠ **MISSING**' : `✓ ${count}`;
  lines.push(tableRow([group, cell(count), status]));
}
lines.push('');

// ── Primary concept × situation matrix ───────────────────────────────────────
lines.push('## Primary Concept × Situation Matrix');
lines.push('');
lines.push(`(Numbers show scenario count; — means none exist yet — priority generation targets)`);
lines.push('');

const headerCols = ['Concept \\ Situation', ...ALL_SITUATIONS.map(s => s.replace(/_/g, '·'))];
lines.push(tableRow(headerCols));
lines.push(tableRow(headerCols.map(() => '---')));

for (const concept of ALL_PRIMARY_CONCEPTS) {
  const row = [concept];
  for (const situation of ALL_SITUATIONS) {
    const count = conceptSituationMatrix.get(`${concept}×${situation}`) ?? 0;
    row.push(cell(count));
  }
  lines.push(tableRow(row));
}
lines.push('');

// ── Generation priorities ─────────────────────────────────────────────────────
lines.push('## Suggested Generation Priorities');
lines.push('');
lines.push('The following archetype × situation combinations have 0 scenarios:');
lines.push('');

const missing: string[] = [];
for (const s of scenarios) {
  if (s.scenario_archetype && s.situation) {
    missing.push(`${s.scenario_archetype}×${s.situation}`);
  }
}
const missingSet = new Set(missing);
const gaps: string[] = [];
for (const archetype of ALL_ARCHETYPES) {
  for (const situation of ALL_SITUATIONS) {
    if (!missingSet.has(`${archetype}×${situation}`)) {
      gaps.push(`- **${archetype}** + \`${situation}\``);
    }
  }
}

if (gaps.length === 0) {
  lines.push('All archetype × situation combinations have at least one scenario. 🎉');
} else {
  // Show only first 20 to keep report readable
  const shown = gaps.slice(0, 20);
  lines.push(...shown);
  if (gaps.length > 20) {
    lines.push(`- *(and ${gaps.length - 20} more — run the full report to see all)*`);
  }
}
lines.push('');

// ── Output ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx !== -1 ? args[outIdx + 1] : undefined;

const report = lines.join('\n');

if (outFile) {
  fs.writeFileSync(outFile, report, 'utf-8');
  console.log(`\n  ✓  Coverage report written to: ${outFile}\n`);
} else {
  console.log(report);
}
