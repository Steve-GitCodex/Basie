# 0058 — Prototype gallery in the dev dashboard; mockup screenshots stay out of git

**Date:** 2026-10-09. Extends ADR 0032.

## Context

Steve reviews many mockups and prototypes and wanted one place to open them, reached from the dev dashboard. He does not
want screenshots committed.

## Decision

- The dev dashboard gets a **Prototypes** section. Its "Open prototypes ↗" link opens `docs/10-design/mockups/index.html`
  in a new tab: a gallery driven by `mockups/catalog.js`, with every card opening in a new tab.
- Every mockup must have a catalog entry. `tests/unit/mockupCatalog.test.js` fails on unlisted pages and missing files.
- Every image under `docs/10-design/mockups/` is git-ignored, along with `_verify/`, `ui-reference/` and
  `.playwright-mcp/`. Prototypes are self-contained HTML with relative paths.

## Consequences

- A fresh clone shows prototypes without their screenshot backgrounds. That is accepted.
- Covered by `tests/browser/dev-dashboard-smoke.mjs` (4 checks).
