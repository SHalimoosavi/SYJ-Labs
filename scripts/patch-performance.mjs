import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }

  return files;
}

const cssPath = path.join(DIST, 'css/styles.css');

try {
  let css = await fs.readFile(cssPath, 'utf8');

  // The external Google Fonts @import is render-blocking. Use the existing
  // system font fallbacks so the static site has no third-party font request.
  css = css.replace(/^@import url\([^\n]+\);\s*/m, '');
  css = css.replace(/font-family:Manrope,system-ui,-apple-system,Segoe UI,sans-serif/g, 'font-family:system-ui,-apple-system,"Segoe UI",sans-serif');
  css = css.replace(/font-family:'DM Mono',monospace/g, 'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.63rem 'DM Mono',monospace/g, 'font:.63rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.6rem 'DM Mono',monospace/g, 'font:.6rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.59rem 'DM Mono',monospace/g, 'font:.59rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.65rem 'DM Mono',monospace/g, 'font:.65rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.7rem 'DM Mono',monospace/g, 'font:.7rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.55rem 'DM Mono',monospace/g, 'font:.55rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');
  css = css.replace(/font: \.58rem 'DM Mono',monospace/g, 'font:.58rem ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace');

  css += `\n\n/* Performance: defer expensive below-the-fold rendering during initial paint. */\n@media (min-width:1px) {\n  .focus-section, .about-section, .community-section, .closing-cta {\n    content-visibility: auto;\n    contain-intrinsic-size: 1px 900px;\n  }\n  .project-grid {\n    contain: layout paint;\n  }\n}\n`;

  await fs.writeFile(cssPath, css, 'utf8');
} catch {
  // Keep the build portable if a non-standard output omits the stylesheet.
}

const htmlFiles = (await walk(DIST)).filter(file => file.endsWith('.html'));
const style = '<style id="syj-performance">@media (min-width:1px){.focus-section,.about-section,.community-section,.closing-cta{content-visibility:auto;contain-intrinsic-size:1px 900px}.project-grid{contain:layout paint}}</style>';

for (const file of htmlFiles) {
  let html = await fs.readFile(file, 'utf8');

  if (!html.includes('id="syj-performance"')) {
    html = html.replace('</head>', `${style}</head>`);
    await fs.writeFile(file, html, 'utf8');
  }
}

console.log(`Performance patch applied to ${htmlFiles.length} generated HTML files.`);
