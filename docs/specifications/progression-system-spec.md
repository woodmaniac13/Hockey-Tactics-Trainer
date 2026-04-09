# Progression System Specification

## Overview

This document defines how players progress through scenarios in the Field Hockey Tactical Trainer.

The progression system must:
- guide users through increasing difficulty
- adapt to user weaknesses
- remain simple (no backend required)
- operate entirely using local data

---

## Design Goals

- Encourage learning progression
- Reinforce weak tactical areas
- Avoid overwhelming users
- Be deterministic and predictable
- Work fully offline

---

## Core Concepts

### Scenario Difficulty
Each scenario has:

```json
{
  "difficulty": 1-5
}

Scenario Tags

Each scenario has tags:

{
  "tags": ["support", "build_out"]
}

Used for:
	•	grouping
	•	recommendations
	•	weakness detection

⸻

Progress Model

Progress is tracked per scenario:

{
  "scenario_id": "S01",
  "version": 1,
  "best_score": 85,
  "last_score": 80,
  "attempt_count": 3
}


⸻

Unlock Rules

Default Rule

A scenario is considered completed when:

best_score ≥ 80


⸻

Difficulty Unlock

A player unlocks next difficulty when:

average_score(current_difficulty) ≥ 80


⸻

Recommendation System

Goal

Suggest next scenario based on:
	•	weakest skill
	•	appropriate difficulty

⸻

Weakness Detection

Method

Aggregate scores by tag:

{
  "support": 0.75,
  "cover": 0.55,
  "spacing": 0.68
}

Lowest value = weakest area.

⸻

Recommendation Logic

if weak_tag exists:
    recommend scenario with that tag
else:
    recommend next difficulty


⸻

Selection Rules

Priority Order
	1.	Weakest tag
	2.	Current difficulty
	3.	Unplayed scenarios
	4.	Lowest previous score

⸻

Scenario States

Each scenario is in one of:

State	Meaning
LOCKED	not yet available
AVAILABLE	playable
COMPLETED	best_score ≥ threshold


⸻

UI Representation

Scenario Card
	•	title
	•	difficulty
	•	tags
	•	best score
	•	status (locked / available / completed)

⸻

Completion Thresholds

Score	Meaning
≥90	excellent
80–89	complete
60–79	partial
<60	poor


⸻

Replay Logic

Users may:
	•	replay any unlocked scenario
	•	improve score
	•	update best_score if higher

⸻

Progress Reset

User may:
	•	reset all progress
	•	reset individual scenarios

⸻

Data Storage

Stored in:

localStorage

Keys:

fhtt.progress.v1
fhtt.attempts.v1


⸻

Edge Cases

No Progress
	•	recommend easiest scenario

⸻

All Completed
	•	recommend weakest tag
	•	allow replay

⸻

No Weakness Data
	•	recommend next difficulty

⸻

Determinism

Progression must:
	•	produce same recommendations given same data
	•	avoid randomness
	•	be reproducible

⸻

Testing Requirements

Unit Tests
	•	unlock logic
	•	recommendation logic
	•	tag aggregation
	•	difficulty progression

⸻

Integration Tests
	•	scenario completion updates progress
	•	recommendations update correctly

⸻

Future Enhancements
	•	adaptive difficulty scaling
	•	streak tracking
	•	skill leveling system
	•	personalized coaching paths
	•	curriculum-group-based progression using `curriculum_group`, `learning_stage`, and `prerequisites` scenario metadata (see [specifications/scenario-semantic-metadata-spec.md](scenario-semantic-metadata-spec.md))

⸻

Acceptance Criteria

Progression system is complete when:
	•	scenarios unlock correctly
	•	weakest skill is detected
	•	recommendations are relevant
	•	progress persists locally
	•	system works offline

⸻

Final Rule

The progression system should always answer:

“What should I practice next to improve fastest?”

