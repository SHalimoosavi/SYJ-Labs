import fs from 'node:fs/promises';

const curationPath = 'data/curation.json';
const projectsPath = 'data/projects.json';
const classificationPath = 'data/credibility-classification.json';
const distProjectsPath = 'dist/data/projects.json';

const NO_LICENSE_FILE = 'No license file';
const UNRECOGNISED_LICENSE = 'License file present but not recognised';

const curation = JSON.parse(await fs.readFile(curationPath, 'utf8'));
const projects = JSON.parse(await fs.readFile(projectsPath, 'utf8'));

const descriptionOverrides = {
  'SYJ-AI': 'Open-source local-first autonomous AI software engineering agent that runs offline through Ollama across Android, Linux, Windows, and macOS.',
  'SYJ-Nexus-Event-Trace': 'A local-first webhook event sink and logger that captures, verifies, stores, and replays webhooks in SQLite. Runs with Node.js on Linux, Windows, macOS, and Android.',
  'SYJ-Nexus-Sentinel-Audit': 'A cross-platform security observability daemon that monitors local network devices, flags unrecognized devices against a whitelist, and generates daily audit reports.'
};

const asApiLicense = value => {
  if (!value) return null;
  if (typeof value === 'object') return value.spdx_id || value.name || null;
  return String(value).trim() || null;
};

const licenseDisplay = value => {
  const apiLicense = asApiLicense(value);
  if (!apiLicense) return NO_LICENSE_FILE;
  if (apiLicense.toUpperCase() === 'NOASSERTION') return UNRECOGNISED_LICENSE;
  return apiLicense;
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
  const displayLicense = apiLicense ? licenseDisplay(apiLicense) : null;

  if (descriptionOverrides[project.name]) project.description = descriptionOverrides[project.name];
  else project.description = cleanDescription(project.description);

  if (Array.isArray(project.topics)) {
    project.topics = project.topics.filter(topic => !/termux|mobile-first/i.test(String(topic)));
  }

  project.licenseApi = apiLicense;
  project.license = displayLicense;
  normalizedByName.set(project.name, project);

  curation.repositories ||= {};
  curation.repositories[project.name] ||= {};
  curation.repositories[project.name].licenseApi = apiLicense;
  curation.repositories[project.name].license = displayLicense;
}

projects.projects = (projects.projects || []).filter(project => project.include !== false);

for (const [name, entry] of Object.entries(curation.repositories || {})) {
  if (descriptionOverrides[name]) entry.description = descriptionOverrides[name];
  const apiLicense = asApiLicense(entry.licenseApi ?? entry.license ?? null);
  entry.licenseApi = apiLicense;
  entry.license = apiLicense ? licenseDisplay(apiLicense) : null;
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
      project.license = normalized.license;
      if (Array.isArray(normalized.topics)) project.topics = normalized.topics;
    }
    await fs.writeFile(distProjectsPath, JSON.stringify(dist, null, 2) + '\n');
  }
} catch {}

console.log('Credibility data normalized: license API values retained, NOASSERTION mapped to a display-safe label, prohibited project metadata filtered, generated tiers preserved, and hidden projects removed from generated data.');
