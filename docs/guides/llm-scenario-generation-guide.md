# LLM Scenario Generation Guide

> **How to use this document**: Include this file verbatim (or the relevant
> sections) as system context when prompting an LLM to generate new
> Hockey Tactics Trainer scenarios. The guide contains everything an LLM needs
> to produce valid, tactically coherent scenario JSON that passes schema
> validation and content lint.

---

## 1. Pitch Coordinate System

The pitch runs on a **0–100 × 0–100** coordinate space.

```
y=0  (top touchline — attacker's RIGHT side)
┌─────────────────────────────────────────────────────────┐
│  Own goal   │   Defensive   │   Middle   │  Attacking   │
│  x=0..5     │   third        │   third    │  third       │
│             │   x=0..35      │  x=30..70  │  x=65..100   │
│  GK pos     │                │            │              │
│  x≈3,y=50   │                │            │  Circle arc  │
│             │                │            │  x≈84,y=50   │
└─────────────────────────────────────────────────────────┘
y=100 (bottom touchline — attacker's LEFT side)
   x=0 (home GK)    x=50 (halfway)    x=100 (opponent goal)
```

### Key landmarks

| Location | x | y |
|---|---|---|
| Home goalkeeper (in goal) | ≈ 3 | 50 |
| Defensive 23m line | ≈ 25 | — |
| Halfway line | 50 | — |
| Attacking 23m line | ≈ 75 | — |
| Shooting circle (D) edge — widest point | ≈ 84 | 50 |
| Penalty spot | ≈ 90 | 50 |
| Opponent goal | 100 | 50 |

### Channel conventions

From the attacking team's perspective (home attacks positive x):

| Channel | y range | Description |
|---|---|---|
| **right** | y 0–33 | Attacker's right; top of the diagram |
| **central** | y 33–67 | Central corridor |
| **left** | y 67–100 | Attacker's left; bottom of the diagram |

### Field zone x-axis bounds (strict thirds)

| Third | x range |
|---|---|
| defensive_third | 0–35 |
| middle_third | 30–70 (overlap at edges) |
| attacking_third | 65–100 |
| circle_edge_* | 75–100 |

> ⚠ **Common LLM mistake**: Placing the ball at x=75 but declaring
> `field_zone: "defensive_third_central"`. The lint will catch this as an
> **error**. Always ensure the ball's x value falls within the declared zone's
> x range.

---

## 2. Entity Placement Reference (`position_hint`)

Every entity should carry a `position_hint` string naming its standard
tactical position. The hint is looked up from `CANONICAL_POSITION_ANCHORS`
in `src/utils/pitchConstants.ts` for coordinate defaults.

The lint warns if actual (x, y) deviates > 15 units from the hint's anchor.

### Goalkeeper

| position_hint | x | y | Role |
|---|---|---|---|
| `gk_own_goal` | 3 | 50 | GK standing in goal |
| `gk_distribution` | 8 | 50 | GK advancing to distribute |
| `opp_gk_far_goal` | 97 | 50 | Opponent GK |

### Defenders / Centre-backs

| position_hint | x | y | Role |
|---|---|---|---|
| `cb_defensive_right` | 15 | 22 | CB, right channel |
| `cb_defensive_central` | 18 | 50 | CB, central |
| `cb_defensive_left` | 15 | 78 | CB, left channel |
| `rb_defensive_right` | 20 | 12 | Right back (wide) |
| `lb_defensive_left` | 20 | 88 | Left back (wide) |
| `rb_midblock_right` | 35 | 15 | Right back pushed up |
| `lb_midblock_left` | 35 | 85 | Left back pushed up |
| `opp_cb_defending_right` | 85 | 28 | Opp CB covering right |
| `opp_cb_defending_central` | 85 | 50 | Opp CB central |
| `opp_cb_defending_left` | 85 | 72 | Opp CB covering left |

### Defensive / Central Midfielders

| position_hint | x | y | Role |
|---|---|---|---|
| `dm_defensive_mid` | 32 | 50 | DM screening the back line |
| `dm_screen_right` | 30 | 35 | DM shaded right |
| `dm_screen_left` | 30 | 65 | DM shaded left |
| `cm_own_half_right` | 38 | 28 | CM in own half, right |
| `cm_own_half_central` | 38 | 50 | CM in own half, central |
| `cm_own_half_left` | 38 | 72 | CM in own half, left |
| `cm_midfield_right` | 48 | 22 | CM at midfield, right |
| `cm_midfield_central` | 48 | 50 | CM at midfield, central |
| `cm_midfield_left` | 48 | 78 | CM at midfield, left |
| `cm_advanced_right` | 58 | 28 | CM pushed forward, right |
| `cm_advanced_central` | 58 | 50 | CM pushed forward, central |
| `cm_advanced_left` | 58 | 72 | CM pushed forward, left |
| `opp_mf_midblock_central` | 40 | 50 | Opp MF in midblock |
| `opp_mf_midblock_right` | 38 | 28 | Opp MF, right |
| `opp_mf_midblock_left` | 38 | 72 | Opp MF, left |

### Attacking Midfielders / Wingers

| position_hint | x | y | Role |
|---|---|---|---|
| `am_attacking_right` | 62 | 28 | AM in attacking half, right |
| `am_attacking_central` | 62 | 50 | AM central |
| `am_attacking_left` | 62 | 72 | AM, left |
| `rw_right_wing` | 65 | 10 | Right winger, wide |
| `lw_left_wing` | 65 | 90 | Left winger, wide |
| `rw_inside_right` | 68 | 22 | Right winger cutting inside |
| `lw_inside_left` | 68 | 78 | Left winger cutting inside |
| `opp_wg_wide_right` | 70 | 12 | Opp winger, right |
| `opp_wg_wide_left` | 70 | 88 | Opp winger, left |

### Forwards / Strikers

| position_hint | x | y | Role |
|---|---|---|---|
| `fw_attacking_right` | 72 | 22 | Forward, right channel |
| `fw_attacking_central` | 72 | 50 | Forward, central |
| `fw_attacking_left` | 72 | 78 | Forward, left channel |
| `cf_circle_edge_right` | 82 | 32 | CF near circle, right |
| `cf_circle_edge_central` | 82 | 50 | CF at circle edge |
| `cf_circle_edge_left` | 82 | 68 | CF near circle, left |
| `cf_penalty_spot` | 90 | 50 | CF on penalty spot |
| `opp_cf_pressing_high` | 20 | 50 | Opp CF pressing high |
| `opp_fw_pressing_right` | 22 | 28 | Opp FW pressing, right |
| `opp_fw_pressing_left` | 22 | 72 | Opp FW pressing, left |

---

## 3. Controlled Vocabularies

### `line_group`

| Value | Meaning |
|---|---|
| `back` | Scenario targets a back-line player (CB, FB) |
| `midfield` | Scenario targets a midfielder (DM, CM, AM) |
| `forward` | Scenario targets a forward / winger |

### `primary_concept`

| Value | Tactical meaning |
|---|---|
| `support` | Providing a passing option to the ball carrier |
| `cover` | Positioning to protect a space or mark a runner |
| `transfer` | Switching play or moving the ball across the pitch |
| `spacing` | Creating or maintaining width/depth in team shape |
| `pressure_response` | Reacting correctly to an opponent press |
| `width_depth` | Holding width or depth to stretch the opposition |
| `recovery_shape` | Tracking back to restore defensive structure |
| `pressing_angle` | Positioning to close down and force the ball |

### `situation`

| Value | Tactical meaning |
|---|---|
| `build_out_under_press` | Home team playing out from the back against a press |
| `settled_attack` | Home team in possession in the opposition half |
| `defensive_shape` | Home team defending in a set structure |
| `high_press` | Home team applying a high press in the opponent's half |
| `recovery_defence` | Home team recovering shape after losing the ball |
| `counter_attack` | Home team transitioning quickly after winning the ball |
| `sideline_trap` | Trap set near the touchline to win the ball |
| `free_hit_shape` | Set-play situation — free hit |
| `circle_entry_support` | Attacking support play around the shooting circle |

### `field_zone`

`defensive_third_{right,central,left}` — x 0–35  
`middle_third_{right,central,left}` — x 30–70  
`attacking_third_{right,central,left}` — x 65–100  
`circle_edge_{right,central,left}` — x 75–100 (near the D)

**right** = y 0–33 (attacker's right), **central** = y 28–72, **left** = y 67–100

### `game_state`

| Value | Meaning |
|---|---|
| `open_play` | Regular run-of-play |
| `restart` | After a foul, hit-out, etc. |
| `turnover` | Immediately after winning the ball |
| `counter` | Counter-attack in progress |
| `set_press` | Organised high-press structure |

### `scenario_archetype`

| Archetype | Summary |
|---|---|
| `back_outlet_support` | CM/MF providing outlet to pressed CB — defensive/middle third |
| `fullback_escape_option` | Fullback creating an escape route under direct press |
| `midfield_triangle_restore` | Midfielder reconnecting the passing triangle |
| `interior_support_under_press` | Interior player supporting the ball under pressure |
| `forward_width_hold` | Forward holding width in attacking phase |
| `forward_press_angle` | Forward angling to press opponent in possession |
| `help_side_cover` | Help-side defender covering a central channel |
| `central_recovery_cover` | Central player recovering to form a cover shape |
| `sideline_trap_support` | Support player in a structured sideline trap |
| `weak_side_balance` | Weak-side player maintaining team shape balance |

### `SemanticRegionPurpose`

| Value | Meaning |
|---|---|
| `primary_support_option` | Best position for the ball carrier to pass to |
| `secondary_support_option` | Second-best option |
| `passing_lane_support` | A lane that enables a specific pass |
| `pressure_relief` | Position that relieves immediate press |
| `switch_option` | Position to switch the point of attack |
| `width_hold` | Position maintaining width on the flank |
| `depth_hold` | Position maintaining depth behind the ball |
| `defensive_cover` | Covering a dangerous space or player |
| `central_protection` | Screening the central channel |
| `recovery_run` | Track back to defensive position |
| `press_trigger` | Point from which pressing action is triggered |
| `screening_position` | Between ball and dangerous opponent |
| `custom` | Use when none of the above apply; add a `notes` field |

### `ReferenceFrame`

| Value | Meaning |
|---|---|
| `pitch` | Absolute pitch coordinates (default) |
| `ball` | Offset relative to the ball position |
| `target_player` | Offset relative to the target player |
| `entity` | Offset relative to a named entity (requires `reference_entity_id`) |

### `PressureDirection`

| Value | Meaning |
|---|---|
| `inside_out` | Pressure from inside, forcing player wide |
| `outside_in` | Pressure from outside, forcing player inside |
| `central` | Pressure from directly ahead |
| `none` | No active pressure on the ball carrier |

### `PressureIntensity`: `low` / `medium` / `high`

### `PressureForcedSide`

`inside` / `outside` / `sideline` / `baseline` / `none`

### `correct_reasoning`

| Value | Player prompt |
|---|---|
| `create_passing_angle` | "Create a passing angle" |
| `provide_cover` | "Provide cover" |
| `enable_switch` | "Enable a switch" |
| `support_under_pressure` | "Support under pressure" |

---

## 4. Region Authoring Strategies

Regions define where the target player should position for ideal or acceptable
scores. Three methods are available, ranked by LLM-friendliness:

### Method 1 — Best: Use `named_zone` (no coordinates required)

```json
{
  "label": "left_back_escape_pocket",
  "purpose": "pressure_relief",
  "named_zone": "left_back_escape_pocket"
}
```

The system automatically resolves geometry from `NAMED_PITCH_ZONES`. No x/y
values needed. Use this whenever a named zone matches your intent.

**Available named zones** (full list in `src/utils/pitchConstants.ts`):

Goalkeeper: `gk_distribution_area`  
Defensive build-out: `left_back_escape_pocket`, `right_back_escape_pocket`, `cb_outlet_right`, `cb_outlet_left`, `defensive_switch_corridor`  
Midfield: `left_midfield_triangle_slot`, `right_midfield_triangle_slot`, `central_midfield_triangle_slot`, `midfield_right_outlet`, `midfield_left_outlet`, `midfield_interior_support`  
Defensive cover: `central_cover_shadow`, `defensive_block_central`, `right_cover_position`, `left_cover_position`  
Recovery: `right_recovery_corridor`, `left_recovery_corridor`, `central_recovery_zone`  
Sideline trap: `sideline_trap_right`, `sideline_trap_left`, `pressing_trigger_right`, `pressing_trigger_left`  
Attacking width: `right_wing_hold_strip`, `left_wing_hold_strip`  
Attacking channels: `central_attacking_channel`, `forward_run_right_channel`, `forward_run_left_channel`, `forward_run_central`  
Circle / D: `left_circle_entry_zone`, `right_circle_entry_zone`, `central_circle_entry_zone`, `d_edge_right`, `d_edge_central`, `d_edge_left`, `penalty_spot_corridor`, `far_post_right`, `far_post_left`

### Method 2 — Good: Use `reference_frame: "ball"` or `"target_player"` with a small offset

For regions whose position is naturally described relative to the ball:

```json
{
  "label": "outlet_lane_beside_ball",
  "purpose": "primary_support_option",
  "reference_frame": "ball",
  "geometry": { "type": "circle", "x": 10, "y": 5, "r": 8 }
}
```

The geometry coordinates are **offsets** from the ball. `x: 10` means 10 units
ahead (more attacking); `y: 5` means 5 units toward the right; negative y
moves toward the left.

**Typical support offsets by concept**:

| Concept | Typical offset from ball |
|---|---|
| Outlet support | x: 8–15, y: ±8 (beside and ahead) |
| Pressure relief | x: -5 to 8, y: ±10 (diagonal behind/beside) |
| Width hold | x: 0 to 10, y: ±20 to ±35 (wide) |
| Cover shadow | x: -10 to -20, y: ±5 (behind the ball) |
| Recovery run | x: -15 to -30, y: ±5 to ±15 |

### Method 3 — Acceptable: Use `reference_frame: "pitch"` with zone-derived coordinates

When you know the approximate pitch location from the field zone bounds:

```json
{
  "label": "strong_side_channel",
  "purpose": "primary_support_option",
  "reference_frame": "pitch",
  "geometry": { "type": "rectangle", "x": 28, "y": 22, "width": 14, "height": 14 }
}
```

Derive x from the zone x bounds; derive y from the channel (right: 10–28,
central: 33–67, left: 72–90).

---

## 5. Archetype Templates (Skeleton JSONs with Annotations)

### `back_outlet_support`

```json
{
  "scenario_id": "S_NEW",
  "version": 1,
  "title": "CM Outlet for Pressed CB",
  "description": "The centre-back has the ball under a high press. You are the central midfielder — provide a strong-side outlet lane.",
  "phase": "attack",
  "team_orientation": "home_attacks_positive_x",
  "line_group": "midfield",
  "primary_concept": "pressure_response",
  "situation": "build_out_under_press",
  "field_zone": "defensive_third_right",
  "game_state": "set_press",
  "scenario_archetype": "back_outlet_support",
  "difficulty": 2,
  "target_player": "cm_right",
  "ball": { "x": 18, "y": 28 },
  "teammates": [
    { "id": "gk",       "role": "GK", "team": "home", "x": 3,  "y": 50, "position_hint": "gk_own_goal" },
    { "id": "cb_right", "role": "CB", "team": "home", "x": 18, "y": 28, "position_hint": "cb_defensive_right" },
    { "id": "cm_right", "role": "CM", "team": "home", "x": 38, "y": 28, "position_hint": "cm_own_half_right" }
  ],
  "opponents": [
    { "id": "opp_press", "role": "FW", "team": "away", "x": 22, "y": 26, "position_hint": "opp_fw_pressing_right" }
  ],
  "pressure": { "direction": "outside_in", "intensity": "high", "forced_side": "inside" },
  "ideal_regions": [
    { "label": "outlet_lane", "purpose": "primary_support_option", "named_zone": "midfield_right_outlet" }
  ],
  "acceptable_regions": [
    { "label": "wider_support", "purpose": "secondary_support_option", "named_zone": "left_midfield_triangle_slot" }
  ],
  "weight_profile": "build_out_v1",
  "constraint_thresholds": { "support": 0.4, "pressure_relief": 0.4 },
  "tags": ["build_out", "pressure_relief", "outlet"],
  "teaching_point": "Position in the lane beside the pressing opponent — not behind them — so the CB can play forward quickly.",
  "target_role_family": "midfield",
  "feedback_hints": {
    "success": "You created a clear outlet for the CB.",
    "common_error": "You stayed in line with the press, blocking the outlet pass.",
    "teaching_emphasis": "Step diagonally away from the press — open your body to receive on the half-turn."
  },
  "correct_reasoning": ["create_passing_angle", "support_under_pressure"]
}
```

### `forward_width_hold`

```json
{
  "scenario_id": "S_NEW",
  "version": 1,
  "title": "Forward Width in Attacking Phase",
  "description": "The ball is in the central attacking channel. You are a forward — hold width on the right to stretch the defence and create a second option.",
  "phase": "attack",
  "team_orientation": "home_attacks_positive_x",
  "line_group": "forward",
  "primary_concept": "width_depth",
  "situation": "settled_attack",
  "field_zone": "attacking_third_central",
  "game_state": "open_play",
  "scenario_archetype": "forward_width_hold",
  "difficulty": 2,
  "target_player": "fw_right",
  "ball": { "x": 72, "y": 50 },
  "teammates": [
    { "id": "am",       "role": "AM", "team": "home", "x": 72, "y": 50, "position_hint": "am_attacking_central" },
    { "id": "fw_right", "role": "FW", "team": "home", "x": 72, "y": 22, "position_hint": "fw_attacking_right" }
  ],
  "opponents": [
    { "id": "opp_cb1", "role": "CB", "team": "away", "x": 82, "y": 40, "position_hint": "opp_cb_defending_central" },
    { "id": "opp_cb2", "role": "CB", "team": "away", "x": 82, "y": 60, "position_hint": "opp_cb_defending_left" }
  ],
  "pressure": { "direction": "central", "intensity": "medium" },
  "ideal_regions": [
    { "label": "right_wing_width", "purpose": "width_hold", "named_zone": "right_wing_hold_strip" }
  ],
  "acceptable_regions": [
    { "label": "inside_run", "purpose": "primary_support_option", "named_zone": "forward_run_right_channel" }
  ],
  "weight_profile": "attack_v1",
  "constraint_thresholds": { "width_depth": 0.4 },
  "tags": ["attack", "width_depth", "support"],
  "teaching_point": "Hold the wide right position to keep the defence stretched. Move to the circle only when the ball arrives wide.",
  "target_role_family": "forward",
  "feedback_hints": {
    "success": "You maintained width and gave the AM a wide option.",
    "common_error": "You drifted inward and congested the central channel.",
    "teaching_emphasis": "Width creates space. Stay wide until you decide to make a run into the circle."
  },
  "correct_reasoning": ["create_passing_angle", "enable_switch"]
}
```

### `help_side_cover`

```json
{
  "scenario_id": "S_NEW",
  "version": 1,
  "title": "Help-Side Cover in Defensive Shape",
  "description": "The ball is on the right channel. You are the help-side midfielder — drop into a covering position to protect the central channel.",
  "phase": "defence",
  "team_orientation": "home_attacks_positive_x",
  "line_group": "midfield",
  "primary_concept": "cover",
  "situation": "defensive_shape",
  "field_zone": "middle_third_right",
  "game_state": "open_play",
  "scenario_archetype": "help_side_cover",
  "difficulty": 2,
  "target_player": "cm_help",
  "ball": { "x": 55, "y": 18 },
  "teammates": [
    { "id": "cb_c",    "role": "CB", "team": "home", "x": 30, "y": 50, "position_hint": "cb_defensive_central" },
    { "id": "cm_help", "role": "CM", "team": "home", "x": 45, "y": 50, "position_hint": "cm_midfield_central" }
  ],
  "opponents": [
    { "id": "opp_w",   "role": "FW", "team": "away", "x": 55, "y": 18, "position_hint": "fw_attacking_right" },
    { "id": "opp_cf",  "role": "CF", "team": "away", "x": 62, "y": 48, "position_hint": "fw_attacking_central" }
  ],
  "pressure": { "direction": "none", "intensity": "medium" },
  "ideal_regions": [
    { "label": "central_cover_shadow", "purpose": "defensive_cover", "named_zone": "central_cover_shadow" }
  ],
  "acceptable_regions": [
    { "label": "right_cover", "purpose": "defensive_cover", "named_zone": "right_cover_position" }
  ],
  "weight_profile": "defence_v1",
  "constraint_thresholds": { "cover": 0.4 },
  "tags": ["cover", "defence", "spacing"],
  "teaching_point": "When the ball is wide, move to the central cover position to protect the space the central forward wants to run into.",
  "target_role_family": "midfield",
  "feedback_hints": {
    "success": "You protected the central channel and made the forward's run less effective.",
    "common_error": "You followed the ball wide and left the central channel open.",
    "teaching_emphasis": "Stay central when the ball is wide — cover the most dangerous space, not the ball."
  },
  "correct_reasoning": ["provide_cover"]
}
```

---

## 6. Step-by-Step Generation Workflow

Follow these steps to generate a valid scenario from scratch.

### Step 1 — Choose archetype and validate constraints

Pick a `scenario_archetype` and check `ARCHETYPE_CONSTRAINTS` for:
- `allowed_phases` — the scenario phase must be in this list.
- `allowed_line_groups` — the `line_group` must match.
- `allowed_primary_concepts` — the `primary_concept` must match.
- `allowed_field_zones` — the `field_zone` should be in this list (warning if not).

### Step 2 — Choose situation, field_zone, game_state

Ensure they are semantically consistent:
- `build_out_under_press` → `field_zone` should be defensive or middle third.
- `circle_entry_support` → `field_zone` should be `circle_edge_*` or `attacking_third_*`.
- `high_press` → pressure `intensity: "high"`, `direction` not `"none"`.

### Step 3 — Place entities using `position_hint`

1. Choose a `position_hint` for each entity from Section 2.
2. Copy the `x`, `y` anchor values from the table.
3. Adjust slightly if needed (keep within 15 units of the anchor to avoid lint warnings).
4. Mark the target player with the `id` matching `target_player`.
5. Ensure at least one opponent is within 40 units of the ball (or set `pressure.direction: "none"`).

### Step 4 — Specify regions

**Preferred**: use `named_zone` for any region that matches a well-known zone.  
**Good alternative**: use `reference_frame: "ball"` with a small offset geometry.  
**Fallback**: use absolute pitch coordinates derived from zone bounds.

- `ideal_regions`: 1–2 regions where the player should ideally be.
- `acceptable_regions`: 1–2 regions for partial credit.

### Step 5 — Write `feedback_hints` and `teaching_point`

- `teaching_point`: one sentence that captures the core coaching message.
- `feedback_hints.success`: what the player did well.
- `feedback_hints.common_error`: the most common mistake to avoid.
- `feedback_hints.teaching_emphasis`: the key principle to reinforce.

### Step 6 — Assign `correct_reasoning`

Pick from `["create_passing_angle", "provide_cover", "enable_switch", "support_under_pressure"]`.  
Choose the options that best match what a good player should be thinking in this scenario.

### Step 7 — Validate

Run the lint tool and fix all errors and warnings:
```bash
npx tsx scripts/lint-scenarios.ts
```

---

## 7. Common LLM Mistakes Catalogue

Avoid these patterns — the content lint will catch them.

| Mistake | Why it's wrong | Fix |
|---|---|---|
| Goalkeeper at x=50 | GK should be near their own goal | Use `position_hint: "gk_own_goal"` → x≈3 |
| `field_zone: "defensive_third_central"` with ball at x=75 | x=75 is in the attacking third | Set `field_zone: "attacking_third_central"` |
| `pressure.direction: "none"` with intensity `"high"` | Contradictory — no direction but high press? | Set a direction: `"outside_in"` or `"central"` |
| `scenario_archetype: "forward_width_hold"` with `line_group: "back"` | Archetype requires a forward | Change `line_group` to `"forward"` |
| All regions using `reference_frame: "pitch"` in a `build_out_under_press` | Ball-relative frames are more robust | Use `reference_frame: "ball"` for outlet positions |
| Using raw geometry `{ "type": "circle", ... }` directly in regions | Authored regions require a semantic wrapper | Wrap in `{ "label": "...", "purpose": "...", "geometry": { ... } }` |
| `reference_entity_id` set but `reference_frame: "pitch"` | Entity frame requires `reference_frame: "entity"` | Set `"reference_frame": "entity"` |
| No opponent within 40 units of ball but `pressure.direction` non-`"none"` | Pressure description inconsistent with positions | Move a pressing opponent within 30 units of the ball |
| All teammates within 15 units of each other | Unrealistic bunching | Spread players across the pitch using appropriate position hints |
| `named_zone` key not in `NAMED_PITCH_ZONES` | Typo or unsupported zone | Check the full list in Section 4 or `src/utils/pitchConstants.ts` |
| Missing `feedback_hints.success` or `feedback_hints.common_error` | Required fields | Add both — they drive in-game feedback |

---

## 8. Example Prompt Template

Use this as a system prompt when generating scenarios:

```
You are a field hockey tactics expert generating training scenarios for the
Hockey Tactics Trainer app. Generate a valid scenario JSON for the archetype
"[ARCHETYPE]" with situation "[SITUATION]".

== SYSTEM CONSTRAINTS ==

1. The pitch is a 0–100 × 0–100 space:
   - x=0: home GK end, x=100: opponent goal
   - y=0: top/right touchline, y=100: bottom/left touchline
   - Defensive third: x 0–35 | Middle third: x 30–70 | Attacking third: x 65–100
   - Circle arc centre: x≈84, y=50

2. Use position_hint keys for all entity positions:
   [paste the position_hint table from Section 2]

3. Use named_zone keys for all regions:
   [paste the named zone list from Section 4]

4. The field_zone MUST match the ball's x position:
   - Defensive third: ball x 0–35
   - Middle third: ball x 30–70
   - Attacking third: ball x 65–100

5. Vocabulary rules:
   - scenario_archetype: [ARCHETYPE]
   - situation: [SITUATION]
   - line_group must match archetype constraints
   - All regions must use semantic wrapper format

6. Chain-of-thought steps:
   Step 1: Choose phase, line_group, primary_concept consistent with archetype.
   Step 2: Choose field_zone and game_state consistent with situation.
   Step 3: Place ball using zone x bounds. Place entities using position_hint table.
   Step 4: Define 1–2 ideal_regions and 1–2 acceptable_regions using named_zone.
   Step 5: Write teaching_point, feedback_hints, correct_reasoning.
   Step 6: Self-check: Is ball x in the declared field_zone's x range? Are opponents near the ball?

Generate the JSON now. After generating, I will run the lint tool:
  npx tsx scripts/lint-scenarios.ts
and share any errors for you to fix.
```

---

## 9. Using the ScenarioIntent Pre-Schema

For the most LLM-friendly workflow, use the `ScenarioIntent` format — no
coordinates required at all. The `intentToScenario()` converter resolves
everything automatically.

**Example intent JSON**:

```json
{
  "title": "CM Outlet for Pressed CB",
  "description": "The right CB has the ball under a high press. You are the right CM — provide an outlet.",
  "scenario_archetype": "back_outlet_support",
  "phase": "attack",
  "line_group": "midfield",
  "primary_concept": "pressure_response",
  "situation": "build_out_under_press",
  "field_zone": "defensive_third_right",
  "game_state": "set_press",
  "difficulty": 2,
  "teaching_point": "Position in the lane beside the pressing opponent.",
  "feedback_hints": {
    "success": "You created a clear outlet for the CB.",
    "common_error": "You stayed in line with the press, blocking the pass."
  },
  "entities": [
    { "id": "gk",       "role": "GK", "team": "home", "position_hint": "gk_own_goal" },
    { "id": "cb_right", "role": "CB", "team": "home", "position_hint": "cb_defensive_right", "is_ball_carrier": true },
    { "id": "cm_right", "role": "CM", "team": "home", "position_hint": "cm_own_half_right", "is_target": true },
    { "id": "opp_fw",   "role": "FW", "team": "away", "position_hint": "opp_fw_pressing_right" }
  ],
  "ideal_zones": [
    { "label": "outlet_lane", "purpose": "primary_support_option", "named_zone": "midfield_right_outlet" }
  ],
  "acceptable_zones": [
    { "label": "wider_support", "purpose": "secondary_support_option", "named_zone": "left_midfield_triangle_slot" }
  ],
  "pressure": { "direction": "outside_in", "intensity": "high", "forced_side": "inside" },
  "correct_reasoning": ["create_passing_angle", "support_under_pressure"]
}
```

**Convert to a full scenario**:

```bash
npx tsx scripts/generate-scenario-from-intent.ts /tmp/my-intent.json --out /tmp/draft.json
```

The output is a complete `Scenario` JSON with resolved x/y coordinates,
ready for lint checking and placement in `public/scenarios/`.

---

## 10. Scenario Coverage Gaps

To see which archetypes and situations have no scenarios yet, run:

```bash
npx tsx scripts/scenario-coverage-report.ts
```

This outputs a markdown table showing scenario counts per archetype, situation,
field zone, and the full `primary_concept × situation` matrix.

Use the output to identify generation priorities — e.g.:
> "Generate 2 scenarios for `forward_press_angle` with `situation: high_press`
> — none currently exist."
