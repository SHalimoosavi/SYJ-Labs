import fs from 'node:fs/promises';
import { asApiLicense, licenseDisplay } from './license-mapping.mjs';

const curationPath = 'data/curation.json';
const projectsPath = 'data/projects.json';
const classificationPath = 'data/credibility-classification.json';
const distProjectsPath = 'dist/data/projects.json';
const distManifestPath = 'dist/data/public-manifest.json';

const curation = JSON.parse(await fs.readFile(curationPath, 'utf8'));
const projects = JSON.parse(await fs.readFile(projectsPath, 'utf8'));

const descriptionOverrides = {
  'SYJ-AI': 'Open-source local-first autonomous AI software engineering agent that runs offline through Ollama across Android, Linux, Windows, and macOS.',
  'SYJ-Nexus-Event-Trace': 'A local-first webhook event sink and logger that captures, verifies, stores, and replays webhooks in SQLite. Runs with Node.js on Linux, Windows, macOS, and Android.',
  'SYJ-Nexus-Sentinel-Audit': 'A cross-platform security observability daemon that monitors local network devices, flags unrecognized devices against a whitelist, and generates daily audit reports.',
  'sayanjali-osint': 'OSINT and geolocation framework for collecting, correlating and reporting publicly available intelligence from network and location data sources.',
  'SYJ-GST-Reconciliation': 'Offline GST invoice reconciliation tool for Indian SMEs, CAs and accountants that cross-verifies supplier invoices against purchase records.',
  'SYJ-SCHOLAR-AI': 'Open-source study assistant that turns documents into summaries, notes, flashcards, quizzes and exam-preparation material using locally runnable AI.'
};

const cleanDescription = value => String(value ?? '')
  .replace(/\btermux\b/gi, 'Android')
  .replace(/\bmobile-first\b/gi, 'cross-platform')
  .replace(/\s+/g, ' ')
  .trim();

curation._defaults = {
  include: false,
  tier: 'archive',
  category: 'Software Engineering',
  status: 'archive'
};

for (const [name, description] of Object.entries(descriptionOverrides)) {
  curation.repositories ||= {};
  curation.repositories[name] ||= {};
  curation.repositories[name].description = description;
}

const normalizedByName = new Map();

for (const project of projects.projects || []) {
  const entry = curation.repositories?.[project.name] || {};
  const apiLicense = asApiLicense(
    entry.licenseApi ?? project.licenseApi ?? project.license ?? entry.license ?? null
  );
  const displayLicense = licenseDisplay(apiLicense);

  if (descriptionOverrides[project.name]) project.description = descriptionOverrides[project.name];
  else project.description = cleanDescription(project.description);

  if (Array.isArray(project.topics)) {
    project.topics = project.topics.filter(topic => !/termux|mobile-first/i.test(String(topic)));
  }

  project.licenseApi = apiLicense;
  project.licenseDisplay = displayLicense;
  project.license = displayLicense;
  normalizedByName.set(project.name, project);

  curation.repositories ||= {};
  curation.repositories[project.name] ||= {};
  curation.repositories[project.name].licenseApi = apiLicense;
  curation.repositories[project.name].licenseDisplay = displayLicense;
  curation.repositories[project.name].license = displayLicense;
}

projects.projects = (projects.projects || []).filter(project => project.include !== false);

for (const [name, entry] of Object.entries(curation.repositories || {})) {
  if (descriptionOverrides[name]) entry.description = descriptionOverrides[name];
  const apiLicense = asApiLicense(entry.licenseApi ?? entry.license ?? null);
  entry.licenseApi = apiLicense;
  entry.licenseDisplay = licenseDisplay(apiLicense);
  entry.license = entry.licenseDisplay;
  if (!entry.tier) {
    entry.tier = entry.flagship
      ? 'flagship'
      : entry.status === 'experimental'
        ? 'experimental'
        : entry.status === 'archive'
          ? 'archive'
          : 'active';
  }
  if (entry.tier === 'archive') entry.status = 'archive';
}

await fs.writeFile(curationPath, JSON.stringify(curation, null, 2) + '\n');
await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2) + '\n');
await fs.writeFile(classificationPath, JSON.stringify(curation, null, 2) + '\n');

try {
  const dist = JSON.parse(await fs.readFile(distProjectsPath, 'utf8'));
  if (Array.isArray(dist.projects)) {
    for (const project of dist.projects) {
      const normalized = normalizedByName.get(project.name);
      if (!normalized) continue;
      project.licenseApi = normalized.licenseApi;
      project.licenseDisplay = normalized.licenseDisplay;
      project.license = normalized.licenseDisplay;
      if (Array.isArray(normalized.topics)) project.topics = normalized.topics;
    }
    await fs.writeFile(distProjectsPath, JSON.stringify(dist, null, 2) + '\n');
  }

  const manifest = JSON.parse(await fs.readFile(distManifestPath, 'utf8'));
  if (Array.isArray(manifest.projects)) {
    for (const project of manifest.projects) {
      const normalized = normalizedByName.get(project.name);
      if (!normalized) continue;
      project.licenseApi = normalized.licenseApi;
      project.licenseDisplay = normalized.licenseDisplay;
    }
    await fs.writeFile(distManifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
} catch {}

console.log('Credibility data normalized: every manifest project has explicit licenseApi and licenseDisplay, public license text is display-safe, prohibited project metadata is filtered, generated tiers are preserved, and hidden projects are removed from generated data.');
