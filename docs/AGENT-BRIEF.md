# AGENT-BRIEF.md — standing brief for the agent working in this repo (Claude Code on Nicko's PC)

Repo: witch-hunter-ue — the Unreal Engine 5.8 port of Witch Hunter.
Author: IO (Nicko's technical director, Hermes side). Read this file before any work.
(Nicko: if you want Claude Code to auto-load this, copy it to CLAUDE.md in the repo
root on the PC — it was kept out of that filename on the VPS by harness policy.)

## Mission

Port Witch Hunter (dark medieval fantasy action RPG, currently a live Three.js browser
prototype at github.com/CaptainPickard/witch-hunter) into a REAL UE 5.8 open-world PC
game using UE's plugin ecosystem: PCG (biome scatter), Lumen, World Partition + HLOD,
Interchange (glTF ingest), IK Retargeter, Niagara, MetaSounds. The browser prototype
STAYS live during the port — it is never modified from this repo's work.

## Read first, in order

1. docs/ue5-port-plan.md — the blueprint (engine baseline §4, art-law carrier §5,
   asset pipeline §6, world mapping §7, gameplay mapping §8, phases §9, risks §11).
2. docs/phases/P*.md — the phase checklists. Work ONE phase at a time. P1 is first.
   Never skip a gate: each P*.md ends with a G-Pn-1 gate that must PASS (with
   evidence: screenshots, counts, logs) before the next phase starts.
3. artifacts/ue-port/ — the generated data (already committed):
   - CONFIG-dump.json — the world's source of truth (all prop/enemy/road coordinates
     dumped verbatim from the browser game's CONFIG.js).
   - ASSET_MANIFEST.csv — 324 GLBs, import decisions per asset (import-as-is /
     retarget / block), tri counts, clip lists, game-reference flags.
   - regionC_heightmap_1009x1009.png + regionC_heightmap_meta.json — the exact
     game-terrain heightmap for the UE Landscape (P3) with import parameters.

## Non-negotiable laws

1. **The art law**: all content is deliberately low-poly with 512px NEAREST +
   5-bit-per-channel posterized textures baked into the GLBs. In UE: Nanite OFF,
   no LOD generation, nearest texture filtering (WH_Pixel8 group), and the pixel
   register post-process material (P1) makes the engine LOOK match the bakes.
   Nothing that fights this law ships, even if it is "better" in UE terms.
2. **Data law**: every world placement comes from artifacts/ue-port/CONFIG-dump.json,
   never from memory, imagination, or eyeballing. Axis mapping: browser is +Y up,
   world XZ; UE takes X_ue = X_web, Y_web = up, Z_ue = -Z_web.
3. **The visual gate is P1's G-P1-1**: the pixel register + quantize post chain must
   reproduce the prototype look on a test map before ANY other UE work proceeds.
4. **Git**: work on feat:* branches off dev; dev is the build line; main = Nicko
   merges only (IO is the remote-side gatekeeper). Small commits, honest messages.
   The witch-hunter prototype repo is READ-ONLY to this project.
5. **Scope discipline**: one phase at a time, exactly its P*.md checklist. If you
   believe a phase needs re-planning, STOP and write the case in docs/phases/ as a
   note for IO — do not improvise new systems.
6. **No player-facing word**: never use the word "free" in any player-facing copy.
7. English only, everywhere.

## Working style

- After each work block: report what changed, what gate step it addresses, what is
  next. Commit at coherent milestones with phase-prefixed messages (e.g. "P1: ...").
- Gate evidence goes in artifacts/ue-port/gate-p1/ .. gate-p8/ (screenshots, counts).
- If something in the plan is factually wrong (e.g. a plugin doesn't exist in 5.8 or
  an import behaves differently), verify with real doc sources, then write the finding
  into the relevant phase doc under "FINDINGS" before working around it.

## Current state (2026-10-20)

- P0 complete: blueprint + exporters + artifacts committed (branch dev @ 959c8d2).
- Next: P1 on this PC (docs/phases/P1.md). UE 5.8 pinned.
- Known open item from the browser (informational): wolf walk-clip legs read frozen in
  the BROWSER build only; the GLB is healthy. P2's gate independently verifies the
  wolf clip plays correctly in-engine.