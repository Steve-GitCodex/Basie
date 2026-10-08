# 0042 — Shared panel frame for dock modals

Date: 2026-10-07 · Status: accepted · Related: ADR 0039 (Inventory modal), ADR 0040 (Mail hub)

## Context

Mail and Inventory are both opened from the dock and swap into each other through `swapModal`, but each sized its own
frame. Desktop: Mail was 920px × 75vh, Inventory 980px × min(78vh, 640px). Phone: Mail went full-screen, Inventory stayed
a 95vw card. Switching between them resized and moved the frame, so it felt like changing screens rather than tabs.

## Decision

One frame for every dock panel modal, defined once in `css/components/modals.css` from two tokens in `variables.css`:
- Desktop: `--panel-modal-w: min(960px, 95vw)`, `--panel-modal-h: min(80vh, 680px)`, centered.
- At 700px and below: fixed, full width, from the top edge down to `--dock-clearance`, so the floating dock sits below the
  panel instead of covering it.

The panel's own CSS (`mail.css`, `inventory.css`) only lays out its contents and never sizes the host.

## Consequences

- A new dock panel joins by adding its host class to the shared selector in `modals.css`.
- Mail drops its per-list dock padding and Undo-toast offset; Inventory becomes full-height on phones.
- `mail-smoke.mjs` asserts Mail and Inventory have the same `#modal-content` rect at 1280×720 and 360×640.
