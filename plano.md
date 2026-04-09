Perfeito, agora ficou profissional 👇
já dá pra montar a base 100% funcional.

---

## 🔐 1. Estrutura do projeto

Cria assim:

```
projeto/
  src/
    config.js
    index.js
    services/
      browser.js
      auth.js
  .env
  package.json
```

---

## 🔑 2. Arquivo de credenciais (.env)

Cria um arquivo `.env` na raiz:

```env
LOGIN_URL=https://ambsolucoespublicas.com.br/ged/gedpmcujubimro/usuario/index.php
CONSULTA_URL=https://ambsolucoespublicas.com.br/ged/gedpmcujubimro/usuario/bemvindoconsulta_docs_liberados_geral_geral.php

USERNAME=SEU_USUARIO
PASSWORD=SUA_SENHA
```

---

## ⚙️ 3. Config (src/config.js)

```js
require('dotenv').config();

module.exports = {
  loginUrl: process.env.LOGIN_URL,
  consultaUrl: process.env.CONSULTA_URL,
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
};
```

---

## 🌐 4. Browser (Playwright) — src/services/browser.js

```js
const { chromium } = require('playwright');

async function createBrowser() {
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true // necessário por causa do PDF
  });

  const page = await context.newPage();

  return { browser, context, page };
}

module.exports = { createBrowser };
```

---

## 🔓 5. Login (src/services/auth.js)

Aqui já usamos os seletores reais que você mandou no HTML 👇


```js
async function login(page, config) {
  await page.goto(config.loginUrl);

  // Preenche os campos
  await page.fill('#username', config.username);
  await page.fill('#password', config.password);

  // Clica no botão login
  await page.click('button[name="signin"]');

  // Aguarda redirecionamento
  await page.waitForLoadState('networkidle');

  console.log('✅ Login realizado');
}

module.exports = { login };
```

---

## 🚀 6. Arquivo principal (src/index.js)

```js
const { createBrowser } = require('./services/browser');
const { login } = require('./services/auth');
const config = require('./config');

(async () => {
  const { browser, page } = await createBrowser();

  try {
    await login(page, config);

    // ir para a tela de consulta
    await page.goto(config.consultaUrl);

    console.log('📄 Página de consulta carregada');

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    // deixa aberto por enquanto para debug
    // await browser.close();
  }
})();
```

---

## 📦 7. Instalar dependências

```bash
npm init -y
npm install playwright dotenv
npx playwright install
```

---

## ⚠️ IMPORTANTE (muito importante)

No HTML que você mandou tem isso:

```html
<script src="https://www.google.com/recaptcha/..."></script>
```

👉 Ou seja: **TEM RECAPTCHA**

Mas pelo código:

```html
<!-- <div class="g-recaptcha"...> -->
```

Ele está **comentado**, então:

✔ provavelmente NÃO está bloqueando login
✔ Playwright deve funcionar normal

Se der erro depois → a gente resolve com bypass.

---

## ✅ Resultado dessa etapa

Depois disso você já vai conseguir:

* logar automaticamente
* cair na página de consulta
* manter sessão ativa

---

## 🔥 Próximo passo (que eu faço pra você)

Agora que o login está resolvido, o próximo passo é:

👉 selecionar classificação
👉 clicar em consultar
👉 pegar a tabela
👉 extrair:

* Classificação
* Caixa
* Descrição
* Ano
* link do detalhe

Se quiser, já posso te entregar essa próxima parte pronta.
