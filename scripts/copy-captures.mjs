/**
 * Copies video captures from Playwright test-results/ to docs/screenshots/
 * with readable filenames derived from the test title.
 */
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const SRC = 'test-results';
const DEST = 'docs/screenshots';

if (!existsSync(SRC)) {
  console.log('No test-results/ directory found — skipping video copy.');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

let copied = 0;

for (const dir of readdirSync(SRC, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const dirPath = join(SRC, dir.name);
  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith('.webm')) continue;
    // dir.name looks like "capture-spec-ts-flow-add-comment-capture-chromium"
    // Extract a readable name from the directory
    const name = dir.name
      .replace(/^capture-spec-ts-/, '')
      .replace(/-capture$/, '')
      .replace(/-chromium$/, '');
    const dest = join(DEST, `${name}.webm`);
    copyFileSync(join(dirPath, file), dest);
    console.log(`Copied: ${dest}`);
    copied++;
  }
}

console.log(`Done — ${copied} video(s) copied to ${DEST}/`);
