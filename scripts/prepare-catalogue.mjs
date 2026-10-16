import fs from 'node:fs/promises';

const file = 'data/curation.json';
const data = JSON.parse(await fs.readFile(file, 'utf8'));

const HIDDEN = new Map([
  ['SYJ-Labs', 'Site source repository; not a catalogue project.'],
  ['termux-pro', 'Tooling/learning repository is not part of the engineering project catalogue.'],
  ['termux-pro-app', 'Legacy companion repository; consolidated out of the public catalogue.'],
  ['SYJ-DEPLOY', 'Presentation/deployment duplicate of SYJ-SCHOLAR-AI; keep the canonical project.'],
  ['LeadForge-web', 'Landing-site companion to SYJ-LeadForge; keep the canonical project repository.'],
  ['syj-blockchain-web', 'Website companion to SAYANJALI-BLOCKCHAIN; keep the canonical blockchain repository.'],
  ['moosavi', 'Founder portfolio; linked separately rather than presented as a lab project.'],
  ['syed-visa-expert', 'Client/authority site rather than a core engineering project.'],
  ['KhaledNasser', 'Client/site work rather than a core engineering project.'],
  ['LawsonAnimalFarm', 'Client/site work rather than a core engineering project.'],
  ['Portfolio', 'Portfolio presentation repository; linked separately from the engineering catalogue.'],
  ['portfolio-os', 'Portfolio presentation repository; linked separately from the engineering catalogue.'],
  ['syed-ali-hasan-moosavi', 'Founder identity/portfolio repository; not a lab project.'],
  ['Me', 'Profile/presentation repository; not a lab project.'],
  ['sayanjali-wisdom-14', 'Content/experimental repository; not a core engineering project.'],
  ['alisonholidays', 'External/client-facing site work; not a core engineering project.'],
  ['local-business-leads', 'Client/lead-generation utility rather than a core lab project.'],
  ['fix-task-broken', 'Maintenance/test repository; not a portfolio project.'],
  ['syj-nopager-test', 'Test repository.'],
  ['antigravity-awesome-skills', 'Third-party skills collection rather than a SYJ-built project.']
]);

const REWRITES = {
  'SYJ-Aegis': 'Local-first security analysis for AI agents, covering secret detection, prompt-injection and RAG risk checks, tool-permission mapping, and excessive-agency detection.',
  'SYJ-SCHOLAR-AI': 'Open-source study assistant that turns documents into summaries, notes, flashcards, quizzes, and exam-preparation material using locally runnable AI.',
  'SYJ-Qualify': 'Website and opportunity qualification tooling for identifying and prioritizing potential engineering leads.',
  'SYJ-DayPilot': 'Task and planning application for organizing daily work, priorities, and execution.',
  'SYJ-Websense-AI': 'AI-assisted web analysis project focused on extracting and organizing useful signals from public web content.',
  'SYJ-EDU': 'Learning platform and engineering experiments focused on building practical software with open-source AI.',
  'SYJ-Mining': 'Engineering-focused mining software and infrastructure experiments by SAYANJALI NEXUS.',
  'SYJ-TOKEN': 'Static public information site for the SYJ Token and its role within the SAYANJALI blockchain ecosystem.',
  'SYJ-LeadForge': 'Open-source lead qualification and website opportunity analysis platform for freelancers and agencies.',
  'SYJ-AI': 'Open-source local AI software-engineering agent designed to execute development workflows without a hosted AI dependency.',
  'SYJ-AI-Arena': 'Multi-agent AI debate engine for structured strategic decision analysis.',
  'SYJ-Mad-Scientist-Lab': 'Experimental technology ideation engine that combines technologies, domains, constraints, and objectives to generate project concepts.',
  'SYJ-Nexus-inventory-sync': 'Lightweight inventory management application with shareable item links for operational stock updates.',
  'SYJ-Github-Optimiser': 'Command-line tooling for automating GitHub profile README, repository topics, and release metadata.',
  'SYJ-Logistics-Fabric': 'Open-source logistics data exchange platform for reconciling shipment information across organizations without a single central data owner.',
  'SYJ-EdgeMind': 'Lightweight C/C++ local AI runtime built around quantized GGUF models for constrained hardware.',
  'SYJ-HCM': 'Multi-tenant human-capital and applicant-tracking platform covering employee records, recruitment, interviews, documents, and offers.',
  'SYJ-LaunchPad': 'Open-source Web3 launch platform for multi-chain token sales, wallet authentication, vesting, claims, and fundraising.',
  'SYJ-LLM': 'C/C++ local LLM runtime built around llama.cpp and GGUF, with memory budgeting for constrained hardware and no required cloud API.',
  'SYJ-NexusIntel-AI-web': 'Web application for SYJ NexusIntel AI, the lab’s AI-assisted business intelligence and automation platform.',
  'SAYANJALI-BLOCKCHAIN': 'Open-source Layer-1 blockchain implementation covering consensus, wallets, transactions, persistent chain storage, peer networking, and multi-node testing.',
  'sayanjali-osint': 'Open-source OSINT toolkit for domain, IP, DNS, geolocation, and security research with report generation and threat-analysis integrations.',
  'SYJ-OpenTrade-Logic': 'Tested open-source trading logic and market-analysis components designed as reusable engineering modules.',
  'SYJ-GST-Reconciliation': 'Offline reconciliation tooling for cross-checking supplier invoices against internal purchase records for accounting workflows.',
  'syj-mail-intelligence-ai': 'AI-assisted email intelligence platform for classification, prioritization, summarization, and reply drafting with a local-model option.'
};

const PROHIBITED = /\b(termux|mobile-first)\b/gi;
const stripMarkup = s => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const clean = (name, description) => {
  let s = stripMarkup(description);
  s = s.replace(PROHIBITED, m => m.toLowerCase() === 'mobile-first' ? 'cross-platform' : 'local command-line environment');
  if (REWRITES[name]) s = REWRITES[name];
  if (s.length > 220) s = `${s.slice(0, 217).replace(/[,;:—\- ]+$/, '')}…`;
  if (s.length < 45) s = `${name} — ${s || 'open-source engineering project'}`;
  return s;
};

for (const [name, entry] of Object.entries(data.repositories || {})) {
  if (HIDDEN.has(name)) {
    entry.include = false;
    entry.status = 'hidden';
    entry.reason = HIDDEN.get(name);
  }
  entry.description = clean(name, entry.description);
}

let rank = 1;
for (const entry of Object.values(data.repositories || {})) {
  if (entry.include && Number.isInteger(entry.flagship)) entry.flagship = rank++;
  else if (entry.include) entry.flagship = null;
}

data.generatedAt = new Date().toISOString();
await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Catalogue prepared: ${Object.values(data.repositories || {}).filter(x => x.include).length} included / ${Object.keys(data.repositories || {}).length} discovered.`);
