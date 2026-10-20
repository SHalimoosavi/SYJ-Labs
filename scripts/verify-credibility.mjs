import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const curation = JSON.parse(await fs.readFile(path.join(ROOT,'data/curation.json'),'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(ROOT,'data/public-manifest.json'),'utf8'));
const projects = curation.repositories || {};
const included = Object.entries(projects).filter(([,p]) => p.include);
const main = included.filter(([,p]) => p.tier !== 'archive');
const archive = included.filter(([,p]) => p.tier === 'archive');
const flagships = included.filter(([,p]) => p.tier === 'flagship').sort((a,b)=>(a[1].flagship??999)-(b[1].flagship??999));

if (Object.values(projects).some(p => !['flagship','active','experimental','archive'].includes(p.tier))) throw new Error('Every curation entry must have a valid tier.');
if (flagships.length !== 8) throw new Error(`Expected 8 flagships, found ${flagships.length}.`);

async function walk(dir, out=[]) { for (const entry of await fs.readdir(dir,{withFileTypes:true})) { const full=path.join(dir,entry.name); if(entry.isDirectory()) await walk(full,out); else out.push(full); } return out; }
const files=await walk(DIST);
const htmlFiles=files.filter(x=>x.endsWith('.html'));
const allText=[];
for(const file of files){ if(/\.(html|txt|xml|json|webmanifest|js|css)$/.test(file)) allText.push([file,await fs.readFile(file,'utf8')]); }

for(const [file,text] of allText){
  if(/NOASSERTION/i.test(text)) throw new Error(`NOASSERTION found in ${path.relative(DIST,file)}`);
  if(/\b(termux|mobile-first)\b/i.test(text)) throw new Error(`Prohibited terminology found in ${path.relative(DIST,file)}`);
}
for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');
  if(!/<link rel="canonical"/.test(html)) throw new Error(`Missing canonical in ${path.relative(DIST,file)}`);
  if(!/<meta property="og:title"/.test(html)) throw new Error(`Missing OG title in ${path.relative(DIST,file)}`);
  if(!/<meta name="twitter:card"/.test(html)) throw new Error(`Missing Twitter card in ${path.relative(DIST,file)}`);
}

const generatedText=allText.map(([,text])=>text).join('\n');
for(const [name,p] of Object.entries(projects)) {
  if(p.include || name === 'SYJ-Labs') continue;
  if(generatedText.includes(`/projects/${p.slug}/`) || generatedText.includes(`>${name}<`) || generatedText.includes(`| ${name} |`)) {
    throw new Error(`include:false project leaked into generated output: ${name}`);
  }
}

for(const [name,p] of flagships){
  const slug=p.slug || name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const file=path.join(DIST,'projects',slug,'index.html');
  const html=await fs.readFile(file,'utf8');
  for(const section of ['Problem','What it does','Architecture','Current implementation','Evidence','Limitations','Status']) if(!new RegExp(`<h2>${section}</h2>`).test(html)) throw new Error(`Flagship ${name} missing required section: ${section}`);
}

const catalogue=await fs.readFile(path.join(DIST,'projects/index.html'),'utf8');
const home=await fs.readFile(path.join(DIST,'index.html'),'utf8');
const llms=await fs.readFile(path.join(DIST,'llms.txt'),'utf8');
const sitemap=await fs.readFile(path.join(DIST,'sitemap.xml'),'utf8');
const countPattern=/(\d+) public projects/g;
const countFromText=text=>[...text.matchAll(countPattern)].map(m=>Number(m[1]));
const embeddedCounts=[...countFromText(home),...countFromText(catalogue),...countFromText(llms)];
const uniqueEmbedded=[...new Set(embeddedCounts)];
if(uniqueEmbedded.length && (uniqueEmbedded.length !== 1 || uniqueEmbedded[0] !== included.length)) throw new Error(`Public project count mismatch: embedded=${uniqueEmbedded.join(',')} manifest=${included.length}.`);

for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');
  const description=html.match(/<meta name="description" content="([^"]*)">/i)?.[1] || '';
  const descriptionCounts=countFromText(description);
  if(descriptionCounts.length && (descriptionCounts.length !== 1 || descriptionCounts[0] !== included.length)) throw new Error(`Meta description count mismatch in ${path.relative(DIST,file)}.`);
}

const catalogueTotal=Number((catalogue.match(/(\d+) public projects/)||[])[1]);
const sitemapCount=(sitemap.match(/<url>/g)||[]).length;
const expectedSitemap=main.length+6;
if(manifest.total!==included.length || manifest.main!==main.length || manifest.archive!==archive.length || manifest.flagship!==flagships.length) throw new Error('public-manifest.json does not match curation.json.');
if(catalogueTotal!==included.length) throw new Error(`Catalogue count ${catalogueTotal} does not match manifest ${included.length}.`);
if(!llms.includes(`Catalogue: ${included.length} public projects`)) throw new Error(`llms.txt count does not match manifest ${included.length}.`);
if(sitemapCount!==expectedSitemap) throw new Error(`Sitemap count ${sitemapCount} does not equal expected ${expectedSitemap}.`);
for(const [,p] of archive){ const slug=p.slug || ''; if(sitemap.includes(`/projects/${slug}/`)) throw new Error(`Archive project leaked into sitemap: ${p.name}`); }

console.log(`credibility verification passed | public=${included.length} main=${main.length} archive=${archive.length} flagship=${flagships.length} sitemap=${sitemapCount}`);
