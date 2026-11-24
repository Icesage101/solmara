// Solmara: Streets of the Sun — the entry program (Node 22, standard library only).
//
// It hands the game in: copies this repository's game/ and screenshots/ into the
// output directory and writes /output/dossier.json with the vendored make.fun
// library, which is the summary the judge reads. The game itself is plain static
// files (game/index.html and its ES modules, no library, no network request),
// so any static server can play it. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game, the screenshots, then the dossier the scorer checks byte for byte.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps, from the kit's gate: the text cap shapes the dossier's
// bytes, and the rest refuse an entry the scorer would refuse — more than four
// screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
