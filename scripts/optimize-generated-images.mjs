import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIST = path.resolve('dist');
const ASSETS = path.join(DIST, 'assets');
const MIN_BYTES = 120 * 1024;
const QUALITY = 80;
const MAX_DIMENSION = 1200;
const IMAGEMAGICK = process.env.IMAGEMAGICK || 'convert';

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }

  return files;
}

function runConvert(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(IMAGEMAGICK, [
      input,
      '-strip',
      '-resize', `${MAX_DIMENSION}x${MAX_DIMENSION}>`,
      '-quality', String(QUALITY),
      `webp:${output}`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let error = '';
    child.stderr.on('data', chunk => { error += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(error || `ImageMagick exited with ${code}`));
    });
  });
}

const files = await walk(ASSETS);
const candidates = files.filter(file => /\.(?:jpe?g|png|webp)$/i.test(file));
let optimized = 0;
let savedBytes = 0;

for (const input of candidates) {
  const stat = await fs.stat(input);
  if (stat.size < MIN_BYTES) continue;

  // Preserve the canonical brand logo and QR/founder assets exactly as authored.
  if (/(syj-labs-logo|founder-photo|qr)/i.test(path.basename(input))) continue;

  const output = input.replace(/\.(?:jpe?g|png|webp)$/i, '.webp');
  const before = stat.size;

  try {
    await runConvert(input, output);
    const after = (await fs.stat(output)).size;

    if (after > 0 && after < before * 0.9) {
      if (output !== input) await fs.unlink(input);
      optimized += 1;
      savedBytes += before - after;
    } else if (output !== input) {
      await fs.unlink(output);
    }
  } catch (error) {
    console.warn(`WARN: image optimization skipped for ${input}: ${error.message}`);
    if (output !== input) {
      try { await fs.unlink(output); } catch {}
    }
  }
}

const generatedFiles = (await walk(DIST)).filter(file => /\.(?:html|css|xml|txt|json)$/i.test(file));

for (const file of generatedFiles) {
  let text = await fs.readFile(file, 'utf8');
  let changed = false;

  for (const input of candidates) {
    const oldRel = path.relative(DIST, input).replaceAll(path.sep, '/');
    const oldName = path.basename(oldRel);
    const newName = oldName.replace(/\.(?:jpe?g|png|webp)$/i, '.webp');
    if (oldName === newName) continue;

    const absoluteRef = `/SYJ-Labs/${oldRel}`;
    const newAbsoluteRef = `/SYJ-Labs/${oldRel.replace(oldName, newName)}`;
    const relativeRef = oldRel;
    const newRelativeRef = relativeRef.replace(oldName, newName);

    if (text.includes(absoluteRef) || text.includes(relativeRef) || text.includes(oldName)) {
      text = text.split(absoluteRef).join(newAbsoluteRef);
      text = text.split(relativeRef).join(newRelativeRef);
      text = text.split(oldName).join(newName);
      changed = true;
    }
  }

  if (changed) await fs.writeFile(file, text, 'utf8');
}

console.log(`Image optimization complete: ${optimized} assets optimized; ${(savedBytes / 1024 / 1024).toFixed(2)} MB saved.`);
