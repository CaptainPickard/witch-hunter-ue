'use strict';
// dump_heightmap.js - Region C heightfield -> UE Landscape heightmap.
//
// REQUIRES the game's own terrain math: prototype/js/wh-ground.js is loaded
// (Node can require it with a THREE stub) and every height comes from its
// CORE.makeField(...).heightA - the exact function the browser walks on.
//
// Determinism self-check: it rebuilds the game's S=140 Float32 lattice exactly
// as wh-ground.buildTerrain does, hashes it with the game's FNV-1a gridHash,
// and ABORTS unless the hash equals CONFIG.regionC.terrain.gridHash
// ('7ca52bd3' at the 2026-10-20 feat tip). Only then does it sample the
// analytic field onto the dense UE grid and write the PNG.
//
// Outputs (artifacts/ue-port/):
//   regionC_heightmap_1009x1009.png  16-bit grayscale (UE Landscape import)
//   regionC_heightmap_meta.json      params + provenance + probe table
//
// Usage: node scripts/dump_heightmap.js <witch-hunter-repo-root>
// Default root: the feat/world-visuals worktree /tmp/wh-worldfeat (matches the
// playtest surfaces). The dev checkout lacks the newest terrain rulings.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const { loadConfig } = require('./lib/wh-config.js');

const GRID = 1009;          // UE max per-section vertex edge (63-quads x 16 comp)
const SIZE = 560;           // CONFIG.regionC.terrain.plane (m)
const PROBE_N = 24;         // probe grid per axis written to meta (PNG round-trip check)

// Minimal THREE stub: only what makeField/gridHash touch. We never call
// buildTerrain (no geometry needed); the lattice is rebuilt by hand below.
const threeStub = {
  Color: function () { this.r = 0; this.g = 0; this.b = 0; },
  BufferAttribute: function () {},
  Mesh: function () {},
  PlaneGeometry: function () {},
  MeshBasicMaterial: function () {},
  Raycaster: function () {},
};

function loadWhGround(repoRoot) {
  const p = path.join(repoRoot, 'prototype', 'js', 'wh-ground.js');
  const src = fs.readFileSync(p, 'utf8');
  // wh-ground.js is an IIFE ending with (typeof window !== 'undefined' ? window : globalThis),
  // so the stub window ITSELF must carry THREE; root.WH_GROUND lands there.
  const win = { THREE: threeStub };
  const sandbox = { console: { log() {}, warn() {}, error() {} }, window: win };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'wh-ground.js' });
  const G = win.WH_GROUND;
  if (!G || !G.CORE) throw new Error('wh-ground.js did not expose WH_GROUND.CORE');
  return { CORE: G.CORE, gridHash: G.gridHash };
}

function writePng16(pathOut, w, h, pixels16) {
  const chunk = (ctype, data) => {
    const c = Buffer.concat([Buffer.from(ctype, 'latin1'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(c) >>> 0, 0);
    return Buffer.concat([len, c, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 16; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 2;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    for (let x = 0; x < w; x++) {
      raw.writeUInt16BE(pixels16[y * w + x], y * (stride + 1) + 1 + x * 2);
    }
  }
  const sig = Buffer.from('89504e470d0a1a0a', 'hex');
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(pathOut, png);
  return png.length;
}

function main() {
  const args = process.argv.slice(2);
  let repoRoot = '/tmp/wh-worldfeat';
  for (let i = 0; i < args.length; i++) { if (args[i] !== null && !args[i].startsWith('--')) repoRoot = args[i]; }

  const cfg = loadConfig(repoRoot);
  const T = cfg.regionC && cfg.regionC.terrain;
  if (!T || !T.enabled) throw new Error('CONFIG.regionC.terrain missing or disabled');

  // Region C disc center in world coords (CONFIG.world.regions or the C row).
  const regionC = (cfg.world && cfg.world.regions && cfg.world.regions.C) || cfg.regionC;
  const center = regionC && regionC.center ? { x: regionC.center.x, z: regionC.center.z } : { x: 0, z: -366 };

  const { CORE, gridHash } = loadWhGround(repoRoot);
  const field = CORE.fieldFor(T, center);   // the game's own field (local x,z)

  // ---- determinism self-check: rebuild the shipped S=140 lattice + hash it
  const S = T.S, seg = T.plane / S, W = S + 1;
  const grid = new Float32Array(W * W);
  let gmin = Infinity, gmax = -Infinity;
  for (let iz = 0; iz < W; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const x = ix * seg - T.plane / 2, z = iz * seg - T.plane / 2;
      const h = field.heightA(x, z);
      grid[iz * W + ix] = h;
      if (h < gmin) gmin = h; if (h > gmax) gmax = h;
    }
  }
  const hash = gridHash('C', grid) || CORE.gridHash(grid);
  if (hash !== T.gridHash) {
    throw new Error('LATTICE HASH MISMATCH: rebuilt ' + hash + ' != CONFIG ' + T.gridHash +
      ' - the loaded wh-ground.js is not the shipped field; aborting before any PNG write.');
  }
  process.stdout.write('self-check OK: S=' + S + ' lattice hash ' + hash + ' (CONFIG ' + T.gridHash + '), h ' + gmin.toFixed(3) + '..' + gmax.toFixed(3) + '\n');

  // ---- dense UE grid (rows 0..G-1 map z local -280..+280 -> world z -646..-86)
  const half = SIZE / 2, step = SIZE / (GRID - 1);
  const px = new Uint16Array(GRID * GRID);
  let hmin = Infinity, hmax = -Infinity;
  const heights = new Float32Array(GRID * GRID);
  for (let row = 0; row < GRID; row++) {
    const zl = -half + row * step;
    for (let col = 0; col < GRID; col++) {
      const xl = -half + col * step;
      const h = field.heightA(xl, zl);
      heights[row * GRID + col] = h;
      if (h < hmin) hmin = h; if (h > hmax) hmax = h;
    }
  }
  const span = hmax - hmin || 1;
  for (let i = 0; i < px.length; i++) px[i] = Math.round(65535 * (heights[i] - hmin) / span);

  const pngPath = path.join(__dirname, '..', 'artifacts', 'ue-port', 'regionC_heightmap_1009x1009.png');
  const pngBytes = writePng16(pngPath, GRID, GRID, px);

  // probe table (for verify_heightmap.py): (row,col) -> float meters
  const probes = [];
  const pstep = (GRID - 1) / (PROBE_N + 1);
  for (let r = 1; r <= PROBE_N; r++) {
    for (let c = 1; c <= PROBE_N; c++) {
      const row = Math.round(r * pstep), col = Math.round(c * pstep);
      probes.push([row, col, Math.round(heights[row * GRID + col] * 10000) / 10000, px[row * GRID + col]]);
    }
  }

  const meta = {
    schema: 'wh-ue-port-heightmap-meta/1',
    generatedBy: 'scripts/dump_heightmap.js',
    sourceFiles: ['prototype/js/CONFIG.js (regionC.terrain)', 'prototype/js/wh-ground.js (CORE.makeField)'],
    repoRoot,
    determinism: {
      seed: T.seed, S, planeSizeM: T.plane,
      latticeGridHash: hash, expectedGridHash: T.gridHash,
      note: 'S=140 game lattice rebuilt + FNV-1a hashed with the game gridHash; PNG written only after a bit-exact match.',
    },
    heightRangeMeters: [round4(hmin), round4(hmax)],
    grid: { size: GRID, spacingM: round4(step), squareM: SIZE },
    worldPlacement: {
      regionCCenterWorld: [center.x, center.z],
      worldZRange: [center.z - half, center.z + half],
      worldXRange: [center.x - half, center.x + half],
      note: 'browser +Y up, world XZ; UE: X_ue = X_web, Y_ue = up, Z_ue = -Z_web. PNG row 0 = z_world min (northmost).',
    },
    ueImport: {
      landscape: 'WH_Landscape_RegionC',
      components: '16x16 sections of 63x63 quads (1009 vertices per section edge -> 241 landmass components 255x255 quads alternative NOT used)',
      zScale: 'on import: Z = (pixel/65535) * span + hMin, span = ' + round4(span) + ' m; set Landscape scale Z = ' + round4(span) + ' m per unit or bake into import mapping',
    },
    verification: {
      probeCount: probes.length,
      toleranceM: 0.05,
      script: 'scripts/verify_heightmap.py',
      probes,
    },
    gameplayNote: 'browser gameplay samples the S=140 Float32 lattice (B-TRI); UE gameplay will collide on the dense landscape - inter-grid drift is < ' + round4(step) + ' m horizontally, absorbed by prop seat tolerances (propFootR ' + (T.propFootR || 1.2) + ').',
  };
  const metaPath = path.join(__dirname, '..', 'artifacts', 'ue-port', 'regionC_heightmap_meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  process.stdout.write('dump_heightmap OK -> ' + pngPath + ' (' + Math.round(pngBytes / 1024) + ' KB, h ' + hmin.toFixed(2) + '..' + hmax.toFixed(2) + ' m) + meta\n');
}

function round4(n) { return Math.round(n * 10000) / 10000; }

main();