import fs from 'node:fs/promises';

const file = 'data/curation.json';
const data = JSON.parse(await fs.readFile(file, 'utf8'));

const PROHIBITED = /\b(termux|mobile-first)\b/gi;
const clean = value => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(PROHIBITED, m => m.toLowerCase() === 'mobile-first' ? 'cross-platform' : 'local command-line environment')
  .replace(/\s+/g, ' ')
  .trim();

for (const entry of Object.values(data.repositories || {})) {
  entry.description = clean(entry.description);
  entry.tier ||= entry.flagship ? 'flagship' : 'archive';
  if (entry.flagship) entry.tier = 'flagship';
  entry.status = entry.tier === 'archive' ? 'archive' : entry.tier === 'experimental' ? 'experimental' : 'active';
}

const order = Object.values(data.repositories || {})
  .filter(x => x.include && x.tier === 'flagship')
  .sort((a, b) => (a.flagship ?? 999) - (b.flagship ?? 999));
order.forEach((entry, index) => { entry.flagship = index + 1; entry.tier = 'flagship'; });

for (const entry of Object.values(data.repositories || {})) {
  if (!entry.include) entry.flagship = null;
}

data.generatedAt = new Date().toISOString();
await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Catalogue curation prepared: ${Object.keys(data.repositories || {}).length} repository entries. Final public count is computed from the generated GitHub inventory.`);
