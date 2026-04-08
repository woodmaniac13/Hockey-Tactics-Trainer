# Weight Profile Specification

## Overview

Weight profiles define how different tactical components contribute to the final evaluation score.

They allow the system to:
- adjust scoring based on scenario intent
- reuse consistent scoring logic across scenarios
- separate tactical philosophy from scenario data

All scenarios must reference a valid weight profile.

---

## File Location

```text
/public/weights/

Example:

/public/weights/build_out_v1.json


⸻

Design Goals
	•	Decouple scoring weights from scenarios
	•	Allow tuning without changing evaluation code
	•	Maintain consistency across similar scenarios
	•	Enable future experimentation and balancing

⸻

Weight Profile Structure

Example

{
  "profile_id": "build_out_v1",
  "version": 1,
  "description": "Build-out phase prioritizing support and passing lanes",

  "weights": {
    "support": 0.35,
    "passing_lane": 0.25,
    "spacing": 0.15,
    "pressure_relief": 0.15,
    "width_depth": 0.10
  },

  "component_config": {
    "distance_to_ball": {
      "optimal_min": 8,
      "optimal_max": 20
    },
    "spacing": {
      "min_distance": 6
    },
    "passing_lane": {
      "block_threshold": 3
    }
  }
}


⸻

Required Fields

Field	Type	Required
profile_id	string	yes
version	number	yes
weights	object	yes
description	string	no
component_config	object	no


⸻

Weights Object

Defines contribution of each scoring component.

Allowed Components
	•	support
	•	passing_lane
	•	spacing
	•	pressure_relief
	•	width_depth
	•	cover
	•	region_fit
	•	reasoning_bonus

⸻

Rules
- values must be **≥ 0** (no upper limit — the evaluator normalizes at runtime if needed)
- sum of weights **should** equal 1.0 for authored profiles (canonical form)
- unused components may be omitted
- missing components default to 0

⸻

Component Config

Optional configuration for component-specific parameters.

Examples

Distance to Ball

{
  "distance_to_ball": {
    "optimal_min": 8,
    "optimal_max": 20
  }
}

Spacing

{
  "spacing": {
    "min_distance": 6
  }
}

Passing Lane

{
  "passing_lane": {
    "block_threshold": 3
  }
}


⸻

Validation Rules

A weight profile is invalid if:
- `profile_id` missing
- `version` missing
- `weights` missing
- any weight < 0 (no upper limit — weights above 1.0 are valid; see normalization below)
- total weight = 0
- unknown component used

---

## Normalization Behavior

Authored profiles may specify raw (un-normalized) weights. The evaluator normalizes at runtime when the scoring weights do not sum to 1.0.

Rules:
- All weights must be **≥ 0** (no upper limit enforced at authoring time)
- The evaluator divides each weight by the sum of all non-`reasoning_bonus` scoring weights
- A `console.warn` is emitted when normalization is applied, identifying the profile and the actual sum
- Strict rejection of non-normalized profiles is **not** required — normalization is applied silently with a warning

This means weight values such as `0.35, 0.25, 0.15, 0.15, 0.10` (sum = 1.0) are canonical, but a profile with values like `35, 25, 15, 15, 10` (sum = 100) would also be accepted and normalized identically.

---

## Data-Driven Loading

Profiles are discovered at runtime via the manifest file:

```text
/public/weights/weights-manifest.json
```

Example manifest:

```json
{
  "version": 1,
  "profiles": [
    "build_out_v1",
    "defence_v1",
    "attack_v1",
    "transition_v1"
  ]
}
```

Each entry is a profile ID. The app loads `/public/weights/<profile_id>.json` for each entry.

**To add a new profile:**
1. Create `/public/weights/<new_profile_id>.json`
2. Add the profile ID to `weights-manifest.json`

No code change is required. The app discovers and loads the new profile automatically.

---

Failure Handling

Issue	Behavior
Invalid profile	Skip profile
Missing profile referenced by scenario	Block scenario load
Partial config missing	Use defaults


⸻

Defaults

If component_config is missing:
	•	use system defaults

If component missing from weights:
	•	treat as weight = 0

⸻

Versioning

version field

Used to:
	•	track changes in weighting logic
	•	maintain consistency with scenarios

⸻

Rules
	•	increment version when weights change significantly
	•	do not reuse profile_id for incompatible profiles
	•	scenarios must reference correct version implicitly

⸻

Naming Conventions

<phase>_<version>

Examples:

build_out_v1
defence_v1
transition_v2


⸻

Best Practices
	•	emphasize only relevant components
	•	avoid overly complex weight distributions
	•	keep profiles intuitive
	•	align weights with tactical intent
	•	test profiles across multiple scenarios

⸻

Common Mistakes

1. Overweighting One Component

Leads to unrealistic scoring.

⸻

2. Missing Key Component

Scenario may behave incorrectly.

⸻

3. Using Same Profile Everywhere

Reduces tactical specificity.

⸻

Example Profiles

Build-Out

```json
{
  "profile_id": "build_out_v1",
  "version": 1,
  "weights": {
    "support": 0.25,
    "passing_lane": 0.20,
    "spacing": 0.15,
    "pressure_relief": 0.20,
    "width_depth": 0.10,
    "cover": 0.00,
    "region_fit": 0.10,
    "reasoning_bonus": 0.02
  }
}
```


⸻

Defence

```json
{
  "profile_id": "defence_v1",
  "version": 1,
  "weights": {
    "cover": 0.30,
    "spacing": 0.20,
    "pressure_relief": 0.20,
    "support": 0.10,
    "passing_lane": 0.10,
    "region_fit": 0.10,
    "reasoning_bonus": 0.02
  }
}
```


⸻

Transition

```json
{
  "profile_id": "transition_v1",
  "version": 1,
  "weights": {
    "support": 0.25,
    "passing_lane": 0.25,
    "width_depth": 0.20,
    "spacing": 0.20,
    "region_fit": 0.10,
    "reasoning_bonus": 0.02
  }
}
```


⸻

Testing Requirements
	•	validate profile loads correctly
	•	ensure weights sum correctly
	•	verify scoring impact changes as expected
	•	ensure missing components do not crash engine

⸻

Extensibility

Future additions:
	•	dynamic weighting
	•	scenario-specific overrides
	•	adaptive profiles
	•	ML-assisted tuning

Must not break:
	•	deterministic scoring
	•	backward compatibility

⸻

Acceptance Criteria

Weight system is complete when:
	•	profiles load correctly
	•	scenarios reference profiles successfully
	•	evaluation uses weights correctly
	•	invalid profiles do not break app
	•	scoring reflects intended tactical emphasis

⸻

Final Rule

Weight profiles control how the system interprets tactical importance.

They must be:
	•	simple
	•	consistent
	•	intentional
	•	validated

