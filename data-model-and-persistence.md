# Data Model & Local Persistence Specification

## Overview

This document defines how data is stored, structured, and managed **locally in the browser**.

Since the application is fully static:
- there is no database
- no backend persistence
- all state must be stored client-side

This system must be:
- resilient to corruption
- version-aware
- backward compatible
- simple and efficient

---

## Storage Strategy

### MVP Storage Method

- `localStorage` (primary)

### Optional Upgrade

- `IndexedDB` for:
  - large attempt histories
  - performance improvements

---

## Storage Keys

All keys must be namespaced.

```text
fhtt.progress.v1
fhtt.attempts.v1
fhtt.settings.v1
fhtt.meta.v1


⸻

1. Progress Model

Tracks best performance per scenario.

Structure

{
  "CM_SUPPORT_RIGHT_01": {
    "version": 1,
    "best_score": 85,
    "last_score": 80,
    "attempt_count": 3,
    "last_played": 1710000000000
  }
}


⸻

Rules
	•	keyed by scenario_id
	•	version must match scenario version
	•	if version mismatch:
	•	treat as new entry
	•	best_score must always be highest recorded score

⸻

2. Attempts Model

Stores attempt history (optional in MVP but recommended).

Structure

{
  "CM_SUPPORT_RIGHT_01": [
    {
      "version": 1,
      "score": 78,
      "result_type": "VALID",
      "position": { "x": 52, "y": 64 },
      "reasoning": "support_under_pressure",
      "timestamp": 1710000000000
    }
  ]
}


⸻

Rules
	•	limit history length per scenario (e.g. last 10 attempts)
	•	newest attempts appended
	•	older entries pruned automatically

⸻

3. Settings Model

Stores user preferences.

Structure

{
  "show_overlays": true,
  "enable_reasoning_prompt": true,
  "debug_mode": false
}


⸻

Defaults

If missing:
	•	use default values
	•	do not crash

⸻

4. Meta Model

Stores app-level metadata.

Structure

{
  "content_version": 1,
  "last_updated": 1710000000000
}


⸻

5. Data Lifecycle

On App Load

Load storage
 → Validate structure
 → Repair or reset invalid sections
 → Initialize defaults


⸻

On Scenario Completion

Evaluate result
 → Update progress
 → Append attempt
 → Save to storage


⸻

6. Versioning Rules

Scenario Version Changes

If:

stored.version != scenario.version

Then:
	•	treat as new scenario
	•	do not overwrite old data
	•	optionally keep legacy data

⸻

7. Corruption Handling

Detection

Invalid if:
	•	JSON parse fails
	•	required fields missing
	•	invalid data types

⸻

Recovery Strategy

Case	Action
Single scenario corrupt	remove that entry
Entire store corrupt	reset store
Partial corruption	repair valid parts


⸻

Rule

Never crash the app due to corrupted storage.

⸻

8. Import / Export

Export

User can export:

{
  "progress": {...},
  "attempts": {...},
  "settings": {...}
}


⸻

Import

Validation required:
	•	schema check
	•	version compatibility
	•	no malicious structure

⸻

Import Rules
	•	confirm overwrite with user
	•	merge or replace (MVP: replace)
	•	ignore invalid entries

⸻

9. Storage Limits

localStorage constraints
	•	~5MB typical browser limit

Mitigation
	•	limit attempt history
	•	avoid storing large redundant data
	•	compress if necessary (future)

⸻

10. Performance Considerations
	•	batch writes when possible
	•	avoid writing on every drag event
	•	only save on submit

⸻

11. Security Considerations
	•	do not trust imported JSON
	•	sanitize all loaded data
	•	prevent script injection
	•	never eval content

⸻

12. Data Access API (Internal)

Provide helper functions:

getProgress(scenarioId)
setProgress(scenarioId, data)

addAttempt(scenarioId, attempt)

getSettings()
setSettings(settings)

exportData()
importData(data)


⸻

13. Testing Requirements

Must test:
	•	saving progress
	•	updating attempts
	•	version mismatch handling
	•	corrupted storage recovery
	•	import/export validation

⸻

14. Future Extensions
	•	IndexedDB migration
	•	cloud sync layer
	•	multi-device persistence
	•	analytics aggregation

These must not break:
	•	existing local data
	•	deterministic behavior

⸻

15. Acceptance Criteria

The persistence system is complete when:
	•	progress saves correctly
	•	attempts are tracked
	•	corrupted data does not crash app
	•	import/export works
	•	version mismatches handled correctly
	•	storage remains within limits

⸻

Final Rule

Local storage is the single source of user state in MVP.

It must be:
	•	reliable
	•	resilient
	•	simple
	•	transparent

⸻


