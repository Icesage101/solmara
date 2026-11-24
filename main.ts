// Solmara: Streets of the Sun — the hand-in program for gta6-01 (Node 22, stdlib only).
//
// What it does: copies this repository's game/ (the playable open-world game, plain static
// files) and screenshots/ (four real renders of that game) into the output directory the
// grader provides, then writes output/dossier.json with the kit's vendored buildDossier
// library, so the judge can read the game from the dossier alone.
//
// Run it locally the same way the grader does, from this directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// It must write byte-identical output on every run: it copies files as they are and the
// dossier is a pure function of those files, so two runs always match.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (reference/gate.json): the game tree and the
// screenshots must leave room under /output's own 1,000-entry, 64 MiB ceiling, so the
// program refuses to hand in a tree the scorer would refuse rather than writing it.
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const SHOT_MAX_FILES = 4;
const SHOT_MAX_BYTES = 256 * 1024;

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      const sub = countTree(path);
      files += sub.files + 1;
      bytes += sub.bytes;
    } else if (info.isFile()) {
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
}

function checkTree(label, dir, maxFiles, maxBytes) {
  const { files, bytes } = countTree(dir);
  if (files > maxFiles) throw new Error(`${label} has ${files} files, over the ${maxFiles} cap`);
  if (bytes > maxBytes) throw new Error(`${label} is ${bytes} bytes, over the ${maxBytes} cap`);
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
checkTree('game/', gameDir, GAME_MAX_FILES, GAME_MAX_BYTES);
if (existsSync(shotsDir)) checkTree('screenshots/', shotsDir, SHOT_MAX_FILES, SHOT_MAX_FILES * SHOT_MAX_BYTES);

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

// The dossier text is capped at 160 KiB; the screenshots at four of 256 KiB each. These
// numbers are the gate's, passed straight through to the library that writes the file.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmara handed in: game/ + screenshots/ + dossier.json in ${outputDir}`);
