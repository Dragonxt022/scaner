const express = require('express');
const { syncCatalogFromArtifacts } = require('../services/catalog-sync');
const { processDocument, runIndexBatch } = require('../services/indexer');
const {
  getBackgroundIndexerStatus,
  recordIndexerEvent,
  startBackgroundIndexing,
  stopBackgroundIndexing,
} = require('../services/background-indexer');
const {
  getDownloadManagerStatus,
  startBackgroundDownloads,
  stopBackgroundDownloads,
} = require('../services/download-manager');
const {
  getBackgroundEnrichmentStatus,
  startBackgroundEnrichment,
  stopBackgroundEnrichment,
} = require('../services/background-enrichment');
const {
  getDocumentById,
  getIndexFailures,
  getIndexerQueueDetails,
  getIndexerQueueItem,
  getMaintenanceInsights,
  setIndexerQueueStatus,
} = require('../services/repository');
const { getAppSettings, updateAppSettings } = require('../services/app-settings');
const { previewMaintenance, runMaintenanceAction } = require('../services/maintenance');
const { previewTextCleanup, runTextCleanup } = require('../services/text-cleanup');
const { enrichDocumentById, listAvailableModels, runEnrichmentBatch } = require('../services/document-enrichment');
const { getEnrichmentStats } = require('../services/repository');
const { getDatabaseStrategy } = require('../services/database-strategy');
const {
  listUsers,
  createUser,
  issuePasswordResetCode,
  listPasswordResetRequests,
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  updateUser,
} = require('../services/auth');
const { listAccessLogs, listSearchLogs, recordAccessLog } = require('../services/audit');
const { listLocalLibraryItems, syncLocalLibrary, getLocalLibraryRoot } = require('../services/local-library');

const router = express.Router();

function clampInteger(value, { fallback, min, max }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

router.get('/indexer-status', (_request, response) => {
  response.json(getBackgroundIndexerStatus());
});

router.get('/index-failures', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 50, min: 1, max: 200 });
  response.json({
    items: getIndexFailures(limit),
  });
});

router.get('/users', (_request, response) => {
  response.json({
    items: listUsers(),
  });
});

router.get('/password-reset-requests', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 100, min: 1, max: 500 });
  response.json({
    items: listPasswordResetRequests(limit),
  });
});

router.get('/access-requests', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 100, min: 1, max: 500 });
  response.json({
    items: listAccessRequests(limit),
  });
});

router.post('/access-requests/:id/approve', (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de solicitacao invalido.' });
    return;
  }

  try {
    const result = approveAccessRequest(id, request.authUser?.id || null);
    recordAccessLog(
      request,
      request.authUser,
      'access_request_approve',
      `Solicitacao de acesso ${id} aprovada pelo usuario ${request.authUser?.cpf || 'desconhecido'}.`,
    );
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.post('/access-requests/:id/reject', (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de solicitacao invalido.' });
    return;
  }

  try {
    const result = rejectAccessRequest(id, request.authUser?.id || null);
    recordAccessLog(
      request,
      request.authUser,
      'access_request_reject',
      `Solicitacao de acesso ${id} rejeitada pelo usuario ${request.authUser?.cpf || 'desconhecido'}.`,
    );
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.get('/activity/access-logs', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 100, min: 1, max: 500 });
  response.json({
    items: listAccessLogs(limit),
  });
});

router.get('/activity/search-logs', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 100, min: 1, max: 500 });
  response.json({
    items: listSearchLogs(limit),
  });
});

router.get('/local-library', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 300, min: 1, max: 1000 });
  const items = listLocalLibraryItems(limit);
  response.json({
    items,
    root: getLocalLibraryRoot(),
    total: items.length,
  });
});

router.get('/indexer-queue', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 30, min: 1, max: 200 });
  response.json(
    getIndexerQueueDetails({
      limit,
      search: request.query?.search,
      status: request.query?.status,
    }),
  );
});

router.get('/download-status', async (_request, response) => {
  response.json(await getDownloadManagerStatus());
});

router.get('/database-status', (_request, response) => {
  response.json(getDatabaseStrategy());
});

router.get('/settings', async (_request, response) => {
  response.json(await getAppSettings());
});

router.get('/maintenance/insights', (_request, response) => {
  response.json(getMaintenanceInsights());
});

router.get('/enrichment/status', (_request, response) => {
  response.json({
    ...getEnrichmentStats(),
    runtime: getBackgroundEnrichmentStatus(),
  });
});

router.get('/enrichment/models', async (request, response) => {
  response.json(await listAvailableModels({
    baseUrl: request.query?.baseUrl,
    provider: request.query?.provider,
  }));
});

router.get('/maintenance/candidates', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 20, min: 1, max: 200 });
  response.json(previewMaintenance({
    strategy: request.query?.strategy,
    limit,
  }));
});

router.get('/text-cleanup/preview', (request, response) => {
  const limit = clampInteger(request.query?.limit, { fallback: 10, min: 1, max: 100 });
  response.json(previewTextCleanup({
    limit,
    sampleSize: clampInteger(request.query?.sampleSize, { fallback: 200, min: limit, max: 1000 }),
    strategy: request.query?.strategy,
  }));
});

router.post('/settings', async (request, response) => {
  response.json(await updateAppSettings(request.body || {}));
});

router.post('/users', (request, response) => {
  try {
    const user = createUser({
      cpf: request.body?.cpf,
      fullName: request.body?.fullName,
      isActive: request.body?.isActive !== false,
      password: request.body?.password,
      role: request.body?.role,
    });
    recordAccessLog(request, request.authUser, 'user_create', `Usuario ${user.cpf} criado com perfil ${user.role}.`);
    response.status(201).json(user);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.patch('/users/:id', (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de usuario invalido.' });
    return;
  }

  try {
    const user = updateUser(id, {
      fullName: request.body?.fullName,
      isActive: request.body?.isActive,
      password: request.body?.password,
      role: request.body?.role,
    });
    recordAccessLog(request, request.authUser, 'user_update', `Usuario ${user.cpf} atualizado para perfil ${user.role}.`);
    response.json(user);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.post('/password-reset-requests/:id/issue', (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de solicitacao invalido.' });
    return;
  }

  try {
    const result = issuePasswordResetCode(id, request.authUser?.id || null);
    recordAccessLog(
      request,
      request.authUser,
      'password_reset_issue',
      `Codigo temporario emitido para CPF ${result.request.cpf}.`,
    );
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.post('/maintenance/run', async (request, response) => {
  const limit = clampInteger(request.body?.limit, { fallback: 20, min: 1, max: 100 });
  response.json(await runMaintenanceAction({
    action: request.body?.action,
    limit,
    mode: request.body?.mode,
    resetAttempts: request.body?.resetAttempts !== false,
    strategy: request.body?.strategy,
  }));
});

router.post('/text-cleanup/run', (request, response) => {
  const limit = clampInteger(request.body?.limit, { fallback: 10, min: 1, max: 100 });
  response.json(runTextCleanup({
    limit,
    sampleSize: clampInteger(request.body?.sampleSize, { fallback: 200, min: limit, max: 1000 }),
    strategy: request.body?.strategy,
  }));
});

router.post('/enrichment/run', async (request, response) => {
  const limit = clampInteger(request.body?.limit, { fallback: 5, min: 1, max: 50 });
  response.json(await runEnrichmentBatch(limit));
});

router.post('/enrichment/start', (request, response) => {
  const batchLimit = clampInteger(request.body?.batchLimit, { fallback: 5, min: 1, max: 50 });
  response.json(startBackgroundEnrichment({ batchLimit }));
});

router.post('/enrichment/document/:id', async (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const document = getDocumentById(id);
  if (!document) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  response.json(await enrichDocumentById(id));
});

router.post('/enrichment/stop', (_request, response) => {
  response.json(stopBackgroundEnrichment());
});

router.post('/downloads/start', async (request, response) => {
  response.json(
    await startBackgroundDownloads({
      concurrency: clampInteger(request.body?.concurrency, { fallback: 3, min: 1, max: 8 }),
      destinationDir: typeof request.body?.destinationDir === 'string' ? request.body.destinationDir.trim() : '',
      overwrite: Boolean(request.body?.overwrite),
      retryCount: clampInteger(request.body?.retryCount, { fallback: 2, min: 0, max: 10 }),
      timeoutMs: clampInteger(request.body?.timeoutMs, { fallback: 30000, min: 5000, max: 600000 }),
    }),
  );
});

router.post('/downloads/stop', async (_request, response) => {
  response.json(await stopBackgroundDownloads());
});

router.post('/sync-catalog', async (_request, response) => {
  response.json(await syncCatalogFromArtifacts());
});

router.post('/local-library/sync', (_request, response) => {
  response.json(syncLocalLibrary());
});

router.post('/reindex', async (request, response) => {
  response.json(
    await runIndexBatch({
      limit: clampInteger(request.body?.limit, { fallback: 20, min: 1, max: 500 }),
      mode: request.body?.mode || 'hybrid',
      runFullProcess: request.body?.fullProcessIfNeeded !== false,
      retryFailures: Boolean(request.body?.retryFailures),
    }),
  );
});

router.post('/reindex/start', (request, response) => {
  const batchLimit = clampInteger(request.body?.batchLimit, { fallback: 10, min: 1, max: 100 });
  response.json(
    startBackgroundIndexing({
      batchLimit,
      runFullProcess: request.body?.fullProcessIfNeeded !== false,
      mode: request.body?.mode || 'hybrid',
      retryFailures: Boolean(request.body?.retryFailures),
    }),
  );
});

router.post('/reindex/stop', (_request, response) => {
  response.json(stopBackgroundIndexing());
});

router.post('/reindex/queue-item/:id', (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const item = getIndexerQueueItem(id);
  if (!item) {
    response.status(404).json({ error: 'Documento nao encontrado na fila.' });
    return;
  }

  if (item.index_status === 'processing') {
    response.status(409).json({ error: 'O item esta em processamento agora. Aguarde o lote atual terminar.' });
    return;
  }

  const action = typeof request.body?.action === 'string' ? request.body.action.trim().toLowerCase() : '';
  let result;
  if (action === 'pause') {
    result = setIndexerQueueStatus(id, 'paused');
    recordIndexerEvent(`Item ${id} removido da fila e movido para pausa.`, {
      context: { action, documentId: id },
      level: 'warning',
    });
  } else if (action === 'enqueue') {
    result = setIndexerQueueStatus(id, 'pending');
    recordIndexerEvent(`Item ${id} adicionado novamente a fila de indexacao.`, {
      context: { action, documentId: id },
      level: 'info',
    });
  } else {
    response.status(400).json({ error: 'Acao de fila invalida.' });
    return;
  }

  response.json({
    ...result,
    queue: getBackgroundIndexerStatus().queue,
  });
});

router.post('/reindex/queue-add', (request, response) => {
  const documentId = clampInteger(request.body?.documentId, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!documentId) {
    response.status(400).json({ error: 'Informe um ID de documento valido.' });
    return;
  }

  const document = getDocumentById(documentId);
  if (!document) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  if (document.index_status === 'processing') {
    response.status(409).json({ error: 'O item ja esta em processamento.' });
    return;
  }

  const result = setIndexerQueueStatus(documentId, 'pending');
  recordIndexerEvent(`Item ${documentId} colocado na fila manualmente.`, {
    context: { action: 'manual-enqueue', documentId },
    level: 'info',
  });

  response.json({
    ...result,
    queue: getBackgroundIndexerStatus().queue,
  });
});

router.post('/reindex/document/:id', async (request, response) => {
  const id = clampInteger(request.params.id, { fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!id) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const document = getDocumentById(id);
  if (!document) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  response.json(await processDocument(document, {
    mode: request.body?.mode || 'hybrid',
    runFullProcess: request.body?.fullProcessIfNeeded !== false,
  }));
});

module.exports = router;
