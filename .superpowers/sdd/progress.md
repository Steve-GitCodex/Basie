# SDD progress — city ambient life (walkers + drone + truck)

Plan: docs/superpowers/plans/2026-07-23-city-ambient-life-walkers-drone.md
Branch base: ec09f7cf90aa87dd92e023db0196c5c754e6977a
Commit policy: NO commits during execution (Steve commits himself). Assets git-ignored
per repo convention — ambient sprites + jobs-ambient.json live on disk only, reproduced
via the rig. Tree left commit-ready.

- [x] Task 1: rig-render ambient sprites — 6/6 on disk, anchors finite (git-ignored, not committed)
- [x] Task 2: pure path/facing helpers + tests
- [x] Task 3: cityAmbientAssets loader
- [x] Task 4: drone road-path + dock/truck state
- [x] Task 5: sprite drawing + fallbacks
- [x] Task 6: CityRenderer wiring + truck interleave
- [x] Task 7: docs

## Minor findings (for final review triage)

Task 6 visual verification (controller): truck renders as a graded van parked on the road;
walkers render as graded survivor figures (not blobs); drone renders as a graded ship with
scan-beam + ground shadow, following the road path (dock 5.5,7.5 → far, 27-cell path).
boot-smoke PASS, ambient assets loaded {walkers:4,drone:true,truck:true}.

## Final whole-branch review (opus) — CLEAN (no Critical/Important)
Minors:
- [FIXED] _droneT unbounded accumulator → added `_droneT %= span*2` guard in update().
- [ACCEPTED] WALKER_SPRITES has 4 but WALKER_COUNT=3 → survivor_shaun is a spare pool entry
  (unused today; ready if walker count grows). Harmless.
- [ACCEPTED] walker(i) negative-safe modulo is over-defensive (i always >=0). Cosmetic.
- [x] Task 7: docs
