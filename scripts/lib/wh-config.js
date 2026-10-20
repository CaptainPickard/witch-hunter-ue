'use strict';
// wh-config.js - load prototype/js/CONFIG.js into a plain object, sandboxed.
// Shared by dump_config.js, dump_heightmap.js, build_asset_manifest.js.
//
// CONFIG.js is a classic browser script that assigns window.WH_CONFIG;
// we evaluate it in a bare VM context with a stub window. Deterministic:
// pure file read + evaluation, no network, no DOM.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadConfig(repoRoot) {
  const cfgPath = path.join(repoRoot, 'prototype', 'js', 'CONFIG.js');
  const src = fs.readFileSync(cfgPath, 'utf8');
  const sandbox = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'CONFIG.js' });
  const cfg = sandbox.window.WH_CONFIG;
  if (!cfg) throw new Error('CONFIG.js did not define window.WH_CONFIG at ' + cfgPath);
  return cfg;
}

module.exports = { loadConfig };