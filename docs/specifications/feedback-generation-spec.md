# Feedback Generation Specification

## Overview

This document defines how evaluation results are converted into **player-facing feedback**.

The Feedback System must:
- explain results clearly
- reinforce correct decisions
- identify improvements
- align with tactical principles
- remain concise and consistent

Feedback is a core part of the product — it is where learning happens.

---

## Design Goals

- Explain *why* a position is good or bad
- Reinforce correct tactical thinking
- Avoid ambiguity or contradiction
- Support multiple valid solutions
- Be readable and concise
- Be deterministic (same input → same feedback)

---

## Inputs

The Feedback Engine receives:

```json
{
  "score": 78,
  "result_type": "VALID",
  "component_scores": {
    "support": 0.85,
    "passing_lane": 0.7,
    "spacing": 0.6,
    "pressure_relief": 0.8
  },
  "constraints_passed": true,
  "region_fit_score": 0.6,
  "reasoning": "support_under_pressure",
  "scenario": {
    "phase": "attack",
    "tags": ["support", "build_out"]
  }
}


⸻

Output Structure

{
  "score": 78,
  "result_type": "VALID",
  "summary": "Good support position with minor improvements needed.",
  "positives": [
    "You created a strong support angle",
    "You remained available outside the pressure"
  ],
  "improvements": [
    "You were slightly too high",
    "A deeper option would provide safer recycling"
  ],
  "tactical_explanation": "In this situation the CM should support behind or beside the ball to relieve pressure.",
  "reasoning_feedback": "Your reasoning matched the tactical objective."
}


⸻

Result Types

Type	Meaning
IDEAL	Optimal positioning
VALID	Good positioning
ALTERNATE_VALID	Valid but different solution
PARTIAL	Mixed result
INVALID	Incorrect positioning
ERROR	Evaluation failed


⸻

Feedback Generation Pipeline
	1.	Determine result type
	2.	Generate summary
	3.	Generate positives
	4.	Generate improvements
	5.	Generate tactical explanation
	6.	Evaluate reasoning alignment
	7.	Assemble output

⸻

1. Summary Generation

Short sentence describing performance.

Rules
	•	≤ 15 words
	•	must match result_type
	•	must not contradict detailed feedback

Examples

Result	Summary
IDEAL	“Excellent positioning.”
VALID	“Good positioning with minor improvements.”
ALTERNATE_VALID	“Valid solution using a different approach.”
PARTIAL	“Partially correct positioning.”
INVALID	“Positioning does not meet tactical requirements.”


⸻

2. Positives

Derived from high component scores.

Rule

Include components where:

component_score ≥ 0.7

Mapping

Component	Feedback
support	“You created a strong support angle”
passing_lane	“You made yourself available for a pass”
spacing	“You maintained good spacing”
pressure_relief	“You helped relieve pressure”
width_depth	“You preserved team structure”
cover	“You provided defensive cover”


⸻

3. Improvements

Derived from low component scores.

Rule

Include components where:

component_score < 0.6

Mapping

Component	Feedback
support	“Your support angle could be improved”
passing_lane	“You were not a clear passing option”
spacing	“You were too close to a teammate”
pressure_relief	“Your position did not relieve pressure effectively”
width_depth	“You did not maintain team shape”
cover	“You were not in a strong covering position”


⸻

## 4. Tactical Explanation

Explains the key tactical principle for this scenario.

**Priority:**
1. If the scenario has a `teaching_point` field, it is used verbatim as the tactical explanation.
2. Otherwise, a generic explanation is derived from the scenario's `phase`, `tags`, and `primary_concept`:
   - attack + support/primary_concept=support → "The player should support the ball carrier to create a safe passing option."
   - defence + cover/primary_concept=cover → "Defenders should protect the central channel before pressing wide."
   - transition → "Quick movement helps transition between phases effectively."
   - fallback → "Good positioning supports team structure and enables passing options."

**Rules:**
- 1–2 sentences
- must not depend on exact coordinates

---

5. Alternate Valid Feedback

If result_type = ALTERNATE_VALID:

Add:

"You found a valid solution that differs from the expected model answer."

Must:
	•	acknowledge correctness
	•	avoid implying mistake

⸻

6. Reasoning Feedback

Compare user reasoning with scenario intent.

Matching

If reasoning aligns:

"Your reasoning matched the tactical objective."

If mismatch:

"Your reasoning did not fully match the tactical objective."

If none:

"No reasoning provided."


⸻

7. Feedback Constraints
	•	Max 3 positives
	•	Max 3 improvements
	•	No duplicate statements
	•	No contradictions
	•	Avoid overly technical language

⸻

8. Tone Guidelines
	•	neutral and instructional
	•	not critical or emotional
	•	avoid slang
	•	avoid long paragraphs

⸻

9. Determinism Requirements
	•	same input → identical feedback text
	•	no randomness in selection
	•	fixed ordering of components

⸻

10. Error Handling

If feedback generation fails:

{
  "summary": "Unable to generate feedback.",
  "positives": [],
  "improvements": []
}

Must not crash UI.

⸻

11. Testing Requirements

Unit Tests
	•	correct mapping of components to feedback
	•	correct summary per result type
	•	reasoning matching logic

Golden Tests

Ensure:

input → exact feedback output


⸻

12. Extensibility

Future enhancements:
	•	dynamic phrasing
	•	personalization
	•	coach-specific feedback styles
	•	multi-language support

Authored feedback hooks via `feedback_hints`

If a scenario includes a `feedback_hints` object, the feedback system may use its authored strings in place of generated text:

| Hook | Used when |
|---|---|
| `feedback_hints.success` | result_type is `IDEAL` or `VALID` |
| `feedback_hints.common_error` | result_type is `PARTIAL` or `INVALID` |
| `feedback_hints.alternate_valid` | result_type is `ALTERNATE_VALID` |
| `feedback_hints.teaching_emphasis` | appended regardless of outcome |

If a hook is absent, the feedback system falls back to its standard generated output. Fallback must always be safe and must not crash the UI.

Must not break:
	•	deterministic output
	•	clarity

⸻

Acceptance Criteria

Feedback system is complete when:
	•	all result types produce valid feedback
	•	feedback is consistent and clear
	•	no contradictions occur
	•	reasoning feedback works
	•	alternate-valid feedback behaves correctly

⸻

Final Rule

Feedback must always answer:

“What did I do well, what should I change, and why?”

