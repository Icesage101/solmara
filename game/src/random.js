// Solmara — a tiny seeded random number generator.
// The city, the traffic and the screenshot scenes all draw from this, never from
// Math.random, so the same seed always builds the same Solmara. That is what makes the
// ?shot= scenes deterministic: one seed, one frame, every load.

// Mulberry32: small, fast, and good enough for scattering buildings and trees.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function rngInt(rng, min, max) {
  return Math.floor(rngRange(rng, min, max + 1));
}

export function rngPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function rngChance(rng, p) {
  return rng() < p;
}

// Shuffle a list in place with the seeded generator, so a shuffled deck of spawn
// points or colours is the same every time the seed is the same.
export function rngShuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}
