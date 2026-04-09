const config = require('./config');
const { login, waitForManualLogin } = require('./services/auth');
const { createBrowser } = require('./services/browser');
const { collectAllPdfLinks } = require('./services/scraper');

(async () => {
  const { browser, context, page } = await createBrowser();

  try {
    if (process.env.MANUAL_LOGIN === 'true') {
      await waitForManualLogin(page, config);
    } else {
      config.validateConfig();
      await login(page, config);
    }

    const result = await collectAllPdfLinks(context, config);

    console.log(`Coleta concluida. Registros: ${result.totalRecords}`);
    console.log(`JSON: ${result.outputPaths.jsonPath}`);
    console.log(`CSV: ${result.outputPaths.csvPath}`);
    console.log(`Log de consultas: ${result.outputPaths.queryLogPath}`);
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await browser.close();
  }
})();
