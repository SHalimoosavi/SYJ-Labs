import fs from 'node:fs/promises';
const file='dist/data/projects.json';
const curation=JSON.parse(await fs.readFile('data/curation.json','utf8'));
const data=JSON.parse(await fs.readFile(file,'utf8'));
for(const project of data.projects){const license=curation.repositories?.[project.name]?.license;project.license=license||null;}
await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
console.log('Project data license metadata normalized.');
