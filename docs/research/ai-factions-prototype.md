# AI factions — P1 brain-simulator findings

Research input from a throwaway prototype, written 2026-10-09. It is not a design lock. Decisions taken from it go
into ADRs. The script is preserved at `docs/research/ai-brain-sim.mjs` (run: `node docs/research/ai-brain-sim.mjs`). It was a single Node file with no game
code: 9 regions on a 3×3 grid, 3 majors, generated minors, a director budget, a scripted player (aggressive / mixed /
peaceful profiles, online 08–09, 13–13:30, 20–22 daily) and power growing from 1,000 to about 25,000 over 30 days.

## What the sim validated

- **Utility scoring with personality weights produces distinct factions.**
  - Red Talon (aggression 1.0) assaults 13–16 times in 30 days, and its standing sinks to Unfriendly.
  - The Scavengers (opportunism 1.0) send about 20 gifts, and they are the only faction that betrays.
  - The Iron Covenant (patience and expansion) builds trust to the cap and only strikes by *coveting* a region when
    the player out-expands it.
- **The defense model works as option 4 intended.**
  - Fortification absorbs small strikes.
  - Assaults are held when the player reinforces and lost when they don't.
  - A mixed player went from 1 to about 6 regions over 30 days with 3–4 losses out of 8 captures. Taking regions felt
    like holding ground, not a ratchet.
- **Foreshadowed betrayal reads as fair.** There were 3–6 foreshadows and 0–2 betrayals per 30 days. Every betrayal
  had at least 6h of visible warning.
- **The minor lifecycle pacing is right.** Camp → settlement → stronghold took about 3.5 days at 0.05–0.11 share per
  day. Most were cleared by the player. The ones left alone became strongholds.

## Failure modes found, and the rule each one implies

1. **Without per-action cooldowns, the AI spams the cheapest top action.** Unpatched, one faction sent about 100
   tribute demands in a day. Rule: every action has a cooldown, and repeating the last action carries a ×0.6 penalty.
2. **Compounding strength snowballs.** When `gather`/`fortify` multiplied strength, it reached 44× player power.
   Rule: faction strength is a band around a target taken from player power (`ratio × territory × (1 + bonus)`,
   bonus in −0.4…+0.3, decaying toward 0). Actions move the bonus and never compound strength.
3. **Filler actions win by default.** Before idle had a floor score and fortify a cooldown, `fortify` won about 2,500
   times. Rule: there is an explicit `idle` action (score 0.05), and every filler action has a cooldown.
4. **Territory snowballs too.** At +12% per region with no cap, the Covenant reached 2× player power and took
   everything. Rule: cap the territory bonus at 3 regions (overextension). Strike size never exceeds the director
   budget.
5. **Telegraphs launched while offline pile up.** A countdown was live 56% of the time, and the one-hostile cap
   then blocked all AI. Rule: hostile plans chosen while the player is offline are *queued*. On login, only the most
   aggressive queued faction telegraphs, with a countdown of at least 45m. The others re-plan.
6. **Attacks the AI can't win are noise.** 67 of 74 raids bounced off fortification. Rule: the AI estimates the
   outcome (known fort plus its *remembered* reinforce rate) and only launches strikes it expects to land.
7. **Adaptation without probing gets stuck.** A 50% prior meant Red Talon never attacked and so never learned.
   Rule: use an optimistic prior (`(reinforced + 0.25) / (seen + 1)`), so the AI tests your defenses and then learns
   from the result.
8. **Pressure never lets up.** Without a calm period after each strike, a countdown was live for 57–64% of online
   time. Rule: the director imposes calm after a strike (4h after a raid, 12h after an assault).
9. **Betrayal rolled on every think is far too common.** It happened 15 times in 30 days. Rule: at most one
   foreshadow roll per faction per day, only when trust < 20, with ≥ 6h of visible foreshadow before a betrayal is
   possible and a 2-day expiry.
10. **Periodic diplomacy feels mechanical.** Gifts arrived exactly once a day, and one faction demanded tribute then
    sent a gift 7 minutes later. Rules:
    - one shared diplomacy cooldown, jittered ×0.7–1.8;
    - gifts require standing ≥ −10;
    - a demand needs a *motive* (the faction is short on resources, or you took something from it in the last day).

## Still open (tuning, not design)

- **Countdown time is spent from online time.** The player is online about 3.5h a day, and strikes wait for login,
  so a 3h assault countdown fills most of a session. Online time under a countdown stayed at 53–75%. Plan to shorten
  assault countdowns to 60–90m and allow at most one assault per day.
- **Raids vanished once the AI only launches winnable strikes**, because binary win/lose raids rarely beat
  fortification. A raid should take loot in proportion to its margin over defense, so small raids still mean
  something and the AI expects some value from them.
- **A peaceful player gets almost no pressure**: 2 strikes in 30 days and a 23-day quiet gap. Major factions
  rightly leave a peaceful neighbour alone. The director's quiet-time failsafe must therefore be served by
  **events** (rebel raids on the home base, world threats), not by faction intent.
- **There's too little fighting between AI factions.** About 1 region changed hands between factions in 30 days, so
  the map looks static between them. Relax the rival gate.
- **Gift volume is high**, at 40+ per month across factions. Gifts should need a motive, like demands do (appeasing
  a strong player, returning a favour).

## Starting constants (carry into `factions.js` / director data)

| Constant | Value |
|---|---|
| Think cadence | 7m + 0–3m jitter. A faction doesn't think while it has an active plan. |
| Top-band random pick | any action within 12% of the best score |
| Cooldowns (h) | gift 24 · truce 48 · demand 24 · scout 6 · gather 6 · fortify 8 · claim 4 · rival 8 · raid 3 · assault 12. The diplomacy cooldown (24h) is shared and jittered. |
| Countdowns | raid 15m · assault 180m (→ retune to 60–90m) · claim 60m · rival 120m · on login ≥ 45m |
| Director | budget +0.03×pp/h × cycle multiplier, cap 1.5×pp. Cycle: build-up 1.2d ×1 → peak 0.6d ×2 → calm 1.2d ×0.3. Failsafe after 4 quiet days. |
| Defense | fort 0.3×pp · reinforce +0.9×pp · reinforce rate when seen 0.75 (a player assumption) |
| Strength band | majors `ratio` 0.7–1.0 × territory (+12% per region, max 3) × (1 + bonus ∈ −0.4…+0.3) |
| Minors | cap 3 alive · spawn every 2–4d · start 0.05×pp · settlement 0.2 · stronghold 0.45 · growth 0.05–0.11/day by archetype |
