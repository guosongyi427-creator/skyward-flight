// Deterministic random numbers: a small mulberry32 generator plus a value-noise
// helper, so a seed always builds the same island, the same rings and the same
// screenshot scenes.
export function createRandom(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2-D value noise from integer lattice hashes. Returns roughly [-1, 1].
// Two octaves of this, at different scales, make the island's hills.
export function makeNoise(seed) {
  function hash(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 974634) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = hash(ix, iz), b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    const u = smooth(fx), v = smooth(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  };
}
