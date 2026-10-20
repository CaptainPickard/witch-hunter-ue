# PC-SETUP.md — starting the UE5 port on your PC (Nicko)

Written by IO 2026-10-20. This is the day-one guide for the Witch Hunter UE 5.8 port
on your PC. The browser prototype keeps running as-is; nothing here touches it.

## 1. Install (one-time)

1. Epic Games Launcher -> Unreal Engine 5.8 (the pin; engine decision logged in
   docs/ue5-port-plan.md §13). Skip starter content.
2. Git for Windows + your GitHub credentials (push access to CaptainPickard).
3. Claude Code CLI (whatever you normally run it with).

## 2. Clone

```bash
git clone https://github.com/CaptainPickard/witch-hunter-ue.git
cd witch-hunter-ue
git checkout dev          # build line; main is the Nicko-merge branch
```

(If you also want the browser prototype locally for side-by-side comparison during
the P1 gate:

```bash
git clone https://github.com/CaptainPickard/witch-hunter.git
cd witch-hunter && git checkout feat/world-visuals
```
The P1 gate compares against a prototype render; the repo docs reference
prototype/builds/v8-playable.html as the playable bundle.)

## 3. Read order (before opening the editor)

1. README.md (phase checklist)
2. docs/ue5-port-plan.md (the blueprint — engine baseline §4, art-law carrier §5,
   phases §9)
3. docs/phases/P1.md (the first phase to fire)
4. docs/AGENT-BRIEF.md (the standing brief for any agent session in this repo —
   copy it to CLAUDE.md in the repo root if you want Claude Code to auto-load it;
   it lives under this name because CLAUDE.md is harness-protected on the VPS side)

## 4. Start P1 (the only phase for day one)

Follow docs/phases/P1.md exactly: Blank C++ project `WHGame` -> the pixel register
post-process material -> the WH_Pixel8 texture group -> the L_Gate1 test map with 2-3
real GLBs -> the G-P1-1 gate checklist. Day one is: project opens clean + the gate
map reads like the prototype.

The data files P1/P2/P3 consume are already in the repo (artifacts/ue-port/):
CONFIG-dump.json (all 4 regions), regionC_heightmap_1009x1009.png + meta (P3), and
ASSET_MANIFEST.csv (324 GLBs with import decisions, P2).

## 5. Handy facts

- Engine pin: **UE 5.8**. World Partition ON / Nanite OFF / Lumen ON are in the plan.
- The heightmap PNG row 0 = north (z_world -646); region C center maps to UE
  (0, up, +366) under the axis law X_ue=X_web, Y_ue=up, Z_ue=-Z_web (plan §7).
- Git discipline here mirrors witch-hunter: feat:* -> dev -> main; **main = Nicko
  merges only**. IO stays the remote-side gatekeeper; your Claude Code session works
  on branches off dev.
- Committing: Content/*.uasset are gitignored by default (binary-heavy). If you want
  asset history on the PC side later, we either flip to Git LFS deliberately or keep
  Content untracked with zip backups — decide at P2, not P1.
- If you want the dumps refreshed after the browser game advances (new C-rulings),
  the dump scripts run anywhere Node v18+ runs — but they read the witch-hunter repo,
  so on the PC refresh happens via the IO/VPS side (same repo, same push). PC-side
  scripts point at the clone path as `<witch-hunter-root>`.

## 6. What NOT to do (hard rules)

- Never run UE editor work from the VPS; the editor is PC-only by design.
- Never touch the witch-hunter prototype repo's playtest setup from this port.
- Don't adopt Nanite, don't enable geometry LOD generation, don't let imports
  auto-generate anything that fights the art law (512 NEAREST + 5-bit bake discipline).
- Don't create UE assets from memory — every world coordinate comes from
  artifacts/ue-port/CONFIG-dump.json.