// A page of its own, in a window of its own, in the shared Windows Chrome: an agent's game keeps running at full rate
// while another agent's window has the focus (a background tab is throttled, down to nothing for requestAnimationFrame).
//
//   const { chromium } = require(<windows path of playwright-core>);
//   const { newWindowPage } = require(<windows path of this file>);
//   const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
//   const page = await newWindowPage(browser, 'http://localhost:53xx');
//   ...
//   await page.close(); // closes the window
//   await browser.close(); // only disconnects
async function newWindowPage(browser, url = 'about:blank', { width = 1280, height = 800 } = {}) {
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const session = await browser.newBrowserCDPSession();
  const { targetId } = await session.send('Target.createTarget', { url: 'about:blank', newWindow: true, width, height });
  await session.detach();
  // Other agents open windows too: find ours by its target id, not by the next page event.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const page of context.pages()) {
      const pageSession = await context.newCDPSession(page).catch(() => null);
      if (!pageSession) continue;
      const { targetInfo } = await pageSession.send('Target.getTargetInfo').catch(() => ({ targetInfo: null }));
      await pageSession.detach().catch(() => {});
      if (targetInfo?.targetId === targetId) {
        await page.setViewportSize({ width, height });
        if (url !== 'about:blank') await page.goto(url, { waitUntil: 'load' });
        return page;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`window ${targetId} did not show up`);
}

module.exports = { newWindowPage };
