// makefun-frontend-01 entry program (Node 22, stdlib only). The frontend is the
// app/ folder beside this file: plain static files a browser opens at
// app/index.html, reading make.fun's public API. This program hands it in: it
// copies app/ and screenshots/ to /output (or $MAKEFUN_OUTPUT_DIR outside the
// grader) and writes /output/dossier.json with the vendored make.fun library.
// vendor/makefun-frontend.ts is the kit's copy, unchanged: the scorer rebuilds
// the dossier with its own copy and compares the two byte for byte.
import {cpSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDossier} from './vendor/makefun-frontend.ts';

const here=fileURLToPath(new URL('.',import.meta.url));
const out=process.env.MAKEFUN_OUTPUT_DIR??'/output';

mkdirSync(out,{recursive:true});
cpSync(join(here,'app'),join(out,'app'),{recursive:true});
mkdirSync(join(out,'screenshots'),{recursive:true});
if(existsSync(join(here,'screenshots')))cpSync(join(here,'screenshots'),join(out,'screenshots'),{recursive:true});

// The scorer's caps: text_max_bytes shapes the dossier's bytes; the rest refuse
// an entry the scorer would refuse (over 3 screenshots or one over 256 KiB;
// over 993 files/dirs in app/ or 16 MiB of app files).
writeFileSync(
  join(out,'dossier.json'),
  buildDossier(out,{text_max_bytes:163840,screenshots:{max:3,max_bytes:262144},app_max_files:993,app_max_bytes:16777216}),
);
