import fs from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('.lighthouseci');
let filenames = [];
try {
  filenames = (await fs.readdir(directory)).filter(name => /^lhr-.*\.json$/i.test(name));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!filenames.length) {
  console.log('LIGHTHOUSE SUMMARY: no LHR JSON files were written.');
  process.exit(0);
}

let count = 0;
for (const filename of filenames.sort()) {
  let report;
  try {
    report = JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'));
  } catch (error) {
    console.warn(`WARN: could not parse ${filename}: ${error.message}`);
    continue;
  }
  if (!report.categories || !report.audits) continue;
  count++;
  console.log('');
  console.log(`LIGHTHOUSE RESULT: ${report.finalDisplayedUrl || report.requestedUrl || filename}`);
  for (const id of ['performance', 'accessibility', 'best-practices', 'seo']) {
    const category = report.categories[id];
    if (!category || typeof category.score !== 'number') continue;
    console.log(`  ${id}: ${Math.round(category.score * 100)}/100`);
    if (category.score >= 1) continue;
    const failed = (category.auditRefs || [])
      .filter(ref => ref.weight > 0)
      .map(ref => ({ ref, audit: report.audits[ref.id] }))
      .filter(({audit}) => audit && typeof audit.score === 'number' && audit.score < 1)
      .sort((a,b) => (b.ref.weight || 0) - (a.ref.weight || 0));
    for (const {ref,audit} of failed.slice(0, 12)) {
      const score = typeof audit.score === 'number' ? Math.round(audit.score * 100) : 'n/a';
      const display = audit.displayValue ? ` — ${audit.displayValue}` : '';
      console.log(`    FAIL [${ref.id}] ${audit.title} (score ${score})${display}`);
      if (audit.description) console.log(`      ${audit.description.replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }
}
if (!count) console.log('LIGHTHOUSE SUMMARY: LHR files were found but none contained the expected report schema.');
