# Witch Hunter — Unreal Engine 5 Port Blueprint

Status: LOCKED PLANNING (Phase 0) · 2026-10-20
Owner: IO (technical director) · Engine decision pending Nicko (pin + repo name — see §13)
Rule zero: the browser Witch Hunter prototype at /workspace/witch-hunter stays live the
whole time. The playtest surfaces (8787 WebUI playtest, 8793 phone surface, the
/tmp/wh-worldfeat worktree) are never touched by port work.

---

## 1. Mission (Nicko's ruling, 2026-10-20)

Port what we have into a REAL Unreal Engine 5 open-world PC game, taking advantage of
UE's plugin ecosystem (PCG, lighting, streaming, retargeting, VFX). This document is the
blueprint; the repo scaffold + deterministic exporters are Phase 0 deliverables; the
phased checklist (§9 + docs/phases/) is fired one phase at a time in later sessions.

## 2. What exists today (verified in-repo, 2026-10-20)

Source of truth for world data: prototype/js/CONFIG.js on the feat/world-visuals line
(tip b01e764, CC-C16 den flip + densify; worktree /tmp/wh-worldfeat mirrors it).

World (4 regions + boundary):
| Region | Content in CONFIG.js | Port notes |
|---|---|---|
| A — Darkwood graveyard | 133 prop rows, church gate, boundaryWall ring r 87.5 (seed 20261006), graveyard dressing | set-dressed static map chunk |
| B — Darkwood edge | 62 prop rows, cemetery, tents, tutorial camp, chokepoint crossing to C | set-dressed + tutorial flow |
| C — Forest of the Old King | 192 prop rows on the S=140 heightfield (seed 1337, hMax 5, 560 m plane), rim mountains (peakH 34) + 3 blocker notches + door notch, King's Roads (spine/ring/branches), stone shrine assembly, scatter (seed 20261005) | UE Landscape + PCG biomes (P3) |
| D — Rot Mother's den | 34 rows; den centre (-185.8,-180.2) world, cave mouth sunk into the SW rim, mouth faces map centre (C15/C16 rulings) | hidden pocket region, set piece |

Enemies (prototype/js/enemy.js): bandits (AI1 orbit/strafe/guard), ghouls (lunge hop),
wolves (7 packs +4 in C16 = densified map, loop patrol, pack-pulls-pack, night boldness),
Rot Mother boss (slam + poison + minion spawns at lair).

Player combat (EPR1, dev commit 3f509e7): lock-on, 3-hit combos, parry/riposte,
sword/axe/dagger/shield kits, caster mode (firebolt), roll + stamina, hit stagger,
corpse loot. The EPR1 parity harness (scratch/erparity) is the combat reference.

Systems: cooking (3-ingredient recipes + buffs), camp kit (place, save/load/save-and-heal,
dusk/night-gated sleep), day/night clock (100-min cycle), gathering, inventory, leveling,
save v1, HUD.

Asset corpus (art-direction/3d/assets, feat worktree): **324 GLBs, 7,290,945 tris
total**, art law = raw mesh as-is + 512 px NEAREST + 5-bit-per-channel posterize bakes.
Class census (see artifacts/ue-port/ASSET_MANIFEST.csv for every row):
prop-biome 102 · raw (non-ingestible sources) 54 · church-kit 34 · char-legacy 26 ·
weapons 22 · old-king 18 · char-rigged 17 (retarget lane) · armor 16 · char-static 13 ·
crypt 10 · graveyard 8 · camp 4.
Rigged characters carry their own clips (hunter male 6–43 clips across rig variants incl.
combat-sword's 43, ghoul 13 incl. zombie set, wolf 6 wolf-authored clips). Rot Mother's
regen bake races_regen/rotmother.glb is a 182,444-tri monolith (browsed budget note in §12).

## 3. Prior art on main (shelved 2026-09-16 spec set) — reconciliation

main carries docs/planning/30-remote-ue5-pipeline.md and 52–58 (core/combat/world
streaming/AI spawning/data ledger/UI-presentation UE5 architecture specs) from the
pre-pivot era. The UE5.8 doc set is RECONCILED into this plan, not re-derived:

| Prior ruling | Status in this port |
|---|---|
| Repo shape WHGame.uproject + Source/WHGame + ue/ python + manifests/ | KEPT (mirrored in §14) |
| UE 5.8 pin (docs 52/53 wrote against UE5.8) | KEPT — 5.8 is the current stable (shipped 2026-06; Lumen Lite Beta in). The mission's "5.4+/5.5 preferred" baseline is superseded by 5.8 = same features + PCG Biome Core/Sample as first-party plugins |
| Custom combat component, GAS deferred | KEPT (doc 54; P4) |
| UMG HUD minimum, 8-widget class map, doc 32 visibility, pixel register post chain (doc 34/MF_WHPixelRegister) | KEPT (P8; the pixel register is part of the P1 visual gate) |
| GLB import pipeline (doc 30, three planes, WH_Socket_* contract from doc 54) | KEPT (P2) |
| Doc 58's "108-GLB verified corpus manifest" + UP-2 (46-vs-108 count) | SUPERSEDED — the real corpus is 324 GLBs (census above); UP-2 closes. ASSET_MANIFEST.csv is the new ledger |
| Remote Control control plane to Nicko's PC (doc 30, RemoteUE runner) | KEPT as the P1+ execution path (no UE editor on the VPS, ever) |
| World streaming spec (doc 55) | KEPT (P3, re-based onto World Partition + PCG as ruled here) |

## 4. Engine baseline

- **Version: UE 5.8** (current stable). Fallback if Nicko prefers the older pin: 5.5/5.6
  still works — PCG + World Partition + Interchange + Lumen are present since 5.4/5.5;
  the Biome Core/Sample plugins differ (sample is 5.8-era; on 5.6 use plain PCG graphs +
  the PCGLayeredBiomes community plugin as the alternates). Decision needed (§13).
- **Project**: Blank C++ (`WHGame`), no starter content.
- **World Partition: ON** — open-world grid 512 m, HLOD layer enabled.
- **Nanite: OFF** (project-wide default off). The art is deliberately low-poly pixelated;
  Nanite's cluster/cupped-surface shading fights the 5-bit bake look and wastes memory on
  2k–180k-tri meshes. Tri budget discipline stays a manifest audit, not a Nanite crutch.
- **Lumen: ON.** Hardware ray tracing if Nicko's GPU supports it (decision at P7 setup);
  software GI as the guaranteed floor. **Lumen Lite** (5.8 Beta) is the low-cost profile
  candidate for the pixelated look — profile in P7, do not block on it. Transparent
  surfaces and pixelation chain interplay probed in the P1 gate first.
- **Enhanced Input: ON** (P4). **CommonUI: adopt for input-conditional UI**; the HUD
  minimum stays plain UMG per doc 58 (CommonUI layered in when gamepad/UI stack grows).
- **VSM or CSM at P7** with Lumen, per-region lighting presets.

## 5. THE ART-LAW CARRIER (the single visual gate — prototype FIRST)

The in-engine look matches the baked discipline on ALL content:

1. **Pixel register post-process material** `MF_WHPixelRegister` (doc 34/58 lineage):
   SceneTexture sampled on a stepped UV grid (screen quantized to a fixed register
   size), then 5-bit-per-channel quantize `floor(c*31)/31` (optionally with the doc 34
   ordered-dither offset before quantize). Implemented as a post-process material
   blendable on a test map. This is gate **G-P1-1**: side-by-side against a
   prototype v8 render; band histogram check on a color ramp; no shimmer on slow pans.
2. **Nearest texture filtering group** — an LOB/TextureGroup profile
   (`WH_Pixel8`, Group 27 slot or project setting) forced on every imported texture;
   Interchange import presets carry it so imports cannot drift.
3. No auto-generated geometry LODs, no Nanite, no normal-map generation from bakes
   (law: raw mesh as-is). LODdness comes from distance fade only if playtest asks.

The P1 acceptance is THIS gate. World/gameplay content in later phases is not approved
until the gate map reproduces the prototype look.

## 6. Asset pipeline (P2)

- **Ingest: Interchange glTF importer** (built-in since 5.4). Verified external fact:
  Interchange truncates skeletal weights to 4 influences/vertex — our rigs are 21–28
  joints and 4 influences are already the bake-time maximum, so no loss.
- **Per-class decisions** live in scripts/lib/manifest-rules.js and are materialized in
  artifacts/ue-port/ASSET_MANIFEST.csv (324 rows): import-as-is 238, retarget 17,
  block 69 (raw pre-pixelate sources + the ok-fence-corner v1/v3 QA-fail lineage).
- **Retarget lane**: IK Rig + IK Retargeter ONLY where needed. Important correction to
  the early assumption: every rigged GLB already carries its own authored clips
  (WH_* humanoid clips on each rig, WH_Wolf_* on the wolf), so the DEFAULT is direct
  per-skeleton import as standalone Animation Blueprints. IK Retargeter (onto a
  WH_Manikin rig from the mixamo.glb base) is adopted only if we want cross-kit clip
  sharing; Control Rig is the fallback if retargeting is lossy (wolf quadruped is the
  likely risk).
- **Import settings by class** (encoded in the manifest): nearest filtering group,
  Nanite off, no LOD generation, no auto-collisions (collisions authored in UE per
  class: PCG scatter gets trunk-capsules/proxy collisions; set dressing gets
  simple-convex/complex-as-specified).
- **old_king kit (18 GLBs, 242,801 tris)**: baked 10-20 but never wired into the browser
  (tri budget). The UE port ingests ALL of it in P2 — farm kit, ruin kit, oak/pine trees.
  The farm kit ships WITHOUT ok-fence-corner v1/v3 (3x visual-QA fail); v2 is wired in
  the browser and ingests fine.
- **Rot Mother**: the races_regen bake is 182,444 tris in one static shell. Import
  as-is (law), but flag for a mid-poly split decision if the editor chokes in P2 —
  that would be an art-side re-bake, decided with Nicko at the P2 gate.

## 7. World building (P3)

- **Landscape**: region C heightmap exported from THE GAME'S OWN MATH:
  scripts/dump_heightmap.js requires wh-ground.js CORE, rebuilds the S=140 lattice,
  proves identity via the game's FNV-1a gridHash (7ca52bd3 == CONFIG.regionC.terrain.gridHash,
  enforced — the dump aborts on mismatch), then samples the analytic field heightA on a
  1009x1009 grid → 16-bit PNG + meta (artifacts/ue-port/regionC_heightmap_1009x1009.png).
  Import as one 16x16-component landscape (63-quad sections). Landscape Z span and
  orientation (row 0 = north, z_world -646) are in the meta; verify the den-mouth sink
  and stone pad on import against the CONFIG coordinates before walking it.
- **Regions A/B/D**: set-dressed static maps on flat ground; A's boundaryWall ring
  (r 87.5, seed 20261006) becomes a landscape skirt ring + blocker volumes.
- **World Partition**: single persistent level, 512 m grid; landmark-to-cell mapping in
  docs/phases/P3 (church gate, chokepoint, stone shrine, den cavern, camps, wolf pack
  loops all carry config coordinates + the UE axis conversion X_ue=X_web, Y_ue=up,
  Z_ue=-Z_web).
- **PCG**: three biome graphs (Darkwood graveyard/edge, Forest of the Old King, Rot den
  surround) seeded from CONFIG.scatter (seed 20261005) + the biome_library tree classes;
  road-edge dressing reads the King's Roads rows from the dump; rock outcrops + ruin
  clusters from regionC prop rows. Epic's PCG Biome Core + Biome Sample (first-party,
  5.8) are the reference implementation (sample flagged Experimental: read + mirror its
  patterns into our own graphs, do not ship the sample plugin's content).
- **Notches**: the 4 rim notches (north/east/west blockers + door) are landscape-carved
  + blocker volumes replicating wh-ground holdAtNotch behavior (P3), so the King's Roads
  mouths stay the only ways through the rim.
- **Data law**: every prop/enemy/road coordinate comes from artifacts/ue-port/
  CONFIG-dump.json (dumped from CONFIG.js verbatim, 155 KB, all 4 regions) — the
  blueprint is built from the game's numbers, never from memory.

## 8. Gameplay mapping table (feeds estimates)

| Browser file | UE equivalent | Complexity | Phase |
|---|---|---|---|
| player.js + moveset + combat (EPR1) | AWHCharacterPlayer (C++) + AWHCombatComponent + Enhanced Input; custom combat component (GAS deferred, doc 54) | L | P4 |
| anim.js / animRt config | Animation Blueprints + state machines per rig; retarget lane per §6 | M | P2/P4 |
| lockOn (CONFIG.lockOn) | UWHLockOnComponent (camera + target pick) | S | P4 |
| spells.js (firebolt/caster) | UWHCastComponent + Niagara firebolt actor | S | P4 |
| enemy.js | AWHEnemyBase + AWHBandit/WHGhoul/WHWolf/WHRotMother; lightweight FSM (C++) — no BT yet | L | P5 |
| wolf packs (packId, loops, pack-pulls-pack) | AWHWolfPackManager (subsystem holding pack table from dump) | M | P5 |
| Rot Mother den set piece | AWHRotMother + den level dressing from regionD rows + minion spawner | M | P5 |
| cooking.js | UWHCookingSubsystem + Recipe DataTable + cook UI (UMG) | S | P6 |
| camp.js | AWHCampKitActor + placement ghost + sleep gate (dusk/night) | M | P6 |
| save.js (save v1) | UWHSaveGame (schema v2; carries config dump version hash) | M | P6 |
| daynight.js | AWHDayNightManager (DirectionalLight + SkyAtmosphere + Lumen presets; 100-min cycle) | S | P6, presets in P7 |
| inventory.js | UWHInventoryComponent + Item DataTables | M | P6 |
| leveling.js | UWHLevelingComponent (XP curve from CONFIG rows) | S | P6 |
| hud.js | UMG HUD per doc 58 (8-widget class map) | M | P8 |
| lightSockets/lightPool | Lumen-friendly light actors + IES-less pixel lights batched | M | P7 |

## 9. Phase plan & estimates (editor-hours, on Nicko's PC unless noted)

| Phase | Scope | Est. (h) | Where |
|---|---|---|---|
| **P0** (DONE this session) | blueprint + scaffold + exporters + manifest | 0 | VPS |
| **P1** | UE project bootstrap on Nicko's PC + pixelation post-process gate (G-P1-1) | 6–10 | PC |
| **P2** | asset ingest (characters + props via Interchange) + IK retarget pass + import-map automation | 12–18 | PC (+ VPS manifest audits) |
| **P3** | world build: landscape import + World Partition + region C PCG biomes + A/B/D set dressing | 16–24 | PC (+ VPS dumps) |
| **P4** | player controller + Enhanced Input + combat core (lock-on, combos, parry) | 20–30 | PC |
| **P5** | enemy AI (bandit/ghoul FSM, wolf packs, Rot Mother den set piece) | 24–36 | PC |
| **P6** | systems port (camp/save/cooking/daynight/inventory/leveling) | 16–24 | PC |
| **P7** | lighting + atmosphere (Lumen day/night presets per region) | 8–14 | PC |
| **P8** | UI/audio/polish + the playtest parity sweep | 12–20 | PC |
| **Total** | | **114–176** | |

Details + per-phase gates: docs/phases/P1.md … P8.md (fired one at a time).

## 10. Execution reality: what runs where

- **VPS (this repo)**: planning, dumps, manifests, audits, mission files, parity data
  prep. NO UE editor ever (headless engine builds are not practical on this box; the
  doc-30 Remote Control runner is the sanctioned path when driving the editor from
  scripts — loaded from devops/remote-engine-automation + confirmed with Nicko first).
- **Nicko's PC**: every UE-editor phase (P1..P8). P1 also establishes the Remote Control
  lane so later phases can be partly driven from VPS scripts where useful.
- The browser prototype stays the daily playtest surface the whole time.

## 11. Risks & open items

1. **Wolf walk-clip legs frozen in the browser** — UNRESOLVED as of 2026-10-20 (GLB
   clips + skinning verify healthy offline; diag chip prototype/js/wolf-debug.js,
   ?whdbg=1). The UE port bypasses the web anim path entirely; wolf clips import as
   authored AnimationSequences and are verified in the P2 gate (clip list match +
   retarget-intact walk).
2. **Interchange 4-influence truncation** — verified external fact; our rigs are
   ≤4-influence at bake; P2 gate re-verifies per rig anyway.
3. **Lumen × pixelation shimmer** — stepped-UV SceneTexture + nearest textures can
   strobe under SW Lumen denoise; probe FIRST in the P1 gate (this is why the gate is
   P1, not P7), mitigations registered: Lumen Lite profile, fixed register size,
   dither-before-quantize.
4. **Rot Mother 182k-tri monolith** — import as-is (law); if editor perf suffers,
   the split is an art-side re-bake ruled with Nicko at P2, not a silent decimation.
5. **fence-corner lineage** — v1/v3 blocked (3x QA fail), v2 wired + ingestible; if
   the farm kit needs a straight corner later it is an art round, out of port scope.
6. **C-series rulings live only in the worktree/feat ref** (CONFIG.js 216 KB there vs
   52 KB on dev) — the feat/world-visuals line is the data source for all dumps; dump
   scripts default to /tmp/wh-worldfeat and say so in their provenance output.

## 12. Parity targets (the P8 sweep runs against these)

- Region silhouettes + landmark placements vs CONFIG coordinates (± the propFootR
  1.2 m seat tolerance).
- Combat: EPR1 feel checklist (lock-on, 3-hit chains, parry/riposte, roll windows,
  stagger) — measured against the erparity floor values, not memory.
- Systems: camp save/load/heal, dusk-gated sleep, cooking buffs, day/night 100-min cycle.
- Visual: G-P1-1 pixel-register register-match on a shared test scene.
- The boss den: lair orientation (mouth faces map centre), rot pools, minions.

## 13. Decision needed from Nicko (one ask)

1. **Engine pin**: UE 5.8 (recommended — current stable; the prior doc set is already
   5.8-aligned; PCG Biome Core/Sample first-party) vs 5.5/5.6 (only if his PC/GPU
   install constraints demand it).
2. **Repo name**: `witch-hunter-ue` (created locally, uncommitted-remote; GitHub remote
   created only on his approval).

## 14. Repo layout (this repo)

```
witch-hunter-ue/
  docs/ue5-port-plan.md        this blueprint
  docs/phases/P0.md .. P8.md   the phase checklists (fired one at a time)
  scripts/dump_config.js       CONFIG.js -> artifacts/ue-port/CONFIG-dump.json
  scripts/dump_heightmap.js    region C -> UE landscape heightmap (game-math exact, hash-gated)
  scripts/build_asset_manifest.js  GLB tree -> ASSET_MANIFEST.csv
  scripts/lib/wh-config.js     sandboxed CONFIG loader
  scripts/lib/wh-glb.js        GLB header/twin parser (tris, clips, skins, bounds)
  scripts/lib/manifest-rules.js  class + decision rules (the audit law)
  artifacts/ue-port/           generated data (committed; re-run to refresh)
  README.md                    quickstart + phase checklist
```