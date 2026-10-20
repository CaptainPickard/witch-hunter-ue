'use strict';
// dump_config.js - CONFIG.js -> artifacts/ue-port/CONFIG-dump.json
//
// World source of truth for the UE5 port. Loads prototype/js/CONFIG.js from
// the witch-hunter checkout in a sandboxed Node context, then serializes
// window.WH_CONFIG verbatim plus derived port facts.
//
// Usage: node scripts/dump_config.js <witch-hunter-repo-root> [--out out.json]
// Default repo root: /workspace/witch-hunter (dev checkout). The dump targets
// the feat/world-visuals superset; override with --repo.
//
// Deterministic: JSON.stringify with 2-space indent, keys in file order.
// Seed/param rows are copied as-is with no recomputation.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadConfig(repoRoot) {
  // CONFIG.js is plain browser script: assigns window.WH_CONFIG.
  const cfgPath = path.join(repoRoot, 'prototype', 'js', 'CONFIG.js');
  const src = fs.readFileSync(cfgPath, 'utf8');
  const sandbox = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: path.relative(repoRoot, cfgPath) });
  const cfg = sandbox.window.WH_CONFIG;
  if (!cfg) throw new Error('CONFIG.js did not define window.WH_CONFIG');
  return cfg;
}

function summarizeForPort(cfg) {
  // Port-relevant derived facts (counts + coordinate envelopes), computed
  // deterministically from the loaded config. No mutation of cfg.
  const regionKeys = Object.keys(cfg).filter((k) => /^region[A-Z]$/.test(k));
  const countRows = (v) => Array.isArray(v) ? v.length : 0;
  const counts = { manifestAssets: cfg.assets ? Object.keys(cfg.assets).length : 0 };
  for (const rk of regionKeys) counts[rk + 'Props'] = countRows(cfg[rk].props);
  const sum = {
    configFormat: regionKeys.length ? 'top-level regionA..D keys' : 'world.regions map',
    regions: regionKeys,
    scatterSeed: cfg.scatter ? cfg.scatter.seed : null,
    wallSeed: cfg.boundaryWall ? cfg.boundaryWall.seed : null,
    counts,
    notes: [
      'Coordinate system: browser Three.js, +Y up, world XZ plane.',
      'UE mapping: X_ue = X_web, Y_ue = Y_web(up), Z_ue = -Z_web (left-handed swap).',
      'All rows land verbatim in this dump; the UE side re-reads them at build time.',
      'Primary source is the feat/world-visuals worktree (newest rulings C1..C16); ' +
      'the dev checkout config is a subset.',
    ],
  };
  return sum;
}

function main() {
  const args = process.argv.slice(2);
  let repoRoot = '/workspace/witch-hunter';
  let outPath = path.join(__dirname, '..', 'artifacts', 'ue-port', 'CONFIG-dump.json');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo') repoRoot = args[++i];
    else if (args[i] === '--out') outPath = args[++i];
    else if (!args[i].startsWith('--')) repoRoot = args[i];
  }
  const cfg = loadConfig(repoRoot);
  const dump = {
    schema: 'wh-ue-port-config-dump/1',
    sourceFile: path.join(repoRoot, 'prototype', 'js', 'CONFIG.js'),
    generatedBy: 'scripts/dump_config.js',
    summary: summarizeForPort(cfg),
    config: cfg,
  };
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2) + '\n');
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  process.stdout.write('dump_config OK -> ' + outPath + ' (' + kb + ' KB)\n');
  process.stdout.write('regions: ' + dump.summary.regions.join(', ') + '\n');
  process.stdout.write('manifest assets: ' + dump.summary.counts.manifestAssets + '\n');
  process.stdout.write('prop counts: ' + Object.entries(dump.summary.counts)
    .filter(([k]) => k.endsWith('Props')).map(([k, v]) => k + '=' + v).join(' ') + '\n');
}

main();