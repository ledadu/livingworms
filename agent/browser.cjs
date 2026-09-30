// Screenshot of a page in the Windows Chrome (real GPU), driven over CDP from WSL with the Windows node.exe:
// node.exe browser.cjs <url> <windows path of the png> <wait ms> <windows path of playwright-core>. Opens its own window (window.cjs) and closes it, so several agents can
// share the browser. Needs Chrome started with --remote-debugging-port=9222 (agent.sh chrome).
const [url, out, waitMs = '6000', playwrightPath] = process.argv.slice(2);
const { chromium } = require(playwrightPath);
const { newWindowPage } = require('./window.cjs');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = await newWindowPage(browser);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.bringToFront();
    await page.waitForTimeout(Number(waitMs));
    // A .jpg keeps the images of the reports light enough to commit.
    const jpeg = /\.jpe?g$/i.test(out);
    await page.screenshot({ path: out, ...(jpeg ? { type: 'jpeg', quality: 80 } : {}) });
    console.log(`screenshot: ${out}`);
    for (const error of errors) console.log(`page error: ${error}`);
  } finally {
    await page.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
