const { getDb } = require('../db/client');
const { analyzeTextQuality, extractWords, normalizeSearchTerm } = require('../utils/text');

const CACHE_TTL_MS = 5000;
const SEARCH_COUNT_TTL_MS = 15000;
const statsCache = { expiresAt: 0, value: null };
const searchCountCache = new Map();

function getCached(cache, producer, ttlMs) {
  if (cache.value != null && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const value = producer();
  cache.value = value;
  cache.expiresAt = Date.now() + ttlMs;
  return value;
}

function clearRepositoryCaches() {
  statsCache.expiresAt = 0;
  statsCache.value = null;
  searchCountCache.clear();
}

function getSearchCountCacheKey(prefix, params) {
  return JSON.stringify([prefix, params]);
}

function getCachedSearchCount(key, producer) {
  const cached = searchCountCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = producer();
  searchCountCache.set(key, {
    expiresAt: Date.now() + SEARCH_COUNT_TTL_MS,
    value,
  });
  return value;
}

function ensureDocumentsColumns() {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(documents)`).all().map((column) => column.name);
  const addColumn = (name, sql) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE documents ADD COLUMN ${sql}`);
      columns.push(name);
    }
  };

  addColumn('content_key', 'content_key TEXT');
  addColumn('index_attempts', 'index_attempts INTEGER NOT NULL DEFAULT 0');
  addColumn('last_index_method', 'last_index_method TEXT');
  addColumn('last_error_at', 'last_error_at TEXT');
  addColumn('access_count', 'access_count INTEGER NOT NULL DEFAULT 0');
  addColumn('last_accessed_at', 'last_accessed_at TEXT');

  db.exec(`
    UPDATE documents
    SET content_key = COALESCE(NULLIF(content_key, ''), NULLIF(hash_verificacao, ''), pdf_url)
    WHERE content_key IS NULL OR content_key = ''
  `);
  db.exec(`
    UPDATE documents
    SET index_attempts = 1
    WHERE COALESCE(index_attempts, 0) = 0
      AND index_status IN ('indexed', 'error', 'processing')
  `);
  db.exec(`
    UPDATE documents
    SET last_error_at = COALESCE(last_error_at, updated_at)
    WHERE index_status = 'error'
      AND (last_error_at IS NULL OR last_error_at = '')
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_content_key ON documents(content_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_index_attempts ON documents(index_attempts)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_error_at ON documents(last_error_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_caixa ON documents(caixa)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_access_count ON documents(access_count)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_accessed_at ON documents(last_accessed_at)`);
}

const upsertDocumentStatement = () =>
  getDb().prepare(`
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
      updated_at
    ) VALUES (
      @source_key,
      @content_key,
      @hash_verificacao,
      @pdf_url,
      @detail_url,
      @nome_arquivo,
      @classificacao,
      @caixa,
      @descricao,
      @ano,
      'pending',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(source_key) DO UPDATE SET
      content_key = excluded.content_key,
      hash_verificacao = excluded.hash_verificacao,
      pdf_url = excluded.pdf_url,
      detail_url = excluded.detail_url,
      nome_arquivo = excluded.nome_arquivo,
      classificacao = excluded.classificacao,
      caixa = excluded.caixa,
      descricao = excluded.descricao,
      ano = excluded.ano,
      index_status = CASE
        WHEN documents.pdf_url <> excluded.pdf_url THEN 'pending'
        ELSE documents.index_status
      END,
      updated_at = CURRENT_TIMESTAMP
  `);

function replaceDocuments(documents) {
  ensureDocumentsColumns();
  const statement = upsertDocumentStatement();
  const db = getDb();
  const transaction = db.transaction((items) => {
    for (const item of items) {
      statement.run(item);
    }
  });

  transaction(documents);
  clearRepositoryCaches();
}

function getContentKeyByDocumentId(documentId) {
  ensureDocumentsColumns();
  return getDb().prepare(`SELECT content_key FROM documents WHERE id = ?`).get(documentId)?.content_key;
}

function getDocumentGroupIds(documentId) {
  ensureDocumentsColumns();
  const contentKey = getContentKeyByDocumentId(documentId);
  if (!contentKey) {
    return [];
  }

  return getDb()
    .prepare(`SELECT id FROM documents WHERE content_key = ? ORDER BY id ASC`)
    .all(contentKey)
    .map((row) => row.id);
}

function saveDocumentContent(documentId, extractedText, metadata) {
  ensureDocumentsColumns();
  const db = getDb();
  const contentKey = getContentKeyByDocumentId(documentId);
  const targetIds = db
    .prepare(`SELECT id FROM documents WHERE content_key = ? ORDER BY id ASC`)
    .all(contentKey)
    .map((row) => row.id);

  const saveContent = db.prepare(`
    INSERT INTO document_contents (document_id, extracted_text, extractor, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      extracted_text = excluded.extracted_text,
      extractor = excluded.extractor,
      updated_at = CURRENT_TIMESTAMP
  `);

  const saveDocument = db.prepare(`
    UPDATE documents
    SET
      index_status = 'indexed',
      index_error = NULL,
      index_attempts = COALESCE(index_attempts, 0) + 1,
      last_error_at = NULL,
      last_index_method = ?,
      text_length = ?,
      page_count = ?,
      last_indexed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const deleteFts = db.prepare('DELETE FROM documents_fts WHERE rowid = ?');
  const insertFts = db.prepare(`
    INSERT INTO documents_fts (rowid, nome_arquivo, classificacao, caixa, descricao, ano, extracted_text)
    SELECT id, nome_arquivo, classificacao, caixa, descricao, ano, ?
    FROM documents
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const targetId of targetIds) {
      saveContent.run(targetId, extractedText, metadata.extractor);
      saveDocument.run(metadata.extractor, extractedText.length, metadata.pageCount, targetId);
      deleteFts.run(targetId);
      insertFts.run(extractedText, targetId);
    }
  });

  transaction();
  clearRepositoryCaches();
}

function listTextCleanupCandidates(strategy = 'low-quality', limit = 20, sampleSize = 200) {
  ensureDocumentsColumns();
  const normalizedLimit = Math.max(1, Number(limit || 20));
  const normalizedSampleSize = Math.max(normalizedLimit, Number(sampleSize || 200));
  const db = getDb();

  let sql = `
    SELECT
      d.id,
      d.content_key,
      d.nome_arquivo,
      d.descricao,
      d.classificacao,
      d.caixa,
      d.ano,
      d.pdf_url,
      d.detail_url,
      d.index_status,
      d.last_index_method,
      d.text_length,
      d.page_count,
      dc.extractor,
      dc.extracted_text
    FROM documents d
    JOIN document_contents dc ON dc.document_id = d.id
    WHERE d.index_status = 'indexed'
      AND COALESCE(d.text_length, 0) > 0
  `;
  const params = [];

  switch (strategy) {
    case 'payroll-layout':
      sql += `
        AND (
          LOWER(COALESCE(d.descricao, '')) LIKE '%folha%'
          OR LOWER(COALESCE(d.descricao, '')) LIKE '%contra cheque%'
          OR LOWER(COALESCE(d.descricao, '')) LIKE '%contracheque%'
          OR LOWER(COALESCE(d.descricao, '')) LIKE '%pagamento%'
          OR LOWER(COALESCE(d.nome_arquivo, '')) LIKE '%folha%'
        )
        ORDER BY COALESCE(d.page_count, 0) DESC, COALESCE(d.text_length, 0) DESC, d.id DESC
      `;
      break;
    case 'long-lines':
      sql += `
        ORDER BY COALESCE(d.text_length, 0) DESC, COALESCE(d.page_count, 0) DESC, d.id DESC
      `;
      break;
    case 'low-quality':
    default:
      sql += `
        AND (
          COALESCE(d.page_count, 0) >= 5
          OR COALESCE(d.text_length, 0) >= 1000
          OR d.last_index_method IS NULL
        )
        ORDER BY COALESCE(d.page_count, 0) DESC, COALESCE(d.text_length, 0) ASC, d.id DESC
      `;
      break;
  }

  const rows = db.prepare(`${sql} LIMIT ?`).all(...params, normalizedSampleSize);
  const ranked = rows.map((item) => {
    const quality = analyzeTextQuality(item.extracted_text || '');
    return {
      ...item,
      quality,
    };
  });

  if (strategy === 'long-lines') {
    ranked.sort((left, right) => {
      const leftLine = Math.round((left.text_length || 0) / Math.max(1, left.page_count || 1));
      const rightLine = Math.round((right.text_length || 0) / Math.max(1, right.page_count || 1));
      return rightLine - leftLine;
    });
  } else if (strategy === 'payroll-layout') {
    ranked.sort((left, right) => (right.page_count || 0) - (left.page_count || 0));
  } else {
    ranked.sort((left, right) => {
      if (left.quality.score !== right.quality.score) {
        return left.quality.score - right.quality.score;
      }
      return (right.page_count || 0) - (left.page_count || 0);
    });
  }

  return ranked.slice(0, normalizedLimit);
}

function rewriteDocumentContent(documentId, extractedText, options = {}) {
  ensureDocumentsColumns();
  const db = getDb();
  const contentKey = getContentKeyByDocumentId(documentId);
  if (!contentKey) {
    return { affectedDocuments: 0, affectedGroups: 0 };
  }

  const targetIds = db
    .prepare(`SELECT id FROM documents WHERE content_key = ? ORDER BY id ASC`)
    .all(contentKey)
    .map((row) => row.id);

  const extractor = typeof options.extractor === 'string' && options.extractor.trim()
    ? options.extractor.trim()
    : db.prepare(`SELECT extractor FROM document_contents WHERE document_id = ?`).get(documentId)?.extractor || 'cleanup';

  const updateContent = db.prepare(`
    INSERT INTO document_contents (document_id, extracted_text, extractor, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      extracted_text = excluded.extracted_text,
      extractor = excluded.extractor,
      updated_at = CURRENT_TIMESTAMP
  `);
  const updateDocument = db.prepare(`
    UPDATE documents
    SET
      text_length = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const deleteFts = db.prepare(`DELETE FROM documents_fts WHERE rowid = ?`);
  const insertFts = db.prepare(`
    INSERT INTO documents_fts (rowid, nome_arquivo, classificacao, caixa, descricao, ano, extracted_text)
    SELECT id, nome_arquivo, classificacao, caixa, descricao, ano, ?
    FROM documents
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const targetId of targetIds) {
      updateContent.run(targetId, extractedText, extractor);
      updateDocument.run(extractedText.length, targetId);
      deleteFts.run(targetId);
      insertFts.run(extractedText, targetId);
    }
  });

  transaction();
  clearRepositoryCaches();

  return {
    affectedDocuments: targetIds.length,
    affectedGroups: 1,
    extractor,
  };
}

function markDocumentError(documentId, errorMessage, method = null) {
  ensureDocumentsColumns();
  const contentKey = getContentKeyByDocumentId(documentId);
  getDb()
    .prepare(`
      UPDATE documents
      SET
        index_status = 'error',
        index_error = ?,
        index_attempts = COALESCE(index_attempts, 0) + 1,
        last_error_at = CURRENT_TIMESTAMP,
        last_index_method = COALESCE(?, last_index_method),
        updated_at = CURRENT_TIMESTAMP
      WHERE content_key = ?
    `)
    .run(errorMessage, method, contentKey);
  clearRepositoryCaches();
}

function markDocumentProcessing(documentId, method = null) {
  ensureDocumentsColumns();
  const contentKey = getContentKeyByDocumentId(documentId);
  getDb()
    .prepare(`
      UPDATE documents
      SET
        index_status = 'processing',
        index_error = NULL,
        last_index_method = COALESCE(?, last_index_method),
        updated_at = CURRENT_TIMESTAMP
      WHERE content_key = ?
    `)
    .run(method, contentKey);
  clearRepositoryCaches();
}

function getDocumentsToIndex(limit = 20, options = {}) {
  ensureDocumentsColumns();
  const includeErrors = Boolean(options.includeErrors);
  const statuses = includeErrors ? ['pending', 'error'] : ['pending'];
  const placeholders = statuses.map(() => '?').join(', ');

  return getDb()
    .prepare(`
      SELECT MIN(id) AS id, content_key, pdf_url, nome_arquivo
      FROM documents
      WHERE index_status IN (${placeholders})
      GROUP BY content_key, pdf_url, nome_arquivo
      ORDER BY
        CASE MIN(CASE index_status WHEN 'pending' THEN 0 WHEN 'error' THEN 1 ELSE 2 END)
          WHEN 0 THEN 0
          WHEN 1 THEN 1
          ELSE 2
        END,
        MIN(id) ASC
      LIMIT ?
    `)
    .all(...statuses, limit);
}

function getDocumentById(id) {
  ensureDocumentsColumns();
  return getDb()
    .prepare(`
      SELECT
        d.*,
        dc.extracted_text,
        de.summary_text,
        de.summary_source,
        de.summary_model,
        dpi.relative_path AS preview_image_path,
        dpi.mime_type AS preview_image_mime_type,
        dpi.width AS preview_image_width,
        dpi.height AS preview_image_height
      FROM documents d
      LEFT JOIN document_contents dc ON dc.document_id = d.id
      LEFT JOIN document_enrichments de ON de.document_id = d.id
      LEFT JOIN document_preview_images dpi ON dpi.document_id = d.id
      WHERE d.id = ?
    `)
    .get(id);
}

function getDocumentDecorations(documentIds = []) {
  ensureDocumentsColumns();
  const ids = [...new Set(documentIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) {
    return new Map();
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb().prepare(`
    SELECT
      d.id,
      de.summary_text,
      de.summary_source,
      de.summary_model,
      dpi.relative_path AS preview_image_path,
      dpi.mime_type AS preview_image_mime_type,
      dpi.width AS preview_image_width,
      dpi.height AS preview_image_height
    FROM documents d
    LEFT JOIN document_enrichments de ON de.document_id = d.id
    LEFT JOIN document_preview_images dpi ON dpi.document_id = d.id
    WHERE d.id IN (${placeholders})
  `).all(...ids);

  return new Map(rows.map((row) => [row.id, row]));
}

function saveDocumentSummary(documentId, summary) {
  ensureDocumentsColumns();
  const db = getDb();
  const contentKey = getContentKeyByDocumentId(documentId);
  const targetIds = db.prepare(`SELECT id FROM documents WHERE content_key = ? ORDER BY id ASC`).all(contentKey).map((row) => row.id);
  const statement = db.prepare(`
    INSERT INTO document_enrichments (document_id, summary_text, summary_source, summary_model, updated_at)
    VALUES (@documentId, @summaryText, @summarySource, @summaryModel, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      summary_text = excluded.summary_text,
      summary_source = excluded.summary_source,
      summary_model = excluded.summary_model,
      updated_at = CURRENT_TIMESTAMP
  `);
  const transaction = db.transaction(() => {
    for (const targetId of targetIds) {
      statement.run({
        documentId: targetId,
        summaryModel: summary.model || '',
        summarySource: summary.source || '',
        summaryText: summary.text || '',
      });
    }
  });
  transaction();
  clearRepositoryCaches();
}

function saveDocumentPreviewImage(documentId, image) {
  ensureDocumentsColumns();
  const db = getDb();
  const contentKey = getContentKeyByDocumentId(documentId);
  const targetIds = db.prepare(`SELECT id FROM documents WHERE content_key = ? ORDER BY id ASC`).all(contentKey).map((row) => row.id);
  const statement = db.prepare(`
    INSERT INTO document_preview_images (document_id, relative_path, mime_type, width, height, file_size, updated_at)
    VALUES (@documentId, @relativePath, @mimeType, @width, @height, @fileSize, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      relative_path = excluded.relative_path,
      mime_type = excluded.mime_type,
      width = excluded.width,
      height = excluded.height,
      file_size = excluded.file_size,
      updated_at = CURRENT_TIMESTAMP
  `);
  const transaction = db.transaction(() => {
    for (const targetId of targetIds) {
      statement.run({
        documentId: targetId,
        fileSize: image.fileSize || 0,
        height: image.height || null,
        mimeType: image.mimeType || 'image/png',
        relativePath: image.relativePath,
        width: image.width || null,
      });
    }
  });
  transaction();
  clearRepositoryCaches();
}

function getEnrichmentStats() {
  ensureDocumentsColumns();
  return getDb().prepare(`
    SELECT
      COUNT(DISTINCT de.document_id) AS summarizedDocuments,
      COUNT(DISTINCT dpi.document_id) AS imagedDocuments,
      SUM(CASE WHEN d.index_status = 'indexed' AND de.document_id IS NULL THEN 1 ELSE 0 END) AS indexedWithoutSummary,
      SUM(CASE WHEN d.index_status = 'indexed' AND dpi.document_id IS NULL THEN 1 ELSE 0 END) AS indexedWithoutImage
    FROM documents d
    LEFT JOIN document_enrichments de ON de.document_id = d.id
    LEFT JOIN document_preview_images dpi ON dpi.document_id = d.id
  `).get();
}

function getDocumentsForEnrichment(limit = 10, options = {}) {
  ensureDocumentsColumns();
  const includeAlreadyEnriched = Boolean(options.includeAlreadyEnriched);
  return getDb().prepare(`
    SELECT
      d.id,
      d.pdf_url,
      d.nome_arquivo,
      d.descricao,
      d.classificacao,
      d.caixa,
      d.ano,
      d.page_count,
      dc.extracted_text,
      de.summary_text,
      dpi.relative_path AS preview_image_path
    FROM documents d
    LEFT JOIN document_contents dc ON dc.document_id = d.id
    LEFT JOIN document_enrichments de ON de.document_id = d.id
    LEFT JOIN document_preview_images dpi ON dpi.document_id = d.id
    WHERE d.index_status = 'indexed'
      AND (${includeAlreadyEnriched ? '1 = 1' : "(COALESCE(de.summary_text, '') = '' OR dpi.relative_path IS NULL)"})
    ORDER BY datetime(COALESCE(d.last_accessed_at, d.last_indexed_at, d.updated_at)) DESC, d.id DESC
    LIMIT ?
  `).all(limit);
}

function registerDocumentAccess(id) {
  ensureDocumentsColumns();
  const result = getDb()
    .prepare(`
      UPDATE documents
      SET
        access_count = COALESCE(access_count, 0) + 1,
        last_accessed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(id);

  if (!result.changes) {
    return false;
  }

  clearRepositoryCaches();
  return true;
}

function getFilters() {
  ensureDocumentsColumns();
  const db = getDb();
  const mapValues = (column) =>
    db
      .prepare(`SELECT DISTINCT ${column} AS value FROM documents WHERE ${column} <> '' ORDER BY ${column} COLLATE NOCASE ASC`)
      .all()
      .map((row) => row.value);

  return {
    anos: mapValues('ano'),
    caixas: mapValues('caixa'),
    classificacoes: mapValues('classificacao'),
  };
}

function getStats() {
  ensureDocumentsColumns();
  return getCached(
    statsCache,
    () =>
      getDb()
        .prepare(`
          SELECT
            COUNT(*) AS totalDocumentos,
            COUNT(DISTINCT content_key) AS conteudosUnicos,
            COUNT(DISTINCT pdf_url) AS pdfsUnicos,
            COUNT(DISTINCT hash_verificacao) AS hashesUnicos,
            SUM(CASE WHEN index_status = 'indexed' THEN 1 ELSE 0 END) AS indexados,
            SUM(CASE WHEN index_status = 'pending' THEN 1 ELSE 0 END) AS pendentes,
            SUM(CASE WHEN index_status = 'processing' THEN 1 ELSE 0 END) AS processando,
            SUM(CASE WHEN index_status = 'error' THEN 1 ELSE 0 END) AS falhas,
            COUNT(DISTINCT ano) AS anos,
            COUNT(DISTINCT caixa) AS caixas
          FROM documents
        `)
        .get(),
    CACHE_TTL_MS,
  );
}

function getIndexerQueueStats() {
  ensureDocumentsColumns();
  const db = getDb();
  return db
    .prepare(`
      SELECT
        SUM(CASE WHEN index_status = 'pending' THEN 1 ELSE 0 END) AS pendingDocuments,
        COUNT(DISTINCT CASE WHEN index_status = 'pending' THEN content_key END) AS pendingContentGroups,
        SUM(CASE WHEN index_status = 'processing' THEN 1 ELSE 0 END) AS processingDocuments,
        COUNT(DISTINCT CASE WHEN index_status = 'processing' THEN content_key END) AS processingContentGroups,
        SUM(CASE WHEN index_status = 'indexed' THEN 1 ELSE 0 END) AS indexedDocuments,
        SUM(CASE WHEN index_status = 'error' THEN 1 ELSE 0 END) AS erroredDocuments,
        COUNT(DISTINCT CASE WHEN index_status = 'error' THEN content_key END) AS erroredContentGroups,
        SUM(CASE WHEN index_status = 'paused' THEN 1 ELSE 0 END) AS pausedDocuments,
        COUNT(DISTINCT CASE WHEN index_status = 'paused' THEN content_key END) AS pausedContentGroups
      FROM documents
    `)
    .get();
}

function getIndexerQueueDetails(options = {}) {
  ensureDocumentsColumns();
  const db = getDb();
  const normalizedLimit = Math.max(1, Math.min(200, Number(options.limit || 30)));
  const requestedStatus = typeof options.status === 'string' ? options.status.trim().toLowerCase() : 'all';
  const normalizedStatus = ['all', 'pending', 'processing', 'error', 'paused'].includes(requestedStatus)
    ? requestedStatus
    : 'all';
  const normalizedSearch = typeof options.search === 'string' ? options.search.trim() : '';
  const where = [`d.index_status IN ('pending', 'processing', 'error', 'paused')`];
  const params = [];

  if (normalizedStatus !== 'all') {
    where.push(`d.index_status = ?`);
    params.push(normalizedStatus);
  }

  if (normalizedSearch) {
    where.push(`(
      CAST(d.id AS TEXT) = ?
      OR LOWER(COALESCE(d.content_key, '')) LIKE ?
      OR LOWER(COALESCE(d.nome_arquivo, '')) LIKE ?
      OR LOWER(COALESCE(d.descricao, '')) LIKE ?
      OR LOWER(COALESCE(d.classificacao, '')) LIKE ?
      OR LOWER(COALESCE(d.caixa, '')) LIKE ?
    )`);
    const likeValue = `%${normalizedSearch.toLowerCase()}%`;
    params.push(normalizedSearch, likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  const rows = db.prepare(`
    SELECT
      MIN(d.id) AS id,
      d.content_key,
      MAX(d.index_status) AS index_status,
      MAX(d.nome_arquivo) AS nome_arquivo,
      MAX(d.descricao) AS descricao,
      MAX(d.classificacao) AS classificacao,
      MAX(d.caixa) AS caixa,
      MAX(d.ano) AS ano,
      MAX(d.pdf_url) AS pdf_url,
      MAX(d.detail_url) AS detail_url,
      MAX(d.index_error) AS index_error,
      MAX(d.last_error_at) AS last_error_at,
      MAX(d.last_index_method) AS last_index_method,
      MAX(d.index_attempts) AS index_attempts,
      MAX(d.last_indexed_at) AS last_indexed_at,
      MAX(d.updated_at) AS updated_at,
      MAX(d.page_count) AS page_count,
      MAX(d.text_length) AS text_length,
      COUNT(*) AS document_count
    FROM documents d
    WHERE ${where.join(' AND ')}
    GROUP BY d.content_key
    ORDER BY
      CASE MAX(d.index_status)
        WHEN 'processing' THEN 0
        WHEN 'error' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'paused' THEN 3
        ELSE 4
      END,
      datetime(MAX(COALESCE(d.last_error_at, d.updated_at, d.last_indexed_at))) DESC,
      MIN(d.id) DESC
    LIMIT ?
  `).all(...params, normalizedLimit);

  return {
    items: rows,
    limit: normalizedLimit,
    search: normalizedSearch,
    status: normalizedStatus,
  };
}

function getIndexerQueueItem(documentId) {
  ensureDocumentsColumns();
  const db = getDb();
  const normalizedId = Number(documentId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return null;
  }

  return db.prepare(`
    SELECT
      MIN(d.id) AS id,
      d.content_key,
      MAX(d.index_status) AS index_status,
      MAX(d.nome_arquivo) AS nome_arquivo,
      MAX(d.descricao) AS descricao,
      MAX(d.classificacao) AS classificacao,
      MAX(d.caixa) AS caixa,
      MAX(d.ano) AS ano,
      MAX(d.pdf_url) AS pdf_url,
      MAX(d.detail_url) AS detail_url,
      MAX(d.index_error) AS index_error,
      MAX(d.last_error_at) AS last_error_at,
      MAX(d.last_index_method) AS last_index_method,
      MAX(d.index_attempts) AS index_attempts,
      MAX(d.last_indexed_at) AS last_indexed_at,
      MAX(d.updated_at) AS updated_at,
      MAX(d.page_count) AS page_count,
      MAX(d.text_length) AS text_length,
      COUNT(*) AS document_count
    FROM documents d
    WHERE d.content_key = (
      SELECT content_key
      FROM documents
      WHERE id = ?
    )
    GROUP BY d.content_key
  `).get(normalizedId);
}

function setIndexerQueueStatus(documentId, targetStatus) {
  ensureDocumentsColumns();
  const db = getDb();
  const normalizedId = Number(documentId);
  const normalizedStatus = typeof targetStatus === 'string' ? targetStatus.trim().toLowerCase() : '';
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return { affectedDocuments: 0, affectedGroups: 0, item: null };
  }
  if (!['pending', 'paused'].includes(normalizedStatus)) {
    throw new Error('Status de fila invalido.');
  }

  const contentKey = db.prepare(`SELECT content_key FROM documents WHERE id = ?`).get(normalizedId)?.content_key;
  if (!contentKey) {
    return { affectedDocuments: 0, affectedGroups: 0, item: null };
  }

  const result = db.prepare(`
    UPDATE documents
    SET
      index_status = ?,
      index_error = CASE WHEN ? = 'pending' THEN NULL ELSE index_error END,
      updated_at = CURRENT_TIMESTAMP
    WHERE content_key = ?
  `).run(normalizedStatus, normalizedStatus, contentKey);

  clearRepositoryCaches();

  return {
    affectedDocuments: result.changes,
    affectedGroups: result.changes ? 1 : 0,
    item: getIndexerQueueItem(normalizedId),
  };
}

function getIndexFailures(limit = 50) {
  ensureDocumentsColumns();
  return getDb()
    .prepare(`
      SELECT
        MIN(id) AS id,
        content_key,
        MAX(nome_arquivo) AS nome_arquivo,
        MAX(descricao) AS descricao,
        MAX(classificacao) AS classificacao,
        MAX(caixa) AS caixa,
        MAX(ano) AS ano,
        MAX(pdf_url) AS pdf_url,
        MAX(detail_url) AS detail_url,
        MAX(index_error) AS index_error,
        MAX(last_error_at) AS last_error_at,
        MAX(last_index_method) AS last_index_method,
        MAX(index_attempts) AS index_attempts
      FROM documents
      WHERE index_status = 'error'
      GROUP BY content_key
      ORDER BY datetime(MAX(last_error_at)) DESC, MIN(id) DESC
      LIMIT ?
    `)
    .all(limit);
}

function getMaintenanceStrategyWhere(strategy) {
  switch (strategy) {
    case 'short-indexed':
      return `d.index_status = 'indexed' AND COALESCE(d.text_length, 0) > 0 AND COALESCE(d.text_length, 0) < 500`;
    case 'short-multipage':
      return `d.index_status = 'indexed' AND COALESCE(d.page_count, 0) >= 5 AND COALESCE(d.text_length, 0) < 500`;
    case 'null-method':
      return `d.index_status = 'indexed' AND (d.last_index_method IS NULL OR d.last_index_method = '')`;
    case 'recent-errors':
      return `d.index_status = 'error' AND datetime(COALESCE(d.last_error_at, d.updated_at)) >= datetime('now', '-30 day')`;
    case 'force-ocr':
      return `d.index_status = 'indexed' AND COALESCE(d.page_count, 0) >= 5 AND COALESCE(d.text_length, 0) < 1000 AND COALESCE(d.last_index_method, '') NOT LIKE '%ocr%'`;
    case 'empty-indexed':
      return `d.index_status = 'indexed' AND COALESCE(d.text_length, 0) = 0`;
    default:
      return `1 = 0`;
  }
}

function getMaintenanceInsights() {
  ensureDocumentsColumns();
  const db = getDb();
  return db.prepare(`
    SELECT
      SUM(CASE WHEN index_status = 'indexed' AND COALESCE(text_length, 0) > 0 AND COALESCE(text_length, 0) < 500 THEN 1 ELSE 0 END) AS shortIndexed,
      SUM(CASE WHEN index_status = 'indexed' AND COALESCE(page_count, 0) >= 5 AND COALESCE(text_length, 0) < 500 THEN 1 ELSE 0 END) AS shortMultiPage,
      SUM(CASE WHEN index_status = 'indexed' AND (last_index_method IS NULL OR last_index_method = '') THEN 1 ELSE 0 END) AS nullMethodIndexed,
      SUM(CASE WHEN index_status = 'indexed' AND COALESCE(text_length, 0) = 0 THEN 1 ELSE 0 END) AS emptyIndexed,
      SUM(CASE WHEN index_status = 'indexed' AND COALESCE(page_count, 0) >= 5 AND COALESCE(text_length, 0) < 1000 AND COALESCE(last_index_method, '') NOT LIKE '%ocr%' THEN 1 ELSE 0 END) AS forceOcrCandidates,
      SUM(CASE WHEN index_status = 'error' AND datetime(COALESCE(last_error_at, updated_at)) >= datetime('now', '-30 day') THEN 1 ELSE 0 END) AS recentErrors30d
    FROM documents
  `).get();
}

function listMaintenanceCandidates(strategy, limit = 20) {
  ensureDocumentsColumns();
  const whereSql = getMaintenanceStrategyWhere(strategy);
  return getDb().prepare(`
    SELECT
      MIN(d.id) AS id,
      d.content_key,
      MAX(d.nome_arquivo) AS nome_arquivo,
      MAX(d.descricao) AS descricao,
      MAX(d.classificacao) AS classificacao,
      MAX(d.caixa) AS caixa,
      MAX(d.ano) AS ano,
      MAX(d.pdf_url) AS pdf_url,
      MAX(d.detail_url) AS detail_url,
      MAX(d.index_status) AS index_status,
      MAX(d.last_index_method) AS last_index_method,
      MAX(d.index_attempts) AS index_attempts,
      MAX(d.text_length) AS text_length,
      MAX(d.page_count) AS page_count,
      MAX(d.last_indexed_at) AS last_indexed_at,
      MAX(d.last_error_at) AS last_error_at,
      MAX(d.index_error) AS index_error
    FROM documents d
    WHERE ${whereSql}
    GROUP BY d.content_key
    ORDER BY
      COALESCE(MAX(d.page_count), 0) DESC,
      COALESCE(MAX(d.text_length), 0) ASC,
      MIN(d.id) DESC
    LIMIT ?
  `).all(limit);
}

function resetDocumentsByIds(documentIds, options = {}) {
  ensureDocumentsColumns();
  const ids = [...new Set((documentIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) {
    return { affectedDocuments: 0, affectedGroups: 0 };
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const targetGroups = db.prepare(`
    SELECT DISTINCT content_key
    FROM documents
    WHERE id IN (${placeholders})
  `).all(...ids).map((row) => row.content_key).filter(Boolean);

  if (!targetGroups.length) {
    return { affectedDocuments: 0, affectedGroups: 0 };
  }

  const groupPlaceholders = targetGroups.map(() => '?').join(', ');
  const targetIds = db.prepare(`
    SELECT id
    FROM documents
    WHERE content_key IN (${groupPlaceholders})
  `).all(...targetGroups).map((row) => row.id);

  const deleteContents = db.prepare(`DELETE FROM document_contents WHERE document_id = ?`);
  const deleteFts = db.prepare(`DELETE FROM documents_fts WHERE rowid = ?`);
  const updateDocument = db.prepare(`
    UPDATE documents
    SET
      index_status = 'pending',
      index_error = NULL,
      index_attempts = CASE WHEN ? THEN 0 ELSE COALESCE(index_attempts, 0) END,
      last_index_method = NULL,
      last_error_at = NULL,
      text_length = 0,
      page_count = 0,
      last_indexed_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const targetId of targetIds) {
      deleteContents.run(targetId);
      deleteFts.run(targetId);
      updateDocument.run(options.resetAttempts ? 1 : 0, targetId);
    }
  });

  transaction();
  clearRepositoryCaches();

  return {
    affectedDocuments: targetIds.length,
    affectedGroups: targetGroups.length,
  };
}

function recoverProcessingDocuments() {
  ensureDocumentsColumns();
  const db = getDb();
  const groups = db.prepare(`
    SELECT COUNT(DISTINCT content_key) AS total
    FROM documents
    WHERE index_status = 'processing'
  `).get();

  if (!groups?.total) {
    return { affectedDocuments: 0, affectedGroups: 0 };
  }

  const result = db.prepare(`
    UPDATE documents
    SET
      index_status = 'pending',
      index_error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE index_status = 'processing'
  `).run();

  clearRepositoryCaches();

  return {
    affectedDocuments: result.changes,
    affectedGroups: groups.total,
  };
}

function resetIndexing() {
  ensureDocumentsColumns();
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM document_contents').run();
    db.prepare('DELETE FROM documents_fts').run();
    db.prepare(`
      UPDATE documents
      SET
        index_status = 'pending',
        index_error = NULL,
        index_attempts = 0,
        last_index_method = NULL,
        last_error_at = NULL,
        text_length = 0,
        page_count = 0,
        last_indexed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).run();
  });

  transaction();
  clearRepositoryCaches();

  return getStats();
}

function isNumericTerm(term) {
  return /^\d+$/.test(term);
}

function getFieldWords(value) {
  return new Set(extractWords(value).map((word) => normalizeSearchTerm(word)).filter(Boolean));
}

function getOrderedTermBonus(value, normalizedTerms) {
  if (!value || normalizedTerms.length < 2) {
    return 0;
  }

  let cursor = -1;
  let gapPenalty = 0;

  for (const term of normalizedTerms) {
    const nextIndex = value.indexOf(term, cursor + 1);
    if (nextIndex === -1) {
      return 0;
    }
    if (cursor >= 0) {
      gapPenalty += Math.max(0, nextIndex - cursor);
    }
    cursor = nextIndex;
  }

  const compactnessBonus = gapPenalty <= 24 ? 18 : gapPenalty <= 60 ? 12 : 6;
  return compactnessBonus + normalizedTerms.length * 4;
}

function getAllTermsInFieldBonus(value, normalizedTerms) {
  if (!value || !normalizedTerms.length) {
    return 0;
  }

  const wordSet = getFieldWords(value);
  const allTermsPresent = normalizedTerms.every((term) =>
    isNumericTerm(term) ? wordSet.has(term) : value.includes(term),
  );
  if (!allTermsPresent) {
    return 0;
  }

  const numericTerms = normalizedTerms.filter((term) => /^\d+$/.test(term));
  return 16 + normalizedTerms.length * 3 + (numericTerms.length ? numericTerms.length * 6 : 0);
}

function buildBaseFilters(params) {
  const where = [];
  const values = [];

  if (params.classificacao) {
    where.push('d.classificacao = ?');
    values.push(params.classificacao);
  }

  if (params.caixa) {
    where.push('d.caixa = ?');
    values.push(params.caixa);
  }

  if (params.ano) {
    where.push('d.ano = ?');
    values.push(params.ano);
  }

  if (params.onlyIndexed) {
    where.push(`d.index_status = 'indexed'`);
  }

  return {
    clauses: where,
    values,
  };
}

function buildWhereSql(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function buildMetadataSearch(alias, rawQuery, metadataTerms) {
  const clauses = [];
  const values = [];
  const seen = new Set();
  const addSearchClause = (term) => {
    const normalizedTerm = normalizeSearchTerm(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) {
      return;
    }
    seen.add(normalizedTerm);

    if (isNumericTerm(normalizedTerm) && normalizedTerm.length <= 2) {
      clauses.push(`(${alias}.ano = ? OR ${alias}.caixa = ?)`); 
      values.push(term, term);
      return;
    }

    if (normalizedTerm.length < 3) {
      clauses.push(`${alias}.hash_verificacao = ? COLLATE NOCASE`);
      values.push(term);
      return;
    }

    const like = `%${term}%`;
    clauses.push(`
      (
        ${alias}.descricao LIKE ? COLLATE NOCASE OR
        ${alias}.nome_arquivo LIKE ? COLLATE NOCASE OR
        ${alias}.classificacao LIKE ? COLLATE NOCASE OR
        ${alias}.caixa LIKE ? COLLATE NOCASE OR
        ${alias}.hash_verificacao LIKE ? COLLATE NOCASE OR
        ${alias}.ano LIKE ? COLLATE NOCASE
      )
    `);
    values.push(like, like, like, like, like, like);
  };

  if (rawQuery) {
    addSearchClause(rawQuery);
  }

  for (const term of metadataTerms) {
    if (term && term !== rawQuery) {
      addSearchClause(term);
    }
  }

  return {
    sql: clauses.length ? `(${clauses.join(' OR ')})` : '',
    values,
  };
}

function buildFastScore(item, rawQuery, metadataTerms) {
  const normalizedQuery = normalizeSearchTerm(rawQuery);
  const normalizedTerms = metadataTerms.map((term) => normalizeSearchTerm(term)).filter(Boolean);
  const searchableFields = [
    ['hash', item.hash_verificacao, 38],
    ['arquivo', item.nome_arquivo, 30],
    ['descricao', item.descricao, 34],
    ['classificacao', item.classificacao, 14],
    ['caixa', item.caixa, 12],
    ['ano', item.ano, 10],
  ];
  const breakdown = {
    accessBonus: 0,
    coverageScore: 0,
    detailScore: 0,
    exactScore: 0,
    indexedBonus: item.index_status === 'indexed' ? 6 : item.index_status === 'processing' ? 3 : 0,
    matchedFields: [],
    matchedTerms: 0,
    methodBonus: item.last_index_method?.includes('ocr') ? 2 : 0,
    total: 0,
  };

  if (item.fts_match_source) {
    breakdown.matchedFields.push('conteudo');
    breakdown.detailScore += 24;
  }

  const accessCount = Math.max(0, Number(item.access_count || 0));
  if (accessCount > 0) {
    breakdown.accessBonus += Math.min(24, Math.round(Math.log2(accessCount + 1) * 6));
  }

  if (item.last_accessed_at) {
    const lastAccessedAt = new Date(item.last_accessed_at).getTime();
    if (Number.isFinite(lastAccessedAt)) {
      const daysSinceAccess = (Date.now() - lastAccessedAt) / 86400000;
      if (daysSinceAccess <= 7) breakdown.accessBonus += 8;
      else if (daysSinceAccess <= 30) breakdown.accessBonus += 4;
    }
  }

  for (const [fieldName, fieldValue, weight] of searchableFields) {
    const normalizedField = normalizeSearchTerm(fieldValue);
    if (!normalizedField) {
      continue;
    }

    const wordSet = getFieldWords(fieldValue);
    let fieldScore = 0;

    if (normalizedQuery && normalizedField.includes(normalizedQuery)) {
      fieldScore += weight;
      breakdown.exactScore += weight;
    }

    let matchedInField = 0;
    for (const term of normalizedTerms) {
      const termMatched = isNumericTerm(term) ? wordSet.has(term) : normalizedField.includes(term);
      if (termMatched) {
        matchedInField += 1;
      }
    }

    if (matchedInField > 0) {
      fieldScore += matchedInField * Math.max(4, Math.round(weight / 4));
      breakdown.matchedFields.push(fieldName);
      breakdown.matchedTerms += matchedInField;
      fieldScore += getAllTermsInFieldBonus(normalizedField, normalizedTerms);
      fieldScore += getOrderedTermBonus(normalizedField, normalizedTerms);
    }

    breakdown.detailScore += fieldScore;
  }

  const uniqueTerms = [...new Set(normalizedTerms)];
  if (uniqueTerms.length) {
    let coveredTerms = 0;
    for (const term of uniqueTerms) {
      const matched = searchableFields.some(([, fieldValue]) => {
        const normalizedField = normalizeSearchTerm(fieldValue);
        const wordSet = getFieldWords(fieldValue);
        return normalizedField && (isNumericTerm(term) ? wordSet.has(term) : normalizedField.includes(term));
      });

      if (matched) {
        coveredTerms += 1;
      }
    }

    if (item.fts_match_source) {
      coveredTerms = uniqueTerms.length;
    }
    breakdown.coverageScore = Math.round((coveredTerms / uniqueTerms.length) * 30);
  }

  breakdown.matchedFields = [...new Set(breakdown.matchedFields)];
  breakdown.total =
    breakdown.exactScore +
    breakdown.detailScore +
    breakdown.coverageScore +
    breakdown.accessBonus +
    breakdown.indexedBonus +
    breakdown.methodBonus +
    (item.search_rank || 0) +
    breakdown.matchedFields.length * 3;

  return breakdown;
}

function searchDocuments(params) {
  ensureDocumentsColumns();
  const db = getDb();
  const metadataTerms = Array.isArray(params.metadataTerms) ? params.metadataTerms : [];
  const rawQuery = String(params.rawQuery || '').trim();
  const { clauses: baseClauses, values: baseValues } = buildBaseFilters(params);
  const metadataSearch = buildMetadataSearch('d', rawQuery, metadataTerms);
  const rawLike = rawQuery ? `%${rawQuery}%` : '';
  const hashLike = rawQuery ? `%${rawQuery}%` : '';
  const limit = Math.max(1, Number(params.limit || 50));
  const offset = Math.max(0, Number(params.offset || 0));
  const statusOrderSql = `CASE d.index_status WHEN 'indexed' THEN 0 WHEN 'processing' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END`;
  const accessOrderSql = `COALESCE(d.access_count, 0) DESC, datetime(COALESCE(d.last_accessed_at, '1970-01-01')) DESC`;

  if (params.ftsQuery || metadataSearch.sql) {
    const ftsWithSql = params.ftsQuery
      ? `
        WITH fts_matches AS (
          SELECT
            rowid AS id,
            bm25(documents_fts, 7.0, 3.5, 2.5, 6.0, 2.0, 0.8) AS fts_rank
          FROM documents_fts
          WHERE documents_fts MATCH ?
        )
      `
      : '';
    const ftsJoinSql = params.ftsQuery ? 'LEFT JOIN fts_matches f ON f.id = d.id' : '';
    const searchClauses = [];
    const searchValues = [];

    if (metadataSearch.sql) {
      searchClauses.push(metadataSearch.sql);
      searchValues.push(...metadataSearch.values);
    }

    if (params.ftsQuery) {
      searchClauses.push('f.id IS NOT NULL');
    }

    const whereClauses = [...baseClauses, `(${searchClauses.join(' OR ')})`];
    const whereSql = buildWhereSql(whereClauses);
    const countParams = [];
    if (params.ftsQuery) {
      countParams.push(params.ftsQuery);
    }
    countParams.push(...baseValues, ...searchValues);

    const total = getCachedSearchCount(
      getSearchCountCacheKey('search', {
        baseClauses,
        baseValues,
        metadataSearchSql: metadataSearch.sql,
        searchValues,
        ftsQuery: params.ftsQuery || '',
      }),
      () =>
        db
          .prepare(`
            ${ftsWithSql}
            SELECT COUNT(*) AS total
            FROM documents d
            ${ftsJoinSql}
            ${whereSql}
          `)
          .get(...countParams).total,
    );

    const resultParams = [];
    if (params.ftsQuery) {
      resultParams.push(params.ftsQuery);
    }
    resultParams.push(
      rawQuery,
      rawQuery,
      rawQuery,
      hashLike,
      rawQuery,
      rawLike,
      rawQuery,
      rawLike,
      rawQuery,
      rawLike,
      rawQuery,
      rawLike,
      rawQuery,
      rawLike,
      ...baseValues,
      ...searchValues,
      limit,
      offset,
    );

    const items = db
      .prepare(`
        ${ftsWithSql}
        SELECT
          d.*,
          '' AS fts_snippet,
          CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS fts_match_source,
          CASE
            WHEN ? <> '' AND d.hash_verificacao = ? COLLATE NOCASE THEN 4
            WHEN ? <> '' AND d.hash_verificacao LIKE ? COLLATE NOCASE THEN 3
            WHEN ? <> '' AND d.descricao LIKE ? COLLATE NOCASE THEN 3
            WHEN ? <> '' AND d.nome_arquivo LIKE ? COLLATE NOCASE THEN 2
            WHEN ? <> '' AND d.classificacao LIKE ? COLLATE NOCASE THEN 1
            WHEN ? <> '' AND d.caixa LIKE ? COLLATE NOCASE THEN 1
            WHEN ? <> '' AND d.ano LIKE ? COLLATE NOCASE THEN 1
            ELSE 0
          END AS metadata_priority,
          CASE
            WHEN f.id IS NOT NULL THEN CAST(MIN(900, MAX(0, ROUND((0 - f.fts_rank) * 100))) AS INTEGER)
            ELSE 0
          END AS search_rank
        FROM documents d
        ${ftsJoinSql}
        ${whereSql}
        ORDER BY
          metadata_priority DESC,
          CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END DESC,
          COALESCE(f.fts_rank, 1e9) ASC,
          ${accessOrderSql},
          ${statusOrderSql},
          d.id DESC
        LIMIT ? OFFSET ?
      `)
      .all(...resultParams);

    if (params.ftsQuery && items.length) {
      const snippetPlaceholders = items.map(() => '?').join(', ');
      const snippetRows = db
        .prepare(`
          SELECT
            rowid AS id,
            snippet(documents_fts, 5, '', '', ' ... ', 18) AS fts_snippet
          FROM documents_fts
          WHERE documents_fts MATCH ?
            AND rowid IN (${snippetPlaceholders})
        `)
        .all(params.ftsQuery, ...items.map((item) => item.id));
      const snippetsById = new Map(snippetRows.map((row) => [row.id, row.fts_snippet]));

      for (const item of items) {
        item.fts_snippet = snippetsById.get(item.id) || '';
      }
    }

    return {
      items: items.map((item) => ({
        ...item,
        score_breakdown: buildFastScore(item, rawQuery, metadataTerms),
      })),
      total,
    };
  }

  const baseWhereSql = buildWhereSql(baseClauses);
  const total = getCachedSearchCount(
    getSearchCountCacheKey('listing', { baseClauses, baseValues }),
    () => db.prepare(`SELECT COUNT(*) AS total FROM documents d ${baseWhereSql}`).get(...baseValues).total,
  );
  const itemsPage = db
    .prepare(`
      SELECT
        d.*,
        '' AS fts_snippet,
        0 AS fts_match_source,
        0 AS metadata_priority,
        0 AS search_rank
      FROM documents d
      ${baseWhereSql}
      ORDER BY
        ${accessOrderSql},
        ${statusOrderSql},
        d.id DESC
      LIMIT ? OFFSET ?
    `)
    .all(...baseValues, limit, offset);

  return {
    items: itemsPage.map((item) => ({
      ...item,
      score_breakdown: buildFastScore(item, rawQuery, metadataTerms),
    })),
    total,
  };
}

module.exports = {
  getDocumentById,
  getDocumentGroupIds,
  getDocumentDecorations,
  getDocumentsForEnrichment,
  getEnrichmentStats,
  getDocumentsToIndex,
  getFilters,
  getIndexFailures,
  getIndexerQueueDetails,
  getIndexerQueueItem,
  getIndexerQueueStats,
  getMaintenanceInsights,
  listMaintenanceCandidates,
  listTextCleanupCandidates,
  getStats,
  markDocumentError,
  markDocumentProcessing,
  registerDocumentAccess,
  recoverProcessingDocuments,
  resetDocumentsByIds,
  replaceDocuments,
  rewriteDocumentContent,
  setIndexerQueueStatus,
  resetIndexing,
  saveDocumentContent,
  saveDocumentPreviewImage,
  saveDocumentSummary,
  searchDocuments,
  clearRepositoryCaches,
};
