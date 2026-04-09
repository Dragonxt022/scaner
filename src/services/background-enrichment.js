const { enrichDocumentById } = require('./document-enrichment');
const { getDocumentsForEnrichment, getEnrichmentStats } = require('./repository');
const { getAppSettings } = require('./app-settings');

const state = {
  active: false,
  avgSecondsPerItem: 0,
  batchLimit: 5,
  currentItem: null,
  errorTotal: 0,
  indexedAtStart: 0,
  items: [],
  lastError: '',
  lastItem: null,
  lastUpdatedAt: null,
  message: 'Aguardando inicializacao.',
  processedTotal: 0,
  recentItems: [],
  startedAt: null,
  stopRequested: false,
  summaryTotalsMs: 0,
  imageTotalsMs: 0,
};

function stamp(message) {
  state.lastUpdatedAt = new Date().toISOString();
  state.message = message;
}

function snapshot() {
  const stats = getEnrichmentStats();
  const elapsedSeconds = state.startedAt ? Math.max(0, Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)) : 0;
  const avgSecondsPerItem = state.processedTotal > 0 ? elapsedSeconds / state.processedTotal : 0;

  return {
    active: state.active,
    avgSecondsPerItem,
    batchLimit: state.batchLimit,
    bottleneckStage: state.summaryTotalsMs >= state.imageTotalsMs ? 'summary' : 'image',
    currentItem: state.currentItem,
    errorTotal: state.errorTotal,
    lastError: state.lastError,
    lastItem: state.lastItem,
    lastUpdatedAt: state.lastUpdatedAt,
    message: state.message,
    processedTotal: state.processedTotal,
    recentItems: state.recentItems,
    startedAt: state.startedAt,
    stats,
    stopRequested: state.stopRequested,
    summaryTotalsMs: state.summaryTotalsMs,
    imageTotalsMs: state.imageTotalsMs,
  };
}

async function loop() {
  while (state.active && !state.stopRequested) {
    const settings = await getAppSettings();
    const queue = getDocumentsForEnrichment(state.batchLimit, {
      includeAlreadyEnriched: settings.enrichmentOverwriteSummary || settings.enrichmentOverwritePreviewImages,
    });
    if (!queue.length) {
      state.active = false;
      state.currentItem = null;
      stamp('Fila de enriquecimento concluida.');
      return;
    }

    for (const item of queue) {
      if (state.stopRequested) {
        break;
      }

      state.currentItem = {
        documentId: item.id,
        label: item.descricao || item.nome_arquivo || `Documento ${item.id}`,
        startedAt: Date.now(),
        stage: 'summary',
      };
      stamp(`Enriquecendo ${state.currentItem.label}.`);

      try {
        const result = await enrichDocumentById(item.id, {
          onStage(_document, stage, payload) {
            state.currentItem = {
              ...state.currentItem,
              stage,
              stageElapsedMs: payload.elapsedMs || 0,
              stageStatus: payload.status || 'start',
            };
          },
        });
        state.processedTotal += 1;
        state.summaryTotalsMs += Number(result.metrics?.summaryMs || 0);
        state.imageTotalsMs += Number(result.metrics?.imageMs || 0);
        state.lastItem = {
          documentId: item.id,
          elapsedMs: result.itemElapsedMs || 0,
          label: state.currentItem.label,
          metrics: result.metrics || {},
          status: 'done',
        };
        state.recentItems.unshift(state.lastItem);
        state.recentItems = state.recentItems.slice(0, 8);
      } catch (error) {
        state.errorTotal += 1;
        state.lastError = error.message;
        state.lastItem = {
          documentId: item.id,
          elapsedMs: Math.max(0, Date.now() - state.currentItem.startedAt),
          label: state.currentItem.label,
          metrics: {},
          status: 'error',
        };
      }
    }

    state.currentItem = null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (state.stopRequested) {
    state.active = false;
    state.currentItem = null;
    stamp('Enriquecimento interrompido pelo usuario.');
  }
}

function startBackgroundEnrichment({ batchLimit = 5 } = {}) {
  if (state.active) {
    return snapshot();
  }

  state.active = true;
  state.batchLimit = Math.max(1, Number(batchLimit) || 5);
  state.currentItem = null;
  state.errorTotal = 0;
  state.imageTotalsMs = 0;
  state.indexedAtStart = getEnrichmentStats().indexedWithoutSummary || 0;
  state.lastError = '';
  state.lastItem = null;
  state.processedTotal = 0;
  state.recentItems = [];
  state.startedAt = new Date().toISOString();
  state.stopRequested = false;
  state.summaryTotalsMs = 0;
  stamp('Fila de enriquecimento iniciada.');

  loop().catch((error) => {
    state.active = false;
    state.currentItem = null;
    state.lastError = error.message;
    stamp(`Falha no enriquecimento em segundo plano: ${error.message}`);
  });

  return snapshot();
}

function stopBackgroundEnrichment() {
  state.stopRequested = true;
  stamp('Solicitacao de parada do enriquecimento recebida.');
  return snapshot();
}

module.exports = {
  getBackgroundEnrichmentStatus: snapshot,
  startBackgroundEnrichment,
  stopBackgroundEnrichment,
};
