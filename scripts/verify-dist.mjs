import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PAGES_PREFIX = '/SYJ-Labs/';
const PAGES_ORIGIN = 'https://shalimoosavi.github.io/SYJ-Labs/';
const PROHIBITED_PUBLIC_COPY = /\b(termux|mobile-first)\b/i;
const required = [
  'index.html',
  '404.html',
  'assets/site.css',
  'assets/site.js',
  'projects/index.html',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'llms-full.txt',
  'site.webmanifest'
];

const exists = async file => {
  try { await fs.access(file); return true; } catch { return false; }
};

const htmlFiles = [];
const publicFiles = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else {
      publicFiles.push(full);
      if (/\.html$/i.test(entry.name)) htmlFiles.push(full);
    }
  }
}

if (!(await exists(DIST))) throw new Error('dist/ does not exist. Run npm run build first.');

const missing = [];
for (const relative of required) {
  if (!(await exists(path.join(DIST, relative)))) missing.push(relative);
}
if (missing.length) throw new Error(`Missing required public files:\n- ${missing.join('\n- ')}`);

await walk(DIST);

const localPattern = /(?:href|src)=["']([^"'#?]+)["']/gi;
const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
const broken = [];

function resolvePublicReference(file, ref) {
  if (ref.startsWith(PAGES_PREFIX)) return path.join(DIST, ref.slice(PAGES_PREFIX.length));
  if (ref.startsWith('/')) return path.join(DIST, ref.slice(1));
  return path.resolve(path.dirname(file), ref);
}

function checkReference(file, ref, label) {
  if (/^(?:https?:|mailto:|tel:|javascript:|data:|\/\/|#)/i.test(ref)) return;
  const target = resolvePublicReference(file, ref);
  if (!fsSync.existsSync(target)) broken.push(`${path.relative(DIST, file)} -> ${label}: ${ref}`);
}

for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  let match;
  localPattern.lastIndex = 0;
  while ((match = localPattern.exec(html))) checkReference(file, match[1], 'href/src');

  srcsetPattern.lastIndex = 0;
  while ((match = srcsetPattern.exec(html))) {
    for (const candidate of match[1].split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean)) {
      checkReference(file, candidate, 'srcset');
    }
  }

  if (PROHIBITED_PUBLIC_COPY.test(html)) throw new Error(`Prohibited public copy found in ${path.relative(DIST, file)}`);

  const ogImages = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  for (const image of ogImages) {
    if (!image.startsWith('http')) checkReference(file, image, 'social-image');
  }
}

if (broken.length) throw new Error(`Broken local public references:\n- ${broken.join('\n- ')}`);

for (const file of publicFiles) {
  if (!/\.(html|xml|txt|json|webmanifest)$/i.test(file)) continue;
  const text = await fs.readFile(file, 'utf8');
  if (PROHIBITED_PUBLIC_COPY.test(text)) throw new Error(`Prohibited public copy found in ${path.relative(DIST, file)}`);
}

const sitemap = await fs.readFile(path.join(DIST, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
for (const url of sitemapUrls) {
  if (!url.startsWith(PAGES_ORIGIN)) continue;
  const relative = url.replace(PAGES_ORIGIN, '');
  const target = path.join(DIST, relative || 'index.html');
  const normalized = relative.endsWith('/') ? path.join(target, 'index.html') : target;
  if (!(await exists(normalized))) throw new Error(`Sitemap target missing: ${url}`);
}

const projectPages = htmlFiles.filter(file => file.includes(`${path.sep}projects${path.sep}`) && path.basename(file) === 'index.html');
const fonts = publicFiles.filter(file => /\.(woff2?|ttf|otf)$/i.test(file));
const images = publicFiles.filter(file => /\.(avif|webp|png|jpe?g|svg)$/i.test(file));
const ogProjectImages = images.filter(file => file.includes(`${path.sep}assets${path.sep}projects${path.sep}`));
if (!fonts.length) throw new Error('No self-hosted font asset found.');
if (!ogProjectImages.length) throw new Error('No generated project social-preview images found.');

console.log([
  'dist verification passed',
  `HTML=${htmlFiles.length}`,
  `projects=${projectPages.length}`,
  `sitemap=${sitemapUrls.length}`,
  `images=${images.length}`,
  `projectOG=${ogProjectImages.length}`,
  `fonts=${fonts.length}`,
  'localRefs=ok',
  'srcset=checked',
  'publicCopy=clean'
].join(' | '));
