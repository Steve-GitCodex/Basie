import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC_ROOT = 'js';

const NARRATION = /\/\/\s*(First|Now|Next|Then|Note:|This ensures|We use|Here we|We also|Now we)\b/;
const TRACKER = /\/\/.*\b(P\d{1,2}|B\d{1,2}|Group \d)\b(?![%px])/;
const CONSOLE_LOG = /console\.log/;

// console.log is allowed only in bootstrap code; everything else uses logManager.
const CONSOLE_OK = (rel) => rel.startsWith(`js/core/`) || rel === 'js/main.js';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(join(ROOT, SRC_ROOT))) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    if (NARRATION.test(line)) violations.push(`${where}  narration comment: ${line.trim()}`);
    if (TRACKER.test(line)) violations.push(`${where}  dead tracker reference: ${line.trim()}`);
    if (!CONSOLE_OK(rel) && CONSOLE_LOG.test(line)) violations.push(`${where}  console.log outside core bootstrap: ${line.trim()}`);
  });
}

if (violations.length > 0) {
  console.error('Banned comments / scaffolding found:\n');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('check:comments — clean');
