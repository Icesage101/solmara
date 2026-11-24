// Solmara: Streets of the Sun — entry program for the gta6-01 bounty.
//
// This program hands the game in. It copies the playable game (game/) and
// the screenshots (screenshots/) from this repository into the output
// directory the grader names (MAKEFUN_OUTPUT_DIR, or ./out when run by
// hand), then writes dossier.json there using the kit's dossier library,
// so the bytes graded later are rebuilt from exactly these files.
// Deterministic by construction: same repository in, same bytes out.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-game.ts';

// The limits the sealed gate grades against, restated so the dossier is
// built under exactly the caps it will be checked with.
const GATE_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));

function outputDir(): string {
  const named = process.env.MAKEFUN_OUTPUT_DIR;
  return named && named.length > 0 ? resolve(named) : join(repoRoot, 'out');
}

// Copy one tree into the output directory, clearing any stale copy first
// so files from an earlier run can never leak into the graded output.
function copyTree(name: string, out: string): void {
  const from = join(repoRoot, name);
  const to = join(out, name);
  if (!existsSync(from)) throw new Error(`repository is missing ${name}/`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

function main(): void {
  const out = outputDir();
  mkdirSync(out, { recursive: true });
  copyTree('game', out);
  copyTree('screenshots', out);
  // buildDossier reads game/ and screenshots/ from the directory it is
  // given, so point it at the output copy: the dossier then describes the
  // exact bytes the grader receives, nothing else.
  const dossier = buildDossier(out, GATE_CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`solmara: wrote game/, screenshots/ and dossier.json (${dossier.length} bytes) to ${out}`);
}

main();
