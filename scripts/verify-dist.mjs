import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist'),BASE='/SYJ-Labs/',SITE_ORIGIN='https://shalimoosavi.github.io';
const REQUIRED=['robots.txt','llms.txt','llms-full.txt','404.html','site.webmanifest'];
const failures=[];
function isExternal(value){return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:|data:|javascript:)/i.test(value);}
function localTarget(value,{sitemap=false}={}){
 if(!value||(!sitemap&&isExternal(value)))return null;
 const clean=value.trim().split('#')[0].split('?')[0];if(!clean)return null;
 let pathname;
 try{const u=new URL(clean,SITE_ORIGIN+BASE);if(sitemap&&u.origin!==SITE_ORIGIN){failures.push(`sitemap URL outside site: ${value}`);return null;}pathname=u.pathname;}
 catch{failures.push(`invalid local URL: ${value}`);return null;}
 if(!pathname.startsWith(BASE)){failures.push(`local URL outside ${BASE}: ${value}`);return null;}
 let rel=pathname.slice(BASE.length);if(!rel||rel.endsWith('/'))rel+='index.html';
 const target=path.resolve(DIST,rel);if(target!==DIST&&!target.startsWith(DIST+path.sep)){failures.push(`path escapes dist: ${value}`);return null;}return target;
}
async function exists(f){try{await fs.access(f);return true;}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')return false;throw e;}}
async function walk(dir){const out=[];for(const ent of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(f));else out.push(f);}return out;}
if(!(await exists(DIST))){console.error(`VERIFY DIST: FAIL — missing ${DIST}`);process.exit(1);}
const files=await walk(DIST),html=files.filter(f=>f.endsWith('.html')),targets=new Map();
for(const f of html){const t=await fs.readFile(f,'utf8');for(const m of t.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi))targets.set(m[1],true);for(const m of t.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi))for(const c of m[1].split(','))targets.set(c.trim().split(/\s+/)[0],true);for(const m of t.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi))targets.set(m[1],true);}
for(const v of targets.keys()){const f=localTarget(v);if(f&&!(await exists(f)))failures.push(`${path.relative(ROOT,f)} ← ${v}`);}
const sitemap=path.join(DIST,'sitemap.xml');
if(!(await exists(sitemap)))failures.push('required file missing: dist/sitemap.xml');
else{const t=await fs.readFile(sitemap,'utf8');for(const m of t.matchAll(/<loc>([^<]+)<\/loc>/gi)){const v=m[1].trim(),f=localTarget(v,{sitemap:true});if(f&&!(await exists(f)))failures.push(`sitemap target missing: ${v} → ${path.relative(DIST,f)}`);}}
for(const f of REQUIRED)if(!(await exists(path.join(DIST,f))))failures.push(`required file missing: dist/${f}`);
for(const f of ['assets/site.css','assets/site.js'])if(!(await exists(path.join(DIST,f))))failures.push(`required file missing: dist/${f}`);
for(const f of files.filter(f=>/\.(?:html|txt|json|xml|webmanifest)$/i.test(f))){const t=await fs.readFile(f,'utf8');if(/termux|mobile-first/i.test(t))failures.push(`forbidden public copy in ${path.relative(DIST,f)}`);if(/\/data\/data\/com\.termux\/|file:\/\/\/data\/|\/home\/[^"' <]+\/syj-labs/i.test(t))failures.push(`local build path leaked into ${path.relative(DIST,f)}`);}
if(failures.length){console.error(`VERIFY DIST: FAIL — ${failures.length} issue(s)`);for(const x of failures)console.error(`- ${x}`);process.exit(1);}
console.log(`VERIFY DIST: PASS — ${html.length} HTML files checked, ${targets.size} local references resolved, sitemap targets valid, required files present, public-copy guard clean.`);
