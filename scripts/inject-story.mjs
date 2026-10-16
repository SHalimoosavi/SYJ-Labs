import fs from 'node:fs/promises';

const file = 'dist/index.html';
const html = await fs.readFile(file, 'utf8');

const section = `
<section class="section origin-story" aria-labelledby="why-open-source">
  <div class="answer">
    <p class="eyebrow">WHY THE CODE STAYS OPEN</p>
    <h2 id="why-open-source">Built without waiting for permission.</h2>
    <p>
      SYJ LABS keeps substantial engineering work public because capital should not be the entry ticket to serious software engineering. A beginner founder should be able to study an architecture, run a project, inspect the trade-offs, and build a better version without first having to afford a private lab.
    </p>
    <p>
      That does not mean every repository is presented as finished product. The catalogue now separates active engineering projects from experiments, client work, duplicate presentation repositories, and maintenance repositories. What remains is intended to be useful evidence: code, architecture, decisions, constraints, and the work required to make an idea real.
    </p>
    <p>
      The point is practical: if one project helps another founder understand how to build, test, deploy, or recover from a failed attempt, keeping the work public has value beyond the repository itself.
    </p>
  </div>
</section>`;

const marker = '<section class="section origin-story"';
if (html.includes(marker)) process.exit(0);
if (!html.includes('</main>')) throw new Error('Homepage main element not found.');

const next = html.replace('</main>', `${section}\n</main>`);
await fs.writeFile(file, next, 'utf8');
console.log('Founder open-source story injected into homepage.');
