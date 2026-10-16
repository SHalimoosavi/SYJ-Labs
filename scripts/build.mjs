import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const OWNER = 'SHalimoosavi';
const BASE = '/SYJ-Labs/';
const SITE = 'https://shalimoosavi.github.io/SYJ-Labs/';
const GSC = 'RhRpM-kPpzv-uHKu5XET8z_0lpO1PIuzYQjgypyHrho';
const API = 'https://api.github.com';

const IMAGEMAGICK = process.env.IMAGEMAGICK || 'convert';
const token = process.env.GITHUB_TOKEN || '';

const headers = {
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'SYJ-Labs-build/2.0'
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const readJson = async file => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read required JSON file ${file}: ${error.message}`);
  }
};

const write = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value, 'utf8');
};

const esc = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

const slugify = name =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project';

const isoDate = value =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

const abs = p =>
  new URL(p.replace(/^\//, ''), SITE).href;

async function checkImageMagick() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      IMAGEMAGICK,
      ['-version'],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let output = '';
    let error = '';

    child.stdout.on('data', chunk => {
      output += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      error += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        const firstLine = output
          .split(/\r?\n/)
          .find(Boolean);

        console.log(
          `ImageMagick: available (${IMAGEMAGICK})${firstLine ? ` — ${firstLine}` : ''}`
        );

        resolve();
      } else {
        reject(
          new Error(
            error ||
            `ImageMagick exited with code ${code}`
          )
        );
      }
    });
  });
}

function categoryFor(repo) {
  const s =
    `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`
      .toLowerCase();

  if (/llm|ai|agent|model|vision|nlp|scholar|intelligence/.test(s)) {
    return 'AI';
  }

  if (/blockchain|web3|token|launchpad|crypto|chain/.test(s)) {
    return 'Blockchain';
  }

  if (/osint|security|sentinel|aegis|shadow|recon/.test(s)) {
    return 'Security & OSINT';
  }

  if (/crm|saas|talent|lead|enterprise|inventory|property|nexus/.test(s)) {
    return 'SaaS & Business';
  }

  if (/gst|finance|trade|stock|quickstock/.test(s)) {
    return 'Automation & Finance';
  }

  if (/mesh|voice|chat|daypilot|educate|edu/.test(s)) {
    return 'Apps & Tools';
  }

  if (/farm|agro|animal/.test(s)) {
    return 'Agriculture';
  }

  return 'Software Engineering';
}

function isObviousTest(repo) {
  return (
    /(^|[-_])(test|tests|demo|scratch|temp|tmp)([-_]|$)/i.test(repo.name) ||
    /test repo|testing repository|temporary/i.test(
      repo.description || ''
    )
  );
}

async function fetchJson(url) {
  const r = await fetch(url, { headers });

  if (!r.ok) {
    throw new Error(
      `${r.status} ${r.statusText}: ${url}`
    );
  }

  return r.json();
}

async function fetchAllRepos() {
  const all = [];

  for (let page = 1; ; page++) {
    const url =
      `${API}/users/${OWNER}/repos?per_page=100&page=${page}&type=owner&sort=updated`;

    console.log(`GitHub API: fetching repository page ${page}...`);

    const batch = await fetchJson(url);

    if (!batch.length) {
      break;
    }

    all.push(...batch);

    if (batch.length < 100) {
      break;
    }
  }

  return all;
}

async function readmeDescription(repo) {
  if (
    repo.description &&
    repo.description.length >= 45
  ) {
    return repo.description.trim();
  }

  for (
    const filename of [
      'README.md',
      'README.rst',
      'README'
    ]
  ) {
    try {
      const url =
        `https://raw.githubusercontent.com/${OWNER}/${repo.name}/${encodeURIComponent(repo.default_branch)}/${filename}`;

      const r = await fetch(
        url,
        {
          headers: {
            'User-Agent': headers['User-Agent']
          }
        }
      );

      if (!r.ok) {
        continue;
      }

      const text = await r.text();

      const lines = text
        .split(/\r?\n/)
        .map(x =>
          x
            .replace(/[`*_>#]/g, '')
            .trim()
        )
        .filter(Boolean);

      const candidate = lines.find(
        x =>
          x.length >= 45 &&
          !/^https?:\/\//.test(x) &&
          !/^badge/i.test(x)
      );

      if (candidate) {
        return candidate.slice(0, 220);
      }
    } catch (error) {
      console.warn(
        `WARN: README lookup failed for ${repo.name}/${filename}: ${error.message}`
      );
    }
  }

  return (
    repo.description?.trim() ||
    `${repo.name} is a public software project by ${OWNER}. See the repository for current scope and implementation details.`
  );
}

async function customOgMap() {
  if (!token) {
    return new Map();
  }

  try {
    const map = new Map();

    let after = null;

    do {
      const query = `
        query($login:String!,$after:String){
          user(login:$login){
            repositories(
              first:100,
              after:$after,
              ownerAffiliations:OWNER,
              privacy:PUBLIC
            ){
              pageInfo{
                hasNextPage
                endCursor
              }
              nodes{
                nameWithOwner
                usesCustomOpenGraphImage
              }
            }
          }
        }
      `;

      const r = await fetch(
        'https://api.github.com/graphql',
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: {
              login: OWNER,
              after
            }
          })
        }
      );

      if (!r.ok) {
        throw new Error(
          `GraphQL ${r.status}`
        );
      }

      const data = await r.json();

      for (
        const node of
        data?.data?.user?.repositories?.nodes || []
      ) {
        map.set(
          node.nameWithOwner.split('/')[1],
          node.usesCustomOpenGraphImage === true
        );
      }

      const info =
        data?.data?.user?.repositories?.pageInfo;

      after =
        info?.hasNextPage
          ? info.endCursor
          : null;

    } while (after);

    return map;

  } catch (error) {
    console.warn(
      `WARN: usesCustomOpenGraphImage could not be verified: ${error.message}`
    );

    return new Map();
  }
}

async function loadCuration() {
  return readJson(path.join(ROOT, 'data/curation.json'));
}

function curate(repo, curation) {
  const override =
    curation.overrides?.[repo.name] ||
    curation.repositories?.[repo.name] ||
    {};

  const hiddenByRule =
    repo.fork ||
    repo.archived ||
    repo.size === 0 ||
    /termux/i.test(repo.name) ||
    isObviousTest(repo);

  return {
    include:
      override.include ??
      !hiddenByRule,

    category:
      override.category ||
      categoryFor(repo),

    flagship:
      Number.isInteger(override.flagship)
        ? override.flagship
        : null,

    status:
      override.status ||
      (
        repo.archived
          ? 'archived'
          : repo.size === 0
            ? 'empty'
            : 'active'
      ),

    reason:
      override.reason ||
      (
        hiddenByRule
          ? 'Excluded by default curation rule.'
          : ''
      ),

    description:
      override.description || '',

    homepage:
      Object.prototype.hasOwnProperty.call(override, 'homepage')
        ? override.homepage
        : undefined
  };
}

async function ensureCuration(repos, curation) {
  const entries = {};

  for (const repo of repos) {
    const c = curate(
      repo,
      curation
    );

    entries[repo.name] = {
      include: c.include,
      category: c.category,
      flagship: c.flagship,
      status: c.status,
      description:
        c.description ||
        await readmeDescription(repo),
      ...(c.homepage !== undefined ? { homepage: c.homepage } : {}),
      ...(c.reason
        ? { reason: c.reason }
        : {})
    };
  }

  const output = {
    _defaults:
      curation._defaults ||
      {
        include: true,
        category: 'Software Engineering',
        status: 'active'
      },
    overrides: curation.overrides || {},
    repositories: entries
  };

  const curationFile = path.join(ROOT, 'data/curation.json');
  const outputText = JSON.stringify(output, null, 2) + '\n';
  let currentText;
  try {
    currentText = await fs.readFile(curationFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (currentText !== outputText) await write(curationFile, outputText);

  return entries;
}

async function makePreview(
  repo,
  curation,
  outFile
) {
  const title =
    repo.name.slice(0, 36);

  const desc =
    (
      curation.description ||
      repo.description ||
      `${repo.name} — software project`
    )
      .replace(/[<&>]/g, '')
      .slice(0, 92);

  const language =
    repo.language ||
    'Software';

  const category =
    curation.category ||
    'Software Engineering';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="1280"
     height="640"
     viewBox="0 0 1280 640">

  <defs>
    <linearGradient
      id="g"
      x1="0"
      y1="0"
      x2="1"
      y2="1">
      <stop
        offset="0"
        stop-color="#07100f"/>
      <stop
        offset="1"
        stop-color="#102826"/>
    </linearGradient>
  </defs>

  <rect
    width="1280"
    height="640"
    fill="url(#g)"/>

  <circle
    cx="1080"
    cy="100"
    r="240"
    fill="#63d7c6"
    opacity=".08"/>

  <circle
    cx="1180"
    cy="580"
    r="300"
    fill="#d7ff63"
    opacity=".05"/>

  <text
    x="72"
    y="86"
    fill="#9fd9d0"
    font-family="Arial,sans-serif"
    font-size="26"
    letter-spacing="5">
    SYJ LABS
  </text>

  <text
    x="72"
    y="250"
    fill="#f2f7f5"
    font-family="Arial,sans-serif"
    font-size="72"
    font-weight="700">
    ${esc(title)}
  </text>

  <text
    x="72"
    y="320"
    fill="#b9cbc7"
    font-family="Arial,sans-serif"
    font-size="30">
    ${esc(desc)}
  </text>

  <text
    x="72"
    y="520"
    fill="#75cfc1"
    font-family="Arial,sans-serif"
    font-size="22">
    ${esc(category.toUpperCase())}
  </text>

  <text
    x="72"
    y="562"
    fill="#7f9792"
    font-family="Arial,sans-serif"
    font-size="20">
    ${esc(language)}
  </text>

  <rect
    x="1110"
    y="510"
    width="92"
    height="64"
    rx="16"
    fill="#0d1817"
    stroke="#31524d"/>

  <text
    x="1156"
    y="550"
    text-anchor="middle"
    fill="#d7ff63"
    font-family="Arial,sans-serif"
    font-size="24"
    font-weight="700">
    SYJ
  </text>

</svg>`;

  await fs.mkdir(
    path.dirname(outFile),
    { recursive: true }
  );

  const svgTemp =
    `${outFile}.svg`;

  await fs.writeFile(
    svgTemp,
    svg,
    'utf8'
  );

  await new Promise(
    (resolve, reject) => {
      const child =
        spawn(
          IMAGEMAGICK,
          [
            svgTemp,
            '-strip',
            '-quality',
            '90',
            `webp:${outFile}`
          ],
          {
            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );

      let error = '';

      child.stderr.on(
        'data',
        chunk => {
          error +=
            chunk.toString();
        }
      );

      child.on(
        'error',
        reject
      );

      child.on(
        'close',
        code => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(
                error ||
                `ImageMagick exited with code ${code} while generating ${outFile}`
              )
            );
          }
        }
      );
    }
  );

  await fs.rm(
    svgTemp,
    { force: true }
  );
}

function layout({
  title,
  description,
  canonical,
  body,
  jsonld,
  ogImage = `${SITE}assets/founder-photo.webp`,
  pageCss = ''
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#07100f">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${BASE}assets/syj-labs-logo.png">
<link rel="preload" as="font" type="font/woff2" href="${BASE}assets/fonts/lato-medium.woff2" crossorigin>
<link rel="stylesheet" href="${BASE}assets/site.css">

<meta property="og:type" content="website">
<meta property="og:site_name" content="SYJ LABS">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">

<meta name="author" content="Syed Ali Hasan Moosavi">
<meta name="google-site-verification" content="${GSC}">

<script type="application/ld+json">${JSON.stringify(jsonld)}</script>

${pageCss}
</head>

<body>

<a class="skip" href="#main">
Skip to content
</a>

<header class="site-header">

<a
  class="brand"
  href="${BASE}"
  aria-label="SYJ LABS home">

  <span class="mark">
    SYJ
  </span>

  <span>
    <strong>
      SYJ <em>LABS</em>
    </strong>

    <small>
      BUILD. INNOVATE. DEPLOY.
    </small>
  </span>

</a>

<button
  type="button"
  class="menu"
  aria-expanded="false"
  aria-controls="nav"
  aria-label="Open navigation">

  <span></span>
  <span></span>

</button>

<nav id="nav">

<a href="${BASE}#projects">
Projects
</a>

<a href="${BASE}projects/">
Catalogue
</a>

<a href="${BASE}#focus">
Focus
</a>

<a href="${BASE}#about">
About
</a>

<a
  class="nav-cta"
  href="https://github.com/SHalimoosavi"
  target="_blank"
  rel="noopener noreferrer">
GitHub ↗
</a>

</nav>

</header>

<main id="main">
${body}
</main>

<footer>

<a href="${BASE}">
SYJ <em>LABS</em>
</a>

<span>
Independent technology work by Syed Ali Hasan Moosavi.
</span>

</footer>

<script
  src="${BASE}assets/site.js"
  defer>
</script>

</body>
</html>`;
}

console.log('');
console.log('========================================');
console.log('        SYJ LABS STATIC BUILD');
console.log('========================================');
console.log('');

await checkImageMagick();

const curation =
  await loadCuration();

const repos =
  process.env.SYJ_LABS_FIXTURE === '1'
    ? await readJson(path.join(ROOT, 'data/fixture.json'))
    : await fetchAllRepos();

console.log(
  `Repositories discovered: ${repos.length}`
);

const ogMap =
  await customOgMap();

const curated =
  await ensureCuration(
    repos,
    curation
  );

const projects =
  repos.map(repo => {
    const c =
      curated[repo.name];

    return {
      name: repo.name,

      description:
        c.description,

      language:
        repo.language ||
        'Other',

      topics:
        (repo.topics || []).filter(topic => !/termux|mobile-first/i.test(topic)),

      stars:
        repo.stargazers_count ||
        0,

      forks:
        repo.forks_count ||
        0,

      fork:
        !!repo.fork,

      archived:
        !!repo.archived,

      size:
        repo.size ||
        0,

      homepage:
        c.homepage !== undefined
          ? c.homepage
          : (repo.homepage || ''),

      license:
        repo.license?.spdx_id ||
        repo.license?.name ||
        null,

      pushed_at:
        repo.pushed_at,

      updated_at:
        repo.updated_at,

      html_url:
        repo.html_url,

      default_branch:
        repo.default_branch,

      category:
        c.category,

      include:
        c.include,

      flagship:
        c.flagship,

      status:
        c.status,

      usesCustomOpenGraphImage:
        ogMap.has(repo.name)
          ? ogMap.get(repo.name)
          : null,

      slug:
        slugify(repo.name)
    };
  });

const projectsFile = path.join(ROOT, 'data/projects.json');
const projectsText = JSON.stringify({ projects }, null, 2) + '\n';
let existingProjectsText;
try {
  existingProjectsText = await fs.readFile(projectsFile, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (existingProjectsText !== projectsText) {
  await write(projectsFile, projectsText);
  console.log('data/projects.json: updated');
} else {
  console.log('data/projects.json: unchanged');
}

await fs.rm(
  DIST,
  {
    recursive: true,
    force: true
  }
);

await fs.mkdir(
  DIST,
  {
    recursive: true
  }
);

await fs.mkdir(
  path.join(
    DIST,
    'projects'
  ),
  {
    recursive: true
  }
);

await fs.cp(
  path.join(
    ROOT,
    'assets/fonts'
  ),
  path.join(
    DIST,
    'assets/fonts'
  ),
  {
    recursive: true
  }
);

for (const file of ['founder-photo.webp', 'site.css', 'site.js']) {
  const source = path.join(ROOT, 'assets', file);
  const destination = path.join(DIST, 'assets', file);
  try {
    await fs.access(source);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  } catch (error) {
    throw new Error(`Required asset copy failed for ${source}: ${error.message}`);
  }
}

const logoSource = path.join(ROOT, 'assets', 'syj-labs-logo.png');
const logoTarget = path.join(DIST, 'assets', 'syj-labs-logo.png');
try {
  await fs.access(logoSource);
  await new Promise((resolve, reject) => {
    const child = spawn(IMAGEMAGICK, [logoSource, '-thumbnail', '64x64', '-strip', '-define', 'png:compression-level=9', logoTarget], {stdio:['ignore','ignore','pipe']});
    let errorText = '';
    child.stderr.on('data', chunk => { errorText += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(errorText || `ImageMagick exited ${code}`)));
  });
} catch (error) {
  throw new Error(`Required logo optimization failed for ${logoSource}: ${error.message}`);
}
console.log('Required assets copied; logo optimized to 64px; unused YouTube QR omitted.');

await fs.mkdir(
  path.join(
    DIST,
    'data'
  ),
  {
    recursive: true
  }
);

const publicProjects = projects.filter(project => !/termux/i.test(project.name));
await write(
  path.join(DIST, 'data/projects.json'),
  JSON.stringify({ projects: publicProjects }, null, 2) + '\n'
);

const included =
  projects
    .filter(
      p => p.include
    )
    .sort(
      (a, b) =>
        (a.flagship ?? 999) -
          (b.flagship ?? 999) ||
        a.name.localeCompare(
          b.name
        )
    );

const flagship =
  included
    .filter(
      p => p.flagship
    )
    .sort(
      (a, b) =>
        a.flagship -
        b.flagship
    )
    .slice(0, 8);

console.log(
  `Included projects: ${included.length}`
);

console.log(
  `Flagship projects: ${flagship.length}`
);

for (const p of included) {
  const sourcePreview = path.join(ROOT, 'assets', 'projects', `${p.slug}.png`);
  const destDir = path.join(DIST, 'assets', 'projects');
  const distPng = path.join(destDir, `${p.slug}.png`);
  const distWebp = path.join(destDir, `${p.slug}.webp`);
  await fs.mkdir(destDir, { recursive: true });
  let previewInput = sourcePreview;
  try {
    await fs.access(sourcePreview);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    previewInput = distPng;
    await makePreview(p, curated[p.name], previewInput);
  }
  if (previewInput !== distPng) await fs.copyFile(previewInput, distPng);
  await new Promise((resolve, reject) => {
    const child = spawn(IMAGEMAGICK, [previewInput, '-strip', '-quality', '82', `webp:${distWebp}`], {stdio:['ignore','ignore','pipe']});
    let errorText = '';
    child.stderr.on('data', chunk => { errorText += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(errorText || `ImageMagick exited ${code} generating ${distWebp}`)));
  });
}

const org = {
  '@type': 'Organization',
  '@id':
    `${SITE}#organization`,
  name: 'SYJ LABS',
  url: SITE,
  logo:
    `${SITE}assets/syj-labs-logo.png`,
  description:
    'A technology lab focused on practical AI tools, blockchain engineering, software development and automation.',
  sameAs: [
    'https://github.com/SHalimoosavi',
    'https://github.com/SHalimoosavi/SYJ-Labs',
    'https://shalimoosavi.github.io/moosavi/',
    'https://youtube.com/@syjlabs'
  ]
};

const person = {
  '@type': 'Person',
  '@id':
    `${SITE}#founder`,
  name:
    'Syed Ali Hasan Moosavi',
  jobTitle:
    'Founder · CTO · Managing Director',
  url:
    'https://shalimoosavi.github.io/moosavi/',
  sameAs: [
    'https://github.com/SHalimoosavi',
    'https://shalimoosavi.github.io/moosavi/',
    'https://youtube.com/@syjlabs'
  ],
  worksFor: {
    '@id':
      `${SITE}#organization`
  },
  image:
    `${SITE}assets/founder-photo.webp`,
  address: {
    '@type':
      'PostalAddress',
    addressLocality:
      'Hyderabad',
    addressRegion:
      'Telangana',
    addressCountry:
      'IN'
  }
};

const website = {
  '@type': 'WebSite',
  '@id':
    `${SITE}#website`,
  url: SITE,
  name:
    'SYJ LABS',
  publisher: {
    '@id':
      `${SITE}#organization`
  },
  inLanguage:
    'en'
};

const homeBody = `
<section class="hero">

<div class="hero-glow"></div>

<div class="hero-copy">

<p class="eyebrow">
INDEPENDENT TECHNOLOGY LAB
</p>

<h1>
Ideas are just<br>
the <span>beginning.</span>
</h1>

<p class="lede">
SYJ LABS is the technology-building identity of Syed Ali Hasan Moosavi. The lab develops practical AI, blockchain, software and automation projects in public.
</p>

<div class="actions">

<a
  class="button primary"
  href="${BASE}projects/">
  Explore the catalogue ↓
</a>

<a
  class="button"
  href="https://github.com/SHalimoosavi"
  target="_blank"
  rel="noopener noreferrer">
  GitHub ↗
</a>

</div>

<div class="principles">
<span>LEARN</span>
<i></i>
<span>BUILD</span>
<i></i>
<span>DEPLOY</span>
<i></i>
<span>EARN</span>
</div>

</div>

<div class="hero-bottom">

<span>
AI / SYSTEMS / SOFTWARE
</span>

<span>
HYDERABAD, INDIA
</span>

</div>

</section>

<section
  class="section answer">

<p class="eyebrow">
WHAT IS SYJ LABS?
</p>

<h2>
A public catalogue of independent technology work.
</h2>

<p>
SYJ LABS is an independent technology lab led by Syed Ali Hasan Moosavi. It documents practical software projects, experiments and engineering work, with source repositories linked for verification.
</p>

</section>

<section
  class="section"
  id="projects">

<div class="heading">

<div>

<p class="eyebrow">
FLAGSHIP WORK
</p>

<h2>
Selected <span>projects.</span>
</h2>

</div>

<p>
Eight projects are highlighted here. The full catalogue contains every repository selected by the site's curation rules.
</p>

</div>

<div class="grid">
${flagship.map(
  (p, i) =>
    card(p, i)
).join('')}
</div>

<div class="center">

<a
  class="button outline"
  href="${BASE}projects/">
  Open the full catalogue →
</a>

</div>

</section>

<section
  class="section focus"
  id="focus">

<p class="eyebrow">
WHAT WE WORK ON
</p>

<h2>
Four disciplines.<br>
<span>One engineering mindset.</span>
</h2>

<div class="focus-grid">

<article>
<b>01</b>
<h3>
Artificial Intelligence
</h3>
<p>
AI tools, language-model experiments and intelligent workflows.
</p>
</article>

<article>
<b>02</b>
<h3>
Blockchain
</h3>
<p>
Web3 applications, infrastructure and developer tooling.
</p>
</article>

<article>
<b>03</b>
<h3>
Software Engineering
</h3>
<p>
Web applications, backend systems and open-source development.
</p>
</article>

<article>
<b>04</b>
<h3>
Automation
</h3>
<p>
Repeatable workflows and tools that reduce manual work.
</p>
</article>

</div>

</section>

<section
  class="section about"
  id="about">

<div>

<p class="eyebrow">
WHO BUILT IT?
</p>

<h2>
Syed Ali Hasan Moosavi
</h2>

<p>
Founder · CTO · Managing Director of SAYANJALI NEXUS PRIVATE LIMITED and the person behind SYJ LABS.
</p>

<p>
For the current implementation, source code and project history, use the linked repositories.
</p>

<a
  class="text-link"
  href="https://shalimoosavi.github.io/moosavi/"
  target="_blank"
  rel="noopener noreferrer">
  Founder portfolio ↗
</a>

</div>

<div class="founder">

<img
  src="${BASE}assets/founder-photo.webp"
  alt="Syed Ali Hasan Moosavi, founder of SYJ LABS"
  width="900"
  height="900"
  loading="lazy"
  decoding="async">

<span>
FOUNDER · CTO · MANAGING DIRECTOR
</span>

</div>

</section>`;

function card(
  p,
  index = 0
) {
  const preview =
    `${BASE}assets/projects/${p.slug}.webp`;

  return `
<article
  class="card reveal"
  data-category="${esc(p.category)}"
  data-language="${esc(p.language)}"
  data-name="${esc(p.name.toLowerCase())}"
  style="--i:${index % 8}">

<a
  href="${BASE}projects/${p.slug}/">

<img
  src="${preview}"
  alt="${esc(p.name)} project preview"
  width="960"
  height="480"
  loading="lazy"
  decoding="async">

<span class="index">
${String(index + 1).padStart(2, '0')}
</span>

</a>

<div>

<small>
${esc(p.category)} · ${esc(p.language)}
</small>

<h3>
${esc(p.name)}
</h3>

<p>
${esc(p.description)}
</p>

<div class="tags">
${p.topics
  .slice(0, 4)
  .map(
    t => `<span>${esc(t)}</span>`
  )
  .join('')}
</div>

<a
  class="text-link"
  href="${BASE}projects/${p.slug}/">
  View project →
</a>

</div>

</article>`;
}

const homeJson = {
  '@context':
    'https://schema.org',
  '@graph': [
    org,
    person,
    website
  ]
};

await write(
  path.join(
    DIST,
    'index.html'
  ),
  layout({
    title:
      'SYJ LABS | AI, Blockchain & Software Engineering',

    description:
      'SYJ LABS is the independent technology lab of Syed Ali Hasan Moosavi, building practical AI tools, blockchain infrastructure, software and automation.',

    canonical:
      SITE,

    body:
      homeBody,

    jsonld:
      homeJson,

    ogImage:
      `${SITE}assets/founder-photo.webp`
  })
);

const catalogueJson = {
  '@context':
    'https://schema.org',

  '@graph': [
    org,
    person,
    website,

    {
      '@type':
        'CollectionPage',

      '@id':
        `${SITE}projects/#catalogue`,

      url:
        `${SITE}projects/`,

      name:
        'SYJ LABS Project Catalogue',

      description:
        'Complete catalogue of included SYJ LABS projects.',

      isPartOf: {
        '@id':
          `${SITE}#website`
      }
    },

    {
      '@type':
        'ItemList',

      itemListElement:
        included.map(
          (p, i) => ({
            '@type':
              'ListItem',

            position:
              i + 1,

            url:
              `${SITE}projects/${p.slug}/`,

            name:
              p.name
          })
        )
    },

    {
      '@type':
        'BreadcrumbList',

      itemListElement: [
        {
          '@type':
            'ListItem',

          position: 1,

          name:
            'SYJ LABS',

          item:
            SITE
        },

        {
          '@type':
            'ListItem',

          position: 2,

          name:
            'Project catalogue',

          item:
            `${SITE}projects/`
        }
      ]
    }
  ]
};

const categories =
  [
    ...new Set(
      included.map(
        p => p.category
      )
    )
  ].sort();

const languages =
  [
    ...new Set(
      included
        .map(
          p => p.language
        )
        .filter(Boolean)
    )
  ].sort();

const catalogueBody = `
<section class="catalogue-head">

<p class="eyebrow">
COMPLETE CATALOGUE
</p>

<h1>
Every included <span>project.</span>
</h1>

<p>
All curated public repositories are rendered in HTML at build time. JavaScript only enhances search, filters and sorting.
</p>

<h2 class="catalogue-section-title">
Browse projects
</h2>

</section>

<section
  class="catalogue-tools"
  aria-label="Project filters">

<label>
Search
<input
  id="project-search"
  type="search"
  placeholder="Search projects"
  autocomplete="off">
</label>

<label>
Category
<select id="category-filter">

<option value="">
All categories
</option>

${categories
  .map(
    x =>
      `<option>${esc(x)}</option>`
  )
  .join('')}

</select>
</label>

<label>
Language
<select id="language-filter">

<option value="">
All languages
</option>

${languages
  .map(
    x =>
      `<option>${esc(x)}</option>`
  )
  .join('')}

</select>
</label>

<label>
Sort

<select id="sort-projects">

<option value="name">
Name
</option>

<option value="updated">
Recently updated
</option>

<option value="stars">
Stars
</option>

</select>

</label>

</section>

<p
  id="catalogue-status"
  class="status"
  aria-live="polite">

${included.length} projects

</p>

<section
  class="grid catalogue-grid"
  id="catalogue">

${included
  .map(
    (p, i) =>
      card(p, i)
  )
  .join('')}

</section>`;

await write(
  path.join(
    DIST,
    'projects/index.html'
  ),
  layout({
    title:
      'SYJ LABS Project Catalogue | AI, Blockchain & Software',

    description:
      `Browse the complete catalogue of ${included.length} included SYJ LABS projects.`,

    canonical:
      `${SITE}projects/`,

    body:
      catalogueBody,

    jsonld:
      catalogueJson,

    ogImage:
      `${SITE}assets/founder-photo.webp`
  })
);

for (
  const [
    i,
    p
  ] of included.entries()
) {
  const projectUrl =
    `${SITE}projects/${p.slug}/`;

  const projectJson = {
    '@context':
      'https://schema.org',

    '@graph': [
      org,
      person,

      {
        '@type':
          'SoftwareSourceCode',

        '@id':
          `${projectUrl}#software`,

        name:
          p.name,

        description:
          p.description,

        url:
          p.html_url,

        codeRepository:
          p.html_url,

        programmingLanguage:
          p.language,

        keywords:
          p.topics,

        dateModified:
          isoDate(p.pushed_at),

        license:
          p.license ||
          undefined
      },

      {
        '@type':
          'BreadcrumbList',

        itemListElement: [
          {
            '@type':
              'ListItem',

            position: 1,

            name:
              'SYJ LABS',

            item:
              SITE
          },

          {
            '@type':
              'ListItem',

            position: 2,

            name:
              'Projects',

            item:
              `${SITE}projects/`
          },

          {
            '@type':
              'ListItem',

            position: 3,

            name:
              p.name,

            item:
              projectUrl
          }
        ]
      }
    ]
  };

  const projectBody = `
<section class="project-hero">

<p class="eyebrow">
${esc(p.category)} · ${esc(p.language)}
</p>

<h1>
${esc(p.name)}
</h1>

<p>
${esc(p.description)}
</p>

<div class="actions">

<a
  class="button primary"
  href="${esc(p.html_url)}"
  target="_blank"
  rel="noopener noreferrer">
  Open repository ↗
</a>

${
  p.homepage
    ? `
<a
  class="button"
  href="${esc(p.homepage)}"
  target="_blank"
  rel="noopener noreferrer">
  Live site ↗
</a>`
    : ''
}

</div>

</section>

<section class="project-detail">

<img
  src="${BASE}assets/projects/${p.slug}.png"
  alt="${esc(p.name)} social preview"
  width="1280"
  height="640"
  fetchpriority="high">

<dl>

<div>
<dt>Language</dt>
<dd>
${esc(p.language)}
</dd>
</div>

<div>
<dt>Category</dt>
<dd>
${esc(p.category)}
</dd>
</div>

<div>
<dt>Last updated</dt>
<dd>
${esc(isoDate(p.pushed_at))}
</dd>
</div>

<div>
<dt>Stars</dt>
<dd>
${p.stars}
</dd>
</div>

<div>
<dt>Topics</dt>
<dd>
${
  p.topics.length
    ? p.topics
        .map(esc)
        .join(', ')
    : 'None listed'
}
</dd>
</div>

<div>
<dt>License</dt>
<dd>
${esc(
  p.license ||
  'Not specified'
)}
</dd>
</div>

</dl>

</section>`;

  await write(
    path.join(
      DIST,
      `projects/${p.slug}/index.html`
    ),
    layout({
      title:
        `${p.name} | SYJ LABS`,

      description:
        p.description,

      canonical:
        projectUrl,

      body:
        projectBody,

      jsonld:
        projectJson,

      ogImage:
        `${SITE}assets/projects/${p.slug}.png`
    })
  );
}

const now =
  new Date().toISOString();

const sitemapEntries = [
  {
    url:
      SITE,

    lastmod:
      now.slice(0, 10)
  },

  {
    url:
      `${SITE}projects/`,

    lastmod:
      now.slice(0, 10)
  },

  ...included.map(
    p => ({
      url:
        `${SITE}projects/${p.slug}/`,

      lastmod:
        isoDate(
          p.pushed_at
        ) ||
        now.slice(0, 10)
    })
  )
];

await write(
  path.join(
    DIST,
    'sitemap.xml'
  ),

  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries.map(x => `<url><loc>${x.url}</loc><lastmod>${x.lastmod}</lastmod></url>`).join('')}</urlset>\n`
);

await write(
  path.join(
    DIST,
    'robots.txt'
  ),

  `User-agent: *\nAllow: /SYJ-Labs/\nSitemap: ${SITE}sitemap.xml\n`
);

await write(
  path.join(
    DIST,
    'site.webmanifest'
  ),

  JSON.stringify(
    {
      name:
        'SYJ LABS',

      short_name:
        'SYJ LABS',

      start_url:
        BASE,

      scope:
        BASE,

      display:
        'standalone',

      background_color:
        '#07100f',

      theme_color:
        '#07100f',

      icons: []
    },
    null,
    2
  ) + '\n'
);

await write(
  path.join(
    DIST,
    '404.html'
  ),

  layout({
    title:
      'Page not found | SYJ LABS',

    description:
      'The requested page was not found on SYJ LABS.',

    canonical:
      `${SITE}404.html`,

    body: `
<section class="not-found">

<p class="eyebrow">
404
</p>

<h1>
That page is not here.
</h1>

<p>
Return to the catalogue or the lab homepage.
</p>

<div class="actions">

<a
  class="button primary"
  href="${BASE}">
  Home
</a>

<a
  class="button"
  href="${BASE}projects/">
  Catalogue
</a>

</div>

</section>`,

    jsonld: {
      '@context':
        'https://schema.org',

      '@type':
        'WebPage',

      name:
        'Page not found'
    }
  })
);

const llmsHeader =
`# SYJ LABS

SYJ LABS is the independent technology lab of Syed Ali Hasan Moosavi. It documents practical AI, blockchain, software and automation projects.

Website: ${SITE}
Founder: https://shalimoosavi.github.io/moosavi/
GitHub: https://github.com/SHalimoosavi

`;

const llmsIndex =
  included
    .map(
      p =>
        `- ${p.name} | ${p.category} | ${p.language} | ${SITE}projects/${p.slug}/`
    )
    .join('\n');

await write(
  path.join(
    DIST,
    'llms.txt'
  ),

  llmsHeader +
  `Projects (${included.length}):\n${llmsIndex}\n`
);

await write(
  path.join(
    DIST,
    'llms-full.txt'
  ),

  llmsHeader +
  included
    .map(
      p =>
`## ${p.name}
Category: ${p.category}
Language: ${p.language}
Description: ${p.description}
Repository: ${p.html_url}
Page: ${SITE}projects/${p.slug}/
Last updated: ${isoDate(p.pushed_at)}
Topics: ${p.topics.join(', ') || 'None listed'}
`
    )
    .join('\n')
);

console.log('');
console.log('========================================');
console.log('BUILD COMPLETE');
console.log('========================================');
console.log(`Public repositories: ${repos.length}`);
console.log(`Included projects:   ${included.length}`);
console.log(`Flagship projects:   ${flagship.length}`);
console.log(`Image backend:       ${IMAGEMAGICK}`);
console.log(`HTML output:         ${DIST}`);
console.log('');

console.log(
  `Custom Open Graph image status verified for ${ogMap.size} repositories${token ? '' : ' (GITHUB_TOKEN unavailable; unverified)'}.`
);
