# Hockey Tactics Trainer

A browser-based field hockey tactical positioning trainer. Players are presented with a scenario, drag the target player to what they think is the best position, and receive immediate scored feedback based on tactical principles.

Runs entirely in-browser as a static site — no backend, no login, no cloud dependency.

**[Play online → woodmaniac13.github.io/Hockey-Tactics-Trainer](https://woodmaniac13.github.io/Hockey-Tactics-Trainer/)**

---

## Quick Start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

Type-check:

```bash
npm run type-check
```

Tests:

```bash
npm test           # watch mode
npx vitest run     # single run
```

---

## Architecture Overview

The app is a **static React SPA**. All logic runs client-side.

| Layer | Responsibility |
|---|---|
| `src/board/` | Interactive pitch canvas — renders entities, regions, handles player drag |
| `src/evaluation/` | Evaluation engine — scores a player position against a scenario |
| `src/feedback/` | Generates human-readable feedback from evaluation results |
| `src/progression/` | Tracks scenario completion and manages unlock state |
| `src/storage/` | localStorage persistence for progress, attempts, and settings |
| `src/scenarios/` | Scenario loading and content manifest parsing |
| `src/components/` | Shared UI components |
| `src/pages/` | Top-level page views |
| `src/types/` | All shared TypeScript types |
| `src/utils/` | Geometry utilities (distance, angle, perpendicular, etc.) |
| `public/scenarios/` | Static scenario JSON files, organized by category |
| `public/weights/` | Weight profile JSON files + `weights-manifest.json` |

**Evaluation pipeline (strict order):**
1. Input validation
2. Constraint evaluation
3. Tactical component scoring (support, passing lane, spacing, pressure relief, width/depth, cover)
4. Region scoring
5. Alternate-valid determination
6. Reasoning bonus
7. Final weighted score (normalized at runtime if weights don't sum to 1.0)
8. Feedback generation

---

## Repository Structure

```
Hockey-Tactics-Trainer/
├── public/
│   ├── scenarios/          # Scenario JSON files by category (build-out, defence, attack, transition)
│   └── weights/            # Weight profile JSON files + weights-manifest.json
├── src/
│   ├── board/              # Pitch canvas and player interaction
│   ├── components/         # Shared UI components
│   ├── evaluation/         # Evaluation engine (evaluator.ts)
│   ├── feedback/           # Feedback text generation
│   ├── hooks/              # React hooks (e.g. useIsMobile)
│   ├── pages/              # Page-level views
│   ├── progression/        # Unlock and progression logic
│   ├── scenarios/          # Scenario loading and manifest parsing
│   ├── storage/            # localStorage read/write
│   ├── test/               # Unit and integration tests
│   ├── types/              # Shared TypeScript types (index.ts)
│   └── utils/              # Geometry helpers
├── docs/                   # All documentation (see docs/index.md)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Documentation

Full documentation index: **[docs/index.md](docs/index.md)**

Key documents:
- [Design Document](docs/design/design-document.md) — product vision and scope
- [Evaluation Engine Spec](docs/specifications/evaluation-engine-specification.md) — scoring logic
- [Scenario Schema](docs/specifications/scenario-schema-definition.md) — scenario JSON format
- [Weight Profile Spec](docs/specifications/weight-profile-spec.md) — weight profiles and normalization
- [Scenario Authoring Guide](docs/guides/scenario-authoring-guide.md) — how to write new scenarios
- [Deployment Guide](docs/guides/deployment-guide.md) — GitHub Pages deployment

---

## Technology Stack

| Tool | Role |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Vitest | Unit testing |
| Zod | Runtime schema validation |
| GitHub Pages | Hosting |

---

## Key Design Decisions

- **Static-only:** No backend. All evaluation, scoring, and persistence is client-side.
- **Data-driven content:** Scenarios and weight profiles are JSON files. No code changes needed to add content.
- **Constraint-based evaluation:** Players are not scored on exact coordinates. Tactical principles (angles, lanes, spacing) drive the score.
- **Multiple valid solutions:** The `ALTERNATE_VALID` result allows correct positions that fall outside authored regions.
- **Polymorphic regions:** Scenario regions support circle, rectangle, polygon, and lane shapes. The legacy `{ x, y, r }` circle format remains valid.
- **Runtime weight normalization:** Weight profiles may use raw weights; the evaluator normalizes them and emits a warning.

---

## How to Add a Scenario

1. Copy an existing scenario from `public/scenarios/<category>/`.
2. Give it a unique `scenario_id` and adjust fields.
3. Add it to the appropriate category entry in `public/scenarios/content-manifest.json`.
4. Run the app locally and verify scoring, feedback, and rendering.
5. Commit and push — GitHub Pages deploys automatically.

See [Scenario Authoring Guide](docs/guides/scenario-authoring-guide.md) for full details.

---

## How to Add a Weight Profile

1. Create `public/weights/<profile_id>.json`.
2. Add the `profile_id` to `public/weights/weights-manifest.json`.

No code change required. The app discovers and loads the new profile automatically.

See [Weight Profile Spec](docs/specifications/weight-profile-spec.md) for the schema.

---

## Build and Deployment

```bash
npm run build      # outputs to dist/
```

Deployed automatically to GitHub Pages on push to `main` via GitHub Actions.

See [Deployment Guide](docs/guides/deployment-guide.md) for details.

---

## Repository

[github.com/woodmaniac13/Hockey-Tactics-Trainer](https://github.com/woodmaniac13/Hockey-Tactics-Trainer)
