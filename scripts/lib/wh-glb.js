'use strict';
// wh-glb.js - shared glTF/GLB binary parser for Witch Hunter UE port tooling.
// Deterministic header-only read: JSON chunk + accessor min/max bounds; the
// BIN chunk length is read but bytes are never interpreted unless asked.
// No dependencies. Exports: parseGlbFile(path), parseGlb(buffer).

const fs = require('fs');

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN'

function parseGlbFile(path) {
  return parseGlb(fs.readFileSync(path));
}

function parseGlb(input) {
  const buf = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  if (buf.length < 20) throw new Error('GLB too small: ' + buf.length + ' bytes');
  const magic = buf.readUInt32LE(0);
  if (magic !== GLB_MAGIC) throw new Error('not a GLB (magic 0x' + magic.toString(16) + ')');
  const gltfVersion = buf.readUInt32LE(4);
  const totalLenField = buf.readUInt32LE(8);
  const jsonLen = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);
  if (jsonType !== CHUNK_JSON) throw new Error('first chunk is not JSON');
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));

  // optional BIN chunk
  let binBytes = 0;
  const off = 20 + jsonLen;
  if (off + 8 <= buf.length) {
    const binLen = buf.readUInt32LE(off);
    if (buf.readUInt32LE(off + 4) === CHUNK_BIN) binBytes = binLen;
  }

  const stats = collectStats(json);
  return Object.assign({
    json,
    gltfVersion,
    totalLenField,
    fileSize: buf.length,
    binBytes,
  }, stats);
}

function collectStats(json) {
  const acc = json.accessors || [];
  const out = {
    tris: 0,
    verts: 0,
    meshCount: 0,
    primCount: 0,
    // [minX, minY, minZ, maxX, maxY, maxZ] across POSITION accessor bounds
    bounds: null,
    // [sizeX, sizeY, sizeZ]
    sizeMeters: null,
    // [{ name, duration, channels }]
    animations: [],
    // [name | null]
    materials: [],
    // [{ name, mimeType, bufferView, uri }]
    images: [],
    nodes: 0,
    skins: 0,
    jointsMax: 0,
    rootScales: [],
  };

  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  let anyBound = false;

  for (const mesh of json.meshes || []) {
    out.meshCount++;
    for (const prim of mesh.primitives || []) {
      out.primCount++;
      const posIdx = prim.attributes ? prim.attributes.POSITION : undefined;
      if (posIdx != null && acc[posIdx]) {
        const a = acc[posIdx];
        out.verts += a.count;
        if (a.min && a.max) {
          anyBound = true;
          for (let i = 0; i < 3; i++) {
            if (a.min[i] < mn[i]) mn[i] = a.min[i];
            if (a.max[i] > mx[i]) mx[i] = a.max[i];
          }
        }
      }
      if (prim.indices != null && acc[prim.indices]) {
        out.tris += acc[prim.indices].count / 3;
      } else if (posIdx != null && acc[posIdx]) {
        // non-indexed draw: every 3 verts are a triangle
        out.tris += acc[posIdx].count / 3;
      }
    }
  }
  out.tris = Math.round(out.tris);
  out.verts = Math.round(out.verts);
  if (anyBound) {
    out.bounds = [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
    out.sizeMeters = [
      round2(mx[0] - mn[0]),
      round2(mx[1] - mn[1]),
      round2(mx[2] - mn[2]),
    ];
  }

  for (const anim of json.animations || []) {
    let duration = 0;
    for (const sampler of anim.samplers || []) {
      const a = sampler.input != null ? acc[sampler.input] : null;
      if (a && a.max && a.max[0] > duration) duration = a.max[0];
    }
    out.animations.push({
      name: anim.name || null,
      duration: round2(duration),
      channels: (anim.channels || []).length,
    });
  }

  for (const mat of json.materials || []) {
    out.materials.push(mat.name || null);
  }
  for (const img of json.images || []) {
    out.images.push({
      name: img.name || null,
      mimeType: img.mimeType || null,
      bufferView: img.bufferView != null,
      uri: img.uri || null,
    });
  }

  out.nodes = (json.nodes || []).length;
  out.skins = (json.skins || []).length;
  let jointsMax = 0;
  for (const sk of json.skins || []) {
    if ((sk.joints || []).length > jointsMax) jointsMax = sk.joints.length;
  }
  out.jointsMax = jointsMax;

  const scene = (json.scenes || [])[0];
  out.rootScales = scene ? (scene.nodes || [])
    .map((ni) => (json.nodes[ni] && json.nodes[ni].scale) || null)
    .filter(Boolean) : [];

  return out;
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { parseGlb, parseGlbFile, GLB_MAGIC, CHUNK_JSON, CHUNK_BIN };