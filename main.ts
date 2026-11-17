// make.fun frontend — entrypoint (Node 22, no build step).
// Copies app/ and screenshots/ into the output directory, builds dossier.json
// with the kit's buildDossier, and refuses loudly on any cap breach.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-frontend.ts';

/** At most 3 screenshots, each at most 256 KiB. */
const MAX_SHOTS = 3;
const MAX_SHOT_BYTES = 256 * 1024;
/** The app: at most 993 files, at most 16 MiB total. */
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 16 * 1024 * 1024;
/** The dossier text's cap, as the bounty's gate sets it. */
const TEXT_MAX_BYTES = 163840;

const repoRoot = new URL('.', import.meta.url).pathname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

/** The screenshots under dir: their count and bytes, refusing on any cap breach. */
export function checkScreenshots(dir: string): { count: number; bytes: number } {
  const shots = readdirSync(dir).filter((f) => /\.(?:png|jpe?g)$/i.test(f)).sort();
  if (shots.length === 0) throw new Error(`screenshots/: no image (an entry hands in 3 screenshots)`);
  if (shots.length > MAX_SHOTS) throw new Error(`screenshots/: ${shots.length} images, over the ${MAX_SHOTS} allowed`);
  let bytes = 0;
  for (const f of shots) {
    const size = statSync(join(dir, f)).size;
    if (size > MAX_SHOT_BYTES) throw new Error(`screenshots/${f}: ${size} bytes, over the ${MAX_SHOT_BYTES} allowed`);
    bytes += size;
  }
  return { count: shots.length, bytes };
}

/** The app tree under dir: its file count and bytes, refusing on any cap breach. */
export function checkApp(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        files++;
        bytes += statSync(p).size;
        if (files > MAX_APP_FILES) throw new Error(`app/: over the ${MAX_APP_FILES} files allowed`);
        if (bytes > MAX_APP_BYTES) throw new Error(`app/: over the ${MAX_APP_BYTES} bytes allowed`);
      } else {
        throw new Error(`app/: ${p} is not a plain file`);
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

/** Build the entry in outDir and return the dossier's byte size. */
export function buildEntry(): number {
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(appDir)) throw new Error('app/: no such directory');
  if (!existsSync(shotsDir)) throw new Error('screenshots/: no such directory');
  const shots = checkScreenshots(shotsDir);
  const app = checkApp(appDir);
  mkdirSync(outDir, { recursive: true });
  cpSync(appDir, join(outDir, 'app'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  const copiedApp = checkApp(join(outDir, 'app'));
  const copiedShots = checkScreenshots(join(outDir, 'screenshots'));
  if (copiedApp.files !== app.files || copiedApp.bytes !== app.bytes) throw new Error('app/: the copy does not match the source');
  if (copiedShots.count !== shots.count || copiedShots.bytes !== shots.bytes) throw new Error('screenshots/: the copy does not match the source');
  const dossier = buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
    app_max_files: MAX_APP_FILES,
    app_max_bytes: MAX_APP_BYTES,
  });
  const bytes = Buffer.isBuffer(dossier) ? dossier : Buffer.from(dossier as unknown as Uint8Array);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, bytes);
  const back = readFileSync(dossierPath);
  if (back.length !== bytes.length) throw new Error(`dossier.json: wrote ${bytes.length} bytes, read back ${back.length}`);
  const parsed = JSON.parse(back.toString('utf8')) as Record<string, unknown>;
  for (const key of ['cover', 'images', 'schema', 'text']) {
    if (!(key in parsed)) throw new Error(`dossier.json: missing key ${key}`);
  }
  console.log(`entry: app ${app.files} files, ${app.bytes} bytes; screenshots ${shots.count}, ${shots.bytes} bytes (copy verified: ${copiedApp.files} files, ${copiedShots.count} shots)`);
  console.log(`dossier.json: ${back.length} bytes, schema ${String(parsed.schema)}, cover ${String(parsed.cover)}`);
  return back.length;
}

try {
  const size = buildEntry();
  console.log(`done: ${outDir}/dossier.json (${size} bytes)`);
} catch (err) {
  console.error(`main.ts: ${(err as Error).message}`);
  process.exit(1);
}
