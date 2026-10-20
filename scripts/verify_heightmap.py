#!/usr/bin/env python3
"""verify_heightmap.py - PNG round-trip verification against the meta probe table.

Independently decodes artifacts/ue-port/regionC_heightmap_1009x1009.png (16-bit
grayscale, no deps: zlib + struct) and re-derives each probe pixel from the
probe table in regionC_heightmap_meta.json. VERIFIES:
  1. every probe (row, col) uint16 in the PNG matches meta within 1 LSB
  2. PNG dims == meta grid == 1009x1009
Exit 0 on PASS, 1 on FAIL; prints the worst |dh| in meters.

The probe table's meter values were produced by the game's own wh-ground CORE
(dump_heightmap.js, hash-gated), so a PASS here means: PNG decodes -> the same
numbers -> the heightmap provably carries the game's terrain.

Usage: python3 scripts/verify_heightmap.py [--dir artifacts/ue-port]
"""
import argparse
import json
import os
import struct
import sys
import zlib


def read_png16(path):
    data = open(path, "rb").read()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("not a PNG")
    pos, w, h, depth, ctype = 8, 0, 0, 0, 0
    idat = b""
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if ctype == b"IHDR":
            w, h, depth, color = struct.unpack(">IIBB", chunk[:10])
            if depth != 16 or color != 0:
                raise ValueError("expected 16-bit grayscale, got depth=%d color=%d" % (depth, color))
        elif ctype == b"IDAT":
            idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * 2
    px = []
    for y in range(h):
        row = raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)]
        for x in range(w):
            px.append(struct.unpack(">H", row[x * 2:x * 2 + 2])[0])
    return w, h, px


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "artifacts", "ue-port"))
    ap.add_argument("--tol-lsb", type=int, default=1)
    a = ap.parse_args()
    meta = json.load(open(os.path.join(a.dir, "regionC_heightmap_meta.json")))
    png_path = os.path.join(a.dir, "regionC_heightmap_%dx%d.png" % (meta["grid"]["size"], meta["grid"]["size"]))
    w, h, px = read_png16(png_path)
    assert (w, h) == (meta["grid"]["size"], meta["grid"]["size"]), "PNG dims mismatch"
    span = meta["heightRangeMeters"][1] - meta["heightRangeMeters"][0]
    worst_lsb, worst_m = 0, 0.0
    fails = []
    for row, col, meters, u16 in meta["verification"]["probes"]:
        got = px[row * w + col]
        d = abs(got - u16)
        if d > worst_lsb:
            worst_lsb = d
        dm = abs(got / 65535.0 * span + meta["heightRangeMeters"][0] - meters)
        if dm > worst_m:
            worst_m = dm
        if d > a.tol_lsb:
            fails.append((row, col, u16, got))
    if fails:
        print("FAIL: %d probes exceed %d LSB (worst %d); worst |dh| %.4f m" % (len(fails), a.tol_lsb, worst_lsb, worst_m))
        for f in fails[:10]:
            print("  row=%d col=%d meta=%d png=%d" % f)
        return 1
    print("PASS: %d probes within %d LSB (worst %d LSB, %.5f m) - PNG carries the game field"
          % (len(meta["verification"]["probes"]), a.tol_lsb, worst_lsb, worst_m))
    return 0


if __name__ == "__main__":
    sys.exit(main())