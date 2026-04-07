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
	•	values must be between 0 and 1
	•	sum of weights should equal 1.0 (recommended)
	•	unused components may be omitted
	•	missing components default to 0

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
	•	profile_id missing
	•	version missing
	•	weights missing
	•	any weight < 0 or > 1
	•	total weight = 0
	•	unknown component used

⸻

Loading Behavior

Load Flow

App Load
 → Load all weight profiles
 → Validate each profile
 → Store in memory


⸻

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

{
  "profile_id": "build_out_v1",
  "version": 1,
  "weights": {
    "support": 0.4,
    "passing_lane": 0.3,
    "spacing": 0.15,
    "pressure_relief": 0.15
  }
}


⸻

Defence

{
  "profile_id": "defence_v1",
  "version": 1,
  "weights": {
    "cover": 0.4,
    "spacing": 0.2,
    "pressure_relief": 0.2,
    "support": 0.2
  }
}


⸻

Transition

{
  "profile_id": "transition_v1",
  "version": 1,
  "weights": {
    "support": 0.3,
    "passing_lane": 0.3,
    "width_depth": 0.2,
    "spacing": 0.2
  }
}


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

