#!/usr/bin/env node
/**
 * Scenario sweep script.
 *
 * Evaluates a coarse grid (every 5 units, 0–100) for every authored scenario
 * and prints a per-scenario summary including result-type distribution and
 * red-flag diagnostics.
 *
 * Usage:
 *   npx tsx scripts/scenario-sweep.ts
 */

import { evaluate } from '../src/evaluation/evaluator';
import { resolveRegionGeometry } from '../src/utils/regions';
import type { Scenario, WeightProfile, TacticalRegionGeometry } from '../src/types';
import fs from 'fs';
import path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkJsonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getRegionCenter(geo: TacticalRegionGeometry): { x: number; y: number } {
  switch (geo.type) {
    case 'circle': return { x: geo.x, y: geo.y };
    case 'rectangle': return { x: geo.x + geo.width / 2, y: geo.y + geo.height / 2 };
    case 'lane': return { x: (geo.x1 + geo.x2) / 2, y: (geo.y1 + geo.y2) / 2 };
    case 'polygon': {
      const n = geo.vertices.length;
      return {
        x: geo.vertices.reduce((s, v) => s + v.x, 0) / n,
        y: geo.vertices.reduce((s, v) => s + v.y, 0) / n,
      };
    }
  }
}

function getRegionMaxRadius(geo: TacticalRegionGeometry): number {
  switch (geo.type) {
    case 'circle': return geo.r;
    case 'rectangle': return Math.sqrt(geo.width ** 2 + geo.height ** 2) / 2;
    case 'lane': {
      const dx = geo.x2 - geo.x1;
      const dy = geo.y2 - geo.y1;
      return Math.sqrt(dx ** 2 + dy ** 2) / 2 + geo.width / 2;
    }
    case 'polygon': {
      const center = getRegionCenter(geo);
      return Math.max(...geo.vertices.map(v =>
        Math.sqrt((v.x - center.x) ** 2 + (v.y - center.y) ** 2)
      ));
    }
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ── Load scenarios and weight profiles ───────────────────────────────────────

const root = path.resolve(process.cwd());
const scenariosDir = path.join(root, 'public', 'scenarios');
const weightsDir = path.join(root, 'public', 'weights');

if (!fs.existsSync(scenariosDir)) {
  console.error(`ERROR: Scenarios directory not found: ${scenariosDir}`);
  process.exit(1);
}
if (!fs.existsSync(weightsDir)) {
  console.error(`ERROR: Weights directory not found: ${weightsDir}`);
  process.exit(1);
}

// Load all weight profiles keyed by profile_id
const profiles = new Map<string, WeightProfile>();
for (const fp of walkJsonFiles(weightsDir)) {
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    if (data.profile_id && data.weights) {
      profiles.set(data.profile_id, data as WeightProfile);
    }
  } catch (e) {
    console.warn(`  ⚠  Could not parse weight profile: ${fp} — ${e}`);
  }
}

// Load all scenarios
const scenarios: { file: string; scenario: Scenario }[] = [];
for (const fp of walkJsonFiles(scenariosDir)) {
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Scenario;
    scenarios.push({ file: path.relative(root, fp), scenario: data });
  } catch (e) {
    console.warn(`  ⚠  Could not parse scenario: ${fp} — ${e}`);
  }
}

if (scenarios.length === 0) {
  console.error('ERROR: No scenarios found.');
  process.exit(1);
}

// ── Grid sweep ───────────────────────────────────────────────────────────────

const STEP = 5;

type ResultType = 'IDEAL' | 'VALID' | 'ALTERNATE_VALID' | 'PARTIAL' | 'INVALID' | 'ERROR';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              SCENARIO SWEEP REPORT                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

for (const { file, scenario } of scenarios) {
  const profile = profiles.get(scenario.weight_profile);
  if (!profile) {
    console.error(`  ✗  ${scenario.scenario_id} (${file}): weight profile "${scenario.weight_profile}" not found — skipping.\n`);
    continue;
  }

  // Resolve ideal region geometries
  const idealGeos: { geo: TacticalRegionGeometry; center: { x: number; y: number }; maxR: number }[] = [];
  for (const region of scenario.ideal_regions) {
    const geo = resolveRegionGeometry(region, scenario);
    if (geo) {
      idealGeos.push({ geo, center: getRegionCenter(geo), maxR: getRegionMaxRadius(geo) });
    }
  }

  // Resolve all region geometries (ideal + acceptable) for "far from all" check
  const allGeos: { center: { x: number; y: number }; maxR: number }[] = [...idealGeos];
  for (const region of scenario.acceptable_regions ?? []) {
    const geo = resolveRegionGeometry(region, scenario);
    if (geo) {
      allGeos.push({ center: getRegionCenter(geo), maxR: getRegionMaxRadius(geo) });
    }
  }

  const counts: Record<ResultType, number> = { IDEAL: 0, VALID: 0, ALTERNATE_VALID: 0, PARTIAL: 0, INVALID: 0, ERROR: 0 };
  let totalPoints = 0;

  const redFlagInsideIdealInvalid: string[] = [];
  const redFlagFarIdeal: string[] = [];

  for (let x = 0; x <= 100; x += STEP) {
    for (let y = 0; y <= 100; y += STEP) {
      totalPoints++;
      const result = evaluate(scenario, { x, y }, profile);
      const rt = result.result_type as ResultType;
      counts[rt] = (counts[rt] ?? 0) + 1;

      // Red flag: inside an ideal region but evaluates to INVALID
      if (rt === 'INVALID') {
        const insideIdeal = idealGeos.some(ig => {
          const d = distance({ x, y }, ig.center);
          return d <= ig.maxR;
        });
        if (insideIdeal) {
          redFlagInsideIdealInvalid.push(`(${x}, ${y})`);
        }
      }

      // Red flag: far from all regions but evaluates to IDEAL
      if (rt === 'IDEAL') {
        const farFromAll = allGeos.every(rg => {
          const d = distance({ x, y }, rg.center);
          return d > rg.maxR + 10;
        });
        if (farFromAll) {
          redFlagFarIdeal.push(`(${x}, ${y})`);
        }
      }
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────
  console.log(`┌──────────────────────────────────────────────────────────────┐`);
  console.log(`│  ${scenario.scenario_id}: ${scenario.title.padEnd(54)}│`);
  console.log(`│  File: ${file.padEnd(52)}│`);
  console.log(`│  Profile: ${scenario.weight_profile.padEnd(49)}│`);
  console.log(`├──────────────────────────────────────────────────────────────┤`);
  console.log(`│  Total grid points: ${String(totalPoints).padEnd(39)}│`);
  console.log(`│  IDEAL:           ${String(counts.IDEAL).padStart(5).padEnd(41)}│`);
  console.log(`│  VALID:           ${String(counts.VALID).padStart(5).padEnd(41)}│`);
  console.log(`│  ALTERNATE_VALID: ${String(counts.ALTERNATE_VALID).padStart(5).padEnd(41)}│`);
  console.log(`│  PARTIAL:         ${String(counts.PARTIAL).padStart(5).padEnd(41)}│`);
  console.log(`│  INVALID:         ${String(counts.INVALID).padStart(5).padEnd(41)}│`);
  if (counts.ERROR > 0) {
    console.log(`│  ERROR:           ${String(counts.ERROR).padStart(5).padEnd(41)}│`);
  }

  if (redFlagInsideIdealInvalid.length > 0) {
    console.log(`├──────────────────────────────────────────────────────────────┤`);
    console.log(`│  🚩 Points inside ideal regions that evaluate to INVALID:   │`);
    for (const pt of redFlagInsideIdealInvalid) {
      console.log(`│     ${pt.padEnd(55)}│`);
    }
  }
  if (redFlagFarIdeal.length > 0) {
    console.log(`├──────────────────────────────────────────────────────────────┤`);
    console.log(`│  🚩 Points far from all regions that evaluate to IDEAL:     │`);
    for (const pt of redFlagFarIdeal) {
      console.log(`│     ${pt.padEnd(55)}│`);
    }
  }

  console.log(`└──────────────────────────────────────────────────────────────┘\n`);
}

console.log('Done.');
