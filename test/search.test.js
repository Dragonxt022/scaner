const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadFreshSearchStack(dbPath) {
  process.env.DB_PATH = dbPath;

  clearModule('../src/config');
  clearModule('../src/db/client');
  clearModule('../src/services/repository');
  clearModule('../src/services/search');

  const { ensureDatabase, getDb, closeDatabase } = require('../src/db/client');
  const repository = require('../src/services/repository');
  const search = require('../src/services/search');

  ensureDatabase();
  repository.getStats();
  repository.clearRepositoryCaches();

  return {
    closeDatabase,
    db: getDb(),
    repository,
    search,
  };
}

function seedDocuments(db) {
  const insertDocument = db.prepare(`
    INSERT INTO documents (
      source_key,
      content_key,
      hash_verificacao,
      pdf_url,
      detail_url,
      nome_arquivo,
      classificacao,
      caixa,
      descricao,
      ano,
      index_status,
      last_index_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertContent = db.prepare(`
    INSERT INTO document_contents (document_id, extracted_text, extractor)
    VALUES (?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO documents_fts (rowid, nome_arquivo, classificacao, caixa, descricao, ano, extracted_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertDocument.run(
      'src-1',
      'content-1',
      'HASH-ABC-001',
      'https://example.com/contrato.pdf',
      'https://example.com/contrato',
      'contrato-saude.pdf',
      'Contratos',
      '12',
      'Contrato de servicos de saude',
      '2024',
      'indexed',
      'native',
    );
    const doc1 = db.prepare('SELECT id FROM documents WHERE source_key = ?').get('src-1').id;
    insertContent.run(doc1, 'Contrato emergencial para a Secretaria Municipal de Saude com vigencia anual.', 'native');
    insertFts.run(
      doc1,
      'contrato-saude.pdf',
      'Contratos',
      '12',
      'Contrato de servicos de saude',
      '2024',
      'Contrato emergencial para a Secretaria Municipal de Saude com vigencia anual.',
    );

    insertDocument.run(
      'src-2',
      'content-2',
      'HASH-LIC-002',
      'https://example.com/licitacao.pdf',
      'https://example.com/licitacao',
      'licitacao-obras.pdf',
      'Licitacoes',
      '15',
      'Processo licitatorio de obras',
      '2023',
      'indexed',
      'ocr',
    );
    const doc2 = db.prepare('SELECT id FROM documents WHERE source_key = ?').get('src-2').id;
    insertContent.run(doc2, 'A licitacao contempla reforma predial e servicos complementares.', 'ocr');
    insertFts.run(
      doc2,
      'licitacao-obras.pdf',
      'Licitacoes',
      '15',
      'Processo licitatorio de obras',
      '2023',
      'A licitacao contempla reforma predial e servicos complementares.',
    );

    insertDocument.run(
      'src-3',
      'content-3',
      'HASH-ONLY-003',
      'https://example.com/hash.pdf',
      'https://example.com/hash',
      'registro-hash.pdf',
      'Controle',
      '09',
      'Documento de controle interno',
      '2022',
      'pending',
      null,
    );
  });

  tx();
}

test('listDocuments retorna snippet do FTS sem expor raw_text', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-test-'));
  const dbPath = path.join(tempDir, 'search.sqlite');

  try {
    const { db, search, closeDatabase } = loadFreshSearchStack(dbPath);
    try {
      seedDocuments(db);

      const result = search.listDocuments({ q: 'saude', page: 1, pageSize: 10 });

      assert.equal(result.total, 1);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].nome_arquivo, 'contrato-saude.pdf');
      assert.match(result.items[0].previewText, /Secretaria Municipal de Saude/i);
      assert.ok(result.items[0].matchDetails.fields.includes('descricao'));
      assert.ok(result.items[0].matchDetails.fields.includes('arquivo'));
      assert.equal('raw_text' in result.items[0], false);
    } finally {
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('listDocuments encontra documentos apenas por metadata quando nao ha FTS', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-test-'));
  const dbPath = path.join(tempDir, 'search.sqlite');

  try {
    const { db, search, closeDatabase } = loadFreshSearchStack(dbPath);
    try {
      seedDocuments(db);

      const result = search.listDocuments({ q: 'controle interno', page: 1, pageSize: 10 });

      assert.equal(result.total, 1);
      assert.equal(result.items[0].hash_verificacao, 'HASH-ONLY-003');
      assert.ok(result.items[0].matchDetails.fields.includes('descricao'));
      assert.equal(result.items[0].previewText, 'Documento de controle interno');
    } finally {
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('getStats reflete replaceDocuments porque o cache e invalidado', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-test-'));
  const dbPath = path.join(tempDir, 'search.sqlite');

  try {
    const { repository, closeDatabase } = loadFreshSearchStack(dbPath);
    try {
      repository.replaceDocuments([
        {
          source_key: 'doc-a',
          content_key: 'content-a',
          hash_verificacao: 'A-1',
          pdf_url: 'https://example.com/a.pdf',
          detail_url: 'https://example.com/a',
          nome_arquivo: 'a.pdf',
          classificacao: 'Atos',
          caixa: '1',
          descricao: 'Documento A',
          ano: '2024',
        },
      ]);

      assert.equal(repository.getStats().totalDocumentos, 1);

      repository.replaceDocuments([
        {
          source_key: 'doc-b',
          content_key: 'content-b',
          hash_verificacao: 'B-1',
          pdf_url: 'https://example.com/b.pdf',
          detail_url: 'https://example.com/b',
          nome_arquivo: 'b.pdf',
          classificacao: 'Atos',
          caixa: '2',
          descricao: 'Documento B',
          ano: '2025',
        },
      ]);

      assert.equal(repository.getStats().totalDocumentos, 2);
    } finally {
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('documento mais acessado sobe no ranque quando a relevancia e equivalente', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaner-test-'));
  const dbPath = path.join(tempDir, 'search.sqlite');

  try {
    const { repository, search, closeDatabase } = loadFreshSearchStack(dbPath);
    try {
      repository.replaceDocuments([
        {
          source_key: 'doc-a',
          content_key: 'content-a',
          hash_verificacao: 'ALFA-1',
          pdf_url: 'https://example.com/a.pdf',
          detail_url: 'https://example.com/a',
          nome_arquivo: 'contrato-a.pdf',
          classificacao: 'Contratos',
          caixa: '7',
          descricao: 'Contrato administrativo',
          ano: '2024',
        },
        {
          source_key: 'doc-b',
          content_key: 'content-b',
          hash_verificacao: 'ALFA-2',
          pdf_url: 'https://example.com/b.pdf',
          detail_url: 'https://example.com/b',
          nome_arquivo: 'contrato-b.pdf',
          classificacao: 'Contratos',
          caixa: '7',
          descricao: 'Contrato administrativo',
          ano: '2024',
        },
      ]);

      repository.registerDocumentAccess(1);
      repository.registerDocumentAccess(1);
      repository.registerDocumentAccess(1);

      const result = search.listDocuments({ q: 'Contrato administrativo', page: 1, pageSize: 10 });

      assert.equal(result.items.length, 2);
      assert.equal(result.items[0].id, 1);
      assert.ok(result.items[0].access_count > result.items[1].access_count);
    } finally {
      closeDatabase();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
