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
{ "difficulty": 1 }
```

### Scenario Tags

Each scenario has tags used for grouping, recommendations, and weakness detection:

```json
{ "tags": ["support", "build_out"] }
```

### Curriculum Metadata

Scenarios may optionally carry curriculum metadata:

```json
{
  "curriculum_group": "build_out_basics",
  "learning_stage": 1,
  "prerequisites": ["S01"],
  "recommended_after": "S02"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `curriculum_group` | string | Logical grouping (e.g. `build_out_basics`) |
| `learning_stage` | number | Ordering within a group (1 = earliest) |
| `prerequisites` | string[] | Scenario IDs that must be completed (≥80) before this unlocks |
| `recommended_after` | string | Soft ordering hint (no hard gate) |

---

## Progress Model

Progress is tracked per scenario:

```json
{
  "scenario_id": "S01",
  "version": 1,
  "best_score": 85,
  "last_score": 80,
  "attempt_count": 3
}
```

---

## Unlock Rules

### Completion Threshold

A scenario is considered completed when: `best_score ≥ 80`

### Prerequisite Gating

If a scenario defines `prerequisites`, **all listed scenarios must be completed** (best_score ≥ 80) before the scenario becomes AVAILABLE. This takes precedence over difficulty-based unlocking.

### Difficulty Unlock

A player unlocks the next difficulty level when:
`average_score(current_difficulty) ≥ 80`

Difficulty-1 scenarios without unmet prerequisites are always AVAILABLE.

---

## Recommendation System

### Goal

Suggest the next scenario based on the user's weakest skill area, then curriculum ordering, then unplayed status.

### Weakness Detection

Aggregate best scores by tag. The tag with the lowest average score is the weakest area.

### Recommendation Priority

1. **Weakness tag** — an unplayed or incomplete scenario that targets the weakest tag
2. **Curriculum-ordered unplayed** — within curriculum groups, prefer lower `learning_stage` first; scenarios without a `curriculum_group` are lower priority within this step
3. **Any unplayed scenario** — in scenario list order
4. **Lowest-scored incomplete** — scenario with the worst best_score

### Scenario States

| State | Meaning |
|-------|---------|
| `LOCKED` | Prerequisites unmet or previous difficulty not passed |
| `AVAILABLE` | Playable |
| `COMPLETED` | `best_score ≥ 80` |

---

## UI Representation

- **Scenario card**: title, difficulty, tags, best score, status (locked / available / completed)
- **Locked scenarios**: lock icon shown; prerequisite IDs shown in scenario details if unmet prerequisites exist
- **Curriculum context**: `curriculum_group` and `learning_stage` shown in scenario detail view
- **Recommended next**: shown in Progress view

---

## Completion Thresholds

| Score | Meaning |
|-------|---------|
| ≥90 | excellent |
| 80–89 | complete |
| 60–79 | partial |
| <60 | poor |

---

## Data Storage

Stored in `localStorage`:
- `fhtt.progress.v1`
- `fhtt.attempts.v1`

---

## Determinism

Progression must:
- produce same recommendations given same data
- avoid randomness
- be reproducible

---

## Testing

Unit tests cover:
- difficulty unlock logic
- prerequisite gating (single and multiple prerequisites)
- curriculum-ordered recommendation (lower `learning_stage` preferred)
- weakness tag recommendation
- tag aggregation
- edge cases: no progress, all completed, no weakness data

---

## Acceptance Criteria

Progression system is complete when:
- scenarios unlock correctly based on both difficulty and prerequisites
- weakest skill is detected
- recommendations follow curriculum ordering when metadata is present
- progress persists locally
- system works offline

---

## Final Rule

The progression system should always answer:

> "What should I practice next to improve fastest?"



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

