import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const runnerTemp = process.env.RUNNER_TEMP || os.tmpdir();
const bundleRoot = path.join(runnerTemp, `syj-labs-fix-bundle-${process.pid}`);
const zipPath = path.join(runnerTemp, 'syj-labs-fix.zip');

const changed = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMRT', 'origin/main...HEAD'],
  { cwd: root, encoding: 'utf8' }
)
  .split(/\r?\n/)
  .map(file => file.trim())
  .filter(Boolean)
  .filter(file => !file.startsWith('dist/'))
  .filter(file => !file.startsWith('node_modules/'))
  .filter(file => !file.startsWith('.git/'))
  .filter(file => !file.startsWith('.lighthouseci/'))
  .sort();

if (!changed.length) {
  throw new Error('No changed source files found against origin/main; cannot package syj-labs-fix.zip.');
}

await fs.rm(bundleRoot, { recursive: true, force: true });
await fs.mkdir(bundleRoot, { recursive: true });

const copied = [];
for (const relative of changed) {
  const source = path.resolve(root, relative);
  if (!source.startsWith(root + path.sep)) {
    throw new Error(`Refusing unsafe patch path: ${relative}`);
  }
  const stat = await fs.stat(source);
  if (!stat.isFile()) continue;
  const destination = path.join(bundleRoot, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  copied.push(relative);
}

const readme = `# SYJ LABS source patch

Base: \`e682e0649d95050cbb53f39ac105bc888900f8cf\` (\`main\`).

This bundle contains only complete, changed source/configuration files from the fix branch. It does not include \`dist/\`, \`node_modules/\`, cached build output, or secrets.

## What it addresses

- Copies required \`assets/site.css\` and \`assets/site.js\` into \`dist/assets/\`; required asset failures now name the missing path.
- Runs \`verify:dist\` from the build and before Pages artifact upload. The verifier checks local HTML asset/page links, sitemap targets, required files, forbidden public copy, and leaked local build paths.
- Makes project-data generation stable by removing per-build timestamps and only rewriting unchanged data when contents actually change.
- Keeps repository thumbnails untouched and optimizes the referenced logo to a stable public path; falls back to ImageMagick with a visible warning if Sharp is unavailable.
- Adds platform-neutral curation text, excludes \`termux-pro\` and \`termux-pro-app\` from public output, and removes stale homepage links known to return 404.
- Adds responsive width checks, screenshot capture, Pa11y, and Lighthouse checks in GitHub Actions.

## Applying

Extract this archive at the repository root, validate hashes with \`sha256sum -c MANIFEST.txt\`, then run \`npm install --no-audit --no-fund\`, \`npm run build\`, and \`npm run verify:dist\`. Keep generated output out of source control: after reviewing the result, run \`git rm -r --cached dist\` when \`dist/\` is tracked. Do not restore unrelated local work over these files; stash it first and restore it after reconciliation.

\`DELETED.txt\` is \`none\`: generated \`dist/\` removal is intentionally handled separately by the apply steps.

## Remaining verification limits

GitHub Actions runs the build with GitHub API access and ImageMagick. Live Pages status remains unverified until the PR is merged and the Pages deployment completes. Lighthouse results can vary slightly between runs and should be checked in the linked Actions report.
`;

await fs.writeFile(path.join(bundleRoot, 'PATCH-README.md'), readme, 'utf8');
await fs.writeFile(path.join(bundleRoot, 'DELETED.txt'), 'none\n', 'utf8');

const manifestEntries = [];
for (const relative of [...copied, 'PATCH-README.md', 'DELETED.txt'].sort()) {
  const bytes = await fs.readFile(path.join(bundleRoot, relative));
  const digest = createHash('sha256').update(bytes).digest('hex');
  manifestEntries.push(`${digest}  ./${relative}`);
}
await fs.writeFile(path.join(bundleRoot, 'MANIFEST.txt'), manifestEntries.join('\n') + '\n', 'utf8');

await fs.rm(zipPath, { force: true });
execFileSync('zip', ['-qr', zipPath, '.'], { cwd: bundleRoot, stdio: 'inherit' });

console.log(`PATCH ZIP: ${zipPath}`);
console.log(`SOURCE FILES INCLUDED: ${copied.length}`);
for (const file of copied) console.log(` - ${file}`);
console.log('MANIFEST: SHA-256 hashes written for every payload file except MANIFEST.txt itself.');
