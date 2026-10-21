import fs from 'node:fs/promises';

const OWNER = 'SHalimoosavi';
const API = 'https://api.github.com';
const CURATION = 'data/curation.json';
const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
const flagshipOrder = ['SAYANJALI-BLOCKCHAIN', 'sayanjali-osint', 'SYJ-GST-Reconciliation', 'SYJ-LaunchPad', 'SYJ-LLM', 'SYJ-NexusIntel-AI-web', 'SYJ-OpenTrade-Logic', 'SYJ-SCHOLAR-AI'];
const hiddenNames = new Set(['alisonholidays', 'fix-task-broken', 'KhaledNasser', 'LawsonAnimalFarm', 'syj-nopager-test', 'Me', 'Portfolio', 'moosavi', 'portfolio-os', 'syed-visa-expert', 'syed-ali-hasan-moosavi', 'SYJ-Labs']);
const descriptionOverrides = {
  'syj-ai': 'Open-source local-first autonomous AI software engineering agent that plans, codes, reviews and verifies software tasks using local models through Ollama.',
  'SYJ-Nexus-Event-Trace': 'Self-hosted webhook event sink and logger that captures, verifies, stores and replays webhook payloads in SQLite for debugging distributed systems.',
  'SYJ-Nexus-Sentinel-Audit': 'Open-source security observability daemon that monitors local network devices, flags unrecognized devices against a whitelist and generates daily audit reports.',
  'sayanjali-osint': 'OSINT and geolocation framework for collecting, correlating and reporting publicly available intelligence from network and location data sources.',
  'SYJ-GST-Reconciliation': 'Offline GST invoice reconciliation tool for Indian SMEs, CAs and accountants that cross-verifies supplier invoices against purchase records.',
  'SYJ-SCHOLAR-AI': 'Open-source study assistant that turns documents into summaries, notes, flashcards, quizzes and exam-preparation material using locally runnable AI.'
};
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'SYJ-Labs-credibility-pass' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response.json();
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const error = new Error(`${response.status} ${response.statusText}: ${url}`);
      if (!retryable || attempt === attempts) throw error;
      lastError = error;
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 500 * (2 ** (attempt - 1)));
    } catch (error) {
      if (attempt === attempts) throw error;
      lastError = error;
      await sleep(500 * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function getText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] } });
  return response.ok ? response.text() : '';
}

async function getLicense(name) {
  try {
    const data = await getJson(`${API}/repos/${OWNER}/${name}/license`);
    return data?.license?.spdx_id || data?.license?.name || null;
  } catch (error) {
    if (String(error.message).startsWith('404')) return null;
    throw error;
  }
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
  return /prototype|proof[- ]of[- ]concept|experimental|poc|alpha|scratch|demo/i.test(`${repo.name} ${repo.description || ''}`);
}

function isHidden(repo) {
  const n = repo.name.toLowerCase();
  return (
    hiddenNames.has(repo.name) ||
    n.includes('termux') ||
    repo.fork ||
    repo.archived ||
    repo.size === 0 ||
    /(^|[-_])(test|tests|demo|boilerplate|template|scratch|tmp|temp)([-_]|$)/i.test(repo.name) ||
    /test repository|testing repository|placeholder|boilerplate/i.test(repo.description || '')
  );
}

function categoryFor(repo) {
  const t = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/llm|ai|agent|model|vision|nlp|scholar|intelligence/.test(t)) return 'AI';
  if (/blockchain|web3|token|launchpad|crypto|chain/.test(t)) return 'Blockchain';
  if (/osint|security|sentinel|aegis|shadow|recon/.test(t)) return 'Security & OSINT';
  if (/crm|saas|talent|lead|enterprise|inventory|property|nexus/.test(t)) return 'SaaS & Business';
  if (/gst|finance|trade|stock|quickstock/.test(t)) return 'Automation & Finance';
  if (/mesh|voice|chat|daypilot|educate|edu/.test(t)) return 'Apps & Tools';
  if (/farm|agro|animal/.test(t)) return 'Agriculture';
  return 'Software Engineering';
}

const current = JSON.parse(await fs.readFile(CURATION, 'utf8'));
const repos = [];
for (let page = 1; ; page += 1) {
  const batch = await getJson(`${API}/users/${OWNER}/repos?per_page=100&page=${page}&type=owner&sort=updated`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const repositories = {};
const report = [];

for (const repo of repos) {
  const manual = { ...(current.overrides?.[repo.name] || {}), ...(current.repositories?.[repo.name] || {}) };
  const hidden = isHidden(repo);
  const fi = flagshipOrder.indexOf(repo.name);
  const readme = await getText(`https://raw.githubusercontent.com/${OWNER}/${repo.name}/${encodeURIComponent(repo.default_branch)}/README.md`);
  const recent = new Date(repo.pushed_at || 0).getTime() >= cutoff;
  const hasDescription = cleanText(repo.description).length >= 45;
  let tier = fi >= 0 ? 'flagship' : 'archive';
  if (hidden) tier = 'archive';
  else if (recent && hasDescription && readme) tier = isPrototype(repo) ? 'experimental' : 'active';
  else if (recent && (isPrototype(repo) || !readme)) tier = 'experimental';

  const description = (descriptionOverrides[repo.name] || cleanText(manual.description || repo.description) || `${repo.name} is a public software project by ${OWNER}. Not documented in the repository.`).slice(0, 220);
  const license = hidden ? null : await getLicense(repo.name);
  const topics = (Array.isArray(manual.topics) ? manual.topics : Array.isArray(repo.topics) ? repo.topics : []).filter(topic => !/termux|mobile-first/i.test(String(topic)));

  repositories[repo.name] = {
    include: !hidden,
    tier,
    category: manual.category || categoryFor(repo),
    flagship: fi >= 0 ? fi + 1 : null,
    status: tier === 'archive' ? 'archive' : tier === 'experimental' ? 'experimental' : 'active',
    description,
    topics,
    ...(hidden ? { reason: 'Excluded from the public catalogue as a test, placeholder, duplicate, client/presentation repository, or prohibited-name repository.' } : {}),
    ...(license !== null ? { licenseApi: license, license: license.toUpperCase() === 'NOASSERTION' ? 'License file present but not recognised' : license } : { licenseApi: null, license: null })
  };

  report.push({
    name: repo.name,
    tier,
    reason: hidden ? 'excluded from public output' : tier === 'flagship' ? 'selected flagship project' : tier === 'active' ? 'pushed within 180 days with description and README' : tier === 'experimental' ? 'recent but incomplete/prototype-stage' : 'kept public but not recently active or sufficiently documented'
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  _defaults: { include: false, tier: 'archive', category: 'Software Engineering', status: 'archive' },
  overrides: { ...(current.overrides || {}) },
  repositories
};

for (const [name, description] of Object.entries(descriptionOverrides)) {
  output.overrides[name] = { ...(output.overrides[name] || {}), description };
}

await fs.writeFile(CURATION, JSON.stringify(output, null, 2) + '\n');
await fs.writeFile('data/credibility-classification.json', JSON.stringify(output, null, 2) + '\n');
await fs.writeFile('data/curation-report.md', '# SYJ LABS project classification\n\n| Repository | Tier | Reason |\n|---|---|---|\n' + report.map(x => `| ${x.name} | ${x.tier} | ${x.reason} |`).join('\n') + '\n');
console.log(`Credibility curation prepared: ${report.length} repositories; public=${Object.values(repositories).filter(p => p.include).length}.`);
