async function login(page, config) {
  await page.goto(config.loginUrl, { waitUntil: 'load' });
  await page.waitForSelector('form#login');
  await page.waitForSelector('#username');
  await page.waitForSelector('#password');
  await page.waitForSelector('button[name="signin"]');

  await page.fill('#username', config.username);
  await page.fill('#password', config.password);

  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click('button[name="signin"]'),
  ]);

  await page.waitForURL((url) => !url.href.includes('/usuario/index.php'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const loginFormVisible = await page.locator('form#login').isVisible().catch(() => false);
  if (loginFormVisible) {
    await page.screenshot({ path: 'login-failed.png', fullPage: true });
    throw new Error(
      'Login nao foi concluido. Verifique usuario/senha ou bloqueios da aplicacao. Screenshot salva em login-failed.png.',
    );
  }

  console.log('Login realizado');
}

async function waitForManualLogin(page, config) {
  await page.goto(config.loginUrl, { waitUntil: 'load' });
  await page.waitForSelector('form#login');

  console.log('Preencha usuario e senha no navegador aberto.');
  console.log('Depois de clicar em Login, o script vai detectar a sessao automaticamente.');

  await page.waitForFunction(
    (loginUrl) => {
      const loginForm = document.querySelector('form#login');
      if (!loginForm || window.location.href !== loginUrl) {
        return true;
      }

      return false;
    },
    config.loginUrl,
    { timeout: 300000 },
  ).catch(() => {});

  await page.waitForTimeout(5000);

  const loginFormVisible = await page.locator('form#login').isVisible().catch(() => false);
  if (loginFormVisible) {
    await page.screenshot({ path: 'login-failed.png', fullPage: true });
    throw new Error(
      'Login manual nao foi concluido. A pagina ainda mostra o formulario. Screenshot salva em login-failed.png.',
    );
  }

  console.log('Login manual confirmado');
}

module.exports = { login, waitForManualLogin };
