import fs from 'node:fs/promises';

const curationPath = 'data/curation.json';
const projectsPath = 'data/projects.json';

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
  const entry = curation.repositories?.[project.name];
  const license = entry?.license;

  if (descriptionOverrides[project.name]) {
    project.description = descriptionOverrides[project.name];
  } else {
    project.description = cleanDescription(project.description);
  }

  if (Array.isArray(project.topics)) {
    project.topics = project.topics.filter(topic => !/termux|mobile-first/i.test(String(topic)));
  }

  if (license && license !== 'NOASSERTION') {
    project.license = license;
  } else {
    delete project.license;
  }
}

for (const [name, entry] of Object.entries(curation.repositories || {})) {
  if (descriptionOverrides[name]) {
    entry.description = descriptionOverrides[name];
  } else {
    entry.description = cleanDescription(entry.description);
  }
  if (entry.license === 'NOASSERTION') delete entry.license;
  entry.tier ||= 'archive';
  if (entry.tier === 'archive') entry.status = 'archive';
}

await fs.writeFile(curationPath, JSON.stringify(curation, null, 2) + '\n');
await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2) + '\n');

console.log('Credibility data normalized: default tier=archive; prohibited project metadata filtered; NOASSERTION removed.');
