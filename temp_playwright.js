const playwright = require('playwright');
(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR', err.toString()));
  page.on('requestfailed', (request) => console.log('REQFAIL', request.url(), request.failure()?.errorText));
  try {
    await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle' });
    await page.fill('#loginCpf', '12345678901');
    await page.fill('#loginPassword', 'Admin@123');
    await page.click('.login-submit');
    await page.waitForTimeout(1000);
    const response = await page.goto('http://127.0.0.1:3000/config/enrichment/settings', { waitUntil: 'networkidle' });
    console.log('STATUS', response.status());
    const hidden = await page.$eval('#configPanel', (el) => el.classList.contains('hidden'));
    const buttons = await page.evaluate(() => ({
      enrichmentSave: Boolean(document.querySelector('#enrichmentSave')),
      enqueueButtons: Array.from(document.querySelectorAll('button')).map((btn) => btn.textContent.trim()),
      logoutButton: Boolean(document.querySelector('#logoutButton')),
    }));
    console.log('CONFIG-HIDDEN', hidden, 'BUTTONS', buttons);
  } catch (error) {
    console.error('ERROR', error);
  } finally {
    await browser.close();
  }
})();
