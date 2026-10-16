import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const staleHomepageRepos = new Set([
  'syj-one',
  'syj-leadforge',
  'ai-zara-web-widget',
  'syj-github-optimiser'
]);

const staleHomepageUrls = new Set([
  'https://shalimoosavi.github.io/syj-one/',
  'https://shalimoosavi.github.io/SYJ-LeadForge/',
  'https://shalimoosavi.github.io/AI-Zara-web-widget/',
  'https://github.com/SHalimoosavi/syj-github-optimizer'
]);

const stripMarkdownLinks = value =>
  String(value || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');

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

function cleanProjectData(projects) {
  for (const project of projects) {
    project.description = stripMarkdownLinks(project.description);

    const slug = String(project.slug || '').toLowerCase();
    const homepage = String(project.homepage || '');

    // Do not publish stale repository homepage metadata as a production CTA.
    // The repository itself is always the authoritative project destination.
    project.homepage = '';

    if (staleHomepageRepos.has(slug) || staleHomepageUrls.has(homepage)) {
      project.homepage = '';
    }
  }
  return projects;
}

async function cleanJson(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));

    if (Array.isArray(data.projects)) {
      data.projects = cleanProjectData(data.projects);
    }

    if (data.repositories && typeof data.repositories === 'object') {
      for (const [name, project] of Object.entries(data.repositories)) {
        project.description = stripMarkdownLinks(project.description);
        project.homepage = '';
        if (staleHomepageRepos.has(String(name).toLowerCase())) {
          project.homepage = '';
        }
      }
    }

    await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch {
    // Optional generated JSON; leave missing/unreadable files alone.
  }
}

async function cleanHtml(file) {
  let html;
  try {
    html = await fs.readFile(file, 'utf8');
  } catch {
    return;
  }

  for (const url of staleHomepageUrls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`\\s*<a\\b[^>]*href=["']${escaped}["'][\\s\\S]*?<\\/a>`, 'gi'),
      ''
    );
  }

  // The catalogue uses WebP previews. Keep project detail pages on the same
  // runtime asset so one generated asset is used consistently everywhere.
  html = html.replace(/(assets\/projects\/[^"'?#]+)\.png/gi, '$1.webp');

  // Remove live-site CTAs generated from unverified GitHub homepage metadata.
  html = html.replace(
    /\s*<a\b[^>]*class=["'][^"']*button[^"']*["'][^>]*>\s*Live site\s*↗\s*<\/a>/gi,
    ''
  );

  html = stripMarkdownLinks(html);
  await fs.writeFile(file, html, 'utf8');
}

await cleanJson(path.join(ROOT, 'data/projects.json'));
await cleanJson(path.join(DIST, 'data/projects.json'));

const files = await walk(DIST);
for (const file of files) {
  if (/\.(html|txt)$/i.test(file)) {
    await cleanHtml(file);
  }
}

console.log('Post-build cleanup complete: stale homepage CTAs removed, project previews normalized to WebP, and markdown artifacts cleaned.');
