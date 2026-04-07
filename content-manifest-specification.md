# Content Manifest Specification (scenario-packs.json)

## Overview

This document defines the structure and behavior of the **scenario manifest system**.

The manifest (`scenario-packs.json`) is the **entry point for all content** in the application.  
It tells the app:
- what scenarios exist
- how they are grouped
- what order to present them
- what metadata applies to each pack

The app must not assume scenarios exist outside the manifest.

---

## File Location

```text
/public/scenario-packs.json


⸻

Design Goals
	•	Single source of truth for available scenarios
	•	Support grouping and progression
	•	Enable lazy loading
	•	Be human-editable
	•	Be robust to partial failure

⸻

Top-Level Structure

{
  "version": 1,
  "packs": []
}


⸻

Required Fields

Field	Type	Required
version	number	yes
packs	array	yes


⸻

Pack Structure

Each pack represents a logical grouping of scenarios.

{
  "id": "core-mvp",
  "title": "Core Scenarios",
  "description": "Fundamental tactical concepts",
  "order": 1,
  "scenarios": [
    "/scenarios/build-out/S01.json",
    "/scenarios/build-out/S02.json"
  ],
  "tags": ["core", "mvp"],
  "difficulty_range": [1, 3]
}


⸻

Pack Fields

Field	Type	Required
id	string	yes
title	string	yes
description	string	yes
order	number	yes
scenarios	array	yes
tags	array	no
difficulty_range	array	no


⸻

Field Definitions

id

Unique identifier for the pack.

Rules:
	•	must be unique
	•	lowercase kebab-case recommended

⸻

title

User-facing name.

⸻

description

Short explanation of the pack’s purpose.

⸻

order

Controls display order.

Lower number = earlier in list.

⸻

scenarios

Array of relative file paths.

Example:

[
  "/scenarios/build-out/S01.json",
  "/scenarios/defence/S02.json"
]

Rules:
	•	must point to valid JSON files
	•	must be relative to /public
	•	must not contain duplicates

⸻

tags

Optional grouping labels.

Used for:
	•	filtering
	•	recommendations

⸻

difficulty_range

Optional.

Example:

[1, 3]

Indicates expected difficulty spread.

⸻

Loading Behavior

Load Sequence

App Start
 → Fetch scenario-packs.json
 → Validate manifest
 → Render pack list
 → Load scenarios on demand


⸻

Scenario Loading Rules
	•	scenarios must be lazy-loaded
	•	do not load all scenarios at startup
	•	load only when:
	•	user selects pack
	•	progression requires it

⸻

Validation Rules

Manifest must be rejected if:
	•	missing version
	•	missing packs array
	•	duplicate pack ids
	•	invalid scenario paths
	•	missing required fields

⸻

Error Handling

Manifest Failure

If manifest fails to load:
	•	show blocking error screen
	•	do not attempt to run app

⸻

Partial Pack Failure

If a pack is invalid:
	•	skip that pack
	•	log error
	•	continue loading others

⸻

Scenario Path Failure

If scenario file fails to load:
	•	skip scenario
	•	log error
	•	do not crash app

⸻

Ordering Rules

Packs:
	•	sorted by order

Scenarios within pack:
	•	preserve listed order
	•	do not auto-sort

⸻

Caching Strategy
	•	browser may cache manifest
	•	version field can be used to invalidate

Optional:

scenario-packs.json?v=2


⸻

Versioning

version field

Used to:
	•	signal content updates
	•	trigger cache invalidation

Rules:
	•	increment when structure changes
	•	increment when large content changes

⸻

Example Full Manifest

{
  "version": 1,
  "packs": [
    {
      "id": "core-mvp",
      "title": "Core Scenarios",
      "description": "Fundamental tactical concepts",
      "order": 1,
      "scenarios": [
        "/scenarios/build-out/CM_SUPPORT_RIGHT_01.json",
        "/scenarios/defence/CB_COVER_CENTER_01.json"
      ],
      "tags": ["core"],
      "difficulty_range": [1, 3]
    },
    {
      "id": "advanced",
      "title": "Advanced Scenarios",
      "description": "More complex decision making",
      "order": 2,
      "scenarios": [
        "/scenarios/transition/CM_SWITCH_01.json"
      ],
      "difficulty_range": [3, 5]
    }
  ]
}


⸻

Best Practices
	•	keep packs focused
	•	avoid too many scenarios in one pack
	•	group by concept, not randomness
	•	maintain consistent naming
	•	ensure progression makes sense

⸻

Common Mistakes

1. Broken Paths
	•	incorrect file paths → scenario fails to load

⸻

2. Duplicate Scenarios
	•	same scenario appearing multiple times

⸻

3. Overloaded Packs
	•	too many scenarios in one group

⸻

4. Missing Ordering
	•	causes unpredictable UI ordering

⸻

Extensibility

Future additions may include:
	•	unlock conditions per pack
	•	pack-level scoring
	•	featured packs
	•	seasonal content

Must remain backward compatible.

⸻

Acceptance Criteria

Manifest system is complete when:
	•	app loads packs correctly
	•	packs display in correct order
	•	scenarios load on demand
	•	invalid entries do not crash app
	•	manifest changes reflect in UI

⸻

Final Rule

The manifest is the only source of truth for available scenarios.

No scenario should be loaded unless referenced here.

⸻


