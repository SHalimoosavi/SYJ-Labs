import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const IMAGEMAGICK = process.env.IMAGEMAGICK || 'convert';

const staleHomepageRepos = new Set(['syj-one','syj-leadforge','ai-zara-web-widget','syj-github-optimiser']);
const staleHomepageUrls = new Set(['https://shalimoosavi.github.io/syj-one/','https://shalimoosavi.github.io/SYJ-LeadForge/','https://shalimoosavi.github.io/AI-Zara-web-widget/','https://github.com/SHalimoosavi/syj-github-optimizer']);
const stripMarkdownLinks = value => String(value || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full)); else files.push(full);
  }
  return files;
}

function cleanProjectData(projects) {
  for (const project of projects) {
    project.description = stripMarkdownLinks(project.description);
    const slug = String(project.slug || '').toLowerCase();
    const homepage = String(project.homepage || '');
    project.homepage = '';
    if (staleHomepageRepos.has(slug) || staleHomepageUrls.has(homepage)) project.homepage = '';
  }
  return projects;
}

async function cleanJson(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (Array.isArray(data.projects)) data.projects = cleanProjectData(data.projects);
    if (data.repositories && typeof data.repositories === 'object') {
      for (const [name, project] of Object.entries(data.repositories)) {
        project.description = stripMarkdownLinks(project.description);
        project.homepage = '';
        if (staleHomepageRepos.has(String(name).toLowerCase())) project.homepage = '';
      }
    }
    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch {}
}

function optimizeCatalogue(html) {
  let cardIndex = 0;
  html = html.replace(/<article\b([^>]*class=["'][^"']*\bcard\b[^"']*["'][^>]*)>/gi, (full, attrs) => {
    cardIndex += 1;
    if (cardIndex <= 12 || /\bhidden\b/.test(attrs)) return full;
    return `<article${attrs} hidden>`;
  });
  if (!html.includes('id="catalogue-section-heading"')) html = html.replace(/(<section\s+class=["']grid catalogue-grid["'][^>]*id=["']catalogue["'])/i, '<h2 id="catalogue-section-heading" class="catalogue-section-heading">Projects</h2>$1');
  if (cardIndex > 12 && !html.includes('id="load-more-projects"')) html = html.replace(/(<section\s+class=["']grid catalogue-grid["'][^>]*id=["']catalogue["'][\s\S]*?<\/section>)/i, '$1<div class="center"><button class="button outline" id="load-more-projects" type="button">Load more projects</button></div>');
  return html;
}

function injectAccessibilityStyles(html) {
  const style = `<style id="syj-a11y-overrides">.hero-bottom{color:#72948c}.focus-grid b{color:#72948c}.catalogue-section-heading{max-width:1180px;margin:0 auto 18px;padding:0 24px;font-size:28px;line-height:1.1}.site-header{backdrop-filter:none!important}.hero-glow{filter:none!important;animation:none!important}.reveal{animation:none!important}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #d7ff63;outline-offset:3px}</style>`;
  return html.includes('id="syj-a11y-overrides"') ? html : html.replace('</head>', `${style}</head>`);
}

async function optimizeImage(file, resize, quality) {
  await new Promise((resolve, reject) => {
    const child = spawn(IMAGEMAGICK, [file, '-resize', resize, '-strip', '-quality', String(quality), file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error || `ImageMagick exited ${code} for ${file}`)));
  });
}

async function optimizeImages() {
  const projectDir = path.join(DIST, 'assets/projects');
  try {
    const projectFiles = (await fs.readdir(projectDir)).filter(file => file.endsWith('.webp'));
    await Promise.all(projectFiles.map(file => optimizeImage(path.join(projectDir, file), '960x480>', 72)));
  } catch {}
  const founder = path.join(DIST, 'assets/founder-photo.webp');
  try { await optimizeImage(founder, '720x720>', 78); } catch {}
  try {
    for (const file of await fs.readdir(projectDir)) if (file.endsWith('.png')) await fs.rm(path.join(projectDir, file), { force: true });
  } catch {}
}

async function cleanHtml(file) {
  let html;
  try { html = await fs.readFile(file, 'utf8'); } catch { return; }
  for (const url of staleHomepageUrls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`\\s*<a\\b[^>]*href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'gi'), '');
  }
  html = html.replace(/(assets\/projects\/[^"'?#]+)\.png/gi, '$1.webp');
  html = html.replace(/\s*<a\b[^>]*class=["'][^"']*button[^"']*["'][^>]*>\s*Live site\s*↗\s*<\/a>/gi, '');
  html = stripMarkdownLinks(html);
  html = injectAccessibilityStyles(html);

  if (path.resolve(file) === path.resolve(path.join(DIST, 'index.html'))) {
    let visibleProjectImage = 0;
    html = html.replace(/<img\b[^>]*src=["'][^"']*assets\/projects\/[^"']+["'][^>]*>/gi, tag => {
      visibleProjectImage += 1;
      return visibleProjectImage <= 2 ? tag.replace(/\sloading=["']lazy["']/i, ' loading="eager"') : tag;
    });
  }

  if (path.resolve(file) === path.resolve(path.join(DIST, 'projects/index.html'))) html = optimizeCatalogue(html);
  html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/[ \t]{2,}/g, ' ');
  await fs.writeFile(file, html, 'utf8');
}

await cleanJson(path.join(ROOT, 'data/projects.json'));
await cleanJson(path.join(DIST, 'data/projects.json'));
const files = await walk(DIST);
for (const file of files) if (/\.(html|txt)$/i.test(file)) await cleanHtml(file);
await optimizeImages();
console.log('Post-build cleanup complete: stale homepage CTAs removed, project previews optimized to WebP, markdown artifacts cleaned, catalogue loading optimized, HTML minified, and accessibility/performance fixes injected.');
