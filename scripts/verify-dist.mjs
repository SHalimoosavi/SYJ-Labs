import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
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

for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  let match;
  while ((match = localPattern.exec(html))) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(ref)) continue;
    const target = path.resolve(path.dirname(file), ref);
    if (!(await exists(target))) broken.push(`${path.relative(DIST, file)} -> ${ref}`);
  }
}

if (broken.length) {
  throw new Error(`Broken local public references:\n- ${broken.join('\n- ')}`);
}

const sitemap = await fs.readFile(path.join(DIST, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
for (const url of sitemapUrls) {
  if (!url.startsWith('https://shalimoosavi.github.io/SYJ-Labs/')) continue;
  const relative = url.replace('https://shalimoosavi.github.io/SYJ-Labs/', '');
  const target = path.join(DIST, relative || 'index.html');
  const normalized = relative.endsWith('/') ? path.join(target, 'index.html') : target;
  if (!(await exists(normalized))) throw new Error(`Sitemap target missing: ${url}`);
}

console.log(`dist verification passed: ${htmlFiles.length} HTML pages, ${sitemapUrls.length} sitemap URLs, all required assets present and all local HTML references resolve.`);
