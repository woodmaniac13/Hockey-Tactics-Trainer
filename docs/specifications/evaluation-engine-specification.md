# Evaluation Engine Specification

## Overview

The Evaluation Engine is the core logic of the application.  
It determines how well a player's chosen position satisfies tactical principles.

This engine runs entirely in-browser and must be:

- deterministic
- fast (<100ms per evaluation)
- explainable
- consistent across all environments

---

## Design Goals

- Evaluate **tactical correctness**, not exact coordinates
- Support **multiple valid solutions**
- Provide **clear, structured feedback**
- Avoid ambiguity in scoring
- Be **data-driven via weight profiles**
- Be robust to imperfect scenarios

---

## Evaluation Pipeline (Strict Order)

The evaluation must execute in the following order:

1. Input Validation
2. Constraint Evaluation
3. Tactical Component Scoring
4. Region Scoring
5. Alternate-Valid Determination
6. Reasoning Bonus
7. Final Score Calculation
8. Feedback Generation

This order must not be altered without explicit redesign.

---

## 1. Input Validation

### Required Inputs

- scenario object
- player position (x, y)
- optional reasoning selection

### Validation Rules

Reject evaluation if:
- coordinates are out of bounds (0–100)
- scenario is invalid
- target player missing
- weight profile missing

### Output on failure

```json
{
  "error": "INVALID_INPUT"
}


⸻

2. Constraint Evaluation

Constraints define minimum tactical expectations.

Example constraints

{
  "support": 0.7,
  "passing_lane": 0.7,
  "pressure_relief": 0.6
}

Evaluation

Each constraint maps to a tactical component score.

Constraint passes if:

component_score >= threshold

Result

{
  "constraints_passed": true
}


⸻

3. Tactical Component Scoring

Each component produces a normalized score in range:

0.0 → 1.0

Core Components

3.1 Support Angle
Measures quality of support relative to pressure.

The support score is a blend of two components:

**Angle component (70%)**

```
support_angle = angle between:
(player - ball) and perpendicular(pressure_vector)
```

Scoring:
- 30°–60° → 1.0
- 15°–75° → 0.6–0.9 (linear scale)
- outside → < 0.6

**Distance-to-ball band component (30%)**

Rewards positions within the profile's `optimal_min`–`optimal_max` range (from `component_config.distance_to_ball`):
- within band → 1.0
- outside band → degrades linearly toward 0

**Final support score**

```
support_score = 0.7 × angle_score + 0.3 × distance_score
```

⸻

3.2 Passing Lane
Measures whether player is realistically available.

Method
	•	check distance of opponents to line segment (ball → player)
	•	if opponent within blocking threshold → reduce score

Output
	•	clear lane → ~1.0
	•	partially blocked → ~0.5–0.8
	•	blocked → <0.5

⸻

3.3 Distance to Ball
Avoid extremes.

Scoring
	•	optimal range → 1.0
	•	too close or too far → degrade score

Range defined by weight profile.

⸻

3.4 Spacing
Avoid crowding teammates.

Method
	•	find nearest teammate distance
	•	penalize below threshold

⸻

3.5 Pressure Relief
Measures if position improves options under pressure.

Factors:
	•	moves away from pressure vector
	•	opens new angle
	•	avoids trapping

⸻

3.6 Width / Depth
Measures structural contribution:
	•	wide players maintaining width
	•	support players providing depth

⸻

3.7 Cover (Defensive scenarios)
Measures ability to:
	•	protect central space
	•	provide fallback support

⸻

4. Region Scoring

Region Types
- `ideal_regions`
- `acceptable_regions`

Region Shapes

Regions use the polymorphic `TacticalRegion` type. Supported shapes:

| Shape | Key fields |
|---|---|
| Legacy circle | `{ x, y, r }` |
| Tagged circle | `{ type: "circle", x, y, r }` |
| Rectangle | `{ type: "rectangle", x, y, width, height, rotation? }` |
| Polygon | `{ type: "polygon", vertices: [{x,y}...] }` |
| Lane | `{ type: "lane", x1, y1, x2, y2, width }` |

Output

```
region_fit_score:
- inside ideal → 1.0
- inside acceptable → 0.6–0.9
- outside → 0
```


⸻

5. Alternate-Valid Determination

Critical rule.

Logic

if constraints_passed == true AND region_fit_score == 0:
    result_type = "ALTERNATE_VALID"

Meaning
	•	player found a valid solution not anticipated by scenario regions
	•	must not be marked incorrect

⸻

6. Reasoning Bonus

Optional user input:
	•	create passing angle
	•	provide cover
	•	enable switch
	•	support under pressure

Logic

If reasoning aligns with scenario intent:

reasoning_bonus = up to +0.10

Must not exceed defined cap.

⸻

7. Final Score Calculation

Weighted Sum

```
score = Σ(component_score × weight)
```

Weights come from the weight profile.

**Weight normalization:** If the scoring weights in the profile do not sum to 1.0, the evaluator normalizes them at runtime by dividing each weight by their sum. A `console.warn` is emitted identifying the profile and the actual sum. This allows profiles with raw (un-normalized) weights to be used without rejection.

Include:
- support
- passing_lane
- spacing
- pressure_relief
- width_depth
- cover
- region_fit
- reasoning_bonus

Output format
- internal: float
- display: integer 0–100

⸻

8. Result Classification

Based on:
	•	constraints
	•	region fit
	•	final score

Types

Type	Condition
IDEAL	inside ideal region + strong score
VALID	acceptable region or strong score
ALTERNATE_VALID	constraints pass, outside regions
PARTIAL	some constraints fail
INVALID	most constraints fail


⸻

9. Feedback Generation

Structure
	•	summary
	•	positives
	•	improvements
	•	tactical explanation

Inputs
	•	component scores
	•	failed constraints
	•	result type
	•	reasoning alignment

⸻

10. Determinism Requirements

The engine must:
	•	produce identical results for identical inputs
	•	use no randomness
	•	use fixed decimal precision (recommend 2–4 decimals)
	•	use stable evaluation order
	•	avoid floating-point drift in comparisons

⸻

11. Geometry Utilities

Required helpers:
	•	distance(pointA, pointB)
	•	angle_between(vecA, vecB)
	•	normalize(vector)
	•	perpendicular(vector)
	•	point_to_line_distance(point, line_segment)

All must be unit tested.

⸻

12. Performance Constraints
	•	evaluation must complete in <100ms
	•	must support scenarios with up to ~20 entities without slowdown
	•	must not trigger unnecessary re-renders

⸻

13. Error Handling

If evaluation fails:
	•	return safe fallback result
	•	do not crash UI

Example:

{
  "score": 0,
  "type": "ERROR"
}


⸻

14. Testing Requirements

Unit Tests
	•	support angle correctness
	•	region detection
	•	passing lane blocking
	•	constraint evaluation
	•	final score calculation

Golden Tests

Provide fixed inputs with expected outputs.

Example:

scenario + position → score = 78

Must not change unless intentional.

⸻

15. Extensibility

Future enhancements may include:
- ML-assisted scoring
- dynamic weighting
- advanced geometry
- multi-player evaluation

These must not break determinism.