# SYJ LABS

SYJ LABS is the independent technology lab of Syed Ali Hasan Moosavi, operated under SAYANJALI NEXUS PRIVATE LIMITED.

The site is a static catalogue of public software projects across AI, blockchain, software engineering and automation. Project pages link to the underlying repositories so implementation details can be checked directly.

## Founder

**Syed Ali Hasan Moosavi**  
**Founder · CTO · Managing Director**

Hyderabad, Telangana, India

- Website: https://shalimoosavi.github.io/SYJ-Labs/
- Founder portfolio: https://shalimoosavi.github.io/moosavi/
- GitHub: https://github.com/SHalimoosavi
- Contact: shalimoosavi@gmail.com
- YouTube: https://youtube.com/@syjlabs

## Catalogue

The catalogue is generated from `data/curation.json` during the build. The project count is therefore generated from the same manifest rather than maintained as a hard-coded public claim.

Every repository receives one tier:

- **flagship** — one of the eight projects deliberately selected for the primary showcase.
- **active** — pushed within the last 180 days, has a substantive repository description, and has a README.
- **experimental** — recent work that is incomplete or explicitly prototype-stage.
- **archive** — public work retained for reference but not presented as current work.

Repositories marked `include: false` are excluded from the generated public catalogue. This is used for obvious tests, placeholders, duplicates, client/presentation repositories, and repositories whose names contain prohibited platform-specific terminology.

### Promoting a project

Add or update its entry in `data/curation.json`:

```json
{
  "include": true,
  "tier": "active",
  "category": "Software Engineering",
  "status": "active"
}
```

For a flagship, add its numeric `flagship` position. The eight flagship positions are intentionally explicit so the homepage order remains stable.

### Hiding a project

Set `include` to `false` and document the reason:

```json
{
  "include": false,
  "tier": "archive",
  "status": "archive",
  "reason": "Test repository."
}
```

The build keeps the classification data authoritative and prevents excluded repositories from leaking into generated public output.

## Public information architecture

- `/` — lab overview, flagship projects, direct answers and recently updated work.
- `/projects/` — searchable project catalogue with tier labels and a collapsed archive.
- `/about/` — lab and founder identity.
- `/contact/` — public contact route.
- `/open-source/` — repository licensing and source-availability policy.
- `/security/` — vulnerability reporting process only.
- `llms.txt` — concise machine-readable hierarchy excluding the archive.
- `llms-full.txt` — full hierarchy including a clearly labelled archive.

## Verification

The public build runs checks for:

- generated build output
- `verify:dist`
- HTML validation
- link validation
- accessibility validation with Pa11y
- prohibited public terminology
- missing canonical/OG/Twitter metadata
- `NOASSERTION` license metadata
- flagship required sections
- curation tiers
- public count consistency
- archive sitemap exclusion
- `include: false` leakage

The repository does not treat a CI pass as proof of production readiness for any individual project. Project claims remain bounded by the documentation and evidence available in each repository.

## License

The repository keeps its existing `LICENSE` file unchanged. That file currently contains a license decision note and does **not** grant a standard open-source license to the SYJ LABS site repository.

Individual projects may use different licenses. The SYJ LABS catalogue reports a project's repository license when one is documented and otherwise shows **No license file**.

## Development

Requirements: Node.js 22 or newer and the dependencies in `package-lock.json`.

```bash
npm ci
npm run build
npm run verify:dist
npm run validate:html
npm run validate:links
npm run validate:a11y
```

The generated site is written to `dist/` for GitHub Pages deployment.
