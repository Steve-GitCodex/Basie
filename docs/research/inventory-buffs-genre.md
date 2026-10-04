# Inventory and buff system research (mobile 4X / base builders)

Research input for the Basie inventory/bag and Boosts screens in the Last Shelter-style reskin.
Written 2026-10-03. This is not a design lock. A decision taken from it should go into an ADR.

## Read this first: how much is actually confirmed

Web access in this session was limited. Fandom wikis, appgamer.com and progameguides.com
returned 402/403 to fetches. Search snippets and the guide sites that did load covered
*strategy* (what to spend) far more than *UI* (what the screen looks like). **Almost no source
found describes bag tab layout, detail bars, Use xN sliders or per-stat bonus breakdown
screens.** Those parts are written as **[unverified]** and must be checked in a live client or
with screenshots before any design relies on them. Sections say plainly where nothing was found.

Confidence labels:
**[official]** developer or in-game text. **[secondary]** guide site, wiki or Q&A site (search
snippet or fetched page). **[unverified]** recalled working knowledge with no source in hand;
treat as a hypothesis to check. **[not found]** searched, nothing usable.

## Summary: what matters most for Basie

1. **Same-type timed boosts do not stack; a new one replaces the old one, with a warning.**
   The one Last Shelter datum found: shields cannot be stacked, and the game warns that the
   active shield will be cancelled and replaced ([appgamer, search excerpt](https://www.appgamer.com/last-shelter-survival/answers/15228-why-can-you-not-use-an-8-hrs-shield)) [secondary].
   State of Survival gathering boosts: only one active, most recent wins
   ([search excerpt, calpoly-hosted mirror; weak](https://grandavehousing.calpoly.edu/news/state-of-survival-cheats-2022)) [secondary, low trust].
   A same-genre help center states the same rule in general form (Civilization War, not one of
   our target games): "the new effect duration will be applied, while the previous item's
   remaining time will be reset" ([help center](https://clegames.oqupie.com/portals/1481/articles/28890)) [official, other game].
2. **Standing bonuses are additive within a stat and come from many named sources.** Evony's
   official-style guide wiki: buffs are additive (20% + 10% = 30%), final value is
   `attribute x (buff% + 100%)` ([Evony Guide Wiki](https://evonyguidewiki.com/en/buff_debuff_basic_guide-en)) [secondary].
   RoK guides give the same shape for training speed: kingdom 10% + rune 15% + duke title 10% = 35%
   ([RoK Guides](https://riseofkingdomsguides.com/how-to-use-title-buffs-guide/)) [secondary].
   Basie already has a stat aggregator (ADR 0031), so a "sum by source" view is cheap.
3. **Several games give a dedicated place to buy-and-activate boosts.** Last Shelter has a
   "Boost Center" button at the lower right of the keep view, used to deploy a Peace Shield
   quickly ([search excerpt of a Last Shelter guide](https://www.appgamer.com/last-shelter-survival/answers/15311-does-the-gather-speed-boost-from-al)) [secondary, snippet only].
   State of Survival uses HQ > Settlement Buffs > Development / Combat, activated from an owned
   item or paid for in Biocaps ([search excerpt](https://grandavehousing.calpoly.edu/news/state-of-survival-cheats-2022);
   [second excerpt](https://progameguides.com/guides/state-of-survival-best-way-to-spend-biocaps/)) [secondary].
4. **Speedups are the main bag item class and are consumed at the timer, not in the bag.**
   RoK: select the building, tap the speedup arrows, and the item deducts time from the task
   (search excerpt of [RoK Guides](https://riseofkingdomsguides.com/how-to-get-speedups-in-rise-of-kingdoms/)) [secondary].
   Last Shelter: "tapping on [an in-progress upgrade] and applying any speedups you have"
   ([BlueStacks tips, via search excerpt](https://www.bluestacks.com/blog/game-guides/last-shelter-survival/lss-tips-tricks-en.html)) [secondary].
5. **Quick wins for tone and flow:** speedups come in a general type plus per-activity types
   (build, research, train) in Last Shelter, and "universal or troop-specific" in Whiteout
   (sources below). The bag needs a "compatible with this timer" filter, not one flat list.

---

## A. Inventory / bag

### A1. Tab categories

| Game | What was found | Confidence |
|---|---|---|
| Last Shelter | Item families named in guides: speedups (general plus build/research/train-specific), resource packs ("resource caches"), boosts (gather bonus, shields), and "army supply" bundles bought in a shop. No tab names found. See sources in A3. | [secondary]; tab layout [not found] |
| State of Survival | Buffs live under HQ > Settlement Buffs, not (as far as found) in a bag tab. | [secondary] |
| Whiteout Survival | Item families named: speedups ("universal or troop-specific"), resources, hero XP items, VIP XP, hero shards, exploration manuals, stamina recovery, training boosts ([BlueStacks shop guide](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-shop-guide-en.html); [WoSTools](https://wostools.net/blog/top-tips-new-players-2025)). Tab names not found. | [secondary]; tab layout [not found] |
| Rise of Kingdoms | Item families named: resources, boosters, speed-ups, keys, teleport, rename card and similar ([search excerpt of RoK guides](https://riseofkingdomsguides.com/how-to-get-speedups-in-rise-of-kingdoms/)). Tab names not found. | [secondary]; tab layout [not found] |
| Evony | Only the shop is documented: General Items and Speedup Items categories ([search excerpt](https://evonyguidewiki.com/en)). Chests, bags and boxes "are all equally useless until you open them up" ([MuMu guide](https://www.mumuplayer.com/blog/evony-the-kings-return-guide.html)). Bag tabs [not found]. | [secondary] |
| Lords Mobile, Puzzles & Survival | [not found]. Searches returned unrelated results. Dropped. | n/a |

[unverified] My recollection is that all five show a top tab strip split roughly into
resources / speedups / boosts-buffs / gifts-chests / misc, with a count badge on each item.
Do not design from this until a screenshot confirms it.

Practical reading: every game in the set separates *time items* (speedups) from *stuff that
changes a stat for a while* (boosts) from *currency-like items* (resources). That three-way
split is the only part with consistent indirect support across sources.

### A2. Tile grid vs list, item detail

**[not found]** for all games: no fetched source describes grid-versus-list layout or whether
detail appears in a bottom bar, popover or modal. [unverified] The genre norm I remember is a
tile grid with a quantity badge in the corner, tap to select, and a detail panel with
Use / Use xN. Verify before copying. Basie's existing choice (Buildables Inventory catalog,
tooltip actions on building click) is a separate decision and does not need to match.

### A3. Use, batch flows, speedups

What the sources do support:

- **Speedups are applied at the timer, not in the bag.** RoK and Last Shelter quotes in
  Summary item 4. This means the *timer/queue UI* owns a "choose speedups" dialog filtered by
  compatible type.
- **Speedup type split.** Last Shelter: "general speedups available for any activity and
  specific speedups for just one type" ([search excerpt of BlueStacks LSS tips](https://www.bluestacks.com/blog/game-guides/last-shelter-survival/lss-tips-tricks-en.html)) [secondary].
  Whiteout: "universal or troop-specific" ([BlueStacks WoS shop guide](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-shop-guide-en.html)) [secondary].
- **Players are told to burn speedups, or to hoard them, depending on the guide.** BlueStacks
  for Last Shelter: use them on every task ([LSS tips](https://www.bluestacks.com/blog/game-guides/last-shelter-survival/lss-tips-tricks-en.html)).
  Pocket Gamer for Last Shelter: "Never use your speed-ups in the early stages of the game"
  ([Pocket Gamer](https://www.pocketgamer.com/last-shelter-survival/last-shelter-survival-tips-tricks/)).
  Whiteout: save them for events that score time spent, such as Strongest Chief
  ([WoSTools beginner guide](https://wostools.net/beginners-guide)). **The sources disagree**;
  the practical consequence is that speedups are also an *event currency*, which matters if
  Basie ever adds events.
- **Resource packs fill a task's missing cost.** "Use your resource packs to fill requirements
  when doing a task" ([BlueStacks LSS tips](https://www.bluestacks.com/blog/game-guides/last-shelter-survival/lss-tips-tricks-en.html)) [secondary].
  This hints that the upgrade dialog, not just the bag, offers a "use pack" path.

[not found] Use xN sliders, Use All, auto-pick smallest-first speedups, choose-a-resource
chest flows, hero-XP item targeting UI (the only hero-XP datum: Whiteout gear pieces serve as
XP items worth 10/30/60/150 for Common/Uncommon/Rare/Epic, and "use lower-rarity items first"
to avoid waste, [search excerpt of WoS guides](https://wostools.net/blog/top-tips-new-players-2025) [secondary]).
That advice implies the UI does *not* auto-pick the cheapest item, which is itself a lead:
auto smallest-first would remove the need for the advice. Unconfirmed.

### A4. Sorting, "new" markers, rarity, empty state, shop shortcut

**[not found]** for every game. Nothing fetched covered sort modes, new-item dots, rarity
frames, empty-state copy, or "Get more" links. The closest indirect evidence of a shop
shortcut: State of Survival buffs can be bought with Biocaps *from the buff screen itself* if
you hold no item (see B3). That is a "get more" pattern solved by buy-and-use rather than a
separate link.

---

## B. Buffs / boosts

### B1. Dedicated screen and organization

| Game | Screen | Organization | Confidence |
|---|---|---|---|
| Last Shelter | "Boost Center", button at lower right of the keep view | Not found. Shield deploys from here. | [secondary, snippet] |
| State of Survival | HQ > Settlement Buffs | Two categories: **Combat** (e.g. Peace Flare, 2/8/24 h; troop boosts) and **Development** (build/production speed, gathering) | [secondary] ([progameguides excerpt](https://progameguides.com/guides/state-of-survival-best-way-to-spend-biocaps/)) |
| Rise of Kingdoms | Buffs apply via items, titles, kingdom, runes. A "Buff Sets" feature saves frequently used buffs so they are not engaged one by one. | Not found | [secondary, snippet] ([RoK Guides](https://riseofkingdomsguides.com/how-to-use-title-buffs-guide/)) |
| Whiteout, Evony | Not found | Evony groups by *activation context*, below | [not found] |

Evony's six buff contexts (basic, marching/attacking, in-city, defense, outcity defense,
reinforcing) are a classification of when a buff applies, not a UI tab
([Evony Guide Wiki](https://evonyguidewiki.com/en/buff_debuff_basic_guide-en)) [secondary].
Useful for Basie if march-only and city-only bonuses ever coexist.

The two organizing axes seen are therefore **by effect category** (State of Survival:
Combat vs Development) and **by source** (RoK guides: tech, VIP, titles, runes, kingdom,
commanders). No source shows one screen doing both.

### B2. Timed boosts vs standing bonuses

Timed (activated, expiring): shields and peace flares (2 h up to 30 days in Last Shelter,
[guide excerpt](https://www.appgamer.com/last-shelter-survival/answers/15311-does-the-gather-speed-boost-from-al) [secondary];
2/8/24 h in State of Survival), gathering boosts. State of Survival gathering boosts: lowest costs
100 Biocaps for +50% over 8 h, highest 600 Biocaps for +100% over 24 h
([excerpt](https://grandavehousing.calpoly.edu/news/state-of-survival-cheats-2022)) [secondary, low trust; mirror site, may be copied from another guide].
Last Shelter also sells a 24 h Gather Bonus from the alliance store (search excerpt,
[BlueStacks LSS economy guide listing](https://www.bluestacks.com/blog/game-guides/last-shelter-survival/lss-economy-guide-en.html), though the fetched page did not repeat it) [unverified].

Standing (always on): research, VIP, titles, alliance and territory, heroes.
- State of Survival gathering speed sources: Economic Research, Economy Talent, alliance
  statues up to 10%, alliance territory benefits ([excerpt](https://grandavehousing.calpoly.edu/news/state-of-survival-cheats-2022)) [secondary, low trust].
- RoK VIP: Gathering/Building/Training/Research Speed +5% each at the cited VIP level;
  titles such as Duke give Troop Defense +5% and Training Speed +10%
  ([search excerpt](https://riseofkingdoms.fandom.com/wiki/VIP?oldid=9219); [title guide](https://riseofkingdomsguides.com/how-to-use-title-buffs-guide/)) [secondary].
- RoK commander titles (Ranger, Tax Officer, Supply Captain and others) unlock at power
  thresholds with small bonuses ([RoK Guides](https://riseofkingdomsguides.com/governor-profile-in-rok/)) [secondary].

### B3. Per-stat total breakdown view

**[not found]** in any game. The searches for a "Bonus overview" screen in Last Shelter and
RoK returned nothing that describes one, and the fetched RoK Governor Profile page says
nothing about aggregate bonus layout. The *concept* is supported only indirectly: guides and
calculators add speed from "technologies, commanders, VIP, runes, titles, and other sources"
by hand ([RoK speedup calculator](https://riseofkingdomsguides.com/rise-of-kingdoms-speedup-calculator/)) [secondary],
which suggests players want a sum-by-source readout. Whether the games ship one is
unconfirmed. [unverified] I recall a "Bonus" or "Details" list under the profile in RoK and
Last Shelter; verify with screenshots.

### B4. Stacking rules for same-type boosts

| Case | Rule | Source | Confidence |
|---|---|---|---|
| Last Shelter shield while one is active | No stacking. Warning says the current shield is cancelled and replaced. | [appgamer](https://www.appgamer.com/last-shelter-survival/answers/15228-why-can-you-not-use-an-8-hrs-shield) | [secondary, snippet] |
| State of Survival gathering boosts | One at a time; most recently applied wins. | [excerpt](https://grandavehousing.calpoly.edu/news/state-of-survival-cheats-2022) | [secondary, low trust] |
| Civilization War time-limited items (other game) | Same item re-used: new duration applied, previous remaining time reset. | [help center](https://clegames.oqupie.com/portals/1481/articles/28890) | [official, other game] |
| Different sources, same stat (research + VIP + title + rune) | Additive. | [Evony wiki](https://evonyguidewiki.com/en/buff_debuff_basic_guide-en); [RoK Guides](https://riseofkingdomsguides.com/how-to-use-title-buffs-guide/) | [secondary] |
| Evony rallies and reinforcements | Each participant's buffs apply to their own troops; they do not combine. | [Evony wiki](https://evonyguidewiki.com/en/buff_debuff_basic_guide-en) | [secondary] |
| RoK, Whiteout, Evony item-on-item overwrite | [not found] whether replace, extend or block | n/a | [not found] |

Open point: "replace" is confirmed for shields (Last Shelter) and gather boosts (State of
Survival). Whether a *longer* boost can be overwritten by a *shorter* one, or whether the
dialog offers "extend" instead, is **not confirmed for any target game**. The Civilization
War rule says the shorter one silently wins on duration. Basie must pick its own rule.

### B5. HUD indicators and buy-and-use

- [not found] icons near avatar, countdown format.
- Buy-and-use is supported: State of Survival lets you activate any settlement buff for
  Biocaps if you hold no item, and buffs "start working right after you activate them"
  ([progameguides excerpt](https://progameguides.com/guides/state-of-survival-best-way-to-spend-biocaps/)) [secondary].
  Last Shelter's Boost Center is described only as the place to deploy shields.
- Hoarding advice shows up for boosts too: peace shields are recommended when carrying
  resources above Storehouse protection or while troops heal
  ([WoSTools](https://wostools.net/beginners-guide)) [secondary]. That is a good fit for a
  contextual prompt ("shield?") at the moment of risk.

---

## What to verify next (cheapest first)

1. Screenshots of the Last Shelter Boost Center and bag tabs (the primary reference). Search
   YouTube thumbnails or the Last Shelter fandom wiki images; Fandom was blocked here.
2. Last Shelter overwrite dialog text (the appgamer thread only paraphrases it).
3. RoK item use flow: Use xN slider and Use All behaviour.
4. Any "Bonus" or "Details" screen in RoK or Last Shelter profile.

---

## Patterns worth stealing for Basie

Ranked by value for effort. "Games" lists where there is *some* sourced support.

1. **Replace-with-warning for same-type timed boosts.** One active boost per effect type; using
   another opens a confirm dialog naming what is replaced and its remaining time. Games:
   Last Shelter (shields), State of Survival (gather). Cheap, and unambiguous to implement.
2. **Speedups applied from the timer, filtered by compatible type.** The queue row owns a
   "speed up" button; the dialog lists only general plus matching speedups. Games: Last
   Shelter, RoK, Whiteout (type split). Avoids a bag round trip.
3. **Additive per-stat aggregation shown as sum by source.** Basie's stat aggregator already
   produces this data; a "Bonuses" panel listing each stat with its sources is mostly UI.
   Games: Evony and RoK for additive rules; the breakdown screen itself is unconfirmed in all.
4. **Dedicated Boosts screen with buy-and-use.** Group by effect category (economy vs combat,
   as State of Survival's Development/Combat), show owned count, and let a missing item be
   bought with premium currency in place. Games: State of Survival; Last Shelter (Boost Center).
5. **Resource packs usable from the cost shortfall.** The upgrade dialog offers "use pack" when
   a resource is short. Games: Last Shelter (guide advice only).
6. **Context-triggered shield prompt.** Offer a shield when storage exceeds protection or troops
   are healing. Games: Whiteout (guide advice). Note that Basie is single-player for now, so
   defer until Phase 4 AI factions.
7. **Do not copy blindly:** tab names, grid vs list, Use xN and Use All, sorting, new-markers,
   rarity frames, empty states. No source was found for any of these; decide them from Basie's
   own Buildables Inventory conventions and verify against screenshots before claiming parity.
