import fs from 'node:fs/promises';

const OWNER = 'SHalimoosavi';
const API = 'https://api.github.com';
const CURATION = 'data/curation.json';
const now = Date.now();
const cutoff = now - 180 * 24 * 60 * 60 * 1000;
const flagshipOrder = [
  'SAYANJALI-BLOCKCHAIN',
  'sayanjali-osint',
  'SYJ-GST-Reconciliation',
  'SYJ-LaunchPad',
  'SYJ-LLM',
  'SYJ-NexusIntel-AI-web',
  'SYJ-OpenTrade-Logic',
  'SYJ-SCHOLAR-AI'
];

const hiddenNames = new Set([
  'alisonholidays', 'fix-task-broken', 'KhaledNasser', 'LawsonAnimalFarm',
  'syj-nopager-test', 'Me', 'Portfolio', 'moosavi', 'portfolio-os',
  'syed-visa-expert', 'syed-ali-hasan-moosavi', 'SYJ-Labs'
]);

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'SYJ-Labs-credibility-pass'
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] } });
  if (!response.ok) return '';
  return response.text();
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\btermux\b/gi, 'a local command-line environment')
    .replace(/\bmobile-first\b/gi, 'cross-platform')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrototype(repo) {
  const text = `${repo.name} ${repo.description || ''}`.toLowerCase();
  return /prototype|proof[- ]of[- ]concept|experimental|poc|alpha|scratch|demo/.test(text);
}

function isHidden(repo) {
  const name = repo.name.toLowerCase();
  return hiddenNames.has(repo.name) || name.includes('termux') ||
    /(^|[-_])(test|tests|demo|boilerplate|template|scratch|tmp|temp)([-_]|$)/i.test(repo.name) ||
    /test repository|testing repository|placeholder|boilerplate/i.test(repo.description || '');
}

function categoryFor(repo) {
  const text = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/llm|ai|agent|model|vision|nlp|scholar|intelligence/.test(text)) return 'AI';
  if (/blockchain|web3|token|launchpad|crypto|chain/.test(text)) return 'Blockchain';
  if (/osint|security|sentinel|aegis|shadow|recon/.test(text)) return 'Security & OSINT';
  if (/crm|saas|talent|lead|enterprise|inventory|property|nexus/.test(text)) return 'SaaS & Business';
  if (/gst|finance|trade|stock|quickstock/.test(text)) return 'Automation & Finance';
  if (/mesh|voice|chat|daypilot|educate|edu/.test(text)) return 'Apps & Tools';
  if (/farm|agro|animal/.test(text)) return 'Agriculture';
  return 'Software Engineering';
}

const current = JSON.parse(await fs.readFile(CURATION, 'utf8'));
const old = current.repositories || {};
const repos = [];
for (let page = 1; ; page += 1) {
  const batch = await getJson(`${API}/users/${OWNER}/repos?per_page=100&page=${page}&type=owner&sort=updated`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const repositories = {};
const report = [];
for (const repo of repos) {
  const manual = current.overrides?.[repo.name] || old[repo.name] || {};
  const hidden = isHidden(repo);
  const flagship = flagshipOrder.indexOf(repo.name);
  const readmeUrl = `https://raw.githubusercontent.com/${OWNER}/${repo.name}/${encodeURIComponent(repo.default_branch)}/README.md`;
  const readme = await getText(readmeUrl);
  const hasDescription = cleanText(repo.description).length >= 45;
  const recent = new Date(repo.pushed_at || 0).getTime() >= cutoff;

  let tier = flagship >= 0 ? 'flagship' : 'archive';
  if (hidden) tier = 'archive';
  else if (recent && hasDescription && readme) tier = isPrototype(repo) ? 'experimental' : 'active';
  else if (recent && (isPrototype(repo) || !readme)) tier = 'experimental';

  const include = hidden ? false : true;
  const description = cleanText(manual.description || repo.description || '') ||
    `${repo.name} is a public software project by ${OWNER}. Not documented in the repository.`;

  repositories[repo.name] = {
    include,
    tier,
    category: manual.category || categoryFor(repo),
    flagship: flagship >= 0 ? flagship + 1 : null,
    status: tier === 'archive' ? 'archive' : tier === 'experimental' ? 'experimental' : 'active',
    description: description.slice(0, 220),
    ...(hidden ? { reason: 'Excluded from the public catalogue as a test, placeholder, duplicate, client/presentation repository, or prohibited-name repository.' } : {}),
    ...(repo.license?.spdx_id ? { license: repo.license.spdx_id } : {})
  };

  report.push({ name: repo.name, tier, reason: hidden ? 'excluded from public output' : tier === 'flagship' ? 'selected flagship project' : tier === 'active' ? 'pushed within 180 days with description and README' : tier === 'experimental' ? 'recent but incomplete/prototype-stage' : 'kept public but not recently active or sufficiently documented' });
}

const output = {
  generatedAt: new Date().toISOString(),
  _defaults: { include: true, tier: 'archive', category: 'Software Engineering', status: 'archive' },
  overrides: current.overrides || {},
  repositories
};

await fs.writeFile(CURATION, JSON.stringify(output, null, 2) + '\n');
await fs.writeFile('data/curation-report.md', '# SYJ LABS project classification\n\n| Repository | Tier | Reason |\n|---|---|---|\n' + report.map(x => `| ${x.name} | ${x.tier} | ${x.reason} |`).join('\n') + '\n');
console.log(`Credibility curation prepared: ${report.length} repositories.`);
