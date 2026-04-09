const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setupApp(dbPath) {
  process.env.DB_PATH = dbPath;
  process.env.AUTH_ENABLED = 'false';

  clearModule('../src/config');
  clearModule('../src/db/client');
  clearModule('../src/db/models');
  clearModule('../src/db/sequelize');
  clearModule('../src/services/app-settings');
  clearModule('../src/services/ai-search');
  clearModule('../src/services/maintenance');
  clearModule('../src/services/auth');
  clearModule('../src/services/audit');
  clearModule('../src/services/document-enrichment');
  clearModule('../src/services/document-qa');
  clearModule('../src/services/repository');
  clearModule('../src/services/search');
  clearModule('../src/services/text-cleanup');
  clearModule('../src/services/background-indexer');
  clearModule('../src/middlewares/auth');
  clearModule('../src/routes/documents');
  clearModule('../src/routes/auth');
  clearModule('../src/routes/search');
  clearModule('../src/routes/admin');
  clearModule('../src/routes/web');
  clearModule('../src/app');

  const { ensureDatabase, closeDatabase } = require('../src/db/client');
  const { closeSequelize } = require('../src/db/sequelize');
  const repository = require('../src/services/repository');
  const { createApp } = require('../src/app');

  ensureDatabase();
  repository.clearRepositoryCaches();

  return {
    app: createApp(),
    closeDatabase,
    closeSequelize,
    repository,
  };
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function startJsonServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

test('health endpoint responde com 200 e payload esperado', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, { ok: true });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('api catch-all retorna 404 json em rota inexistente', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/inexistente`);
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.match(body.error, /Rota nao encontrada/);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('documents valida id invalido com 400', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/documents/abc`);
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'Identificador de documento invalido.');
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('documents registra acesso com 204', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-1',
        content_key: 'content-1',
        hash_verificacao: 'ABC-123',
        pdf_url: 'https://example.com/a.pdf',
        detail_url: 'https://example.com/a',
        nome_arquivo: 'a.pdf',
        classificacao: 'Atos',
        caixa: '1',
        descricao: 'Documento A',
        ano: '2024',
      },
    ]);

    const created = repository.getDocumentById(1);
    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/documents/${created.id}/access`, { method: 'POST' });

      assert.equal(response.status, 204);
      assert.equal(repository.getDocumentById(created.id).access_count, 1);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('admin settings retorna padrao e persiste atualizacao', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);

    try {
      const initialResponse = await fetch(`${baseUrl}/api/admin/settings`);
      const initialBody = await initialResponse.json();

      assert.equal(initialResponse.status, 200);
      assert.equal(initialBody.autoIndexOnDetailView, false);
      assert.equal(initialBody.enrichmentBatchLimit, 5);
      assert.equal(initialBody.enrichmentProvider, 'disabled');
      assert.equal(initialBody.enrichmentSummaryEnabled, true);

      const updateResponse = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          autoIndexOnDetailView: true,
          enrichmentBatchLimit: 7,
          enrichmentBaseUrl: 'http://127.0.0.1:11434/v1',
          enrichmentModel: 'qwen-test',
          enrichmentProvider: 'local',
          enrichmentSummaryEnabled: true,
        }),
      });
      const updateBody = await updateResponse.json();

      assert.equal(updateResponse.status, 200);
      assert.equal(updateBody.autoIndexOnDetailView, true);
      assert.equal(updateBody.enrichmentBatchLimit, 7);
      assert.equal(updateBody.enrichmentProvider, 'local');
      assert.equal(updateBody.enrichmentModel, 'qwen-test');

      const confirmResponse = await fetch(`${baseUrl}/api/admin/settings`);
      const confirmBody = await confirmResponse.json();
      assert.equal(confirmBody.autoIndexOnDetailView, true);
      assert.equal(confirmBody.enrichmentBatchLimit, 7);
      assert.equal(confirmBody.enrichmentBaseUrl, 'http://127.0.0.1:11434/v1');
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('enrichment run gera resumo fallback para documento indexado', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-enrich-1',
        content_key: 'group-enrich-1',
        hash_verificacao: 'ENRICH-001',
        pdf_url: 'https://example.com/enrich-1.pdf',
        detail_url: 'https://example.com/enrich-1',
        nome_arquivo: 'enrich-1.pdf',
        classificacao: 'Atos',
        caixa: 'CAIXA 1',
        descricao: 'Relatorio financeiro resumido',
        ano: '2024',
      },
    ]);
    repository.saveDocumentContent(1, 'Relatorio financeiro com receitas, despesas e saldo do periodo. Documento administrativo do municipio.', {
      extractor: 'pdf-parse',
      pageCount: 4,
    });

    const { server, baseUrl } = await startServer(app);

    try {
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enrichmentPreviewImagesEnabled: false,
          enrichmentProvider: 'disabled',
          enrichmentSummaryEnabled: true,
        }),
      });

      const response = await fetch(`${baseUrl}/api/admin/enrichment/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit: 3 }),
      });
      const body = await response.json();
      const enriched = repository.getDocumentById(1);

      assert.equal(response.status, 200);
      assert.equal(body.processed, 1);
      assert.match(enriched.summary_text, /Relatorio financeiro resumido/);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('admin enrichment models lista modelos automaticamente para endpoint estilo LM Studio', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);
    const lmServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/api/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          data: [
            { id: 'qwen2.5-7b-instruct' },
            { id: 'llama-3.1-8b-instruct' },
          ],
        }));
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/admin/enrichment/models?${new URLSearchParams({
          baseUrl: `${lmServerInfo.baseUrl}/api/v1/chat`,
          provider: 'local',
        })}`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.provider, 'local');
      assert.equal(body.endpoint, `${lmServerInfo.baseUrl}/api/v1/models`);
      assert.deepEqual(body.models, ['qwen2.5-7b-instruct', 'llama-3.1-8b-instruct']);
    } finally {
      await new Promise((resolve, reject) => lmServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('admin enrichment models lista modelos automaticamente para endpoint nativo do Ollama', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize } = setupApp(dbPath);
    const { server, baseUrl } = await startServer(app);
    const ollamaServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/api/tags') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          models: [
            { model: 'qwen2.5:7b' },
            { name: 'llama3.1:8b' },
          ],
        }));
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/admin/enrichment/models?${new URLSearchParams({
          baseUrl: `${ollamaServerInfo.baseUrl}/api`,
          provider: 'local',
        })}`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.provider, 'local');
      assert.equal(body.endpoint, `${ollamaServerInfo.baseUrl}/api/tags`);
      assert.deepEqual(body.models, ['qwen2.5:7b', 'llama3.1:8b']);
    } finally {
      await new Promise((resolve, reject) => ollamaServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('search image usa IA local para extrair consulta e retorna resultados', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-image-1',
        content_key: 'group-image-1',
        hash_verificacao: 'IMG-001',
        pdf_url: 'https://example.com/image-1.pdf',
        detail_url: 'https://example.com/image-1',
        nome_arquivo: 'image-1.pdf',
        classificacao: 'RH',
        caixa: 'Servidores',
        descricao: 'Bruno Goncalves Braga',
        ano: '2023',
      },
    ]);
    repository.saveDocumentContent(1, 'FERNANDO BRUNO GONCALVES BRAGA', {
      extractor: 'pdf-parse',
      pageCount: 1,
    });

    const { server, baseUrl } = await startServer(app);
    const aiServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/v1/responses') {
        let rawBody = '';
        request.on('data', (chunk) => {
          rawBody += chunk;
        });
        request.on('end', () => {
          const body = JSON.parse(rawBody);
          assert.ok(Array.isArray(body.input));
          assert.equal(body.input[0]?.role, 'user');
          assert.equal(body.input[0]?.content?.[0]?.type, 'input_text');
          assert.equal(body.input[0]?.content?.[0]?.text, 'Leia a imagem e devolva apenas o texto visivel mais relevante para busca documental. Preserve nomes, numeros, datas, processos, caixas, classificacoes e termos centrais.');
          assert.equal(body.input[0]?.content?.[1]?.type, 'input_image');
          assert.match(body.input[0]?.content?.[1]?.image_url || '', /^data:image\//);
          assert.equal(body.instructions, 'Voce extrai texto visivel de imagens de documentos em portugues. Devolva somente o texto encontrado, limpo, sem markdown, sem comentarios e sem explicacoes.');
          assert.equal(body.model, 'vision-test');
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({
            output_text: 'Bruno Goncalves Braga',
          }));
        });
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enrichmentBaseUrl: `${aiServerInfo.baseUrl}/api/v1/chat`,
          enrichmentModel: 'vision-test',
          enrichmentProvider: 'local',
        }),
      });

      const response = await fetch(`${baseUrl}/api/search/image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7nV4AAAAASUVORK5CYII=',
          pageSize: 10,
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.extractedText, 'Bruno Goncalves Braga');
      assert.equal(body.query, 'Bruno Goncalves Braga');
      assert.equal(body.usedExtractedText, true);
      assert.equal(body.usedQuery, 'Bruno Goncalves Braga');
      assert.equal(body.search.total, 1);
      assert.equal(body.search.items[0].descricao, 'Bruno Goncalves Braga');
    } finally {
      await new Promise((resolve, reject) => aiServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('documents ask usa IA para responder perguntas sobre o arquivo', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-ask-1',
        content_key: 'group-ask-1',
        hash_verificacao: 'ASK-001',
        pdf_url: 'https://example.com/ask-1.pdf',
        detail_url: 'https://example.com/ask-1',
        nome_arquivo: 'ask-1.pdf',
        classificacao: 'Decretos',
        caixa: 'Arquivos Diversos',
        descricao: 'Decreto 498 de 2019',
        ano: '2019',
      },
    ]);
    repository.saveDocumentContent(1, 'DECRETO N 498 DE 11 DE SETEMBRO DE 2019. Abre no orcamento vigente credito adicional suplementar.', {
      extractor: 'pdf-parse',
      pageCount: 2,
    });

    const { server, baseUrl } = await startServer(app);
    const aiServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/v1/responses') {
        let rawBody = '';
        request.on('data', (chunk) => {
          rawBody += chunk;
        });
        request.on('end', () => {
          const body = JSON.parse(rawBody);
          assert.equal(typeof body.input, 'string');
          assert.ok(body.input.includes('Pergunta: Qual o assunto principal do decreto?'));
          assert.equal(body.instructions, 'Voce responde perguntas sobre documentos administrativos brasileiros usando apenas o contexto fornecido.');
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({
            output_text: 'O documento trata da abertura de credito adicional suplementar no orcamento vigente.',
          }));
        });
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enrichmentBaseUrl: `${aiServerInfo.baseUrl}/api/v1/chat`,
          enrichmentModel: 'qa-test',
          enrichmentProvider: 'local',
        }),
      });

      const response = await fetch(`${baseUrl}/api/documents/1/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: 'Qual o assunto principal do decreto?',
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.model, 'qa-test');
      assert.match(body.answer, /credito adicional suplementar/i);
    } finally {
      await new Promise((resolve, reject) => aiServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('search image usa endpoint nativo do Ollama para extrair consulta e retorna resultados', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-image-ollama-1',
        content_key: 'group-image-ollama-1',
        hash_verificacao: 'IMG-OLLAMA-001',
        pdf_url: 'https://example.com/image-ollama-1.pdf',
        detail_url: 'https://example.com/image-ollama-1',
        nome_arquivo: 'image-ollama-1.pdf',
        classificacao: 'RH',
        caixa: 'Servidores',
        descricao: 'Maria de Souza',
        ano: '2024',
      },
    ]);
    repository.saveDocumentContent(1, 'MARIA DE SOUZA', {
      extractor: 'pdf-parse',
      pageCount: 1,
    });

    const { server, baseUrl } = await startServer(app);
    const aiServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/api/chat') {
        let rawBody = '';
        request.on('data', (chunk) => {
          rawBody += chunk;
        });
        request.on('end', () => {
          const body = JSON.parse(rawBody);
          assert.equal(body.model, 'vision-ollama');
          assert.equal(body.stream, false);
          assert.equal(body.messages[0]?.role, 'system');
          assert.equal(body.messages[1]?.role, 'user');
          assert.equal(body.messages[1]?.content, 'Leia a imagem e devolva apenas o texto visivel mais relevante para busca documental. Preserve nomes, numeros, datas, processos, caixas, classificacoes e termos centrais.');
          assert.equal(Array.isArray(body.messages[1]?.images), true);
          assert.equal(body.messages[1]?.images?.length, 1);
          assert.doesNotMatch(body.messages[1]?.images?.[0] || '', /^data:image\//);
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({
            message: {
              content: 'Maria de Souza',
            },
          }));
        });
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enrichmentBaseUrl: `${aiServerInfo.baseUrl}/api`,
          enrichmentModel: 'vision-ollama',
          enrichmentProvider: 'local',
        }),
      });

      const response = await fetch(`${baseUrl}/api/search/image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7nV4AAAAASUVORK5CYII=',
          pageSize: 10,
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.extractedText, 'Maria de Souza');
      assert.equal(body.query, 'Maria Souza');
      assert.equal(body.search.total, 1);
    } finally {
      await new Promise((resolve, reject) => aiServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('documents ask usa endpoint nativo do Ollama para responder perguntas sobre o arquivo', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-ask-ollama-1',
        content_key: 'group-ask-ollama-1',
        hash_verificacao: 'ASK-OLLAMA-001',
        pdf_url: 'https://example.com/ask-ollama-1.pdf',
        detail_url: 'https://example.com/ask-ollama-1',
        nome_arquivo: 'ask-ollama-1.pdf',
        classificacao: 'Portarias',
        caixa: 'Arquivo Central',
        descricao: 'Portaria 15 de 2024',
        ano: '2024',
      },
    ]);
    repository.saveDocumentContent(1, 'PORTARIA 15 DE 2024. Nomeia Maria de Souza para o cargo de diretora administrativa.', {
      extractor: 'pdf-parse',
      pageCount: 1,
    });

    const { server, baseUrl } = await startServer(app);
    const aiServerInfo = await startJsonServer((request, response) => {
      if (request.url === '/api/chat') {
        let rawBody = '';
        request.on('data', (chunk) => {
          rawBody += chunk;
        });
        request.on('end', () => {
          const body = JSON.parse(rawBody);
          assert.equal(body.model, 'qa-ollama');
          assert.equal(body.stream, false);
          assert.equal(body.messages[0]?.role, 'system');
          assert.equal(body.messages[1]?.role, 'user');
          assert.match(body.messages[1]?.content || '', /Pergunta: Quem foi nomeada para o cargo\?/);
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({
            message: {
              content: 'Maria de Souza foi nomeada para o cargo de diretora administrativa.',
            },
          }));
        });
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enrichmentBaseUrl: `${aiServerInfo.baseUrl}/api`,
          enrichmentModel: 'qa-ollama',
          enrichmentProvider: 'local',
        }),
      });

      const response = await fetch(`${baseUrl}/api/documents/1/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: 'Quem foi nomeada para o cargo?',
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.model, 'qa-ollama');
      assert.match(body.answer, /Maria de Souza/);
    } finally {
      await new Promise((resolve, reject) => aiServerInfo.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('maintenance insights expõe contadores da fila de tratamento', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-maintenance-1',
        content_key: 'group-maintenance-1',
        hash_verificacao: 'MAINT-001',
        pdf_url: 'https://example.com/maintenance-1.pdf',
        detail_url: 'https://example.com/maintenance-1',
        nome_arquivo: 'maintenance-1.pdf',
        classificacao: 'Relatorios',
        caixa: 'CX-1',
        descricao: 'Documento para OCR',
        ano: '2024',
      },
    ]);
    repository.saveDocumentContent(1, 'texto curto', {
      extractor: 'pdf-parse',
      pageCount: 16,
    });

    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/admin/maintenance/insights`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.shortMultiPage, 1);
      assert.equal(body.forceOcrCandidates, 1);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('maintenance run limpa documento e devolve para pendente', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-maintenance-2',
        content_key: 'group-maintenance-2',
        hash_verificacao: 'MAINT-002',
        pdf_url: 'https://example.com/maintenance-2.pdf',
        detail_url: 'https://example.com/maintenance-2',
        nome_arquivo: 'maintenance-2.pdf',
        classificacao: 'Processos',
        caixa: 'CX-2',
        descricao: 'Documento para limpeza',
        ano: '2025',
      },
    ]);
    repository.saveDocumentContent(1, 'texto muito curto', {
      extractor: 'pdf-parse',
      pageCount: 12,
    });

    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/admin/maintenance/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'clear_to_pending',
          strategy: 'short-multipage',
          limit: 10,
          resetAttempts: true,
        }),
      });
      const body = await response.json();
      const document = repository.getDocumentById(1);

      assert.equal(response.status, 200);
      assert.equal(body.processed, 1);
      assert.equal(document.index_status, 'pending');
      assert.equal(document.text_length, 0);
      assert.equal(document.page_count, 0);
      assert.equal(document.last_index_method, null);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('text cleanup preview e run ajustam texto indexado sem reenfileirar', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-cleanup-1',
        content_key: 'group-cleanup-1',
        hash_verificacao: 'CLEAN-001',
        pdf_url: 'https://example.com/cleanup-1.pdf',
        detail_url: 'https://example.com/cleanup-1',
        nome_arquivo: 'cleanup-1.pdf',
        classificacao: 'Folha',
        caixa: 'RH',
        descricao: 'Folha de Pagamento Agosto',
        ano: '2019',
      },
    ]);
    repository.saveDocumentContent(1, 'Folha de Pagamento Data Pagamento: 25/08/2019 Matrícula Nome do Trabalhador Admissão ABIGAIL DELFINO DA SILVA', {
      extractor: 'pdf-parse',
      pageCount: 16,
    });

    const { server, baseUrl } = await startServer(app);

    try {
      const previewResponse = await fetch(`${baseUrl}/api/admin/text-cleanup/preview?strategy=payroll-layout&limit=10&sampleSize=50`);
      const previewBody = await previewResponse.json();

      assert.equal(previewResponse.status, 200);
      assert.equal(previewBody.items.length, 1);
      assert.match(previewBody.items[0].afterSnippet, /Matrícula|Matr[ií]cula/);

      const runResponse = await fetch(`${baseUrl}/api/admin/text-cleanup/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          strategy: 'payroll-layout',
          limit: 10,
          sampleSize: 50,
        }),
      });
      const runBody = await runResponse.json();
      const updated = repository.getDocumentById(1);

      assert.equal(runResponse.status, 200);
      assert.equal(runBody.processed, 1);
      assert.equal(updated.index_status, 'indexed');
      assert.match(updated.extracted_text, /\n\nData Pagamento:/);
      assert.match(updated.extracted_text, /\n\nMatr[ií]cula Nome do Trabalhador/);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('reindex start recupera grupos presos em processing antes de iniciar', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-app-test-'));
  const dbPath = path.join(tempDir, 'app.sqlite');

  try {
    const { app, closeDatabase, closeSequelize, repository } = setupApp(dbPath);
    repository.replaceDocuments([
      {
        source_key: 'doc-processing-1',
        content_key: 'group-processing-1',
        hash_verificacao: 'PROC-001',
        pdf_url: 'https://example.com/proc-1.pdf',
        detail_url: 'https://example.com/proc-1',
        nome_arquivo: 'proc-1.pdf',
        classificacao: 'Teste',
        caixa: 'CX-1',
        descricao: 'Documento preso em processing',
        ano: '2026',
      },
    ]);
    repository.markDocumentProcessing(1, 'hybrid');

    const { server, baseUrl } = await startServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/admin/reindex/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          batchLimit: 1,
          mode: 'hybrid',
          retryFailures: false,
        }),
      });
      const body = await response.json();
      const queueStats = repository.getIndexerQueueStats();

      assert.equal(response.status, 200);
      assert.equal(body.recoveredGroupsAtStart, 1);
      assert.equal(queueStats.processingContentGroups, 0);
    } finally {
      await fetch(`${baseUrl}/api/admin/reindex/stop`, { method: 'POST' });
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeSequelize();
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
