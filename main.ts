// make.fun frontend — entrypoint (Node 22, no build step).
//
// Builds the entry directory the bounty scores: copies app/ and screenshots/
// into the output directory, writes dossier.json from the kit's
// buildDossier, then reads it back and checks it before reporting.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/frontend-out node main.ts
//
// Exit 0 only when the output is complete and the dossier is valid; any cap
// breach, missing file or mismatch fails non-zero.
import { buildDossier } from './vendor/makefun-frontend.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const MAX_SHOTS = 3;
const MAX_SHOT_BYTES = 256 * 1024;
const MAX_APP_FILES = 993;
const MAX_APP_BYTES = 16 * 1024 * 1024;
const TEXT_MAX_BYTES = 163840;

/** The output directory: $MAKEFUN_OUTPUT_DIR, else /output. */
function outputDir(): string {
  const dir = process.env.MAKEFUN_OUTPUT_DIR?.trim();
  if (dir) return resolve(dir);
  return '/output';
}

/** Count the files and bytes under a directory, recursively. */
function treeSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = treeSize(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files++;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

/** The screenshots cap: at most 3 images, each at most 256 KiB, PNG or JPEG. */
function checkScreenshots(dir: string): { count: number; bytes: number } {
  const shots = join(dir, 'screenshots');
  if (!existsSync(shots) || !statSync(shots).isDirectory()) {
    throw new Error('screenshots/: no such directory (the entry hands in 3 screenshots)');
  }
  const names = readdirSync(shots).filter((n) => statSync(join(shots, n)).isFile());
  if (names.length === 0) throw new Error('screenshots/: no images (the entry hands in 3 screenshots)');
  if (names.length > MAX_SHOTS) {
    throw new Error(`screenshots/: ${names.length} images, over the ${MAX_SHOTS} allowed`);
  }
  let bytes = 0;
  for (const name of names) {
    const path = join(shots, name);
    const size = statSync(path).size;
    if (size > MAX_SHOT_BYTES) {
      throw new Error(`screenshots/${name}: ${size} bytes, over the ${MAX_SHOT_BYTES} allowed`);
    }
    const head = readFileSync(path).subarray(0, 4);
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error(`screenshots/${name}: neither PNG nor JPEG`);
    bytes += size;
  }
  return { count: names.length, bytes };
}

/** The app cap: at most 993 files and 16 MiB under app/. */
function checkApp(dir: string): { files: number; bytes: number } {
  const app = join(dir, 'app');
  if (!existsSync(app) || !statSync(app).isDirectory()) {
    throw new Error('app/: no such directory (the entry hands in a static frontend)');
  }
  const { files, bytes } = treeSize(app);
  if (files > MAX_APP_FILES) {
    throw new Error(`app/: ${files} files, over the ${MAX_APP_FILES} allowed`);
  }
  if (bytes > MAX_APP_BYTES) {
    throw new Error(`app/: ${bytes} bytes, over the ${MAX_APP_BYTES} allowed`);
  }
  if (!existsSync(join(app, 'index.html'))) {
    throw new Error('app/index.html: no such file (the app opens at app/index.html)');
  }
  return { files, bytes };
}

/** Copy app/ and screenshots/ into the output, then check the copy matches. */
function copyEntry(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of ['app', 'screenshots']) {
    const src = join(from, name);
    const dst = join(to, name);
    if (!existsSync(src)) throw new Error(`${name}/: no such directory in ${from}`);
    cpSync(src, dst, { recursive: true });
    const want = treeSize(src);
    const got = treeSize(dst);
    if (want.files !== got.files || want.bytes !== got.bytes) {
      throw new Error(
        `${name}/: copy mismatch (source ${want.files} files, ${want.bytes} bytes; output ${got.files} files, ${got.bytes} bytes)`,
      );
    }
  }
}

/** The dossier, read back and checked: schema, cover, images and text keys. */
function readDossierBack(dir: string): { bytes: number; cover: number; images: number; textBytes: number } {
  const path = join(dir, 'dossier.json');
  const raw = readFileSync(path, 'utf8');
  const dossier = JSON.parse(raw) as Record<string, unknown>;
  if (dossier.schema !== 'makefun/dossier/v1') {
    throw new Error(`dossier.json: schema ${String(dossier.schema)}, not makefun/dossier/v1`);
  }
  if (typeof dossier.cover !== 'number') throw new Error('dossier.json: no cover key');
  if (!Array.isArray(dossier.images)) throw new Error('dossier.json: no images key');
  if (typeof dossier.text !== 'string') throw new Error('dossier.json: no text key');
  return { bytes: Buffer.byteLength(raw, 'utf8'), cover: dossier.cover, images: dossier.images.length, textBytes: Buffer.byteLength(dossier.text, 'utf8') };
}

function main(): void {
  const repo = process.cwd();
  const out = outputDir();
  const shots = checkScreenshots(repo);
  const app = checkApp(repo);
  copyEntry(repo, out);
  const dossier = buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
    app_max_files: MAX_APP_FILES,
    app_max_bytes: MAX_APP_BYTES,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
  const back = readDossierBack(out);
  console.log(`output: ${out}`);
  console.log(`app: ${app.files} files, ${app.bytes} bytes (copy verified against source)`);
  console.log(`screenshots: ${shots.count} images, ${shots.bytes} bytes`);
  console.log(`dossier.json: ${back.bytes} bytes, schema makefun/dossier/v1, cover ${back.cover}, ${back.images} images, text ${back.textBytes} bytes`);
}

main();
