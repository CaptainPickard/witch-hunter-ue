'use strict';
// build_asset_manifest.js - art-direction/3d/assets/**.glb -> ASSET_MANIFEST.csv
//
// Class rules (classId, decision, ueDir), applied by path class + name regex;
// source-class counts print as a census. The manifest is the single ingest
// ledger Devbot consumes in P2; every GLB in the tree must land on some row.
//
// Usage: node scripts/build_asset_manifest.js <glb-tree-root> [--out csv]
// Default tree: /tmp/wh-worldfeat/art-direction/3d/assets (worktree = the
// full current tree incl. old_king bakes). Flags are deterministic.
const fs = require('fs');
const path = require('path');
const { classifyByPath, decisionFor } = require('./lib/manifest-rules.js');
const { parseGlbFile } = require('./lib/wh-glb.js');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.toLowerCase().endsWith('.glb')) yield p;
  }
}

function main() {
  const args = process.argv.slice(2);
  let root = '/tmp/wh-worldfeat/art-direction/3d/assets';
  let repoRoot = '/tmp/wh-worldfeat';
  let outPath = path.join(__dirname, '..', 'artifacts', 'ue-port', 'ASSET_MANIFEST.csv');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outPath = args[++i];
    else if (args[i] === '--repo') repoRoot = args[++i];
    else if (!args[i].startsWith('--')) root = args[i];
  }

  // which GLB basenames the browser game actually loads (prototype/js/assets.js)
  const assetsJs = fs.readFileSync(path.join(repoRoot, 'prototype', 'js', 'assets.js'), 'utf8');
  const loaded = new Set(assetsJs.match(/[a-z0-9_.-]+\.glb/gi) || []);
  const isGameReferenced = (rel) => loaded.has(path.basename(rel));

  const rows = [];
  const census = new Map();
  for (const f of walk(root)) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const cls = classifyByPath(rel);
    const glb = parseGlbFile(f);
    const dec = decisionFor(cls, rel);
    const rec = {
      relPath: rel,
      assetName: path.basename(rel, '.glb').replace(/-pixelated$/, ''),
      family: rel.split('/')[0],
      classId: cls.id,
      classLabel: cls.label,
      decision: dec.decision,
      uePath: dec.ueDir + dec.assetName(rel),
      importSettings: dec.importSettings,
      triCount: glb.tris,
      vsize: glb.verts,
      skinned: glb.skins > 0,
      clips: glb.animations.length,
      clipNames: glb.animations.map(c => c.name),
      jointsMax: glb.jointsMax,
      boundsM: glb.sizeMeters,
      sizeKB: Math.round(glb.fileSize / 1024),
      gameReferenced: isGameReferenced(rel),
    };
    rows.push(rec);
    census.set(cls.id, (census.get(cls.id) || 0) + 1);
  }
  rows.sort((a, b) => a.relPath.localeCompare(b.relPath));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  process.stdout.write('build_asset_manifest OK -> ' + outPath + '\n');
  const total = rows.length;
  let csv = [
    'relative_path,asset_name,family,class_id,class_label,decision,ue_path,import_settings,tri_count,vertex_count,skinned,clips,clip_names,joints_max,game_referenced,size_kb',
  ];
  for (const r of rows) {
    csv.push([r.relPath, r.assetName, r.family, r.classId, r.classLabel, r.decision, r.uePath, r.importSettings, r.triCount, r.vsize, r.skinned, r.clips, r.clipNames.join('|'), r.jointsMax, r.gameReferenced, r.sizeKB].map(csvField).join(','));
  }
  fs.writeFileSync(outPath, csv.join('\n') + '\n');
  const byClass = [...census.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => k + '=' + v).join(' ');
  process.stdout.write('rows written: ' + total + ' | by class: ' + byClass + '\n');
  process.stdout.write('total tris: ' + rows.reduce((s, r) => s + r.triCount, 0) + '\n');
}

function csvField(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

main();