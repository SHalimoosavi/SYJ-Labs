import fs from 'node:fs/promises';
const source = JSON.parse(await fs.readFile('data/credibility-classification.json','utf8'));
await fs.writeFile('data/curation.json', JSON.stringify(source, null, 2) + '\n');
console.log('Credibility classification restored to data/curation.json.');
