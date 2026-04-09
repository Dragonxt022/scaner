const { chromium } = require('playwright');

async function createBrowser(options = {}) {
  const browser = await chromium.launch({
    headless: options.headless ?? false,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  return { browser, context, page };
}

module.exports = { createBrowser };
