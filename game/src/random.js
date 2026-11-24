// random.js — deterministic seeded randomness. The whole city, and every
// staged screenshot scene, is built from one seed so the same seed always
// produces the same Solmara. One job: be the only source of chance the
// world generator and the shot scenes are allowed to use.

// mulberry32: a small, fast, well-mixed 32-bit generator.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function randInt(rng, lo, hi) {
  return Math.floor(randRange(rng, lo, hi + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// A stable numeric seed from a short string, so shot scenes can be named
// (?shot=chase) and still seed the world deterministically.
export function seedFromString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
