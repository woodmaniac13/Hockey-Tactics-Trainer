You’re right — the link I gave you was not actually delivering the updated document reliably. That’s on me.

Instead of pointing you to a broken link again, here is the actual fully consolidated, updated design document inline. You can copy it directly, and if you want I can convert this into a downloadable .docx or .pdf afterward.

⸻

2D Web-Based Interactive Tactical Trainer for Field Hockey

Full Technical Design Specification (Final Integrated Version)

⸻

1. Overview

1.1 Purpose

A 2D web-based interactive tactical training system where players:
	•	are presented with realistic field hockey scenarios
	•	reposition their player via drag-and-drop
	•	receive AI-evaluated feedback based on tactical principles

⸻

1.2 Core Philosophy

Positioning is evaluated based on:
	•	Role fulfillment (support / transfer / cover)
	•	Relationship to the ball
	•	Team structure (triangles, width, depth)

NOT:
	•	exact coordinate matching

⸻

1.3 Key Design Principles
	•	Constraint-based scoring
	•	Multiple valid solutions
	•	Explainable feedback
	•	Deterministic evaluation
	•	Coach-aligned logic

⸻

2. System Architecture

2.1 Components

Client (Web)
	•	2D pitch UI
	•	Drag interaction
	•	Instant scoring (local WASM)
	•	Feedback rendering

Server
	•	Authoritative evaluation
	•	Scenario storage
	•	Player analytics

Shared Engine
	•	WASM evaluation module
	•	Guarantees client/server parity

⸻

3. Pitch & Coordinate System (Resolved)

3.1 Axis Definition

Axis	Meaning
x = 0	Home defending baseline
x = 100	Home attacking baseline
y = 0	Left sideline
y = 100	Right sideline

Direction
	•	Home team attacks +X

⸻

3.2 Pitch Bands

Band	Range	Meaning
B1	0–16	DEF_CIRCLE
B2	16–33	DEF_23
B3	33–50	DEF_HALF
B4	50–67	ATT_HALF
B5	67–84	ATT_23
B6	84–100	ATT_CIRCLE


⸻

4. Scenario System (Fully Defined)

4.1 Scenario Schema

{
  "scenario_id": "S03",
  "version": 1,
  "team_orientation": "home_attacks_positive_x",

  "ball": { "x": 54, "y": 32 },

  "teammates": [
    { "id": "LB", "x": 40, "y": 20 },
    { "id": "CB", "x": 35, "y": 32 },
    { "id": "RB", "x": 42, "y": 50 }
  ],

  "opponents": [
    { "id": "F1", "x": 52, "y": 34 },
    { "id": "F2", "x": 55, "y": 28 },
    { "id": "M1", "x": 60, "y": 35 }
  ],

  "pressure": {
    "direction": "inside_out",
    "intensity": "medium"
  },

  "target_player": "CM",

  "ideal_regions": [
    { "x": 48, "y": 35, "r": 8, "weight": 1.0 }
  ],

  "acceptable_regions": [
    { "x": 45, "y": 38, "r": 10 }
  ],

  "weight_profile": "build_out_v1",

  "constraint_thresholds": {
    "support": 0.7,
    "passing_lane": 0.7,
    "pressure_relief": 0.6
  },

  "difficulty": 2,
  "tags": ["support", "build_out"]
}


⸻

4.2 Validation Rules
	•	Opponents required (>0)
	•	Minimum total entities ≥ 10
	•	Coordinates within bounds
	•	Cannot save invalid scenarios

⸻

5. Evaluation Engine (Final)

5.1 Evaluation Order
	1.	Constraint validation
	2.	Tactical scoring
	3.	Region scoring
	4.	Reasoning bonus

⸻

5.2 Alternate Valid Solution Path (Fixed)

if constraints_pass():
    if not in_regions():
        result = ALTERNATE_VALID


⸻

5.3 Tactical Metrics

In Possession
	•	Support angle
	•	Passing lane quality
	•	Distance to ball
	•	Spacing
	•	Width / depth

Out of Possession
	•	Pressure role
	•	Cover position
	•	Central protection
	•	Recovery angle

⸻

5.4 Support Angle (Resolved)

support_angle = angle between:
(player - ball) and perpendicular to pressure direction

Scoring

Angle	Result
30–60°	Optimal
15–75°	Acceptable
Otherwise	Poor


⸻

6. Pressure Model (Added)

"pressure": {
  "direction": "inside_out",
  "intensity": "medium"
}


⸻

Values

Direction
	•	inside_out
	•	outside_in
	•	central
	•	none

Intensity
	•	low / medium / high

⸻

7. Weight System (Governed)

7.1 Decoupled Profiles

"weight_profile": "build_out_v1"


⸻

7.2 Example

{
  "support": 0.35,
  "passing_lane": 0.25,
  "spacing": 0.2,
  "pressure_relief": 0.2
}


⸻

7.3 Governance
	•	Defined by lead coach
	•	Validated via playtesting
	•	Version-controlled
	•	Shared across scenarios

⸻

8. Client / Server Parity (Resolved)

8.1 Deterministic Engine
	•	Shared WASM logic
	•	Same math, same weights

⸻

8.2 Reconciliation

Case	Behaviour
Match	No change
<2% diff	Silent
≥2% diff	UI correction + flag


⸻

8.3 Testing
	•	Golden test fixtures
	•	CI parity enforcement

⸻

9. Interactive Board

9.1 Core Interaction
	•	Drag player
	•	Snap to coordinates
	•	Submit

⸻

9.2 Feedback

Example:

Score: 78

Good:
	•	Strong support angle
	•	Maintained triangle

Improve:
	•	Too high → no recycle option
	•	Central lane exposed

⸻

9.3 Visual Overlays
	•	Passing lanes
	•	Ideal zones
	•	Player vs optimal comparison

⸻

10. Scenario Authoring (Realistic)

10.1 Time Cost

User	Time
Expert	20–40 min
New	60–90 min


⸻

10.2 Required MVP Tools
	•	Formation templates
	•	Scenario duplication
	•	Snap-to-zone placement
	•	Auto opponent generation

⸻

10.3 MVP Scope
	•	20 scenarios (reduced from 50)

⸻

11. Progression System (Defined)

11.1 Metadata

{
  "difficulty": 2,
  "tags": ["support"]
}


⸻

11.2 Rules
	•	Unlock at ≥80%
	•	Weakest skill drives next scenario

⸻

12. Reasoning Capture (Added)

Prompt

Why did you move here?

Options:
	•	Passing angle
	•	Cover
	•	Switch
	•	Support

⸻

Scoring
	•	Correct reasoning = +10%

⸻

13. Versioning (Enforced)

{
  "scenario_id": "S03",
  "version": 3
}


⸻

Attempt Record

{
  "scenario_id": "S03",
  "version": 3,
  "score": 82
}


⸻

14. Determinism
	•	No randomness
	•	Fixed precision
	•	Same results everywhere

⸻

15. Implementation Phases

Phase 1 (MVP)
	•	Board
	•	Scenarios
	•	Rule engine
	•	Feedback

Phase 2
	•	Authoring tools
	•	Analytics

Phase 3
	•	ML refinement
	•	Adaptive learning
