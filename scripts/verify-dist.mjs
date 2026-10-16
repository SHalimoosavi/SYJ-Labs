import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PAGES_PREFIX = '/SYJ-Labs/';
const PAGES_ORIGIN = 'https://shalimoosavi.github.io/SYJ-Labs/';
const required = [
  'index.html',
  '404.html',
  'assets/site.css',
  'assets/site.js',
  'projects/index.html',
  'sitemap.xml',
  'robots.txt',
  'llms.txt'
];

const exists = async file => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

const htmlFiles = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.html$/i.test(entry.name)) htmlFiles.push(full);
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
const broken = [];

function resolvePublicReference(file, ref) {
  // Generated Pages URLs are rooted at /SYJ-Labs/, while the artifact itself
  // is rooted at dist/. Resolve the project prefix back into the artifact.
  if (ref.startsWith(PAGES_PREFIX)) {
    return path.join(DIST, ref.slice(PAGES_PREFIX.length));
  }

  // A root-relative reference without the Pages prefix is still relative to
  // the published artifact root, not the runner's filesystem root.
  if (ref.startsWith('/')) {
    return path.join(DIST, ref.slice(1));
  }

  return path.resolve(path.dirname(file), ref);
}

for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  let match;
  localPattern.lastIndex = 0;
  while ((match = localPattern.exec(html))) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(ref)) continue;
    const target = resolvePublicReference(file, ref);
    if (!(await exists(target))) broken.push(`${path.relative(DIST, file)} -> ${ref}`);
  }
}

if (broken.length) {
  throw new Error(`Broken local public references:\n- ${broken.join('\n- ')}`);
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

console.log(`dist verification passed: ${htmlFiles.length} HTML pages, ${sitemapUrls.length} sitemap URLs, all required assets present and all local HTML references resolve.`);
