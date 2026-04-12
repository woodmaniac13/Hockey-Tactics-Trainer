# Deployment Guide — GitHub Pages

## Overview

This document defines how to build and deploy the Field Hockey Tactical Trainer as a **static web application** using GitHub Pages.

The application must:
- build into static assets (HTML, CSS, JS)
- require no backend
- deploy automatically on push
- remain compatible with GitHub Pages constraints

---

## Deployment Model

### Hosting
- GitHub Pages (static hosting)

### Build System
- Node-based build (Vite recommended)

### CI/CD
- GitHub Actions

---

## Requirements

### Repository Setup

- repository must have:
  - `main` branch (or configured deployment branch)
  - Pages enabled in repo settings

### Required Files

```text
package.json
vite.config.ts
index.html
/src
/public


⸻

Build Output

The build must produce:

/dist
  index.html
  assets/
  scenarios/
  weights/

All runtime content must be accessible under the deployed root.

⸻

Base Path Configuration

GitHub Pages serves from:

https://<username>.github.io/<repo-name>/

Vite config requirement

export default defineConfig({
  base: '/Hockey-Tactics-Trainer/',
});

Replace with your repo name.

⸻

GitHub Actions Workflow

Create:

.github/workflows/deploy.yml

Example

name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - run: npm ci
      - run: npm run type-check
      - run: npm test -- --run
      - run: npm run build

      - name: Upload Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - id: deployment
        name: Deploy
        uses: actions/deploy-pages@v4


⸻

Enabling GitHub Pages

In repository settings:
	1.	Go to Settings → Pages
	2.	Set:
	•	Source: GitHub Actions
	3.	Save

⸻

Local Development

Run locally:

npm install
npm run dev


⸻

Local Production Build

npm run build
npm run preview


⸻

Static Asset Requirements

Scenarios

Must be available at:

/public/scenarios/

Weight Profiles

/public/weights/

Manifest

/public/scenario-packs.json


⸻

Routing Constraints

GitHub Pages does not support server-side routing.

Rules
	•	use client-side routing only
	•	avoid deep links unless handled properly
	•	fallback to index.html

⸻

SPA Routing Fix (Optional)

If using React Router:

Use hash routing:

<HashRouter>

OR configure fallback properly.

⸻

Cache Considerations

Issues
	•	browsers may cache old scenarios

Solutions
	•	version scenario files
	•	optionally append query string:

scenario.json?v=2


⸻

Performance Guidelines
	•	keep bundle size small
	•	lazy load scenarios
	•	compress assets
	•	avoid large dependencies

⸻

Error Handling

Build Failures
	•	must fail CI pipeline
	•	must not deploy broken build

Runtime Failures
	•	scenario load failure → skip scenario
	•	manifest failure → show error screen
	•	missing asset → fallback gracefully

⸻

Security Constraints
	•	no dynamic script execution from JSON
	•	sanitize all text content
	•	validate imported files strictly

⸻

Offline Behavior

Optional:
	•	support basic offline after load
	•	do not depend on network after initial load

⸻

Versioning Strategy
	•	scenarios include version
	•	app does not auto-migrate scenario logic
	•	local data keyed by version

⸻

Rollback Strategy

If deployment breaks:
	•	revert commit
	•	push fix
	•	redeploy via Actions

⸻

Monitoring (MVP)

Minimal:
	•	console logging
	•	manual QA

Future:
	•	add lightweight telemetry

⸻

Acceptance Criteria

Deployment is successful when:
	•	app loads from GitHub Pages URL
	•	scenarios load correctly
	•	evaluation works
	•	no backend calls occur
	•	refresh does not break app
	•	assets resolve correctly under base path

⸻

Future Enhancements
	•	custom domain
	•	CDN optimization
	•	service worker caching
	•	partial backend integration (optional)

⸻

Final Rule

The deployed app must be:
	•	fully functional without a server
	•	stable under static hosting
	•	resilient to content issues
	•	easy to redeploy via Git push

⸻


