# witch-hunter-ue

Witch Hunter -> Unreal Engine 5 open-world port. Planning + tooling repo (Phase 0).
The UE project itself is built on Nicko's PC in P1+; this repo carries the blueprint,
the deterministic exporters, and the generated data the port consumes.

Blueprint: docs/ue5-port-plan.md (read it first — engine baseline, plugins,
art-law carrier, asset pipeline, world mapping, gameplay table, phases, risks).

## Phase checklist (fire one at a time)

- [x] **P0** — blueprint + scaffold + exporters + manifest (this commit;
      record in docs/phases/P0.md)
- [ ] **P1** — UE project bootstrap on Nicko's PC + pixelation post-process gate
      (6–10 h) — docs/phases/P1.md
- [ ] **P2** — asset ingest + IK retarget pass (12–18 h) — docs/phases/P2.md
- [ ] **P3** — world build: landscape + World Partition + region C PCG biomes
      (16–24 h) — docs/phases/P3.md
- [ ] **P4** — player controller + Enhanced Input + combat core (20–30 h) —
      docs/phases/P4.md
- [ ] **P5** — enemy AI: bandits/ghouls FSM + wolf packs + Rot Mother den
      (24–36 h) — docs/phases/P5.md
- [ ] **P6** — systems port: camp/save/cooking/daynight/inventory/leveling
      (16–24 h) — docs/phases/P6.md
- [ ] **P7** — lighting + atmosphere: Lumen day/night presets per region
      (8–14 h) — docs/phases/P7.md
- [ ] **P8** — UI/audio/polish + playtest parity sweep (12–20 h) —
      docs/phases/P8.md

Total estimate: 114–176 editor-hours. Every phase except P1 bootstrap can be
partly driven from the VPS via the doc-30 Remote Control lane; see the plan §10.

## Tooling (deterministic, seeded, re-runnable)

```bash
# CONFIG.js -> full JSON dump (world source of truth; worktree default = /tmp/wh-worldfeat)
node scripts/dump_config.js /tmp/wh-worldfeat

# region C heightfield -> UE Landscape heightmap (requires the game's own wh-ground.js;
# aborts unless the rebuilt lattice hash == CONFIG.regionC.terrain.gridHash)
node scripts/dump_heightmap.js /tmp/wh-worldfeat
python3 scripts/verify_heightmap.py     # PNG round-trip probe check

# GLB tree -> manifest (324 GLBs, tri counts, per-class UE decisions)
node scripts/build_asset_manifest.js /tmp/wh-worldfeat/art-direction/3d/assets
```

Generated data (committed): artifacts/ue-port/CONFIG-dump.json,
regionC_heightmap_1009x1009.png + regionC_heightmap_meta.json, ASSET_MANIFEST.csv.

## Hard rules

- The witch-hunter browser prototype stays live; its repo and worktree are never
  touched by this repo's work (read-only surveys only).
- No UE editor execution from the VPS; editor work is P1+ on Nicko's PC.
- GitHub remote only after Nicko approves (repo name + engine pin decision in
  the plan §13).
- All docs in English; never the word "free" in player-facing copy.

## Source repos / branches

- github.com/CaptainPickard/witch-hunter — browser prototype (dev = stable line;
  main = Nicko merges only; feat/world-visuals = the world-visual program; the
  C-series rulings C1..C16 live on feat + its worktree /tmp/wh-worldfeat).
- Prior art: main's docs/planning 30 + 52-58 (pre-pivot UE5.8 spec set, reconciled
  into this plan §3).
- Art corpus: 324 GLBs @ art-direction/3d/assets (feat worktree carries the 10-20
  old_king bakes that are not yet wired into the browser game).