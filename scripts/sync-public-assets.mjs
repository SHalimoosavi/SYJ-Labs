import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const assets = [
  ['assets/site.css', 'assets/site.css'],
  ['assets/site.js', 'assets/site.js']
];

for (const [source, target] of assets) {
  const from = path.join(ROOT, source);
  const to = path.join(DIST, target);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

console.log('Public runtime assets copied to dist/assets.');
