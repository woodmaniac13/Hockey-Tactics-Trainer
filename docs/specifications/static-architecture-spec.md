# Static Architecture Specification

## Overview

This document defines the architecture of the Field Hockey Tactical Trainer as a **static, client-only web application**.

The system is designed to:
- run entirely in the browser
- be deployed on GitHub Pages
- require no backend services
- remain deterministic and content-driven

---

## Architectural Principles

- **Static-first**: no server required
- **Deterministic**: same input → same output
- **Modular**: clear separation of concerns
- **Content-driven**: behaviour driven by JSON files
- **Fail-safe**: invalid content does not crash the app
- **Lightweight**: optimized for fast load and responsiveness

---

## High-Level Architecture

```text
Browser Runtime
 ├── App Shell (React)
 ├── Board Renderer
 ├── Scenario System
 │    ├── Manifest Loader
 │    ├── Scenario Loader
 │    └── Schema Validator
 ├── Evaluation Engine
 ├── Feedback Engine
 ├── Progression Engine
 ├── Persistence Layer
 └── Import/Export Module


⸻

Module Breakdown

1. App Shell

Responsibilities
	•	application routing (if any)
	•	layout structure
	•	state orchestration
	•	error boundaries

Requirements
	•	must not block rendering if scenarios fail to load
	•	must handle loading states gracefully

⸻

2. Board Renderer

Responsibilities
	•	render pitch
	•	render players and ball
	•	handle drag interactions
	•	render overlays after submission

Requirements
	•	smooth dragging (target ~60fps)
	•	support responsive resizing
	•	restrict movement within pitch bounds

Entities Rendered
	•	ball
	•	teammates
	•	opponents
	•	target player (highlighted)

⸻

3. Scenario System

3.1 Manifest Loader

Loads:

/public/scenario-packs.json

Responsibilities
	•	list available scenarios
	•	group by category
	•	handle missing or invalid entries

⸻

3.2 Scenario Loader

Responsibilities
	•	fetch scenario JSON
	•	validate schema
	•	normalize data

Requirements
	•	must not crash on invalid JSON
	•	must skip invalid scenarios safely

⸻

3.3 Schema Validator

Responsibilities
	•	validate scenario structure
	•	enforce required fields
	•	ensure coordinate validity

Implementation
	•	use runtime schema validation (e.g. Zod)

⸻

4. Evaluation Engine

Defined in:
	•	evaluation-engine-spec.md

Responsibilities
	•	compute tactical score
	•	classify result
	•	ensure determinism

Requirements
	•	no randomness
	•	fast execution (<100ms)
	•	stable outputs

⸻

5. Feedback Engine

Responsibilities
	•	convert scores into human-readable feedback
	•	generate:
	•	positives
	•	improvements
	•	tactical explanation

Inputs
	•	evaluation results
	•	scenario metadata
	•	reasoning input

⸻

6. Progression Engine

Responsibilities
	•	track user progress
	•	unlock scenarios
	•	recommend next scenarios

Inputs
	•	stored attempts
	•	scenario difficulty
	•	scenario tags

⸻

7. Persistence Layer

Responsibilities
	•	store and retrieve local state

Storage Options

MVP
	•	localStorage

Optional
	•	IndexedDB

⸻

Stored Data

{
  "scenario_id": "S01",
  "version": 1,
  "best_score": 85,
  "last_score": 80,
  "attempt_count": 3
}


⸻

Requirements
	•	handle corrupted data gracefully
	•	support versioning
	•	allow reset without breaking app

⸻

8. Import / Export Module

Responsibilities
	•	export progress as JSON
	•	import progress from JSON

Requirements
	•	validate imported data
	•	avoid overwriting incompatible versions
	•	provide user confirmation before overwrite

⸻

Data Flow

Scenario Load Flow

App Load
 → Load Manifest
 → Select Scenario
 → Fetch Scenario JSON
 → Validate Schema
 → Render Board


⸻

Evaluation Flow

User Moves Player
 → Submit
 → Evaluation Engine
 → Feedback Engine
 → Display Results
 → Save Progress


⸻

State Management

State Types

UI State
	•	current scenario
	•	player position
	•	drag state
	•	feedback visibility

Data State
	•	loaded scenarios
	•	weight profiles
	•	progress data

⸻

Recommended Approach
	•	lightweight state (React state or simple store)
	•	avoid heavy global state libraries unless necessary

⸻

File Structure (Expected)

/src
  /components
  /board
  /evaluation
  /feedback
  /scenarios
  /storage
  /utils
  /types
  /pages

/public
  /scenarios
  /weights
  /assets
  scenario-packs.json


⸻

Performance Requirements
	•	scenario evaluation <100ms
	•	drag interaction smooth at 60fps
	•	initial load under reasonable size (~<1–2MB ideal)
	•	lazy-load scenarios where possible

⸻

Error Handling Strategy

Scenario Errors
	•	skip invalid scenarios
	•	log errors
	•	notify user minimally

⸻

Runtime Errors
	•	catch exceptions in evaluation
	•	fallback to safe response
	•	never crash UI

⸻

Storage Errors
	•	detect corrupted data
	•	reset only affected store
	•	notify user if needed

⸻

Determinism Requirements

All modules must:
	•	produce consistent outputs
	•	avoid non-deterministic APIs
	•	use fixed precision calculations

⸻

Security Considerations
	•	no external script execution from scenarios
	•	validate all imported JSON
	•	do not trust user-imported data
	•	sanitize displayed text

⸻

Accessibility Requirements
	•	buttons must be keyboard accessible
	•	sufficient color contrast
	•	clear labels
	•	no reliance on color-only indicators

⸻

Build & Deployment Constraints
	•	must compile to static assets
	•	no server dependencies
	•	must run fully offline after load (except initial fetch)

⸻

Extensibility

Future additions may include:
	•	backend sync
	•	multiplayer scenarios
	•	richer authoring tools
	•	advanced analytics

These should not break:
	•	static deployment
	•	deterministic evaluation
	•	scenario schema

⸻

Assumptions
	•	scenarios are trusted but validated
	•	users may have no internet after initial load
	•	performance must remain acceptable on mid-range devices
	•	bundle size should remain controlled

⸻

Build Priorities

Phase 1
	•	scenario loading
	•	board rendering
	•	evaluation engine
	•	feedback display
	•	persistence

Phase 2
	•	progression system
	•	reasoning capture
	•	overlays

Phase 3
	•	authoring helpers
	•	import/export improvements

⸻

Acceptance Criteria

The architecture is complete when:
	•	app runs fully from static hosting
	•	no backend required
	•	scenarios load correctly
	•	evaluation is deterministic
	•	UI remains responsive
	•	invalid data does not crash the app

⸻


