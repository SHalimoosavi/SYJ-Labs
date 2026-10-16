import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

// These are legacy homepage values that are no longer valid. The canonical
// project pages now live inside SYJ LABS, so generated cards should not expose
// dead Live site buttons for them.
const BROKEN_HOME_PAGES = new Set([
  'https://shalimoosavi.github.io/syj-one/',
  'https://shalimoosavi.github.io/SYJ-LeadForge/',
  'https://shalimoosavi.github.io/AI-Zara-web-widget/',
  'https://github.com/SHalimoosavi/syj-github-optimizer'
]);

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

function sanitizeProjectsJson(text) {
  const data = JSON.parse(text);

  for (const project of data) {
    if (BROKEN_HOME_PAGES.has(project.homepage)) {
      project.homepage = '';
    }
  }

  return JSON.stringify(data, null, 2) + '\n';
}

function sanitizeHtml(text) {
  let out = text;

  for (const url of BROKEN_HOME_PAGES) {
    const escaped = url.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const liveSite = new RegExp(
      `<a\\s+class="button"\\s+href="${escaped}"[\\s\\S]*?<\\/a>`,
      'gi'
    );
    out = out.replace(liveSite, '');
  }

  return out;
}

const projectDataFiles = [
  path.join(ROOT, 'data/projects.json'),
  path.join(DIST, 'data/projects.json')
];

for (const file of projectDataFiles) {
  try {
    const text = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, sanitizeProjectsJson(text), 'utf8');
  } catch {
    // The build may not have produced every optional metadata file.
  }
}

for (const file of await walk(DIST)) {
  if (!/\.(html|xml|txt|json)$/i.test(file)) continue;

  const text = await fs.readFile(file, 'utf8');
  const sanitized = file.endsWith('.html') ? sanitizeHtml(text) : text;

  if (sanitized !== text) {
    await fs.writeFile(file, sanitized, 'utf8');
  }
}

console.log('Generated metadata sanitization complete.');
