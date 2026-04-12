Web-Based Interactive Tactical Trainer for Field Hockey

Overview

A browser-based tactical training tool where players:
	•	interact with a 2D or 3D field hockey board
	•	reposition a player based on a scenario
	•	receive immediate feedback based on tactical principles

The system runs entirely in the browser and is deployed as a static site on GitHub Pages.

The MVP is a static single-page application with no backend dependency. All scoring, content loading, state management, and progress persistence happen client-side.

⸻

Product Goal

Teach players to make better tactical positioning decisions in field hockey by presenting scenarios and judging their chosen movement based on:
	•	support
	•	transfer
	•	cover
	•	spacing
	•	width/depth
	•	pressure response

The product is not trying to simulate full match physics. It is a tactical decision trainer, not a game simulation.

⸻

Non-Goals

The MVP must not attempt to provide:
	•	full real-time multi-player simulation
	•	physics-based ball movement
	•	live coach dashboards
	•	cloud sync
	•	user login
	•	multiplayer collaboration
	•	freeform whiteboard drawing tools
	•	server-authoritative scoring

⸻

Core Principles
	•	Ball-relative positioning (support / transfer / cover)
	•	Constraint-based evaluation (not exact positions)
	•	Multiple valid solutions allowed
	•	Deterministic scoring
	•	Explainable feedback
	•	Static deployment compatibility
	•	Content-driven design through scenario JSON files

⸻

MVP Scope

Included
	•	Interactive board
	•	Scenario loading from static files
	•	In-browser evaluation
	•	Feedback system
	•	Local progress tracking
	•	Reasoning capture
	•	Difficulty progression
	•	Visual overlays after submission
	•	Scenario validation at load time
	•	Import/export of local progress JSON

Excluded
	•	Backend APIs
	•	User accounts
	•	Cloud persistence
	•	Real-time analytics
	•	Coach publishing tools (server-based)
	•	Shared team content management
	•	Live content editing in production
	•	Online leaderboards

⸻

Target Platform

Static web frontend hosted on GitHub Pages.

Supported devices
	•	desktop browsers: primary target
	•	tablets: supported
	•	mobile phones: usable, but not primary MVP target

Supported browsers
	•	latest Chrome
	•	latest Edge
	•	latest Safari
	•	latest Firefox

Do not optimize first for legacy browsers.

⸻

High-Level User Flow
	1.	User opens app
	2.	App loads manifest and scenario packs
	3.	User selects scenario or progression-recommended scenario
	4.	Scenario board renders
	5.	User optionally reads objective and reasoning prompt context
	6.	User drags target player
	7.	User submits answer
	8.	App evaluates:
	•	constraints
	•	tactical scores
	•	region fit
	•	reasoning alignment
	9.	User receives:
	•	score
	•	explanation
	•	visual overlays
	•	alternate-valid acknowledgement if applicable
	10.	Progress stored locally
	11.	User can retry or continue

⸻

Primary UX Modes

1. Training Mode

Default user mode.
	•	choose scenario
	•	answer once
	•	see result
	•	save progress

2. Review Mode

Visible after submission.
	•	shows ideal/acceptable regions
	•	shows player placement
	•	shows passing lanes / support angles
	•	explains tactical logic

3. Retry Mode

Replays same scenario without altering prior saved attempt unless user explicitly resubmits.

4. Debug Mode

Development-only mode.
	•	exposes raw scoring breakdown
	•	shows geometry helpers
	•	shows region outlines before submit
	•	not enabled in normal production UI

⸻

Core Data Sources
	•	Scenarios: /public/scenarios/**/*.json
	•	Weight profiles: /public/weights/*.json
	•	Manifest: /public/scenario-packs.json

The app must treat these files as the canonical content source.

⸻

Repository Expectations

The AI agent building this should assume the repo contains or will contain:

/public
  /scenarios
    /build-out
    /defence
    /attack
    /transition
  /weights
  /assets
  scenario-packs.json

/src
  /components
  /board
  /evaluation
  /feedback
  /hooks
  /llm
  /scenarios
  /storage
  /types
  /utils
  /pages


⸻

Persistence Model

Stored locally:
	•	scores
	•	attempts
	•	reasoning answers
	•	progression
	•	settings
	•	recently played scenarios

Storage choice
	•	MVP: localStorage
	•	Optional richer attempt history: IndexedDB

Required local keys

Suggested names:
	•	fhtt.progress.v1
	•	fhtt.attempts.v1
	•	fhtt.settings.v1
	•	fhtt.contentVersion.v1

Persistence rules
	•	scenario attempts must include scenario id and version
	•	if scenario version changes, historical attempts remain valid but are not merged with newer version attempts
	•	corrupted local state must fail gracefully and reset only the corrupted store, not crash the app

⸻

Success Criteria
	•	Users understand positioning decisions
	•	Feedback is clear and actionable
	•	Multiple valid solutions are accepted
	•	System is responsive (<100ms scoring on normal scenario sizes)
	•	Load time is fast on static hosting
	•	Broken scenario files do not crash the app
	•	Deterministic scoring produces same result for same input every time

⸻

Tactical Model

Core Tactical Concepts

The evaluation model is based on:
	•	support
	•	transfer
	•	cover
	•	ball-side vs weak-side
	•	width and depth
	•	spacing
	•	pressure response

The app should not try to encode every coaching philosophy. It should implement a clear default tactical framework with configurable scenario weights.

⸻

Ball-Relative Logic

The correct move depends on:
	•	ball location
	•	pressure direction
	•	target player role
	•	teammate spacing
	•	opponent pressure
	•	scenario objective

The app should never assume one perfect coordinate is the only correct answer.

⸻

Static App Architecture

Runtime Architecture

Entirely client-side:
	•	React UI layer
	•	Board rendering layer
	•	Scenario loading layer
	•	Evaluation engine
	•	Feedback generation layer
	•	Local persistence layer
	•	Progression engine

No server calls are required after static assets are loaded.

⸻

Preferred Stack
	•	React
	•	TypeScript
	•	Vite
	•	Zod for runtime validation
	•	Canvas for 2D board rendering
	•	Three.js / @react-three/fiber / drei for 3D board view
	•	localStorage for MVP persistence

If a rendering library is used, it must support:
	•	dragging entities
	•	overlays
	•	hit testing
	•	responsive resizing

⸻

Performance Constraints

The app should:
	•	load quickly on GitHub Pages
	•	keep initial JS bundle moderate
	•	avoid unnecessary libraries
	•	evaluate a scenario in under 100ms
	•	remain interactive at 60fps during drag on common laptops/tablets

⸻

Coordinate System

Canonical Pitch Space

Use normalized pitch coordinates.
	•	x = 0 → home defending baseline
	•	x = 100 → home attacking baseline
	•	y = 0 → left sideline
	•	y = 100 → right sideline

Direction

Home team attacks in the positive X direction.

All scenario files must use this orientation.

⸻

Pitch Bands

Use these default longitudinal bands:

Band	X Range	Meaning
B1	0–16	DEF_CIRCLE
B2	16–33	DEF_23
B3	33–50	DEF_HALF
B4	50–67	ATT_HALF
B5	67–84	ATT_23
B6	84–100	ATT_CIRCLE

Optional lateral bands may also be used internally:
	•	LW
	•	LI
	•	C
	•	RI
	•	RW

These are not required in base scenario files, but may be derived.

⸻

Scenario Model

Scenario File Purpose

A scenario describes:
	•	current board state
	•	objective
	•	movable player
	•	valid solution regions
	•	evaluation thresholds
	•	difficulty metadata

⸻

Required Scenario Fields

Every scenario must include:

{
  "scenario_id": "S01",
  "version": 1,
  "title": "CM support under right-side pressure",
  "description": "Move the CM to support the ball carrier safely.",
  "team_orientation": "home_attacks_positive_x",
  "phase": "attack",
  "target_player": "CM",
  "ball": { "x": 58, "y": 68 },
  "teammates": [],
  "opponents": [],
  "pressure": {
    "direction": "inside_out",
    "intensity": "medium"
  },
  "ideal_regions": [],
  "acceptable_regions": [],
  "weight_profile": "build_out_v1",
  "constraint_thresholds": {
    "support": 0.7,
    "passing_lane": 0.7,
    "pressure_relief": 0.6
  },
  "difficulty": 2,
  "tags": ["support", "build_out", "cm"]
}


⸻

Required Validation Rules

A scenario is invalid if:
	•	scenario_id missing
	•	version missing
	•	ball missing
	•	target player missing
	•	teammates missing
	•	opponents missing
	•	pressure missing
	•	weight profile missing
	•	coordinates out of range
	•	fewer than one opponent
	•	fewer than one teammate besides target where scenario depends on relationship
	•	no ideal and no acceptable regions
	•	unknown pressure direction
	•	unknown phase
	•	duplicate entity ids

The app must reject invalid scenarios cleanly.

⸻

Entity Format

Suggested entity structure:

{
  "id": "CM",
  "role": "CM",
  "team": "home",
  "x": 48,
  "y": 52
}

Required entity fields
	•	id
	•	role
	•	team
	•	x
	•	y

Allowed team values
	•	home
	•	away

⸻

Regions

Two region types:

Ideal regions

Best answers.
May contain multiple regions.

Acceptable regions

Still valid answers.
May contain multiple regions.

Shape support

MVP should support:
	•	circle

Optional later:
	•	ellipse
	•	polygon

To reduce build complexity, MVP should start with circles only.

⸻

Evaluation Engine

Evaluation Order

The engine must evaluate in this order:
	1.	Hard validation
	2.	Constraint scoring
	3.	Tactical component scoring
	4.	Region fit scoring
	5.	Reasoning bonus
	6.	Final feedback selection

This order matters and must not be changed casually.

⸻

Determinism Rules

The evaluator must be deterministic.

Required:
	•	no randomness
	•	fixed decimal handling
	•	stable sort order
	•	no time-based influence
	•	same inputs produce same outputs

Round displayed values separately from internal scoring to avoid drift.

⸻

Constraint-Based Model

A move can be valid even if outside ideal/acceptable region if it satisfies tactical thresholds strongly enough.

Alternate-valid rule

If all defined constraints pass minimum thresholds, and region fit is low or zero:
	•	mark result as ALTERNATE_VALID
	•	do not classify as wrong
	•	show special feedback acknowledging a different valid solution

This is required.

⸻

Tactical Scoring Components

The engine should support these component scores:
	•	support
	•	passing_lane
	•	spacing
	•	pressure_relief
	•	width_depth
	•	cover
	•	region_fit
	•	reasoning_bonus

Not all scenarios need all components.

⸻

Pressure Model

Pressure is structured, not implied.

Pressure object

{
  "direction": "inside_out",
  "intensity": "medium"
}

Allowed directions
	•	inside_out
	•	outside_in
	•	central
	•	none

Allowed intensity
	•	low
	•	medium
	•	high

⸻

Support Angle

Support angle is a defined geometric concept.

Definition

Angle between:
	•	the vector from ball to player
	•	the vector perpendicular to pressure direction

Default interpretation
	•	30°–60° → optimal
	•	15°–75° → acceptable
	•	outside that → poor

Implementation note

The evaluator must define pressure direction as a unit vector before angle computations.

⸻

Passing Lane

Measures whether the player is realistically available.

MVP approximation

Use geometric blocking against opponent positions:
	•	if an opponent lies close to the line segment from ball to player, lane is degraded
	•	closeness threshold configurable per scenario or profile

No full occlusion physics needed.

⸻

Distance to Ball

Useful support positions should not be:
	•	too close
	•	too far

Distance scoring should be profile-based, not hardcoded globally.

⸻

Spacing

Reward positions that do not overcrowd nearby teammates.

MVP approximation

Penalty when nearest friendly player distance is below threshold.

⸻

Pressure Relief

Reward moves that:
	•	create escape angle
	•	open safer option away from pressure
	•	avoid trapping the ball carrier

⸻

Width / Depth

Reward roles that preserve structure:
	•	wide players staying wide when appropriate
	•	support players offering depth behind or ahead of ball

⸻

Final Score

Use weighted sum from the referenced weight profile.

Suggested output:
	•	integer 0–100 for display
	•	raw float internally if needed

⸻

Weight Profiles

Scenarios must reference a named profile.

Example:

{
  "profile_id": "build_out_v1",
  "weights": {
    "support": 0.35,
    "passing_lane": 0.25,
    "spacing": 0.2,
    "pressure_relief": 0.2
  }
}

Rule

Scenario files should not duplicate weight tables inline in MVP unless necessary for special cases.

⸻

Feedback System

Feedback Goals

Feedback must:
	•	explain the result
	•	identify what was good
	•	identify what to improve
	•	be concise
	•	be scenario-specific enough to feel useful

⸻

Feedback Structure

Recommended structure:
	•	headline
	•	score
	•	validity type
	•	positives
	•	improvement points
	•	tactical reason
	•	optional reasoning comparison

Example
	•	Score: 78
	•	Result: Valid
	•	Good: You created a usable support angle and stayed available outside the pressure line.
	•	Improve: You were slightly too high, leaving less safe depth behind the ball.
	•	Why: In this scenario the CM should support and relieve inside-out pressure.

⸻

Result Types

Use one of:
	•	IDEAL
	•	VALID
	•	ALTERNATE_VALID
	•	PARTIAL
	•	INVALID

⸻

Reasoning Capture

Purpose

Encourage tactical thinking, not just guessing positions.

Flow

Before feedback reveal, optionally ask:

Why did you move here?

MVP answers
	•	Create a passing angle
	•	Provide cover
	•	Enable switch
	•	Support under pressure
	•	Maintain width
	•	Restore shape
	•	Break pressure
	•	Occupy depth

> **Known gap:** The UI reasoning prompt (`src/components/ReasoningCapture.tsx`) currently exposes only the first 4 options. The additional 4 options (`maintain_width`, `restore_shape`, `break_pressure`, `occupy_depth`) are defined in the schema and used by `correct_reasoning` in scenario files, but are not yet selectable in the player-facing UI.

Scoring

Add small bonus for aligned reasoning:
	•	suggested max +10%

Do not let reasoning overpower movement scoring.

⸻

Progression Model

Difficulty

Each scenario has:
	•	difficulty integer, suggested range 1–5

Recommendation logic

MVP should support basic progression:
	•	unlock next difficulty when average score threshold is met
	•	recommend scenarios from weakest tag category

Example

If player consistently scores low on cover, recommend more cover scenarios.

⸻

Local Progress Record

Suggested structure:

{
  "scenario_id": "S01",
  "version": 1,
  "best_score": 82,
  "last_score": 78,
  "attempt_count": 3,
  "last_played": 1710000000000
}


⸻

Board UI Requirements

Required Visual Elements
	•	pitch background
	•	ball marker
	•	teammates
	•	opponents
	•	target player highlight
	•	submit button
	•	reset button
	•	optional objective panel
	•	feedback panel
	•	overlay layer

⸻

Drag Behaviour
	•	only target player is draggable in MVP
	•	drag constrained to pitch bounds
	•	movement should feel immediate
	•	on release, player remains where dropped
	•	reset returns to scenario start position

⸻

Overlays After Submit

Show at least:
	•	player final position
	•	ideal/acceptable regions
	•	line from ball to player
	•	optional pressure direction indicator

Do not reveal ideal regions before submit in standard mode.

⸻

Responsive Behaviour

Desktop first.
For narrow screens:
	•	stack controls vertically
	•	keep pitch visible without impossible small touch targets
	•	do not hide submit button

⸻

Error Handling

Required Non-Crash Behaviours

If something goes wrong:
	•	bad scenario file → show scenario load error, skip scenario
	•	bad weight profile → show content error
	•	corrupt local storage → reset affected store only
	•	missing manifest entry → ignore broken entry, continue loading remaining content

The app must never white-screen due to one bad scenario file.

⸻

Content Loading Rules

Manifest

The app should use a manifest file to know what exists.

Example:

{
  "packs": [
    {
      "id": "core-mvp",
      "title": "Core MVP Scenarios",
      "scenarios": [
        "/scenarios/build-out/S01.json",
        "/scenarios/defence/S02.json"
      ]
    }
  ]
}


⸻

Loading Strategy
	•	load manifest first
	•	lazy-load scenario files as needed
	•	preload only the next likely scenario if useful

Do not preload all scenarios if unnecessary.

⸻

Import / Export

MVP support

Users should be able to:
	•	export progress as JSON
	•	import progress from JSON

This is important because there is no backend.

Validation

Imported files must be validated before applying.

⸻

Testing Expectations

Unit tests

Must cover:
	•	geometry helpers
	•	pressure vector conversion
	•	support angle calculation
	•	region inclusion
	•	scoring functions
	•	alternate-valid logic
	•	progression logic
	•	storage migration logic

Golden tests

Provide fixed scenario + position + expected score outputs.

These are required so future changes do not alter scoring accidentally.

UI tests

At minimum:
	•	scenario loads
	•	target player drags
	•	submit works
	•	feedback appears
	•	progress persists

⸻

Accessibility Requirements

MVP should include:
	•	keyboard-accessible buttons
	•	readable color contrast
	•	text labels for major actions
	•	no feedback that relies only on color
	•	clear touch targets

Full keyboard drag interaction is optional in MVP, but buttons and navigation should be keyboard-usable.

⸻

Deployment Assumptions

Hosting

GitHub Pages

Build

A static build pipeline should output deployable assets.

CI

At minimum:
	•	install
	•	type check
	•	test
	•	build
	•	deploy to Pages on main branch

⸻

Assumptions for the AI Agent Building This

The AI agent should assume:
	•	no backend should be introduced unless explicitly requested
	•	MVP must remain GitHub Pages compatible
	•	simplicity is preferred over extensibility when both satisfy requirements
	•	circle regions are enough for MVP
	•	localStorage is enough for MVP unless attempt history becomes unwieldy
	•	scenario files are human-editable and should remain readable
	•	deterministic evaluation is more important than elaborate realism
	•	the tactical framework should be configurable via weight profiles, not rewritten per scenario

⸻

Build Priorities

Phase 1
	•	app shell
	•	scenario manifest loading
	•	board rendering
	•	single draggable player
	•	submit/reset
	•	deterministic evaluator
	•	feedback panel
	•	local progress persistence

Phase 2
	•	progression view
	•	reasoning capture
	•	import/export
	•	richer overlays
	•	content validation UX

Phase 3
	•	authoring helper mode
	•	more scenario packs
	•	better analytics summaries
	•	IndexedDB migration if needed

⸻

Acceptance Criteria for MVP

The MVP is complete when:
	•	app loads from GitHub Pages
	•	user can select a scenario
	•	target player can be dragged
	•	submission returns deterministic score and feedback
	•	alternate-valid moves are supported
	•	reasoning can be captured
	•	progress persists locally
	•	invalid content fails gracefully
	•	build and deploy run automatically

⸻

Open Decisions Left Intentionally Small

These may be adjusted during implementation without breaking the design:
	•	exact rendering library
	•	exact styling system
	•	localStorage vs IndexedDB for attempts
	•	specific folder naming under /public/scenarios
	•	exact difficulty thresholds

These should not delay implementation.