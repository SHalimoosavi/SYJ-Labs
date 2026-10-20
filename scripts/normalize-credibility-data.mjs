import fs from 'node:fs/promises';

const curationPath = 'data/curation.json';
const projectsPath = 'data/projects.json';

const curation = JSON.parse(await fs.readFile(curationPath, 'utf8'));
const projects = JSON.parse(await fs.readFile(projectsPath, 'utf8'));

curation._defaults = {
  include: false,
  tier: 'archive',
  category: 'Software Engineering',
  status: 'archive'
};

for (const project of projects.projects || []) {
  const entry = curation.repositories?.[project.name];
  const license = entry?.license;

  if (license && license !== 'NOASSERTION') {
    project.license = license;
  } else {
    delete project.license;
  }
}

for (const entry of Object.values(curation.repositories || {})) {
  if (entry.license === 'NOASSERTION') delete entry.license;
  entry.tier ||= 'archive';
  if (entry.tier === 'archive') entry.status = 'archive';
}

await fs.writeFile(curationPath, JSON.stringify(curation, null, 2) + '\n');
await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2) + '\n');

console.log('Credibility data normalized: default tier=archive; NOASSERTION removed.');
