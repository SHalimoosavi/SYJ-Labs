# SYJ LABS — static catalogue architecture

SYJ LABS is the independent technology lab of Syed Ali Hasan Moosavi, documenting practical AI, blockchain, software and automation projects.

## What this package changes

- Keeps the existing `/SYJ-Labs/` GitHub Pages base path.
- Keeps the existing Google Search Console verification tag and Person/Organization/WebSite identity model in the generated site.
- Replaces the hand-maintained six-project grid with a build-time GitHub repository catalogue.
- Generates one static HTML page per included repository.
- Adds progressive-enhancement search, category/language filters and name sorting.
- Generates deterministic 1280×640 PNG social previews and optimized WebP card images at build time.
- Adds `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, a manifest and 404 page.
- Adds GitHub Pages deployment through `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`.
- Adds Lighthouse CI configuration for three runs per page URL and mobile/desktop presets.
- Adds HTML validation, link checking and Pa11y accessibility checks in Actions.

## Verified in this delivery

The package was syntax-checked with Node 22.16.0 and the JavaScript files parse successfully.

A full dependency installation could not be completed in the delivery environment because `npm install` timed out. Therefore Lighthouse, Pa11y, html-validate, link checking, the GitHub API build, browser rendering and the final production performance numbers are **unverified here** and are intentionally not claimed as passing.

No Lighthouse score, WCAG conformance claim or search/AI-search visibility claim is made by this package.

## Architecture

```text
.
├── data/
│   ├── site.json
│   ├── curation.json
│   └── projects.json              # generated from the GitHub inventory
├── scripts/
│   └── build.mjs                  # Node 22 build-time inventory + static generation
├── assets/
│   ├── fonts/lato-medium.woff2   # self-hosted font
│   ├── site.css
│   └── site.js
├── .github/workflows/
│   ├── deploy.yml
│   └── quality.yml
├── lighthouserc.mobile.json
├── lighthouserc.desktop.json
├── .htmlvalidate.json
├── package.json
├── LICENSE
└── README.md
```

The build output is `dist/`. GitHub Pages publishes only `dist/`.

## Build-time GitHub inventory

`npm run build` pages through the public repositories owned by `SHalimoosavi` using the GitHub REST API with `per_page=100` until an empty page is returned.

When `GITHUB_TOKEN` is available, the build also queries GraphQL for `usesCustomOpenGraphImage`. Without a token that field is not verified; the build records `null` rather than pretending it knows the answer.

Repository descriptions are preferred. When a description is missing or very short, the build attempts to read the repository README and extracts a conservative one-line description.

## Curation

`data/curation.json` is generated with one entry per discovered repository. The `_defaults` and `overrides` structure is used as the human-maintained curation layer.

Rules:

- Forks are hidden by default.
- Empty repositories are hidden by default.
- Archived repositories are hidden by default.
- Obvious test/temp repositories are hidden by default.
- Other public repositories are included unless an override hides them.
- `flagship` is a numeric order; lower numbers appear first on the homepage.
- `category` is explicit where curated and otherwise inferred conservatively from repository name, description and topics.
- `description` is kept factual; if it is not manually supplied, the build uses repository metadata or a README-derived sentence.

To hide a project, edit its entry after the first build:

```json
"ExampleRepo": {
  "include": false,
  "category": "Software Engineering",
  "status": "hidden",
  "reason": "Not ready for public portfolio presentation."
}
```

To feature it:

```json
"ExampleRepo": {
  "include": true,
  "category": "AI",
  "flagship": 3,
  "status": "active"
}
```

## Adding a new project

Do not add an HTML card manually. Create or update the GitHub repository, then run:

```bash
npm install
GITHUB_TOKEN=YOUR_TOKEN npm run build
```

The next build refreshes `data/projects.json`, curation entries, project pages, the sitemap, the LLM indexes and social previews.

## Social previews

The build creates a deterministic 1280×640 PNG per included repository under `dist/assets/projects/` and a WebP version for catalogue cards. The template uses project name, description, language, category and the SYJ LABS mark. Text is generated from repository data, not freehand image generation.

This repository cannot set another repository's GitHub **Settings → Social preview** image through the normal public GitHub contents API. For repositories without a custom social preview, the generated PNG can be uploaded manually through each repository's GitHub UI. If a repository accepts a pull request containing `.github/social-preview.png`, that is a separate repository change and is not performed by this static-site build.

## GitHub Pages setup

1. Open `SHalimoosavi/SYJ-Labs` → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push the `.github/workflows/deploy.yml` workflow to `main`.
4. The workflow builds `dist/`, uploads it with `actions/upload-pages-artifact`, and deploys it with `actions/deploy-pages`.
5. The workflow runs on pushes to `main`, manual dispatch, and once daily.

The site URL is:

`https://shalimoosavi.github.io/SYJ-Labs/`

The `/SYJ-Labs/` prefix is deliberately used in canonical URLs, internal links, asset URLs, sitemap entries and the web manifest.

## Performance decisions

- No runtime framework.
- No third-party runtime scripts.
- Images below the fold use lazy loading and async decoding.
- The first project image on a project detail page uses `fetchpriority="high"`.
- CSS animation is limited to `transform` and `opacity`.
- Catalogue cards use `content-visibility: auto`.
- `prefers-reduced-motion: reduce` disables motion.
- A progressive `@view-transition` rule is included; browsers that do not support it ignore it.
- The old 1.16 MB cover preload is intentionally not used.

GitHub Pages does not expose a way for this repository to set arbitrary HTTP response headers. That means a site author cannot directly set custom `Cache-Control` or equivalent response headers for the Pages origin. Lighthouse cache-lifetime findings affected by server headers therefore cannot be fully solved from static site code alone. The build instead reduces transfer cost through self-hosted WOFF2, WebP/PNG previews, lazy loading, explicit dimensions and static asset reuse.

## SEO / AEO / GEO

Every generated page has:

- unique title and description;
- canonical URL;
- Open Graph and Twitter metadata;
- Person, Organization and WebSite identity data;
- catalogue CollectionPage and ItemList data;
- per-project SoftwareSourceCode data;
- BreadcrumbList data on catalogue and project pages;
- plain HTML answer-style sections on the homepage.

FAQPage is intentionally not emitted because the site does not expose a matching visible FAQ section.

Structured data can help search engines understand the site. It does not guarantee rankings, snippets, knowledge panels or AI-search visibility.

## Accessibility

The implementation includes a skip link, semantic headings, visible focus states, keyboard-operable controls, a labelled mobile navigation button, Escape-to-close behavior, `aria-live` result counts, descriptive image alternatives and reduced-motion support.

Actual WCAG conformance remains **unverified** until the Actions Pa11y run and manual keyboard/browser review complete successfully.

## Known limitations / real delivery bug

The delivery environment could not complete `npm install` before timeout, so the dependency-backed build and browser audit could not be executed here. This is an environment limitation, not a claim that the package is bug-free.

The build also cannot verify GitHub GraphQL `usesCustomOpenGraphImage` without a GitHub token. It records `null` when the field is unavailable rather than guessing.

## License

No license has been added yet.

**Which license do you want for SYJ LABS?**
