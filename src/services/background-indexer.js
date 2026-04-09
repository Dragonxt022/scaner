const { runIndexBatch } = require('./indexer');
const { getIndexerQueueStats, recoverProcessingDocuments } = require('./repository');

const MAX_HISTORY = 8;
const MAX_LOG_ENTRIES = 160;
const state = {
  active: false,
  activeItems: [],
  batchLimit: 10,
  bottleneckTotalsMs: {
    download: 0,
    native: 0,
    ocr: 0,
  },
  currentBatch: 0,
  errorTotal: 0,
  indexedTotal: 0,
  lastItem: null,
  lastError: '',
  lastUpdatedAt: null,
  message: 'Aguardando inicializacao.',
  mode: 'hybrid',
  operationLogs: [],
  pendingAtStart: 0,
  processedTotal: 0,
  recoveredGroupsAtStart: 0,
  recentBatches: [],
  retryFailures: false,
  runFullProcess: true,
  startedAt: null,
  stopRequested: false,
};

function pushLog(level, message, context = {}) {
  state.operationLogs.unshift({
    context,
    currentBatch: state.currentBatch,
    level,
    message,
    timestamp: new Date().toISOString(),
  });
  state.operationLogs = state.operationLogs.slice(0, MAX_LOG_ENTRIES);
}

function stamp(message, level = 'info', context = {}) {
  state.lastUpdatedAt = new Date().toISOString();
  state.message = message;
  pushLog(level, message, context);
}

function getElapsedSeconds() {
  if (!state.startedAt) {
    return 0;
  }

  return Math.max(0, Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000));
}

function snapshot() {
  const queue = getIndexerQueueStats();
  const baseline = Math.max(state.pendingAtStart || 0, queue.pendingContentGroups || 0, 1);
  const completedGroups = Math.max(0, baseline - (queue.pendingContentGroups || 0));
  const rawProgressPercent = (completedGroups / baseline) * 100;
  const progressPercent =
    completedGroups > 0 && rawProgressPercent < 1
      ? 1
      : Math.max(0, Math.min(100, Math.round(rawProgressPercent)));
  const elapsedSeconds = getElapsedSeconds();
  const avgSecondsPerGroup = state.processedTotal > 0 ? elapsedSeconds / state.processedTotal : 0;
  const pendingGroupsForEta = state.retryFailures
    ? (queue.pendingContentGroups || 0) + (queue.erroredContentGroups || 0)
    : (queue.pendingContentGroups || 0);
  const etaSeconds = avgSecondsPerGroup > 0 ? Math.round(pendingGroupsForEta * avgSecondsPerGroup) : null;

  return {
    active: state.active,
    activeItems: state.activeItems,
    avgSecondsPerGroup,
    batchLimit: state.batchLimit,
    bottleneckStage: Object.entries(state.bottleneckTotalsMs).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
    bottleneckTotalsMs: state.bottleneckTotalsMs,
    currentBatch: state.currentBatch,
    elapsedSeconds,
    errorTotal: state.errorTotal,
    etaSeconds,
    indexedTotal: state.indexedTotal,
    lastItem: state.lastItem,
    lastError: state.lastError,
    lastUpdatedAt: state.lastUpdatedAt,
    message: state.message,
    mode: state.mode,
    operationLogs: state.operationLogs,
    pendingAtStart: state.pendingAtStart,
    processedTotal: state.processedTotal,
    progressPercent,
    queue,
    recoveredGroupsAtStart: state.recoveredGroupsAtStart,
    recentBatches: state.recentBatches,
    retryFailures: state.retryFailures,
    runFullProcess: state.runFullProcess,
    startedAt: state.startedAt,
    stopRequested: state.stopRequested,
  };
}

function upsertActiveItem(document, patch) {
  const current = state.activeItems.find((item) => item.documentId === document.id);
  if (current) {
    Object.assign(current, patch);
    return;
  }

  state.activeItems.push({
    documentId: document.id,
    label: document.descricao || document.nome_arquivo || `Documento ${document.id}`,
    ...patch,
  });
}

function removeActiveItem(documentId) {
  state.activeItems = state.activeItems.filter((item) => item.documentId !== documentId);
}

async function loop() {
  while (state.active && !state.stopRequested) {
    const queueBefore = getIndexerQueueStats();
    const remainingGroups = state.retryFailures
      ? (queueBefore.pendingContentGroups || 0) + (queueBefore.erroredContentGroups || 0)
      : (queueBefore.pendingContentGroups || 0);

    if (!remainingGroups) {
      stamp('Fila concluida.');
      state.active = false;
      state.activeItems = [];
      return;
    }

    state.currentBatch += 1;
    const batchStartedAt = Date.now();
    stamp(
      `Processando lote ${state.currentBatch} com ${state.batchLimit} item(ns) em modo ${state.mode}${
        state.retryFailures ? ' incluindo falhas anteriores' : ''
      }.`,
    );

    const result = await runIndexBatch({
      limit: state.batchLimit,
      mode: state.mode,
      onItemComplete(document, itemResult) {
        state.lastItem = {
          bottleneckStage: itemResult.bottleneckStage || null,
          documentId: document.id,
          elapsedMs: itemResult.itemElapsedMs || 0,
          label: document.descricao || document.nome_arquivo || `Documento ${document.id}`,
          metrics: itemResult.metrics || {},
          status: itemResult.status,
        };
        for (const [stage, value] of Object.entries(itemResult.metrics || {})) {
          const normalizedStage = stage.replace(/Ms$/, '');
          if (Object.prototype.hasOwnProperty.call(state.bottleneckTotalsMs, normalizedStage)) {
            state.bottleneckTotalsMs[normalizedStage] += Number(value) || 0;
          }
        }
        pushLog('success', `Documento concluido: ${state.lastItem.label}.`, {
          documentId: document.id,
          elapsedMs: itemResult.itemElapsedMs || 0,
          status: itemResult.status,
        });
        removeActiveItem(document.id);
      },
      onItemError(document, itemResult) {
        state.lastItem = {
          bottleneckStage: null,
          documentId: document.id,
          elapsedMs: itemResult.itemElapsedMs || 0,
          label: document.descricao || document.nome_arquivo || `Documento ${document.id}`,
          metrics: itemResult.metrics || {},
          status: itemResult.status,
        };
        pushLog('error', `Falha ao processar ${state.lastItem.label}: ${itemResult.error || 'erro sem detalhe'}.`, {
          documentId: document.id,
          elapsedMs: itemResult.itemElapsedMs || 0,
          status: itemResult.status,
        });
        removeActiveItem(document.id);
      },
      onItemStart(document, payload) {
        upsertActiveItem(document, {
          itemStartedAt: payload.startedAt,
          mode: payload.mode,
          stage: 'download',
          stageStartedAt: payload.startedAt,
          status: 'processing',
        });
        pushLog('info', `Documento iniciado: ${document.descricao || document.nome_arquivo || `Documento ${document.id}`}.`, {
          documentId: document.id,
          mode: payload.mode,
          runFullProcess: payload.runFullProcess,
        });
      },
      onStage(document, stage, payload) {
        const patch = {
          stage,
        };
        if (payload.startedAt) {
          patch.stageStartedAt = payload.startedAt;
        }
        if (payload.status) {
          patch.stageStatus = payload.status;
        }
        if (payload.elapsedMs) {
          patch.lastStageElapsedMs = payload.elapsedMs;
        }
        upsertActiveItem(document, patch);
        pushLog('debug', `Etapa ${stage} em ${document.descricao || document.nome_arquivo || `Documento ${document.id}`}.`, {
          documentId: document.id,
          elapsedMs: payload.elapsedMs || 0,
          stage,
          status: payload.status || 'executando',
        });
      },
      runFullProcess: state.runFullProcess,
      retryFailures: state.retryFailures,
    });
    const indexedInBatch = result.results.filter((item) => item.status === 'indexed').length;
    const errorsInBatch = result.results.filter((item) => item.status === 'error').length;
    const durationSeconds = Math.max(1, Math.round((Date.now() - batchStartedAt) / 1000));

    state.processedTotal += result.processed;
    state.indexedTotal += indexedInBatch;
    state.errorTotal += errorsInBatch;

    state.recentBatches.unshift({
      batchNumber: state.currentBatch,
      durationSeconds,
      errors: errorsInBatch,
      indexed: indexedInBatch,
      mode: state.mode,
      processed: result.processed,
      retryFailures: state.retryFailures,
      runFullProcess: state.runFullProcess,
      timestamp: new Date().toISOString(),
    });
    state.recentBatches = state.recentBatches.slice(0, MAX_HISTORY);

    if (errorsInBatch) {
      const lastError = result.results.find((item) => item.status === 'error');
      state.lastError = lastError?.error || 'Falha ao indexar lote.';
    }

    if (!result.processed) {
      stamp('Nenhum item foi processado no lote atual.');
      state.active = false;
      state.activeItems = [];
      return;
    }

    stamp(`Lote ${state.currentBatch} concluido: ${indexedInBatch} indexado(s), ${errorsInBatch} erro(s).`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (state.stopRequested) {
    state.active = false;
    state.activeItems = [];
    stamp('Processo interrompido pelo usuario.');
  }
}

function startBackgroundIndexing({ batchLimit = 10, mode = 'hybrid', retryFailures = false, runFullProcess = true } = {}) {
  if (state.active) {
    return snapshot();
  }

  const recovery = recoverProcessingDocuments();
  const queue = getIndexerQueueStats();
  state.active = true;
  state.batchLimit = Math.max(1, Number(batchLimit) || 10);
  state.activeItems = [];
  state.bottleneckTotalsMs = {
    download: 0,
    native: 0,
    ocr: 0,
  };
  state.currentBatch = 0;
  state.errorTotal = 0;
  state.indexedTotal = 0;
  state.lastError = '';
  state.lastItem = null;
  state.mode = mode || 'hybrid';
  state.operationLogs = [];
  state.recoveredGroupsAtStart = recovery.affectedGroups || 0;
  state.pendingAtStart = retryFailures
    ? (queue.pendingContentGroups || 0) + (queue.erroredContentGroups || 0)
    : (queue.pendingContentGroups || 0);
  state.processedTotal = 0;
  state.recentBatches = [];
  state.retryFailures = Boolean(retryFailures);
  state.runFullProcess = runFullProcess !== false;
  state.startedAt = new Date().toISOString();
  state.stopRequested = false;
  stamp(
    `Indexacao em segundo plano iniciada no modo ${state.mode}${
      state.retryFailures ? ' com reprocessamento de falhas' : ' ignorando falhas anteriores'
    }${state.runFullProcess ? ' com processo completo quando necessario' : ' sem enriquecimento complementar'}${
      state.recoveredGroupsAtStart ? `; ${state.recoveredGroupsAtStart} grupo(s) preso(s) em processamento foram recuperados` : ''
    }.`,
  );

  loop().catch((error) => {
    state.active = false;
    state.activeItems = [];
    state.lastError = error.message;
    stamp(`Falha no processo em segundo plano: ${error.message}`);
  });

  return snapshot();
}

function stopBackgroundIndexing() {
  state.stopRequested = true;
  stamp('Solicitacao de parada recebida.');
  return snapshot();
}

function recordIndexerEvent(message, { context = {}, level = 'info' } = {}) {
  stamp(message, level, context);
  return snapshot();
}

module.exports = {
  getBackgroundIndexerStatus: snapshot,
  recordIndexerEvent,
  startBackgroundIndexing,
  stopBackgroundIndexing,
};
