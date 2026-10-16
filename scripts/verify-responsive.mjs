import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root = process.env.SCREENSHOT_DIR;
const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.SITE_BASE_URL || 'http://127.0.0.1:4173/SYJ-Labs/';

if (!root) throw new Error('SCREENSHOT_DIR is required.');
if (!chrome) throw new Error('CHROME_BIN is required.');
await fs.mkdir(root, { recursive: true });

const pages = [
  { name: 'home', path: '' },
  { name: 'catalogue', path: 'projects/' },
  { name: 'project', path: 'projects/syj-llm/' }
];
const widths = [320, 375, 768, 1280, 1920];
const failures = [];
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  for (const width of widths) {
    const mobile = width <= 375;
    await page.setViewport({
      width,
      height: mobile ? 812 : 900,
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile
    });

    for (const item of pages) {
      const url = new URL(item.path, baseUrl).href;
      const response = await page.goto(url, { waitUntil: 'networkidle2' });
      if (!response || response.status() >= 400) {
        failures.push(`HTTP ${response?.status() ?? 'no response'} at ${width}px: ${url}`);
        continue;
      }

      const metrics = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        horizontalOverflow: Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth
        ) > window.innerWidth + 1
      }));

      if (metrics.horizontalOverflow) {
        failures.push(
          `horizontal overflow at ${width}px on ${item.path || '/'}: viewport=${metrics.viewport}, document=${metrics.document}, body=${metrics.body}`
        );
        console.error(`FAIL responsive ${width}px ${item.name}: ${JSON.stringify(metrics)}`);
      } else {
        console.log(`PASS responsive ${width}px ${item.name}: ${JSON.stringify(metrics)}`);
      }

      if (width === 375 || width === 1280) {
        const variant = width === 375 ? 'mobile' : 'desktop';
        const filename = path.join(root, `${item.name}-${variant}-${width}.png`);
        await page.screenshot({ path: filename, fullPage: false, animations: 'disabled' });
        console.log(`SCREENSHOT: ${filename}`);
      }
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`RESPONSIVE CHECK: FAIL — ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('RESPONSIVE CHECK: PASS — all three pages checked at 320, 375, 768, 1280 and 1920px.');
