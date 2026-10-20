'use strict';
// manifest-rules.js - GLB path -> asset class + UE decision mapping.
//
// Class rules are applied by family dir + filename regex over the repo-relative
// path (art-direction/3d/assets/<family>/<name>.glb). Decisions:
//   import-as-is   -> Interchange glTF static import, no geometry edits
//   retarget       -> skeletal import + IK Rig/IK Retargeter to WH_Manikin
//   re-bake        -> not ingestible as-is; needs an art pass before P2
//   block          -> known-gap assets (do not ingest; tracked in the plan)
//
// Art law: ALL textures are 512 + NEAREST + 5-bit posterize bakes by
// construction; UE import settings carry that law (nearest filtering group).
// No geometry post-processing in UE (tri counts are audited, never edited).

const RULES = [
  { family: 'races_regen/rigged', id: 'char-rigged', label: 'Rigged character (skeletal, game-ready)',
    decision: 'retarget', importSettings: 'Interchange: skeletal; IK retarget to WH_Manikin in P2; per-clip AnimationSequences' },
  { family: 'races_regen', id: 'char-static', label: 'Character base (static/ref)', decision: 'import-as-is',
    importSettings: 'Interchange: static; reference only' },
  { family: 'races', id: 'char-legacy', label: 'Legacy race model (pre-regen)', decision: 'import-as-is',
    importSettings: 'Interchange: static; archival, not placed' },
  { family: 'weapons', id: 'weapon', label: 'Weapon (socket-mounted)', decision: 'import-as-is',
    importSettings: 'Interchange: static; WH_Socket_* contract (doc 54); no collisions' },
  { family: 'armor', id: 'armor', label: 'Armor/attire piece (socket-attached)', decision: 'import-as-is',
    importSettings: 'Interchange: static; socket attach; no collisions' },
  { family: 'trees', id: 'prop-tree', label: 'Tree (biome scatter)', decision: 'import-as-is',
    importSettings: 'Interchange: static; PCG scatter source; no per-piece collisions (trunk capsules authored in UE)' },
  { family: 'rock', id: 'prop-rock', label: 'Rock/outcrop (biome scatter)', decision: 'import-as-is',
    importSettings: 'Interchange: static; PCG scatter; convex collisions in UE' },
  { family: 'ruins', id: 'prop-ruin', label: 'Ruin kit piece', decision: 'import-as-is',
    importSettings: 'Interchange: static; PCG dressing + set dressing' },
  { family: 'farm', id: 'prop-farm', label: 'Farm kit piece', decision: 'import-as-is',
    importSettings: 'Interchange: static; fence-corner trio ships as raw kit only (known gap)' },
  { family: 'props', id: 'prop', label: 'Prop (generic)', decision: 'import-as-is',
    importSettings: 'Interchange: static' },
  { family: 'church-kit', id: 'church-kit', label: 'Church kit piece', decision: 'import-as-is',
    importSettings: 'Interchange: static; set-dressed' },
  { family: 'crypt', id: 'crypt', label: 'Crypt/grave piece', decision: 'import-as-is',
    importSettings: 'Interchange: static; set-dressed' },
  { family: 'graveyard', id: 'graveyard', label: 'Graveyard prop', decision: 'import-as-is',
    importSettings: 'Interchange: static; set-dressed' },
  { family: 'camp', id: 'camp', label: 'Camp kit prop (placeable)', decision: 'import-as-is',
    importSettings: 'Interchange: static; camp-kit placement actor' },
  { family: 'biome_library/raw', id: 'raw', label: 'RAW bake (pre-pixelate source)', decision: 'block',
    importSettings: 'NEVER ingest: raw pre-bake source; pixelated variant is the ingest candidate' },
  { family: 'biome_library/refs', id: 'raw', label: 'RAW reference render', decision: 'block',
    importSettings: 'NEVER ingest: concept reference only' },
  { family: 'biome_library', id: 'prop-biome', label: 'Biome tree (pixelated bake)', decision: 'import-as-is',
    importSettings: 'Interchange: static; PCG scatter source' },
  { family: 'old_king', id: 'old-king', label: 'Old King bake (farm/ruin/tree kit)', decision: 'import-as-is',
    importSettings: 'Interchange: static; NOT wired in browser (tri budget) - EU port ingests in P2; fence-corner trio = raw kit only' },
  { family: 'textures', id: 'texture', label: 'Standalone texture', decision: 'import-as-is',
    importSettings: 'Texture2D; NEAREST group profile; never auto-mip to blur' },
  { family: 'sky', id: 'sky', label: 'Sky dome master', decision: 'import-as-is',
    importSettings: 'TextureCube/skydome; see P7 atmosphere' },
];

// Name-level overrides (checked before family verdicts where marked).
const NAME_RULES = [
  { test: /raw\//, id: 'raw', label: 'RAW bake (pre-pixelate source)', decision: 'block',
    importSettings: 'NEVER ingest' },
  { test: /-raw\.glb$/i, id: 'raw', label: 'RAW glb (pre-bake)', decision: 'block',
    importSettings: 'NEVER ingest' },
];

// families whose ONLY ingest candidates are pixelated bakes; the plain-name
// siblings are pre-bake raws (raw twin of the bake, kept for re-bake work only).
const PIXELATE_ONLY_FAMILIES = new Set(['races', 'old_king']);

// known visual-QA gap names (3x regen fail lineage; farm kit ships without it).
// v1 + v3 are the failed generations; v2 is the variant the browser actually
// wires (assets.js, C13b) so only v1/v3 block.
const BLOCK_NAME_RE = /^ok-fence-corner(-v3)?$/i;

function classifyByPath(rel) {
  for (const nr of NAME_RULES) {
    if (nr.test.test(rel)) return { id: nr.id, label: nr.label };
  }
  const family = rel.split('/')[0];
  const sub = rel.includes('/') ? rel.slice(family.length + 1, rel.lastIndexOf('/')) : '';
  const famPath = (sub ? family + '/' + sub : family);
  for (const r of RULES) {
    if (r.family === famPath || r.family === family) return { id: r.id, label: r.label };
  }
  return { id: 'unclassified', label: 'UNCLASSIFIED (triage before P2)', decision: 'block',
    importSettings: 'hold' };
}

// Decision refinement by name, after family classification.
function decisionFor(cls, rel) {
  const base = rel.split('/').pop();
  const isPixelated = /-pixelated\.glb$/i.test(base);
  const assetName = base.replace(/\.glb$/i, '').replace(/-pixelated$/i, '');
  const dir = ueDirFor(cls, rel);
  // legacy families: non-pixelated plain twins are pre-bake raws
  if (PIXELATE_ONLY_FAMILIES.has(rel.split('/')[0]) && !isPixelated && !/\.rigged\./i.test(base) && !/combat-|mixamo/i.test(base) && cls.id !== 'raw') {
    return { decision: 'block', ueDir: dir, assetName: () => assetName,
      importSettings: 'pre-bake raw twin; the -pixelated sibling is the ingest candidate' };
  }
  // known asset gap: the old_king farm fence-corner trio (3x visual-QA fail)
  if (rel.split('/')[0] === 'old_king' && BLOCK_NAME_RE.test(assetName)) {
    return { decision: 'block', ueDir: dir, assetName: () => assetName,
      importSettings: 'KNOWN GAP: 3x visual-QA fail; do not ingest; farm kit ships without it' };
  }
  const rule = RULES.find((r) => r.id === cls.id) || { decision: 'import-as-is', importSettings: 'Interchange: static' };
  return { decision: rule.decision, ueDir: dir, assetName: () => assetName, importSettings: rule.importSettings };
}

function ueDirFor(cls, rel) {
  // /Game/WH/... content root; the editor work happens on Nicko's PC in P2+
  const m = {
    'char-rigged': '/Game/WH/Characters/',
    'char-static': '/Game/WH/Characters/_ref/',
    'char-legacy': '/Game/WH/Characters/_legacy/',
    'weapon': '/Game/WH/Weapons/',
    'armor': '/Game/WH/Armor/',
    'prop-tree': '/Game/WH/Environment/Trees/',
    'prop-rock': '/Game/WH/Environment/Rocks/',
    'prop-ruin': '/Game/WH/Environment/Ruins/',
    'prop-farm': '/Game/WH/Environment/Farm/',
    'prop-biome': '/Game/WH/Environment/Trees/',
    'old-king': '/Game/WH/Environment/OldKing/',
    'church-kit': '/Game/WH/Environment/Church/',
    'crypt': '/Game/WH/Environment/Crypt/',
    'graveyard': '/Game/WH/Environment/Graveyard/',
    'camp': '/Game/WH/Environment/Camp/',
    'prop': '/Game/WH/Environment/Misc/',
    'texture': '/Game/WH/Textures/',
    'sky': '/Game/WH/Environment/Sky/',
  }[cls.id] || '/Game/WH/Misc/';
  return m;
}

module.exports = { RULES, NAME_RULES, classifyByPath, decisionFor };