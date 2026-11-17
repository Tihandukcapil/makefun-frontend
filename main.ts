// main.ts — entrypoint for the make.fun frontend-01 entry.
//
// Run with Node 22 and no arguments:
//
//   node main.ts
//
// It copies the repo's app/ and screenshots/ into the output directory
// ($MAKEFUN_OUTPUT_DIR, or /output when unset) and writes dossier.json
// there — the makefun/dossier/v1 dossier the bounty grades — via the
// kit's vendor buildDossier, which only ever reads files.
//
// The caps below are the bounty's: at most 3 screenshots, each at most
// 256 KiB; the app at most 993 files and 16 MiB in total. Anything over
// a cap fails loudly with a non-zero exit before any output is written.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 256 * 1024;
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 16 * 1024 * 1024;
const TEXT_MAX_BYTES = 4 * 1024 * 1024;

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

interface SizedFile {
  path: string;
  bytes: number;
}

function walkFiles(dir: string, base: string): SizedFile[] {
  const found: SizedFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(full, base));
    } else if (entry.isFile()) {
      found.push({ path: full.slice(base.length + 1), bytes: statSync(full).size });
    }
  }
  return found;
}

function checkApp(appDir: string): { files: number; bytes: number } {
  const files = walkFiles(appDir, appDir);
  if (files.length > MAX_APP_FILES) {
    fail(`app/ holds ${files.length} files, over the ${MAX_APP_FILES} cap`);
  }
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > MAX_APP_BYTES) {
    fail(`app/ totals ${total} bytes, over the ${MAX_APP_BYTES} cap`);
  }
  return { files: files.length, bytes: total };
}

function checkScreenshots(shotsDir: string): number {
  const files = readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile());
  if (files.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${files.length} images, over the ${MAX_SCREENSHOTS} cap`);
  }
  for (const name of files) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${size} bytes, over the ${MAX_SCREENSHOT_BYTES} cap`);
    }
  }
  return files.length;
}

function main(): void {
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) fail('app/ is missing or not a directory');
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) fail('screenshots/ is missing or not a directory');

  const appStats = checkApp(appDir);
  const shotCount = checkScreenshots(shotsDir);

  mkdirSync(outDir, { recursive: true });
  cpSync(appDir, join(outDir, 'app'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    app_max_files: MAX_APP_FILES,
    app_max_bytes: MAX_APP_BYTES,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  // Read it back: a short or missing dossier means the write did not land.
  const written = readFileSync(dossierPath);
  if (written.length !== dossier.length) {
    fail(`dossier.json on disk is ${written.length} bytes, expected ${dossier.length}`);
  }
  console.log(
    `main.ts: app ${appStats.files} files (${appStats.bytes} bytes), ${shotCount} screenshots -> ${dossierPath} (${dossier.length} bytes)`,
  );
}

main();
