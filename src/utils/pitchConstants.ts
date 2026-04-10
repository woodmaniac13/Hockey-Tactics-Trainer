/**
 * Pitch Coordinate Reference System
 *
 * This module is the canonical source of truth for all pitch spatial semantics.
 * It bridges English tactical descriptions and the 0–100 numeric pitch space.
 *
 * Coordinate conventions:
 *   x: 0  = home GK end (own goal)
 *   x: 100 = opponent goal end (attacking end)
 *   y: 0  = top touchline (right channel from attacking team's perspective)
 *   y: 100 = bottom touchline (left channel from attacking team's perspective)
 *
 * Key landmarks (approximate):
 *   Defensive 23m line:  x ≈ 25
 *   Halfway line:        x = 50
 *   Attacking 23m line:  x ≈ 75
 *   Shooting circle arc: x ≈ 84 (nearest edge), centre at x=100
 *   Circle edge midpoint: x ≈ 84, y = 50
 *
 * Channel conventions (from attacking team's perspective, facing goal):
 *   right channel: y 0–33   (top of diagram, attacker's right)
 *   central channel: y 33–67
 *   left channel: y 67–100  (bottom of diagram, attacker's left)
 *
 * Note: The thirds are based on the 23-metre lines of a regulation pitch (91.4m):
 *   defensive third: x 0–33  (own goal to near the defensive 23m line)
 *   middle third:    x 33–67
 *   attacking third: x 67–100 (near attacking 23m line to opponent goal)
 *
 * Consumed by: scenarioLint.ts (coordinate consistency checks),
 *              scenarioIntent.ts (intent-to-scenario conversion),
 *              scripts/generate-scenario-from-intent.ts,
 *              scripts/scenario-coverage-report.ts,
 *              docs/guides/llm-scenario-generation-guide.md (as reference).
 */

import type { FieldZone, TacticalRegionGeometry } from '../types';

// ── Field zone bounds ─────────────────────────────────────────────────────────

export type ZoneBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

/**
 * Coordinate bounds for every FieldZone enum value.
 *
 * The thirds (x-axis) use crisp boundaries at the 23m lines (~x25 and x75).
 * The channels (y-axis) use generous, slightly overlapping ranges so that
 * scenarios authored near zone edges are not incorrectly flagged.
 *
 * Usage in lint: check whether the ball's (x, y) falls inside the declared
 * field_zone bounds. Mismatches in x (wrong third) are the most telling errors;
 * y (wrong channel) is advisory.
 */
export const FIELD_ZONE_BOUNDS: Record<FieldZone, ZoneBounds> = {
  // ── Defensive third (x 0–35) ──────────────────────────────────────────────
  defensive_third_right:   { xMin: 0,  xMax: 35, yMin: 0,  yMax: 42 },
  defensive_third_central: { xMin: 0,  xMax: 35, yMin: 28, yMax: 72 },
  defensive_third_left:    { xMin: 0,  xMax: 35, yMin: 58, yMax: 100 },

  // ── Middle third (x 30–70) — overlaps at both ends for boundary plays ────
  middle_third_right:   { xMin: 30, xMax: 70, yMin: 0,  yMax: 42 },
  middle_third_central: { xMin: 30, xMax: 70, yMin: 28, yMax: 72 },
  middle_third_left:    { xMin: 30, xMax: 70, yMin: 58, yMax: 100 },

  // ── Attacking third (x 65–100) ────────────────────────────────────────────
  attacking_third_right:   { xMin: 65, xMax: 100, yMin: 0,  yMax: 42 },
  attacking_third_central: { xMin: 65, xMax: 100, yMin: 28, yMax: 72 },
  attacking_third_left:    { xMin: 65, xMax: 100, yMin: 58, yMax: 100 },

  // ── Circle-edge zones (near the shooting D, x 75+) ───────────────────────
  // These nest inside the attacking third and are used for circle-entry scenarios.
  circle_edge_right:   { xMin: 75, xMax: 100, yMin: 0,  yMax: 45 },
  circle_edge_central: { xMin: 75, xMax: 100, yMin: 30, yMax: 70 },
  circle_edge_left:    { xMin: 75, xMax: 100, yMin: 55, yMax: 100 },
};

// ── Canonical position anchors ────────────────────────────────────────────────

/**
 * Approximate centroid coordinates for standard tactical positions.
 *
 * Used by:
 *   - Entity `position_hint` field: LLMs name the position semantically; the
 *     lint layer warns when the actual (x, y) deviates more than 15 units.
 *   - `intentToScenario()`: resolves hints to (x, y) for draft scenario output.
 *
 * Keys follow the pattern: <role>_<location_description>
 * Coordinates are approximate — authors may place entities anywhere nearby.
 *
 * Channel convention: right = y 0–33, central = y 33–67, left = y 67–100.
 */
export const CANONICAL_POSITION_ANCHORS: Record<string, { x: number; y: number }> = {
  // ── Goalkeeper ────────────────────────────────────────────────────────────
  gk_own_goal:         { x: 3,  y: 50 },
  gk_distribution:     { x: 8,  y: 50 },

  // ── Centre-backs ──────────────────────────────────────────────────────────
  cb_defensive_right:  { x: 15, y: 22 },
  cb_defensive_central:{ x: 18, y: 50 },
  cb_defensive_left:   { x: 15, y: 78 },

  // ── Fullbacks ─────────────────────────────────────────────────────────────
  rb_defensive_right:  { x: 20, y: 12 },
  lb_defensive_left:   { x: 20, y: 88 },
  rb_midblock_right:   { x: 35, y: 15 },
  lb_midblock_left:    { x: 35, y: 85 },

  // ── Defensive midfielder ──────────────────────────────────────────────────
  dm_defensive_mid:    { x: 32, y: 50 },
  dm_screen_right:     { x: 30, y: 35 },
  dm_screen_left:      { x: 30, y: 65 },

  // ── Central midfielders ───────────────────────────────────────────────────
  cm_own_half_right:   { x: 38, y: 28 },
  cm_own_half_central: { x: 38, y: 50 },
  cm_own_half_left:    { x: 38, y: 72 },
  cm_midfield_right:   { x: 48, y: 22 },
  cm_midfield_central: { x: 48, y: 50 },
  cm_midfield_left:    { x: 48, y: 78 },
  cm_advanced_right:   { x: 58, y: 28 },
  cm_advanced_central: { x: 58, y: 50 },
  cm_advanced_left:    { x: 58, y: 72 },

  // ── Attacking midfielder ──────────────────────────────────────────────────
  am_attacking_right:  { x: 62, y: 28 },
  am_attacking_central:{ x: 62, y: 50 },
  am_attacking_left:   { x: 62, y: 72 },

  // ── Wingers ───────────────────────────────────────────────────────────────
  rw_right_wing:       { x: 65, y: 10 },
  lw_left_wing:        { x: 65, y: 90 },
  rw_inside_right:     { x: 68, y: 22 },
  lw_inside_left:      { x: 68, y: 78 },

  // ── Forwards / Strikers ───────────────────────────────────────────────────
  fw_attacking_right:  { x: 72, y: 22 },
  fw_attacking_central:{ x: 72, y: 50 },
  fw_attacking_left:   { x: 72, y: 78 },
  cf_circle_edge_right:{ x: 82, y: 32 },
  cf_circle_edge_central:{ x: 82, y: 50 },
  cf_circle_edge_left: { x: 82, y: 68 },
  cf_penalty_spot:     { x: 90, y: 50 },

  // ── Common opponent positions (for opposition entities) ───────────────────
  opp_gk_far_goal:        { x: 97, y: 50 },
  opp_cb_defending_right: { x: 85, y: 28 },
  opp_cb_defending_central:{ x: 85, y: 50 },
  opp_cb_defending_left:  { x: 85, y: 72 },
  opp_cf_pressing_high:   { x: 20, y: 50 },
  opp_fw_pressing_right:  { x: 22, y: 28 },
  opp_fw_pressing_left:   { x: 22, y: 72 },
  opp_mf_midblock_central:{ x: 40, y: 50 },
  opp_mf_midblock_right:  { x: 38, y: 28 },
  opp_mf_midblock_left:   { x: 38, y: 72 },
  opp_wg_wide_right:      { x: 70, y: 12 },
  opp_wg_wide_left:       { x: 70, y: 88 },
};

// ── Named pitch zones (tactical region geometries) ───────────────────────────

/**
 * Pre-defined tactical zone geometries for common positions on the pitch.
 *
 * Used by:
 *   - SemanticRegion `named_zone` field: LLMs reference a zone by name; the
 *     system resolves to geometry automatically.
 *   - `intentToScenario()`: resolves intent region descriptions to geometry.
 *
 * Each entry is a TacticalRegionGeometry ready for use in ideal_regions or
 * acceptable_regions after any reference-frame translation.
 */
export const NAMED_PITCH_ZONES: Record<string, TacticalRegionGeometry> = {
  // ── Goalkeeper areas ──────────────────────────────────────────────────────
  gk_distribution_area:
    { type: 'circle', x: 8, y: 50, r: 10 },

  // ── Defensive build-out pockets ───────────────────────────────────────────
  left_back_escape_pocket:
    { type: 'circle', x: 22, y: 82, r: 9 },
  right_back_escape_pocket:
    { type: 'circle', x: 22, y: 18, r: 9 },
  cb_outlet_right:
    { type: 'circle', x: 20, y: 28, r: 8 },
  cb_outlet_left:
    { type: 'circle', x: 20, y: 72, r: 8 },
  defensive_switch_corridor:
    { type: 'lane', x1: 15, y1: 35, x2: 15, y2: 65, width: 12 },

  // ── Midfield support slots ────────────────────────────────────────────────
  left_midfield_triangle_slot:
    { type: 'circle', x: 42, y: 28, r: 8 },
  right_midfield_triangle_slot:
    { type: 'circle', x: 42, y: 72, r: 8 },
  central_midfield_triangle_slot:
    { type: 'circle', x: 45, y: 50, r: 9 },
  midfield_right_outlet:
    { type: 'rectangle', x: 34, y: 18, width: 14, height: 18 },
  midfield_left_outlet:
    { type: 'rectangle', x: 34, y: 64, width: 14, height: 18 },
  midfield_interior_support:
    { type: 'rectangle', x: 40, y: 38, width: 16, height: 24 },

  // ── Defensive cover shadows ───────────────────────────────────────────────
  central_cover_shadow:
    { type: 'circle', x: 42, y: 50, r: 10 },
  defensive_block_central:
    { type: 'rectangle', x: 15, y: 35, width: 15, height: 30 },
  right_cover_position:
    { type: 'circle', x: 48, y: 32, r: 9 },
  left_cover_position:
    { type: 'circle', x: 48, y: 68, r: 9 },

  // ── Recovery corridors ────────────────────────────────────────────────────
  right_recovery_corridor:
    { type: 'rectangle', x: 30, y: 5, width: 25, height: 22 },
  left_recovery_corridor:
    { type: 'rectangle', x: 30, y: 73, width: 25, height: 22 },
  central_recovery_zone:
    { type: 'circle', x: 35, y: 50, r: 12 },

  // ── Sideline trap positions ───────────────────────────────────────────────
  sideline_trap_right:
    { type: 'rectangle', x: 35, y: 2, width: 22, height: 14 },
  sideline_trap_left:
    { type: 'rectangle', x: 35, y: 84, width: 22, height: 14 },
  pressing_trigger_right:
    { type: 'circle', x: 28, y: 18, r: 8 },
  pressing_trigger_left:
    { type: 'circle', x: 28, y: 82, r: 8 },

  // ── Attacking width strips ────────────────────────────────────────────────
  right_wing_hold_strip:
    { type: 'rectangle', x: 60, y: 3, width: 22, height: 18 },
  left_wing_hold_strip:
    { type: 'rectangle', x: 60, y: 79, width: 22, height: 18 },

  // ── Attacking transition channels ─────────────────────────────────────────
  central_attacking_channel:
    { type: 'rectangle', x: 57, y: 38, width: 18, height: 24 },
  forward_run_right_channel:
    { type: 'circle', x: 68, y: 28, r: 9 },
  forward_run_left_channel:
    { type: 'circle', x: 68, y: 72, r: 9 },
  forward_run_central:
    { type: 'circle', x: 70, y: 50, r: 10 },

  // ── Circle-entry and D zones ──────────────────────────────────────────────
  left_circle_entry_zone:
    { type: 'circle', x: 82, y: 28, r: 10 },
  right_circle_entry_zone:
    { type: 'circle', x: 82, y: 72, r: 10 },
  central_circle_entry_zone:
    { type: 'circle', x: 84, y: 50, r: 10 },
  d_edge_right:
    { type: 'circle', x: 83, y: 30, r: 8 },
  d_edge_central:
    { type: 'circle', x: 86, y: 50, r: 8 },
  d_edge_left:
    { type: 'circle', x: 83, y: 70, r: 8 },
  penalty_spot_corridor:
    { type: 'rectangle', x: 86, y: 42, width: 12, height: 16 },
  far_post_right:
    { type: 'circle', x: 92, y: 40, r: 7 },
  far_post_left:
    { type: 'circle', x: 92, y: 60, r: 7 },
};

// ── Tactical distance bands ───────────────────────────────────────────────────

/**
 * Named approximate distance ranges in pitch units (0–100 scale).
 *
 * Used in the LLM guide to describe typical spacing expectations.
 * Each band reflects a common tactical concept.
 */
export const TACTICAL_DISTANCE_BANDS: Record<string, { min: number; max: number; description: string }> = {
  very_close:        { min: 2,  max: 5,  description: 'Physical contact / immediately adjacent — typical marking distance' },
  pressing_range:    { min: 4,  max: 8,  description: 'Close enough to close down and press the ball carrier' },
  support_range:     { min: 8,  max: 15, description: 'Optimal support distance — reachable pass, escapes press shadow' },
  line_break_range:  { min: 14, max: 22, description: 'Forward run distance — breaks behind a defensive line' },
  switch_range:      { min: 20, max: 35, description: 'Switch-of-play pass — changes the point of attack' },
  long_ball:         { min: 30, max: 55, description: 'Driven long pass — requires high skill, rarely sustainable' },
};

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns true when (x, y) falls within the given zone's coordinate bounds.
 * Uses generous, overlapping bounds so boundary cases are not penalised.
 */
export function isPointInZone(x: number, y: number, zone: FieldZone): boolean {
  const bounds = FIELD_ZONE_BOUNDS[zone];
  return x >= bounds.xMin && x <= bounds.xMax && y >= bounds.yMin && y <= bounds.yMax;
}

/**
 * Returns true when (x, y) is within the x-axis range for the given field zone.
 * Used for the stricter "wrong third" check in linting.
 */
export function isPointInZoneX(x: number, zone: FieldZone): boolean {
  const bounds = FIELD_ZONE_BOUNDS[zone];
  return x >= bounds.xMin && x <= bounds.xMax;
}

/**
 * Returns the Euclidean distance between two points on the 0–100 pitch.
 */
export function pitchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Returns the anchor coordinates for a position_hint key, or undefined if unknown.
 */
export function resolvePositionHint(hint: string): { x: number; y: number } | undefined {
  return CANONICAL_POSITION_ANCHORS[hint];
}
