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

const cleanDescription = value => String(value ?? '')
  .replace(/\btermux\b/gi, 'Android')
  .replace(/\bmobile-first\b/gi, 'cross-platform')
  .replace(/\s+/g, ' ')
  .trim();

const licenseDisplay = value => {
  if (!value) return NO_LICENSE_FILE;
  if (String(value).toUpperCase() === 'NOASSERTION') return UNRECOGNISED_LICENSE;
  return String(value);
};

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

for (const project of projects.projects || []) {
  const entry = curation.repositories?.[project.name] || {};
  const apiLicense = project.licenseApi ?? project.license ?? entry.licenseApi ?? entry.license ?? null;
  const displayLicense = licenseDisplay(apiLicense);

  if (descriptionOverrides[project.name]) project.description = descriptionOverrides[project.name];
  else project.description = cleanDescription(project.description);

  if (Array.isArray(project.topics)) {
    project.topics = project.topics.filter(topic => !/termux|mobile-first/i.test(String(topic)));
  }

  project.licenseApi = apiLicense;
  project.license = apiLicense ? displayLicense : null;

  curation.repositories ||= {};
  curation.repositories[project.name] ||= {};
  curation.repositories[project.name].licenseApi = apiLicense;
  curation.repositories[project.name].license = apiLicense ? displayLicense : null;
}

projects.projects = (projects.projects || []).filter(project => project.include !== false);

for (const [name, entry] of Object.entries(curation.repositories || {})) {
  if (descriptionOverrides[name]) entry.description = descriptionOverrides[name];
  const apiLicense = entry.licenseApi ?? entry.license ?? null;
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
  await fs.writeFile(distProjectsPath, JSON.stringify(projects, null, 2) + '\n');
} catch {}

console.log('Credibility data normalized: license API values retained, NOASSERTION mapped to a display-safe label, prohibited project metadata filtered, generated tiers preserved, and hidden projects removed from generated data.');
