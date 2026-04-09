(function bootstrapConfigPage() {
  const currentPage = (document.body.dataset.page || '').replace(/^config-/, '') || 'dashboard';

  const elements = {
    autoIndexOnDetailView: document.querySelector('#autoIndexOnDetailView'),
    auditSummaryFeedback: document.querySelector('#auditSummaryFeedback'),
    auditSummaryStats: document.querySelector('#auditSummaryStats'),
    batchLimit: document.querySelector('#batchLimit'),
    accessLogSearch: document.querySelector('#accessLogSearch'),
    configFeedback: document.querySelector('#configFeedback'),
    configLead: document.querySelector('#configLead'),
    configPanel: document.querySelector('#configPanel'),
    configStats: document.querySelector('#configStats'),
    databaseStrategy: document.querySelector('#databaseStrategy'),
    downloadActionFeedback: document.querySelector('#downloadActionFeedback'),
    downloadActiveList: document.querySelector('#downloadActiveList'),
    downloadCompletedFiles: document.querySelector('#downloadCompletedFiles'),
    downloadConcurrency: document.querySelector('#downloadConcurrency'),
    downloadDestinationDir: document.querySelector('#downloadDestinationDir'),
    downloadFailedFiles: document.querySelector('#downloadFailedFiles'),
    downloadInFlightCount: document.querySelector('#downloadInFlightCount'),
    downloadManifestPath: document.querySelector('#downloadManifestPath'),
    downloadMessage: document.querySelector('#downloadMessage'),
    downloadOverwrite: document.querySelector('#downloadOverwrite'),
    downloadPendingFiles: document.querySelector('#downloadPendingFiles'),
    downloadProgressText: document.querySelector('#downloadProgressText'),
    downloadRetryCount: document.querySelector('#downloadRetryCount'),
    downloadStart: document.querySelector('#downloadStart'),
    downloadStatusMode: document.querySelector('#downloadStatusMode'),
    downloadStop: document.querySelector('#downloadStop'),
    downloadTimeoutMs: document.querySelector('#downloadTimeoutMs'),
    downloadTotalFiles: document.querySelector('#downloadTotalFiles'),
    downloadTotalProgressBar: document.querySelector('#downloadTotalProgressBar'),
    downloadTotalProgressLabel: document.querySelector('#downloadTotalProgressLabel'),
    downloadUpdatedAt: document.querySelector('#downloadUpdatedAt'),
    enrichmentApiKey: document.querySelector('#enrichmentApiKey'),
    enrichmentBaseUrl: document.querySelector('#enrichmentBaseUrl'),
    enrichmentBatchLimit: document.querySelector('#enrichmentBatchLimit'),
    enrichmentFeedback: document.querySelector('#enrichmentFeedback'),
    enrichmentCurrentItem: document.querySelector('#enrichmentCurrentItem'),
    enrichmentErrorTotal: document.querySelector('#enrichmentErrorTotal'),
    enrichmentAvgTime: document.querySelector('#enrichmentAvgTime'),
    enrichmentBottleneckStage: document.querySelector('#enrichmentBottleneckStage'),
    enrichmentLoadModels: document.querySelector('#enrichmentLoadModels'),
    enrichmentLastItemCard: document.querySelector('#enrichmentLastItemCard'),
    enrichmentLastItemTime: document.querySelector('#enrichmentLastItemTime'),
    enrichmentModel: document.querySelector('#enrichmentModel'),
    enrichmentModelOptions: document.querySelector('#enrichmentModelOptions'),
    enrichmentOverwritePreviewImages: document.querySelector('#enrichmentOverwritePreviewImages'),
    enrichmentOverwriteSummary: document.querySelector('#enrichmentOverwriteSummary'),
    enrichmentProcessMode: document.querySelector('#enrichmentProcessMode'),
    enrichmentProcessedTotal: document.querySelector('#enrichmentProcessedTotal'),
    enrichmentPreviewImageCount: document.querySelector('#enrichmentPreviewImageCount'),
    enrichmentPreviewImageQuality: document.querySelector('#enrichmentPreviewImageQuality'),
    enrichmentPreviewImagesEnabled: document.querySelector('#enrichmentPreviewImagesEnabled'),
    enrichmentProvider: document.querySelector('#enrichmentProvider'),
    enrichmentResults: document.querySelector('#enrichmentResults'),
    enrichmentRun: document.querySelector('#enrichmentRun'),
    enrichmentSave: document.querySelector('#enrichmentSave'),
    enrichmentStats: document.querySelector('#enrichmentStats'),
    enrichmentStatusMode: document.querySelector('#enrichmentStatusMode'),
    enrichmentStop: document.querySelector('#enrichmentStop'),
    enrichmentSummaryEnabled: document.querySelector('#enrichmentSummaryEnabled'),
    failureCount: document.querySelector('#failureCount'),
    fullProcessToggle: document.querySelector('#fullProcessToggle'),
    indexFailuresList: document.querySelector('#indexFailuresList'),
    indexFailureSearch: document.querySelector('#indexFailureSearch'),
    indexMode: document.querySelector('#indexMode'),
    indexerActiveItems: document.querySelector('#indexerActiveItems'),
    indexerAvgRate: document.querySelector('#indexerAvgRate'),
    indexerBatchHistory: document.querySelector('#indexerBatchHistory'),
    indexerBatchSearch: document.querySelector('#indexerBatchSearch'),
    indexerBottleneckStage: document.querySelector('#indexerBottleneckStage'),
    indexerCounts: document.querySelector('#indexerCounts'),
    indexerCurrentBatch: document.querySelector('#indexerCurrentBatch'),
    indexerErrorTotal: document.querySelector('#indexerErrorTotal'),
    indexerFailedGroups: document.querySelector('#indexerFailedGroups'),
    indexerIndexedTotal: document.querySelector('#indexerIndexedTotal'),
    indexerLastError: document.querySelector('#indexerLastError'),
    indexerLastItemCard: document.querySelector('#indexerLastItemCard'),
    indexerLastItemTime: document.querySelector('#indexerLastItemTime'),
    indexerOperationLogs: document.querySelector('#indexerOperationLogs'),
    indexerOperationSearch: document.querySelector('#indexerOperationSearch'),
    indexerPendingGroups: document.querySelector('#indexerPendingGroups'),
    indexerPendingDocuments: document.querySelector('#indexerPendingDocuments'),
    indexerProcessingDocuments: document.querySelector('#indexerProcessingDocuments'),
    indexerProgressBar: document.querySelector('#indexerProgressBar'),
    indexerProgressLabel: document.querySelector('#indexerProgressLabel'),
    indexerPausedGroups: document.querySelector('#indexerPausedGroups'),
    indexerQueueAddButton: document.querySelector('#indexerQueueAddButton'),
    indexerQueueFeedback: document.querySelector('#indexerQueueFeedback'),
    indexerQueueFilter: document.querySelector('#indexerQueueFilter'),
    indexerQueueList: document.querySelector('#indexerQueueList'),
    indexerQueueManualId: document.querySelector('#indexerQueueManualId'),
    indexerQueueRefresh: document.querySelector('#indexerQueueRefresh'),
    indexerQueueSearch: document.querySelector('#indexerQueueSearch'),
    indexerStatusMode: document.querySelector('#indexerStatusMode'),
    indexerStatusText: document.querySelector('#indexerStatusText'),
    indexerUpdatedAt: document.querySelector('#indexerUpdatedAt'),
    localLibraryFeedback: document.querySelector('#localLibraryFeedback'),
    localLibraryAutoSync: document.querySelector('#localLibraryAutoSync'),
    localLibraryList: document.querySelector('#localLibraryList'),
    localLibrarySearch: document.querySelector('#localLibrarySearch'),
    localLibraryStats: document.querySelector('#localLibraryStats'),
    localLibrarySync: document.querySelector('#localLibrarySync'),
    maintenanceCandidates: document.querySelector('#maintenanceCandidates'),
    maintenanceClear: document.querySelector('#maintenanceClear'),
    maintenanceFeedback: document.querySelector('#maintenanceFeedback'),
    maintenanceInsights: document.querySelector('#maintenanceInsights'),
    maintenanceLimit: document.querySelector('#maintenanceLimit'),
    maintenanceMode: document.querySelector('#maintenanceMode'),
    maintenancePreview: document.querySelector('#maintenancePreview'),
    maintenanceReprocess: document.querySelector('#maintenanceReprocess'),
    maintenanceResetAttempts: document.querySelector('#maintenanceResetAttempts'),
    maintenanceStrategy: document.querySelector('#maintenanceStrategy'),
    logoutButton: document.querySelector('#logoutButton'),
    passwordResetRequestList: document.querySelector('#passwordResetRequestList'),
    passwordResetSearch: document.querySelector('#passwordResetSearch'),
    refreshStats: document.querySelector('#refreshStats'),
    reindexStart: document.querySelector('#reindexStart'),
    reindexStop: document.querySelector('#reindexStop'),
    retryFailuresToggle: document.querySelector('#retryFailuresToggle'),
    syncCatalog: document.querySelector('#syncCatalog'),
    textCleanupCandidates: document.querySelector('#textCleanupCandidates'),
    textCleanupFeedback: document.querySelector('#textCleanupFeedback'),
    textCleanupLimit: document.querySelector('#textCleanupLimit'),
    textCleanupPreview: document.querySelector('#textCleanupPreview'),
    textCleanupRun: document.querySelector('#textCleanupRun'),
    textCleanupSampleSize: document.querySelector('#textCleanupSampleSize'),
    textCleanupStrategy: document.querySelector('#textCleanupStrategy'),
    userCpf: document.querySelector('#userCpf'),
    userEditId: document.querySelector('#userEditId'),
    userFullName: document.querySelector('#userFullName'),
    userIsActive: document.querySelector('#userIsActive'),
    userList: document.querySelector('#userList'),
    userManagementFeedback: document.querySelector('#userManagementFeedback'),
    userMustChangePassword: document.querySelector('#userMustChangePassword'),
    userPassword: document.querySelector('#userPassword'),
    userResetButton: document.querySelector('#userResetButton'),
    userRole: document.querySelector('#userRole'),
    userSearch: document.querySelector('#userSearch'),
    userSaveButton: document.querySelector('#userSaveButton'),
    searchLogSearch: document.querySelector('#searchLogSearch'),
  };

  const state = {
    enrichmentDirty: false,
    enrichmentModelsKey: '',
    indexerQueueSearchHandle: null,
    maintenanceItems: [],
    pollHandle: null,
    runtime: null,
  };

  function safe(value, fallback = '--') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function formatTimestamp(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
    }).format(date);
  }

  function formatDuration(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes > 0) return `${minutes}min ${rest}s`;
    return `${rest}s`;
  }

  function formatQueueStatus(value) {
    switch (String(value || '').toLowerCase()) {
      case 'processing':
        return 'Processando';
      case 'error':
        return 'Falha';
      case 'paused':
        return 'Pausada';
      case 'pending':
        return 'Pendente';
      default:
        return safe(value, '--');
    }
  }

  function formatLogLevel(value) {
    switch (String(value || '').toLowerCase()) {
      case 'error':
        return 'Erro';
      case 'warning':
        return 'Aviso';
      case 'success':
        return 'Sucesso';
      case 'debug':
        return 'Etapa';
      default:
        return 'Info';
    }
  }

  function card(label, value) {
    return `<article class="overview-stat"><span>${label}</span><strong>${value}</strong></article>`;
  }

  function pill(label, tone = '') {
    return `<span class="table-pill${tone ? ` ${tone}` : ''}">${escapeHtml(label)}</span>`;
  }

  function buildLocalFileUrl(relativePath) {
    return `/acervo-local/${String(relativePath || '')
      .split(/[\\/]+/)
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`;
  }

  function getPrimaryFileUrl(item) {
    return item?.local_file_url || (item?.local_relative_path ? buildLocalFileUrl(item.local_relative_path) : '') || item?.pdf_url || '#';
  }

  function getPrimaryFileLabel(item) {
    return item?.source_kind === 'local' || item?.local_relative_path ? 'Abrir arquivo' : 'Abrir PDF';
  }

  function getReferenceUrl(item) {
    if (item?.source_kind === 'local') {
      return getPrimaryFileUrl(item);
    }
    return item?.detail_url || item?.pdf_url || '#';
  }

  function getReferenceLabel(item) {
    return item?.source_kind === 'local' ? 'Origem local' : 'Origem';
  }

  function normalizeText(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function matchesSearch(item, search, fields) {
    const term = normalizeText(search);
    if (!term) return true;
    return fields.some((field) => normalizeText(typeof field === 'function' ? field(item) : item?.[field]).includes(term));
  }

  function renderEmptyTable(title, copy) {
    return `
      <div class="table-empty">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(copy)}</p>
      </div>`;
  }

  function renderTable({ container, columns, rows, emptyTitle, emptyCopy, compact = false }) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = renderEmptyTable(emptyTitle, emptyCopy);
      return;
    }

    container.innerHTML = `
      <table class="data-table${compact ? ' data-table-compact' : ''}">
        <thead>
          <tr>${columns.map((column) => `<th${column.className ? ` class="${column.className}"` : ''}>${escapeHtml(column.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td${cell.className ? ` class="${cell.className}"` : ''}>${cell.html}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  function getFeedbackElement(preferred, fallback) {
    return preferred || fallback || elements.configLead;
  }

  function rerenderFilteredViews() {
    if (state.runtime?.users) renderUsers(state.runtime.users.items || []);
    if (state.runtime?.passwordResetRequests) renderPasswordResetRequests(state.runtime.passwordResetRequests.items || []);
    if (state.runtime?.accessLogs) renderAccessLogs(state.runtime.accessLogs.items || []);
    if (state.runtime?.searchLogs) renderSearchLogs(state.runtime.searchLogs.items || []);
    if (state.runtime?.localLibrary) renderLocalLibrary(state.runtime.localLibrary.items || [], state.runtime.localLibrary.root || '');
    if (state.runtime?.failures) renderFailures(state.runtime.failures.items || []);
    if (state.runtime?.indexerStatus) renderIndexerStatus(state.runtime.indexerStatus);
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (response.status === 428) {
      window.location.assign('/security');
      throw new Error('Troca de senha obrigatoria.');
    }
    if (response.status === 401 || response.status === 403) {
      window.location.assign('/login');
      throw new Error('Sessao expirada.');
    }
    if (!response.ok) throw new Error(`Falha ao carregar ${url}: ${response.status}`);
    return response.json();
  }

  async function runPost(url, payload = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 428) {
      window.location.assign('/security');
      throw new Error('Troca de senha obrigatoria.');
    }
    if (response.status === 401 || response.status === 403) {
      window.location.assign('/login');
      throw new Error('Sessao expirada.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Falha na requisicao: ${response.status}`);
    return result;
  }

  function renderStats(stats) {
    if (!elements.configStats) return;
    elements.configStats.innerHTML = [
      card('Total', formatNumber(stats.totalDocumentos)),
      card('Indexados', formatNumber(stats.indexados)),
      card('Pendentes', formatNumber(stats.pendentes)),
      card('Falhas', formatNumber(stats.falhas)),
      card('PDFs unicos', formatNumber(stats.pdfsUnicos)),
      card('Conteudos unicos', formatNumber(stats.conteudosUnicos)),
    ].join('');
  }

  function renderDatabaseStrategy(strategy) {
    if (!elements.databaseStrategy) return;
    elements.databaseStrategy.textContent =
      `Banco: ${safe(strategy.dialect)} - busca: ${safe(strategy.searchStrategy)} - indexacao: ${safe(strategy.indexingStrategy)}`;
  }

  function renderEnrichmentStats(stats) {
    if (!elements.enrichmentStats) return;
    elements.enrichmentStats.innerHTML = [
      card('Com resumo', formatNumber(stats.summarizedDocuments)),
      card('Com miniatura', formatNumber(stats.imagedDocuments)),
      card('Sem resumo', formatNumber(stats.indexedWithoutSummary)),
      card('Sem miniatura', formatNumber(stats.indexedWithoutImage)),
    ].join('');

    const runtime = stats.runtime || {};
    if (elements.enrichmentStatusMode) {
      elements.enrichmentStatusMode.textContent = runtime.active ? 'Executando' : runtime.stopRequested ? 'Parando' : 'Parado';
      elements.enrichmentProcessedTotal.textContent = formatNumber(runtime.processedTotal || 0);
      elements.enrichmentErrorTotal.textContent = formatNumber(runtime.errorTotal || 0);
      elements.enrichmentAvgTime.textContent =
        runtime.avgSecondsPerItem && runtime.avgSecondsPerItem > 0 ? `${runtime.avgSecondsPerItem.toFixed(1)}s / item` : '--';
      elements.enrichmentBottleneckStage.textContent = safe(runtime.bottleneckStage || '--');
      elements.enrichmentLastItemTime.textContent =
        runtime.lastItem?.elapsedMs ? `${(Number(runtime.lastItem.elapsedMs) / 1000).toFixed(1)}s` : '--';
      elements.enrichmentRun.disabled = Boolean(runtime.active);
      elements.enrichmentStop.disabled = !runtime.active && !runtime.stopRequested;
      elements.enrichmentCurrentItem.innerHTML = runtime.currentItem
        ? `
          <article class="history-card">
            <h4>${safe(runtime.currentItem.label)}</h4>
            <p class="muted-copy">fase: ${safe(runtime.currentItem.stage)} - status ${safe(runtime.currentItem.stageStatus || 'executando')}</p>
            <div class="meta-chips">
              <span class="chip">${runtime.currentItem.stageElapsedMs ? `${(Number(runtime.currentItem.stageElapsedMs) / 1000).toFixed(1)}s na fase` : 'sem medicao'}</span>
            </div>
          </article>`
        : `<article class="empty-card"><h4>Nenhum documento em fila agora.</h4><p class="muted-copy">Quando a IA estiver rodando, o item atual aparece aqui.</p></article>`;
      elements.enrichmentLastItemCard.innerHTML = runtime.lastItem
        ? `
          <article class="history-card">
            <h4>${safe(runtime.lastItem.label)}</h4>
            <p class="muted-copy">status ${safe(runtime.lastItem.status)} - gargalo ${safe(runtime.bottleneckStage || '--')}</p>
            <div class="meta-chips">
              <span class="chip">sumario ${(Number(runtime.lastItem.metrics?.summaryMs || 0) / 1000).toFixed(1)}s</span>
              <span class="chip">imagem ${(Number(runtime.lastItem.metrics?.imageMs || 0) / 1000).toFixed(1)}s</span>
              <span class="chip">total ${(Number(runtime.lastItem.elapsedMs || 0) / 1000).toFixed(1)}s</span>
            </div>
          </article>`
        : `<article class="empty-card"><h4>Sem enriquecimento concluido.</h4><p class="muted-copy">Os tempos do ultimo item aparecem aqui.</p></article>`;
    }
  }

  function renderIndexerStatus(status) {
    if (!elements.indexerStatusMode && !elements.indexerBatchHistory && !elements.indexerOperationLogs) return;
    const queue = status.queue || {};
    const progress = Math.max(0, Math.min(100, Number(status.progressPercent || 0)));
    if (elements.indexerStatusMode) {
      elements.indexerStatusMode.textContent = status.active ? 'Executando' : status.stopRequested ? 'Parando' : 'Parado';
    }
    if (elements.indexerCurrentBatch) {
      elements.indexerCurrentBatch.textContent = formatNumber(status.currentBatch || 0);
    }
    if (elements.indexerIndexedTotal) {
      elements.indexerIndexedTotal.textContent = formatNumber(status.indexedTotal || 0);
    }
    if (elements.indexerErrorTotal) {
      elements.indexerErrorTotal.textContent = formatNumber(status.errorTotal || 0);
    }
    if (elements.indexerPendingGroups) {
      elements.indexerPendingGroups.textContent = formatNumber(queue.pendingContentGroups || 0);
    }
    if (elements.indexerPendingDocuments) {
      elements.indexerPendingDocuments.textContent = formatNumber(queue.pendingDocuments || 0);
    }
    if (elements.indexerProcessingDocuments) {
      elements.indexerProcessingDocuments.textContent = formatNumber(queue.processingDocuments || 0);
    }
    if (elements.indexerFailedGroups) {
      elements.indexerFailedGroups.textContent = formatNumber(queue.erroredContentGroups || 0);
    }
    if (elements.indexerPausedGroups) {
      elements.indexerPausedGroups.textContent = formatNumber(queue.pausedContentGroups || 0);
    }
    if (elements.indexerAvgRate) {
      elements.indexerAvgRate.textContent =
        status.avgSecondsPerGroup && status.avgSecondsPerGroup > 0 ? `${status.avgSecondsPerGroup.toFixed(1)}s / grupo` : '--';
    }
    if (elements.indexerBottleneckStage) {
      elements.indexerBottleneckStage.textContent = safe(status.bottleneckStage || '--');
    }
    if (elements.indexerLastItemTime) {
      elements.indexerLastItemTime.textContent =
        status.lastItem?.elapsedMs ? `${(Number(status.lastItem.elapsedMs) / 1000).toFixed(1)}s` : '--';
    }
    if (elements.indexerStatusText) {
      elements.indexerStatusText.textContent = safe(status.message || 'Aguardando inicio.');
    }
    if (elements.indexerUpdatedAt) {
      elements.indexerUpdatedAt.textContent = `Atualizado em ${formatTimestamp(status.lastUpdatedAt)}`;
    }
    if (elements.indexerLastError) {
      elements.indexerLastError.textContent = status.lastError ? safe(status.lastError) : '';
    }
    if (elements.indexerProgressBar) {
      elements.indexerProgressBar.style.width = `${progress}%`;
    }
    if (elements.indexerProgressLabel) {
      elements.indexerProgressLabel.textContent = `${progress}%`;
    }
    if (elements.indexerCounts) {
      elements.indexerCounts.textContent =
        `${formatNumber(status.processedTotal)} processados - ${formatNumber(queue.pendingContentGroups || 0)} pendentes - ${formatNumber(queue.processingContentGroups || 0)} em processamento - ${formatNumber(queue.erroredContentGroups || 0)} falhas - ${formatNumber(queue.pausedContentGroups || 0)} pausados`;
    }

    if (elements.reindexStart) {
      elements.reindexStart.disabled = Boolean(status.active);
    }
    if (elements.reindexStop) {
      elements.reindexStop.disabled = !status.active && !status.stopRequested;
    }

    if (elements.indexerActiveItems) {
      renderTable({
        container: elements.indexerActiveItems,
        columns: [
          { label: 'Documento' },
          { label: 'Fase' },
          { label: 'Modo' },
          { label: 'Inicio' },
          { label: 'Tempo na fase' },
        ],
        rows: (status.activeItems || []).map((item) => [
          { html: escapeHtml(safe(item.label)) },
          { html: escapeHtml(safe(item.stage)) },
          { html: escapeHtml(safe(item.mode)) },
          { html: escapeHtml(item.stageStartedAt ? formatTimestamp(item.stageStartedAt) : 'Em andamento') },
          { html: escapeHtml(item.lastStageElapsedMs ? `${(Number(item.lastStageElapsedMs) / 1000).toFixed(1)}s` : 'Sem medicao') },
        ]),
        emptyTitle: 'Nenhum documento ativo.',
        emptyCopy: 'Quando a fila estiver rodando, o documento atual aparece aqui.',
        compact: true,
      });
    }

    if (elements.indexerLastItemCard) {
      renderTable({
        container: elements.indexerLastItemCard,
        columns: [
          { label: 'Documento' },
          { label: 'Status' },
          { label: 'Gargalo' },
          { label: 'Download' },
          { label: 'Parse' },
          { label: 'OCR' },
          { label: 'Total' },
        ],
        rows: status.lastItem ? [[
          { html: escapeHtml(safe(status.lastItem.label)) },
          { html: escapeHtml(safe(status.lastItem.status)) },
          { html: escapeHtml(safe(status.lastItem.bottleneckStage || '--')) },
          { html: escapeHtml(`${(Number(status.lastItem.metrics?.downloadMs || 0) / 1000).toFixed(1)}s`) },
          { html: escapeHtml(`${(Number(status.lastItem.metrics?.nativeMs || 0) / 1000).toFixed(1)}s`) },
          { html: escapeHtml(`${(Number(status.lastItem.metrics?.ocrMs || 0) / 1000).toFixed(1)}s`) },
          { html: escapeHtml(`${(Number(status.lastItem.elapsedMs || 0) / 1000).toFixed(1)}s`) },
        ]] : [],
        emptyTitle: 'Sem item concluido.',
        emptyCopy: 'Assim que um documento finalizar, os tempos aparecem aqui.',
        compact: true,
      });
    }

    if (elements.indexerBatchHistory) {
      const filteredBatches = (status.recentBatches || []).filter((batch) => matchesSearch(
        batch,
        elements.indexerBatchSearch?.value,
        [(item) => `lote ${item.batchNumber}`, 'mode', 'timestamp'],
      ));
      renderTable({
        container: elements.indexerBatchHistory,
        columns: [
          { label: 'Lote' },
          { label: 'Data' },
          { label: 'Modo' },
          { label: 'Processados' },
          { label: 'Indexados' },
          { label: 'Erros' },
          { label: 'Duracao' },
        ],
        rows: filteredBatches.map((batch) => [
          { html: `Lote ${formatNumber(batch.batchNumber)}` },
          { html: escapeHtml(formatTimestamp(batch.timestamp)) },
          { html: escapeHtml(`${safe(batch.mode)}${batch.retryFailures ? ' / retry falhas' : ''}`) },
          { html: formatNumber(batch.processed) },
          { html: formatNumber(batch.indexed) },
          { html: formatNumber(batch.errors) },
          { html: escapeHtml(formatDuration(batch.durationSeconds)) },
        ]),
        emptyTitle: 'Sem lotes recentes.',
        emptyCopy: 'Quando a fila rodar, o historico aparece aqui.',
        compact: true,
      });
    }

    if (elements.indexerOperationLogs) {
      const filteredLogs = (status.operationLogs || []).filter((entry) => matchesSearch(
        entry,
        elements.indexerOperationSearch?.value,
        ['level', 'message', 'timestamp', (item) => item.context?.stage, (item) => item.context?.documentId, 'currentBatch'],
      ));
      renderTable({
        container: elements.indexerOperationLogs,
        columns: [
          { label: 'Nivel' },
          { label: 'Data' },
          { label: 'Mensagem' },
          { label: 'Lote' },
          { label: 'Documento' },
          { label: 'Fase' },
        ],
        rows: filteredLogs.map((entry) => [
          { html: escapeHtml(formatLogLevel(entry.level)) },
          { html: escapeHtml(formatTimestamp(entry.timestamp)) },
          { html: escapeHtml(safe(entry.message)) },
          { html: formatNumber(entry.currentBatch || 0) },
          { html: escapeHtml(entry.context?.documentId ? formatNumber(entry.context.documentId) : '--') },
          { html: escapeHtml(safe(entry.context?.stage || '--')) },
        ]),
        emptyTitle: 'Sem log operacional.',
        emptyCopy: 'As etapas da fila aparecem aqui em tempo real.',
        compact: true,
      });
    }
  }

  function renderIndexerQueue(data) {
    if (!elements.indexerQueueList) return;
    const items = data?.items || [];
    renderTable({
      container: elements.indexerQueueList,
      columns: [
        { label: 'Documento' },
        { label: 'Status' },
        { label: 'Classificacao' },
        { label: 'Caixa' },
        { label: 'Tentativas' },
        { label: 'Metodo' },
        { label: 'Atualizado' },
        { label: 'Erro' },
        { label: 'Acoes', className: 'table-col-actions' },
      ],
      rows: items.map((item) => [
        { html: escapeHtml(safe(item.descricao || item.nome_arquivo || `Documento ${item.id}`)) },
        { html: escapeHtml(formatQueueStatus(item.index_status)) },
        { html: escapeHtml(safe(item.classificacao || 'Sem classificacao')) },
        { html: escapeHtml(`Caixa ${safe(item.caixa || '--')} / ${safe(item.ano || '--')}`) },
        { html: formatNumber(item.index_attempts || 0) },
        { html: escapeHtml(safe(item.last_index_method || 'sem metodo')) },
        { html: escapeHtml(formatTimestamp(item.updated_at)) },
        { html: escapeHtml(safe(item.index_error || '--')) },
        {
          html: `
            <div class="table-actions">
              <a class="ghost-button table-inline-button" href="${safe(getPrimaryFileUrl(item), '#')}" target="_blank" rel="noreferrer">${getPrimaryFileLabel(item)}</a>
              ${item.index_status !== 'processing' && item.index_status !== 'paused'
                ? `<button class="ghost-button table-inline-button queue-action-button" type="button" data-action="pause" data-id="${escapeHtml(item.id)}">Remover</button>`
                : ''}
              ${item.index_status === 'paused' || item.index_status === 'error'
                ? `<button class="primary-button table-inline-button queue-action-button" type="button" data-action="enqueue" data-id="${escapeHtml(item.id)}">Adicionar</button>`
                : ''}
            </div>`,
          className: 'table-col-actions',
        },
      ]),
      emptyTitle: 'Nenhum item nesta visao.',
      emptyCopy: 'Ajuste o filtro ou a busca para localizar grupos na fila.',
      compact: true,
    });
  }

  function renderDownloadStatus(status) {
    if (!elements.downloadStatusMode) return;
    const progress = Math.max(0, Math.min(100, Number(status.fileProgressPercent || 0)));
    elements.downloadStatusMode.textContent = status.active ? 'Executando' : status.stopRequested ? 'Parando' : 'Parado';
    elements.downloadTotalFiles.textContent = formatNumber(status.totalFiles || 0);
    elements.downloadCompletedFiles.textContent = formatNumber(status.completedFiles || 0);
    elements.downloadFailedFiles.textContent = formatNumber(status.failedFiles || 0);
    elements.downloadPendingFiles.textContent = formatNumber(status.pendingFiles || 0);
    elements.downloadProgressText.textContent = `${formatNumber(status.processedFiles || 0)} / ${formatNumber(status.totalFiles || 0)}`;
    elements.downloadInFlightCount.textContent = `${formatNumber(status.inFlightFiles || 0)} em andamento`;
    elements.downloadManifestPath.textContent = safe(status.manifestPath || '--');
    elements.downloadUpdatedAt.textContent = `Atualizado em ${formatTimestamp(status.lastUpdatedAt)}`;
    elements.downloadMessage.textContent = safe(status.message || 'Aguardando inicio.');
    elements.downloadTotalProgressBar.style.width = `${progress}%`;
    elements.downloadTotalProgressLabel.textContent = `${progress}%`;
    if (elements.downloadDestinationDir) {
      elements.downloadDestinationDir.value = safe(status.destinationDir || 'data/local-acervo', 'data/local-acervo');
    }
    elements.downloadOverwrite.checked = Boolean(status.overwrite);
    elements.downloadActiveList.innerHTML = (status.activeDownloads || []).length
      ? status.activeDownloads.map((item) => `
          <article class="download-card">
            <h4>${safe(item.fileName)}</h4>
            <p class="muted-copy">slot ${formatNumber(item.slot || 0)} - tentativa ${formatNumber(item.attempt || 1)}</p>
          </article>`).join('')
      : `<article class="empty-card"><h4>Nenhum download ativo.</h4><p class="muted-copy">Os arquivos em andamento aparecem aqui.</p></article>`;
  }

  function renderFailures(items) {
    if (!elements.failureCount || !elements.indexFailuresList) return;
    elements.failureCount.textContent = formatNumber(items.length);
    const filtered = items.filter((item) => matchesSearch(
      item,
      elements.indexFailureSearch?.value,
      ['descricao', 'nome_arquivo', 'classificacao', 'caixa', 'ano', 'index_error'],
    ));
    renderTable({
      container: elements.indexFailuresList,
      columns: [
        { label: 'Documento' },
        { label: 'Classificacao' },
        { label: 'Caixa/Ano' },
        { label: 'Erro' },
        { label: 'Acoes', className: 'table-col-actions' },
      ],
      rows: filtered.map((item) => [
        { html: escapeHtml(safe(item.descricao || item.nome_arquivo)) },
        { html: escapeHtml(safe(item.classificacao)) },
        { html: escapeHtml(`Caixa ${safe(item.caixa)} / ${safe(item.ano)}`) },
        { html: escapeHtml(safe(item.index_error || 'Falha sem detalhe')) },
        {
          html: `
            <div class="table-actions">
              <a class="ghost-button table-inline-button" href="${safe(getPrimaryFileUrl(item), '#')}" target="_blank" rel="noreferrer">${getPrimaryFileLabel(item)}</a>
              <a class="ghost-button table-inline-button" href="${safe(getReferenceUrl(item), '#')}" target="_blank" rel="noreferrer">${getReferenceLabel(item)}</a>
            </div>`,
          className: 'table-col-actions',
        },
      ]),
      emptyTitle: 'Nenhuma falha registrada.',
      emptyCopy: 'As falhas de indexacao aparecem aqui.',
      compact: true,
    });
  }

  function renderUsers(items) {
    if (!elements.userList) return;
    const filtered = items.filter((item) => matchesSearch(
      item,
      elements.userSearch?.value,
      ['full_name', 'cpf', 'role', (candidate) => (candidate.is_active ? 'ativo' : 'inativo')],
    ));
    renderTable({
      container: elements.userList,
      columns: [
        { label: 'Nome' },
        { label: 'CPF' },
        { label: 'Perfil' },
        { label: 'Status' },
        { label: 'Ultimo login' },
        { label: 'Senha' },
        { label: 'Acoes', className: 'table-col-actions' },
      ],
      rows: filtered.map((item) => [
        { html: escapeHtml(safe(item.full_name)) },
        { html: escapeHtml(safe(item.cpf)) },
        { html: escapeHtml(item.role === 'admin' ? 'Admin' : 'Usuario') },
        { html: escapeHtml(item.is_active ? 'Ativo' : 'Inativo') },
        { html: escapeHtml(formatTimestamp(item.last_login_at)) },
        { html: escapeHtml(item.must_change_password ? 'Troca pendente' : 'Regular') },
        {
          html: `<button class="ghost-button table-inline-button user-edit-button" type="button" data-id="${escapeHtml(item.id)}">Editar</button>`,
          className: 'table-col-actions',
        },
      ]),
      emptyTitle: 'Nenhum usuario cadastrado.',
      emptyCopy: 'Cadastre usuarios e administradores por aqui.',
      compact: true,
    });
  }

  function renderPasswordResetRequests(items) {
    if (!elements.passwordResetRequestList) return;
    const filtered = items.filter((item) => matchesSearch(
      item,
      elements.passwordResetSearch?.value,
      ['full_name', 'cpf', 'status', 'requested_by_ip', 'admin_full_name'],
    ));
    renderTable({
      container: elements.passwordResetRequestList,
      columns: [
        { label: 'Usuario' },
        { label: 'CPF' },
        { label: 'Status' },
        { label: 'Solicitado em' },
        { label: 'IP' },
        { label: 'Codigo' },
        { label: 'Admin' },
        { label: 'Acoes', className: 'table-col-actions' },
      ],
      rows: filtered.map((item) => [
        { html: escapeHtml(safe(item.full_name)) },
        { html: escapeHtml(safe(item.cpf)) },
        { html: escapeHtml(safe(item.status)) },
        { html: escapeHtml(formatTimestamp(item.requested_at)) },
        { html: escapeHtml(safe(item.requested_by_ip || '--')) },
        { html: escapeHtml(safe(item.issued_code_preview || '--')) },
        { html: escapeHtml(safe(item.admin_full_name || '--')) },
        {
          html: item.status !== 'consumed'
            ? `<button class="primary-button table-inline-button password-reset-issue-button" type="button" data-id="${escapeHtml(item.id)}">Emitir codigo</button>`
            : '--',
          className: 'table-col-actions',
        },
      ]),
      emptyTitle: 'Sem solicitacoes.',
      emptyCopy: 'As solicitacoes de recuperacao de senha aparecem aqui.',
      compact: true,
    });
  }

  function renderAccessLogs(items) {
    const container = document.querySelector('#accessLogsList');
    if (!container) return;
    const filtered = items.filter((item) => matchesSearch(
      item,
      elements.accessLogSearch?.value,
      ['full_name', 'cpf', 'event_type', 'method', 'target_path', 'ip_address', 'details'],
    ));
    renderTable({
      container,
      columns: [
        { label: 'Usuario' },
        { label: 'Evento' },
        { label: 'Rota' },
        { label: 'Data' },
        { label: 'Origem' },
        { label: 'Detalhes' },
      ],
      rows: filtered.map((item) => [
        {
          html: `
            <div class="table-identity">
              <strong>${escapeHtml(safe(item.full_name))}</strong>
              <small>${escapeHtml(safe(item.cpf))} • ${escapeHtml(safe(item.role || '--'))}</small>
            </div>`,
        },
        {
          html: `
            <div class="table-stacked">
              ${pill(safe(item.event_type), 'tone-blue')}
              <small>${escapeHtml(safe(item.method || '--'))}</small>
            </div>`,
        },
        {
          html: `
            <div class="table-path">
              <strong>${escapeHtml(safe(item.target_path || '--'))}</strong>
            </div>`,
        },
        { html: escapeHtml(formatTimestamp(item.created_at)) },
        {
          html: `
            <div class="table-stacked">
              <strong>${escapeHtml(safe(item.ip_address || '--'))}</strong>
              <small>${escapeHtml(safe(item.user_agent || '--'))}</small>
            </div>`,
        },
        { html: `<div class="table-wrap">${escapeHtml(safe(item.details || '--'))}</div>` },
      ]),
      emptyTitle: 'Sem registros de acesso.',
      emptyCopy: 'Os eventos de login, logout e navegacao aparecem aqui.',
    });
  }

  function renderSearchLogs(items) {
    const container = document.querySelector('#searchLogsList');
    if (!container) return;
    const filtered = items.filter((item) => matchesSearch(
      item,
      elements.searchLogSearch?.value,
      ['full_name', 'cpf', 'search_type', 'query_text', 'classificacao', 'caixa', 'ano'],
    ));
    renderTable({
      container,
      columns: [
        { label: 'Usuario' },
        { label: 'Tipo' },
        { label: 'Consulta' },
        { label: 'Resultados' },
        { label: 'Filtros' },
        { label: 'Data' },
      ],
      rows: filtered.map((item) => [
        {
          html: `
            <div class="table-identity">
              <strong>${escapeHtml(safe(item.full_name))}</strong>
              <small>${escapeHtml(safe(item.cpf))}</small>
            </div>`,
        },
        { html: pill(safe(item.search_type || 'text'), item.search_type === 'image' ? 'tone-violet' : 'tone-blue') },
        {
          html: `
            <div class="table-stacked">
              <strong>${escapeHtml(safe(item.query_text || '(sem termo)'))}</strong>
              <small>pagina ${escapeHtml(String(item.page || 1))} • tamanho ${escapeHtml(String(item.page_size || 10))}</small>
            </div>`,
        },
        { html: `<strong>${formatNumber(item.result_total || 0)}</strong>` },
        {
          html: `
            <div class="table-stacked">
              <small>Classificacao: ${escapeHtml(safe(item.classificacao || 'todas'))}</small>
              <small>Caixa: ${escapeHtml(safe(item.caixa || 'todas'))}</small>
              <small>Ano: ${escapeHtml(safe(item.ano || 'todos'))}</small>
            </div>`,
        },
        { html: escapeHtml(formatTimestamp(item.created_at)) },
      ]),
      emptyTitle: 'Sem historico de pesquisa.',
      emptyCopy: 'As consultas dos usuarios aparecem aqui.',
    });
  }

  function renderAuditSummary(accessItems, searchItems) {
    if (!elements.auditSummaryStats) return;
    const now = Date.now();
    const within24h = (value) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return Number.isFinite(time) && now - time <= 24 * 60 * 60 * 1000;
    };

    const accessLogs = accessItems || [];
    const searchLogs = searchItems || [];
    const uniqueUsers = new Set(accessLogs.map((item) => item.user_id).filter(Boolean));
    const uniqueIps = new Set(accessLogs.map((item) => item.ip_address).filter(Boolean));
    const searches24h = searchLogs.filter((item) => within24h(item.created_at)).length;
    const access24h = accessLogs.filter((item) => within24h(item.created_at)).length;

    elements.auditSummaryStats.innerHTML = [
      card('Acessos 24h', formatNumber(access24h)),
      card('Pesquisas 24h', formatNumber(searches24h)),
      card('Usuarios rastreados', formatNumber(uniqueUsers.size)),
      card('IPs distintos', formatNumber(uniqueIps.size)),
    ].join('');

    if (elements.auditSummaryFeedback) {
      elements.auditSummaryFeedback.textContent =
        `Auditoria consolidada com ${formatNumber(accessLogs.length)} evento(s) de acesso e ${formatNumber(searchLogs.length)} pesquisa(s) exibidos nesta tela.`;
    }
  }

  function renderLocalLibrary(items, root) {
    if (!elements.localLibraryList) return;
    const filtered = (items || []).filter((item) => matchesSearch(
      item,
      elements.localLibrarySearch?.value,
      ['nome_arquivo', 'descricao', 'caixa', 'mime_type', 'index_status', 'local_relative_path'],
    ));

    if (elements.localLibraryStats) {
      const pdfCount = filtered.filter((item) => String(item.mime_type || '').toLowerCase() === 'application/pdf').length;
      const indexedCount = filtered.filter((item) => item.index_status === 'indexed').length;
      const pendingCount = filtered.filter((item) => item.index_status === 'pending').length;
      elements.localLibraryStats.innerHTML = [
        card('Arquivos locais', formatNumber(filtered.length)),
        card('PDFs locais', formatNumber(pdfCount)),
        card('Indexados', formatNumber(indexedCount)),
        card('Pendentes', formatNumber(pendingCount)),
      ].join('');
    }

    renderTable({
      container: elements.localLibraryList,
      columns: [
        { label: 'Arquivo' },
        { label: 'Pasta / tipo' },
        { label: 'Status' },
        { label: 'Extracao' },
        { label: 'Acesso', className: 'table-col-actions' },
      ],
      rows: filtered.map((item) => [
        {
          html: `
            <div class="table-identity">
              <strong>${escapeHtml(safe(item.nome_arquivo || item.descricao))}</strong>
              <small>${escapeHtml(safe(item.descricao || '--'))}</small>
            </div>`,
        },
        {
          html: `
            <div class="table-stacked">
              <strong>${escapeHtml(safe(item.caixa || 'Acervo local'))}</strong>
              <small>${escapeHtml(safe(item.mime_type || '--'))}</small>
            </div>`,
        },
        {
          html: `
            <div class="table-stacked">
              ${pill(formatQueueStatus(item.index_status), item.index_status === 'indexed' ? 'tone-green' : item.index_status === 'error' ? 'tone-red' : 'tone-blue')}
              <small>${escapeHtml(formatTimestamp(item.updated_at))}</small>
            </div>`,
        },
        {
          html: `
            <div class="table-stacked">
              <strong>${escapeHtml(safe(item.extractor || 'aguardando fila'))}</strong>
              <small>${formatNumber(item.text_length || 0)} caracteres • ${formatNumber(item.page_count || 0)} pagina(s)</small>
            </div>`,
        },
        {
          html: `
            <div class="table-actions">
              <a class="ghost-button table-inline-button" href="${safe(getPrimaryFileUrl(item), '#')}" target="_blank" rel="noreferrer">${getPrimaryFileLabel(item)}</a>
              <a class="ghost-button table-inline-button" href="/document?id=${escapeHtml(String(item.id))}">Detalhes</a>
            </div>`,
          className: 'table-col-actions',
        },
      ]),
      emptyTitle: 'Nenhum arquivo local sincronizado.',
      emptyCopy: `Coloque arquivos em ${root || 'data/local-acervo'} e clique em sincronizar.`,
    });
  }

  function renderMaintenanceInsights(insights) {
    if (!elements.maintenanceInsights) return;
    elements.maintenanceInsights.innerHTML = [
      card('Texto curto', formatNumber(insights.shortIndexed)),
      card('Texto curto em PDF grande', formatNumber(insights.shortMultiPage)),
      card('Sem metodo', formatNumber(insights.nullMethodIndexed)),
      card('Indexados vazios', formatNumber(insights.emptyIndexed)),
      card('Sugestoes para OCR', formatNumber(insights.forceOcrCandidates)),
      card('Falhas em 30 dias', formatNumber(insights.recentErrors30d)),
    ].join('');
  }

  function renderMaintenanceCandidates(items) {
    if (!elements.maintenanceCandidates) return;
    state.maintenanceItems = items;
    elements.maintenanceCandidates.innerHTML = items.length
      ? items.map((item) => `
          <article class="maintenance-card">
            <div class="maintenance-card-head">
              <h4>${safe(item.descricao || item.nome_arquivo)}</h4>
              <span class="chip">${safe(item.last_index_method || 'sem metodo')}</span>
            </div>
            <p class="muted-copy">${safe(item.classificacao)} - Caixa ${safe(item.caixa)} - ${safe(item.ano)}</p>
            <div class="meta-chips">
              <span class="chip">texto: ${formatNumber(item.text_length || 0)}</span>
              <span class="chip">paginas: ${formatNumber(item.page_count || 0)}</span>
              <span class="chip">tentativas: ${formatNumber(item.index_attempts || 0)}</span>
              <span class="chip">status: ${safe(item.index_status)}</span>
            </div>
            ${item.index_error ? `<p class="error-copy">${safe(item.index_error)}</p>` : ''}
            <div class="failure-links">
              <a href="${safe(getPrimaryFileUrl(item), '#')}" target="_blank" rel="noreferrer">${getPrimaryFileLabel(item)}</a>
              <a href="${safe(getReferenceUrl(item), '#')}" target="_blank" rel="noreferrer">${getReferenceLabel(item)}</a>
            </div>
          </article>`).join('')
      : `<article class="empty-card"><h4>Nenhum candidato encontrado.</h4><p class="muted-copy">A fila selecionada nao retornou itens com o criterio atual.</p></article>`;
  }

  function renderTextCleanupCandidates(items) {
    if (!elements.textCleanupCandidates) return;
    elements.textCleanupCandidates.innerHTML = items.length
      ? items.map((item) => `
          <article class="maintenance-card">
            <div class="maintenance-card-head">
              <h4>${safe(item.descricao || item.nome_arquivo)}</h4>
              <span class="chip">score ${Number(item.qualityScore || 0).toFixed(2)}</span>
            </div>
            <p class="muted-copy">${safe(item.classificacao)} - Caixa ${safe(item.caixa)} - ${safe(item.ano)} - ${formatNumber(item.page_count || 0)} paginas</p>
            <div class="meta-chips">
              <span class="chip">antes: ${formatNumber(item.text_length || 0)} chars</span>
              <span class="chip">ajuste: ${item.deltaLength >= 0 ? '+' : ''}${formatNumber(item.deltaLength || 0)}</span>
              <span class="chip">${safe(item.profile)}</span>
            </div>
            <div class="cleanup-preview-grid">
              <div class="cleanup-preview-box">
                <span>Trecho atual</span>
                <p>${escapeHtml(safe(item.beforeSnippet))}</p>
              </div>
              <div class="cleanup-preview-box">
                <span>Como ficara</span>
                <p>${escapeHtml(safe(item.afterSnippet))}</p>
              </div>
            </div>
          </article>`).join('')
      : `<article class="empty-card"><h4>Nenhum texto precisou ajuste.</h4><p class="muted-copy">O preview atual nao encontrou mudancas relevantes para aplicar.</p></article>`;
  }

  function renderEnrichmentResults(items) {
    if (!elements.enrichmentResults) return;
    elements.enrichmentResults.innerHTML = items.length
      ? items.map((item) => `
          <article class="maintenance-card">
            <div class="maintenance-card-head">
              <h4>Documento ${formatNumber(item.documentId || 0)}</h4>
              <span class="chip">${item.error ? 'erro' : 'ok'}</span>
            </div>
            ${item.summary?.text ? `<p class="result-summary">${escapeHtml(item.summary.text)}</p>` : ''}
            ${item.previewImage?.relativePath ? `<div class="meta-chips"><span class="chip">miniatura ${escapeHtml(item.previewImage.relativePath)}</span></div>` : ''}
            ${item.error ? `<p class="error-copy">${escapeHtml(item.error)}</p>` : ''}
          </article>`).join('')
      : `<article class="empty-card"><h4>Nenhum enriquecimento executado.</h4><p class="muted-copy">Salve a configuracao e rode um lote para gerar resumos e miniaturas.</p></article>`;
  }

  function renderEnrichmentModels(items) {
    if (!elements.enrichmentModelOptions) return;
    elements.enrichmentModelOptions.innerHTML = (items || [])
      .map((item) => `<option value="${escapeHtml(item)}"></option>`)
      .join('');
  }

  function getEnrichmentModelsKey() {
    return `${safe(elements.enrichmentProvider?.value, '')}::${safe(elements.enrichmentBaseUrl?.value, '')}`;
  }

  function markEnrichmentDirty(value = true) {
    state.enrichmentDirty = value;
  }

  async function refreshRuntime() {
    const tasks = [];
    if (elements.indexerStatusMode || elements.indexFailuresList || currentPage === 'dashboard') {
      tasks.push(fetchJson('/api/admin/indexer-status').then((value) => ['indexerStatus', value]));
    }
    if (elements.indexerQueueList) {
      const params = new URLSearchParams({
        limit: '40',
        search: safe(elements.indexerQueueSearch?.value, ''),
        status: safe(elements.indexerQueueFilter?.value, 'all'),
      });
      tasks.push(fetchJson(`/api/admin/indexer-queue?${params.toString()}`).then((value) => ['indexerQueue', value]));
    }
    if (elements.downloadStatusMode || currentPage === 'dashboard') {
      tasks.push(fetchJson('/api/admin/download-status').then((value) => ['downloadStatus', value]));
    }
    if (elements.indexFailuresList) {
      tasks.push(fetchJson('/api/admin/index-failures?limit=30').then((value) => ['failures', value]));
    }
    if (elements.userList) {
      tasks.push(fetchJson('/api/admin/users').then((value) => ['users', value]));
    }
    if (elements.passwordResetRequestList) {
      tasks.push(fetchJson('/api/admin/password-reset-requests?limit=80').then((value) => ['passwordResetRequests', value]));
    }
    if (document.querySelector('#accessLogsList') || elements.auditSummaryStats) {
      tasks.push(fetchJson('/api/admin/activity/access-logs?limit=80').then((value) => ['accessLogs', value]));
    }
    if (document.querySelector('#searchLogsList') || elements.auditSummaryStats) {
      tasks.push(fetchJson('/api/admin/activity/search-logs?limit=80').then((value) => ['searchLogs', value]));
    }
    if (elements.localLibraryList) {
      tasks.push(fetchJson('/api/admin/local-library?limit=500').then((value) => ['localLibrary', value]));
    }

    const entries = await Promise.all(tasks);
    state.runtime = Object.fromEntries(entries);

    if (state.runtime.indexerStatus) {
      renderIndexerStatus(state.runtime.indexerStatus);
    }
    if (state.runtime.indexerQueue) {
      renderIndexerQueue(state.runtime.indexerQueue);
    }
    if (state.runtime.downloadStatus) {
      renderDownloadStatus(state.runtime.downloadStatus);
    }
    if (state.runtime.failures) {
      renderFailures(state.runtime.failures.items || []);
    }
    if (state.runtime.users) {
      renderUsers(state.runtime.users.items || []);
    }
    if (state.runtime.passwordResetRequests) {
      renderPasswordResetRequests(state.runtime.passwordResetRequests.items || []);
    }
    if (state.runtime.accessLogs) {
      renderAccessLogs(state.runtime.accessLogs.items || []);
    }
    if (state.runtime.searchLogs) {
      renderSearchLogs(state.runtime.searchLogs.items || []);
    }
    if (state.runtime.localLibrary) {
      renderLocalLibrary(state.runtime.localLibrary.items || [], state.runtime.localLibrary.root || '');
    }
    if (elements.auditSummaryStats) {
      renderAuditSummary(state.runtime.accessLogs?.items || [], state.runtime.searchLogs?.items || []);
    }
  }

  async function refreshStatsAndSettings() {
    const tasks = [];
    if (elements.configStats || currentPage === 'dashboard') {
      tasks.push(fetchJson('/api/documents/stats').then((value) => ['stats', value]));
      tasks.push(fetchJson('/api/admin/database-status').then((value) => ['databaseStrategy', value]));
    }
    if (elements.autoIndexOnDetailView || elements.enrichmentProvider) {
      tasks.push(fetchJson('/api/admin/settings').then((value) => ['settings', value]));
    }
    if (elements.maintenanceInsights) {
      tasks.push(fetchJson('/api/admin/maintenance/insights').then((value) => ['maintenanceInsights', value]));
    }
    if (elements.enrichmentStats) {
      tasks.push(fetchJson('/api/admin/enrichment/status').then((value) => ['enrichmentStats', value]));
    }

    const entries = await Promise.all(tasks);
    const data = Object.fromEntries(entries);

    if (data.stats) {
      renderStats(data.stats);
    }
    if (data.databaseStrategy) {
      renderDatabaseStrategy(data.databaseStrategy);
    }
    if (data.settings && elements.autoIndexOnDetailView) {
      elements.autoIndexOnDetailView.checked = Boolean(data.settings.autoIndexOnDetailView);
      if (elements.localLibraryAutoSync) {
        elements.localLibraryAutoSync.checked = Boolean(data.settings.localLibraryAutoSync);
      }
    }
    if (data.settings && elements.enrichmentProvider && !state.enrichmentDirty) {
      elements.enrichmentProvider.value = data.settings.enrichmentProvider || 'disabled';
      elements.enrichmentModel.value = data.settings.enrichmentModel || '';
      elements.enrichmentOverwritePreviewImages.checked = Boolean(data.settings.enrichmentOverwritePreviewImages);
      elements.enrichmentOverwriteSummary.checked = Boolean(data.settings.enrichmentOverwriteSummary);
      elements.enrichmentProcessMode.value = data.settings.enrichmentProcessMode || 'both';
      elements.enrichmentPreviewImageCount.value = String(data.settings.enrichmentPreviewImageCount || 1);
      elements.enrichmentPreviewImageQuality.value = data.settings.enrichmentPreviewImageQuality || 'balanced';
      elements.enrichmentBaseUrl.value = data.settings.enrichmentBaseUrl || '';
      elements.enrichmentApiKey.value = data.settings.enrichmentApiKey || '';
      elements.enrichmentBatchLimit.value = String(data.settings.enrichmentBatchLimit || 5);
      elements.enrichmentSummaryEnabled.checked = Boolean(data.settings.enrichmentSummaryEnabled);
      elements.enrichmentPreviewImagesEnabled.checked = Boolean(data.settings.enrichmentPreviewImagesEnabled);
      const enrichmentKey = getEnrichmentModelsKey();
      if (
        currentPage === 'enrichment' &&
        elements.enrichmentBaseUrl.value &&
        elements.enrichmentProvider.value !== 'disabled' &&
        state.enrichmentModelsKey !== enrichmentKey
      ) {
        loadEnrichmentModels().catch(() => {});
      }
    }
    if (data.maintenanceInsights) {
      renderMaintenanceInsights(data.maintenanceInsights);
    }
    if (data.enrichmentStats) {
      renderEnrichmentStats(data.enrichmentStats);
    }
  }

  async function previewMaintenance() {
    const result = await fetchJson(`/api/admin/maintenance/candidates?${new URLSearchParams({
      strategy: elements.maintenanceStrategy.value,
      limit: elements.maintenanceLimit.value,
    })}`);
    renderMaintenanceInsights(result.insights || {});
    renderMaintenanceCandidates(result.items || []);
    return result;
  }

  async function runMaintenance(action) {
    const result = await runPost('/api/admin/maintenance/run', {
      action,
      limit: Number(elements.maintenanceLimit.value || 10),
      mode: elements.maintenanceMode.value,
      resetAttempts: elements.maintenanceResetAttempts.checked,
      strategy: elements.maintenanceStrategy.value,
    });
    renderMaintenanceInsights(result.insights || {});
    renderMaintenanceCandidates(result.items || []);
    return result;
  }

  async function previewTextCleanup() {
    const result = await fetchJson(`/api/admin/text-cleanup/preview?${new URLSearchParams({
      limit: elements.textCleanupLimit.value,
      sampleSize: elements.textCleanupSampleSize.value,
      strategy: elements.textCleanupStrategy.value,
    })}`);
    renderTextCleanupCandidates(result.items || []);
    return result;
  }

  async function runTextCleanup() {
    const result = await runPost('/api/admin/text-cleanup/run', {
      limit: Number(elements.textCleanupLimit.value || 10),
      sampleSize: Number(elements.textCleanupSampleSize.value || 200),
      strategy: elements.textCleanupStrategy.value,
    });
    renderTextCleanupCandidates(result.items || []);
    return result;
  }

  async function saveEnrichmentSettings() {
    const result = await runPost('/api/admin/settings', {
      enrichmentApiKey: elements.enrichmentApiKey.value,
      enrichmentBatchLimit: Number(elements.enrichmentBatchLimit.value || 5),
      enrichmentBaseUrl: elements.enrichmentBaseUrl.value,
      enrichmentModel: elements.enrichmentModel.value,
      enrichmentOverwritePreviewImages: elements.enrichmentOverwritePreviewImages.checked,
      enrichmentOverwriteSummary: elements.enrichmentOverwriteSummary.checked,
      enrichmentProcessMode: elements.enrichmentProcessMode.value,
      enrichmentPreviewImageCount: Number(elements.enrichmentPreviewImageCount.value || 1),
      enrichmentPreviewImageQuality: elements.enrichmentPreviewImageQuality.value,
      enrichmentPreviewImagesEnabled: elements.enrichmentPreviewImagesEnabled.checked,
      enrichmentProvider: elements.enrichmentProvider.value,
      enrichmentSummaryEnabled: elements.enrichmentSummaryEnabled.checked,
    });
    markEnrichmentDirty(false);
    await refreshStatsAndSettings();
    return result;
  }

  async function runEnrichment() {
    const result = await runPost('/api/admin/enrichment/start', {
      batchLimit: Number(elements.enrichmentBatchLimit.value || 5),
    });
    await refreshStatsAndSettings();
    renderEnrichmentResults(result.items || []);
    return result;
  }

  async function stopEnrichment() {
    return runPost('/api/admin/enrichment/stop');
  }

  async function loadEnrichmentModels() {
    const result = await fetchJson(`/api/admin/enrichment/models?${new URLSearchParams({
      baseUrl: elements.enrichmentBaseUrl.value,
      provider: elements.enrichmentProvider.value,
    })}`);
    renderEnrichmentModels(result.models || []);
    state.enrichmentModelsKey = getEnrichmentModelsKey();
    return result;
  }

  function fillUserForm(item) {
    elements.userEditId.value = String(item.id || '');
    elements.userFullName.value = item.full_name || '';
    elements.userCpf.value = item.cpf || '';
    elements.userRole.value = item.role || 'user';
    elements.userIsActive.value = item.is_active ? 'true' : 'false';
    elements.userMustChangePassword.value = item.must_change_password ? 'true' : 'false';
    elements.userPassword.value = '';
  }

  function resetUserForm() {
    if (!elements.userEditId) return;
    elements.userEditId.value = '';
    elements.userFullName.value = '';
    elements.userCpf.value = '';
    elements.userRole.value = 'user';
    elements.userIsActive.value = 'true';
    elements.userMustChangePassword.value = 'true';
    elements.userPassword.value = '';
  }

  function bindEvents() {
    document.querySelectorAll('.config-nav-collapsible').forEach((group) => {
      const toggle = group.querySelector('.config-nav-toggle');
      if (!toggle || toggle.dataset.bound === 'true') return;
      toggle.dataset.bound = 'true';
      toggle.addEventListener('click', () => {
        const collapsed = group.dataset.collapsed === 'true';
        group.dataset.collapsed = collapsed ? 'false' : 'true';
        toggle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
      });
    });

    if (elements.logoutButton) {
      elements.logoutButton.addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
          window.location.assign('/login');
        }
      });
    }

    if (elements.refreshStats) {
      elements.refreshStats.addEventListener('click', async () => {
      const feedback = getFeedbackElement(elements.configFeedback);
      feedback.textContent = 'Atualizando estatisticas...';
        try {
          await refreshStatsAndSettings();
          feedback.textContent = 'Estatisticas atualizadas.';
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.syncCatalog) {
      elements.syncCatalog.addEventListener('click', async () => {
      const feedback = getFeedbackElement(elements.configFeedback);
      feedback.textContent = 'Sincronizando catalogo...';
        try {
          const result = await runPost('/api/admin/sync-catalog');
          await refreshStatsAndSettings();
          feedback.textContent = `Catalogo sincronizado: ${formatNumber(result.totalUnicos)} unicos importados.`;
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.autoIndexOnDetailView) {
      elements.autoIndexOnDetailView.addEventListener('change', async (event) => {
      const feedback = getFeedbackElement(elements.configFeedback);
      feedback.textContent = 'Salvando configuracao...';
        try {
          const result = await runPost('/api/admin/settings', {
            autoIndexOnDetailView: event.target.checked,
          });
          event.target.checked = Boolean(result.autoIndexOnDetailView);
          feedback.textContent = result.autoIndexOnDetailView
            ? 'Autoindexacao em pagina de detalhe ativada.'
            : 'Autoindexacao em pagina de detalhe desativada.';
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.localLibraryAutoSync) {
      elements.localLibraryAutoSync.addEventListener('change', async (event) => {
        const feedback = getFeedbackElement(elements.configFeedback);
        feedback.textContent = 'Salvando configuracao...';
        try {
          const result = await runPost('/api/admin/settings', {
            localLibraryAutoSync: event.target.checked,
          });
          event.target.checked = Boolean(result.localLibraryAutoSync);
          feedback.textContent = result.localLibraryAutoSync
            ? 'Sincronizacao automatica do acervo local ativada.'
            : 'Sincronizacao automatica do acervo local desativada.';
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.reindexStart) {
      elements.reindexStart.addEventListener('click', async () => {
      const feedback = getFeedbackElement(elements.indexerStatusText, elements.configFeedback);
      feedback.textContent = 'Iniciando indexacao...';
        try {
          await runPost('/api/admin/reindex/start', {
            batchLimit: Number(elements.batchLimit.value || 10),
          fullProcessIfNeeded: elements.fullProcessToggle ? elements.fullProcessToggle.checked : true,
          mode: elements.indexMode.value,
          retryFailures: elements.retryFailuresToggle.checked,
          });
          await refreshRuntime();
          feedback.textContent = 'Indexacao iniciada.';
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.reindexStop) {
      elements.reindexStop.addEventListener('click', async () => {
      const feedback = getFeedbackElement(elements.indexerStatusText, elements.configFeedback);
      feedback.textContent = 'Solicitando parada...';
        try {
          await runPost('/api/admin/reindex/stop');
          await refreshRuntime();
          feedback.textContent = 'Parada solicitada.';
        } catch (error) {
          feedback.textContent = error.message;
        }
      });
    }

    if (elements.indexerQueueRefresh) {
      elements.indexerQueueRefresh.addEventListener('click', async () => {
        elements.indexerQueueFeedback.textContent = 'Atualizando detalhes da fila...';
        try {
          await refreshRuntime();
          elements.indexerQueueFeedback.textContent = 'Fila atualizada.';
        } catch (error) {
          elements.indexerQueueFeedback.textContent = error.message;
        }
      });
    }

    if (elements.indexerQueueFilter) {
      elements.indexerQueueFilter.addEventListener('change', async () => {
        elements.indexerQueueFeedback.textContent = 'Aplicando filtro da fila...';
        try {
          await refreshRuntime();
          elements.indexerQueueFeedback.textContent = 'Filtro aplicado.';
        } catch (error) {
          elements.indexerQueueFeedback.textContent = error.message;
        }
      });
    }

    if (elements.indexerQueueSearch) {
      elements.indexerQueueSearch.addEventListener('input', () => {
        if (state.indexerQueueSearchHandle) {
          clearTimeout(state.indexerQueueSearchHandle);
        }
        state.indexerQueueSearchHandle = setTimeout(() => {
          elements.indexerQueueFeedback.textContent = 'Buscando na fila...';
          refreshRuntime()
            .then(() => {
              elements.indexerQueueFeedback.textContent = 'Busca aplicada.';
            })
            .catch((error) => {
              elements.indexerQueueFeedback.textContent = error.message;
            });
        }, 260);
      });
    }

    [
      elements.userSearch,
      elements.passwordResetSearch,
      elements.accessLogSearch,
      elements.searchLogSearch,
      elements.localLibrarySearch,
      elements.indexFailureSearch,
      elements.indexerBatchSearch,
      elements.indexerOperationSearch,
    ].filter(Boolean).forEach((input) => {
      input.addEventListener('input', () => {
        rerenderFilteredViews();
      });
    });

    if (elements.indexerQueueAddButton) {
      elements.indexerQueueAddButton.addEventListener('click', async () => {
        elements.indexerQueueFeedback.textContent = 'Adicionando item na fila...';
        try {
          await runPost('/api/admin/reindex/queue-add', {
            documentId: Number(elements.indexerQueueManualId.value || 0),
          });
          elements.indexerQueueManualId.value = '';
          await refreshRuntime();
          elements.indexerQueueFeedback.textContent = 'Item adicionado na fila.';
        } catch (error) {
          elements.indexerQueueFeedback.textContent = error.message;
        }
      });
    }

    if (elements.indexerQueueManualId) {
      elements.indexerQueueManualId.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          elements.indexerQueueAddButton?.click();
        }
      });
    }

    if (elements.indexerQueueList) {
      elements.indexerQueueList.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('.queue-action-button');
        if (!actionButton) return;

        elements.indexerQueueFeedback.textContent = 'Atualizando item da fila...';
        try {
          await runPost(`/api/admin/reindex/queue-item/${actionButton.dataset.id}`, {
            action: actionButton.dataset.action,
          });
          await refreshRuntime();
          elements.indexerQueueFeedback.textContent =
            actionButton.dataset.action === 'pause' ? 'Item removido da fila.' : 'Item reenfileirado.';
        } catch (error) {
          elements.indexerQueueFeedback.textContent = error.message;
        }
      });
    }

    if (elements.userSaveButton) {
      elements.userSaveButton.addEventListener('click', async () => {
        elements.userManagementFeedback.textContent = 'Salvando usuario...';
        try {
          const payload = {
            cpf: elements.userCpf.value,
            fullName: elements.userFullName.value,
            isActive: elements.userIsActive.value === 'true',
            mustChangePassword: elements.userMustChangePassword.value === 'true',
            password: elements.userPassword.value,
            role: elements.userRole.value,
          };
          if (elements.userEditId.value) {
            await fetch(`/api/admin/users/${elements.userEditId.value}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            }).then(async (response) => {
              if (response.status === 401 || response.status === 403) {
                window.location.assign('/login');
                throw new Error('Sessao expirada.');
              }
              const result = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(result.error || `Falha na requisicao: ${response.status}`);
              return result;
            });
            elements.userManagementFeedback.textContent = 'Usuario atualizado.';
          } else {
            await runPost('/api/admin/users', payload);
            elements.userManagementFeedback.textContent = 'Usuario cadastrado.';
          }
          resetUserForm();
          await refreshRuntime();
        } catch (error) {
          elements.userManagementFeedback.textContent = error.message;
        }
      });
    }

    if (elements.userResetButton) {
      elements.userResetButton.addEventListener('click', () => {
        resetUserForm();
        elements.userManagementFeedback.textContent = 'Formulario limpo.';
      });
    }

    if (elements.userList) {
      elements.userList.addEventListener('click', (event) => {
        const editButton = event.target.closest('.user-edit-button');
        if (!editButton) return;
        const item = (state.runtime?.users?.items || []).find((candidate) => String(candidate.id) === editButton.dataset.id);
        if (!item) return;
        fillUserForm(item);
        elements.userManagementFeedback.textContent = `Editando usuario ${item.cpf}.`;
      });
    }

    if (elements.passwordResetRequestList) {
      elements.passwordResetRequestList.addEventListener('click', async (event) => {
        const issueButton = event.target.closest('.password-reset-issue-button');
        if (!issueButton) return;
        elements.userManagementFeedback.textContent = 'Emitindo codigo temporario...';
        try {
          const result = await runPost(`/api/admin/password-reset-requests/${issueButton.dataset.id}/issue`, {});
          elements.userManagementFeedback.textContent = `Codigo emitido: ${result.code}`;
          await refreshRuntime();
        } catch (error) {
          elements.userManagementFeedback.textContent = error.message;
        }
      });
    }

    if (elements.downloadStart) {
      elements.downloadStart.addEventListener('click', async () => {
        elements.downloadActionFeedback.textContent = 'Preparando fila de downloads...';
        try {
          await runPost('/api/admin/downloads/start', {
          concurrency: Number(elements.downloadConcurrency.value || 3),
          destinationDir: elements.downloadDestinationDir.value.trim() || 'data/local-acervo',
          overwrite: elements.downloadOverwrite.checked,
          retryCount: Number(elements.downloadRetryCount.value || 2),
          timeoutMs: Number(elements.downloadTimeoutMs.value || 30000),
        });
        await refreshRuntime();
        elements.downloadActionFeedback.textContent = 'Downloads iniciados.';
        } catch (error) {
          elements.downloadActionFeedback.textContent = error.message;
        }
      });
    }

    if (elements.downloadStop) {
      elements.downloadStop.addEventListener('click', async () => {
        elements.downloadActionFeedback.textContent = 'Solicitando parada dos downloads...';
        try {
          await runPost('/api/admin/downloads/stop');
        await refreshRuntime();
        elements.downloadActionFeedback.textContent = 'Parada solicitada.';
        } catch (error) {
          elements.downloadActionFeedback.textContent = error.message;
        }
      });
    }

    if (elements.maintenancePreview) {
      elements.maintenancePreview.addEventListener('click', async () => {
        elements.maintenanceFeedback.textContent = 'Analisando fila de tratamento...';
        try {
          const result = await previewMaintenance();
        elements.maintenanceFeedback.textContent = `${formatNumber((result.items || []).length)} candidato(s) analisados para ${elements.maintenanceStrategy.options[elements.maintenanceStrategy.selectedIndex].textContent.toLowerCase()}.`;
        } catch (error) {
          elements.maintenanceFeedback.textContent = error.message;
        }
      });
    }

    if (elements.maintenanceClear) {
      elements.maintenanceClear.addEventListener('click', async () => {
        elements.maintenanceFeedback.textContent = 'Limpando candidatos e devolvendo para pendente...';
        try {
          const result = await runMaintenance('clear_to_pending');
        elements.maintenanceFeedback.textContent = `${formatNumber(result.processed || 0)} grupo(s) limpos e reenfileirados.`;
        await refreshRuntime();
        } catch (error) {
          elements.maintenanceFeedback.textContent = error.message;
        }
      });
    }

    if (elements.maintenanceReprocess) {
      elements.maintenanceReprocess.addEventListener('click', async () => {
        elements.maintenanceFeedback.textContent = 'Limpando e reprocessando candidatos...';
        try {
          const result = await runMaintenance('reprocess_now');
        const successCount = (result.results || []).filter((item) => item.status === 'indexed').length;
        const errorCount = (result.results || []).filter((item) => item.status === 'error').length;
        elements.maintenanceFeedback.textContent = `${formatNumber(successCount)} sucesso(s) e ${formatNumber(errorCount)} erro(s) no reprocessamento imediato.`;
        await refreshRuntime();
        } catch (error) {
          elements.maintenanceFeedback.textContent = error.message;
        }
      });
    }

    if (elements.textCleanupPreview) {
      elements.textCleanupPreview.addEventListener('click', async () => {
        elements.textCleanupFeedback.textContent = 'Gerando preview de saneamento textual...';
        try {
          const result = await previewTextCleanup();
          elements.textCleanupFeedback.textContent = `${formatNumber((result.items || []).length)} texto(s) com ajuste sugerido.`;
        } catch (error) {
          elements.textCleanupFeedback.textContent = error.message;
        }
      });
    }

    if (elements.textCleanupRun) {
      elements.textCleanupRun.addEventListener('click', async () => {
        elements.textCleanupFeedback.textContent = 'Aplicando limpeza no texto indexado...';
        try {
          const result = await runTextCleanup();
          elements.textCleanupFeedback.textContent = `${formatNumber(result.processed || 0)} texto(s) atualizados no banco e no indice.`;
        } catch (error) {
          elements.textCleanupFeedback.textContent = error.message;
        }
      });
    }

    if (elements.enrichmentSave) {
      elements.enrichmentSave.addEventListener('click', async () => {
        elements.enrichmentFeedback.textContent = 'Salvando configuracoes de IA e midia...';
        try {
          await saveEnrichmentSettings();
          if (elements.enrichmentProvider.value === 'local' || elements.enrichmentProvider.value === 'cloud') {
            await loadEnrichmentModels().catch(() => {});
          }
          elements.enrichmentFeedback.textContent = 'Configuracoes salvas.';
        } catch (error) {
          elements.enrichmentFeedback.textContent = error.message;
        }
      });
    }

    if (elements.enrichmentProvider) {
      elements.enrichmentProvider.addEventListener('change', async () => {
        markEnrichmentDirty(true);
        renderEnrichmentModels([]);
        state.enrichmentModelsKey = '';
        if (elements.enrichmentProvider.value === 'local' && elements.enrichmentBaseUrl.value.trim()) {
          elements.enrichmentFeedback.textContent = 'Consultando modelos locais...';
          try {
            const result = await loadEnrichmentModels();
            if (result.models?.length && !elements.enrichmentModel.value) {
              [elements.enrichmentModel.value] = result.models;
            }
            elements.enrichmentFeedback.textContent = result.models?.length
              ? `${formatNumber(result.models.length)} modelo(s) encontrados automaticamente.`
              : 'Nenhum modelo encontrado automaticamente.';
          } catch (error) {
            elements.enrichmentFeedback.textContent = error.message;
          }
        }
      });
    }

    if (elements.enrichmentBaseUrl) {
      elements.enrichmentBaseUrl.addEventListener('change', async () => {
        markEnrichmentDirty(true);
        renderEnrichmentModels([]);
        state.enrichmentModelsKey = '';
        if (elements.enrichmentProvider.value === 'local' && elements.enrichmentBaseUrl.value.trim()) {
          elements.enrichmentFeedback.textContent = 'Consultando modelos locais...';
          try {
            const result = await loadEnrichmentModels();
            if (result.models?.length && !elements.enrichmentModel.value) {
              [elements.enrichmentModel.value] = result.models;
            }
            elements.enrichmentFeedback.textContent = result.models?.length
              ? `${formatNumber(result.models.length)} modelo(s) encontrados automaticamente.`
              : 'Nenhum modelo encontrado automaticamente.';
          } catch (error) {
            elements.enrichmentFeedback.textContent = error.message;
          }
        }
      });
    }

    if (elements.enrichmentModel) {
      elements.enrichmentModel.addEventListener('input', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentApiKey) {
      elements.enrichmentApiKey.addEventListener('input', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentSummaryEnabled) {
      elements.enrichmentSummaryEnabled.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentOverwriteSummary) {
      elements.enrichmentOverwriteSummary.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentPreviewImagesEnabled) {
      elements.enrichmentPreviewImagesEnabled.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentOverwritePreviewImages) {
      elements.enrichmentOverwritePreviewImages.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentPreviewImageCount) {
      elements.enrichmentPreviewImageCount.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentPreviewImageQuality) {
      elements.enrichmentPreviewImageQuality.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentBatchLimit) {
      elements.enrichmentBatchLimit.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentProcessMode) {
      elements.enrichmentProcessMode.addEventListener('change', () => markEnrichmentDirty(true));
    }

    if (elements.enrichmentLoadModels) {
      elements.enrichmentLoadModels.addEventListener('click', async () => {
        elements.enrichmentFeedback.textContent = 'Consultando modelos disponiveis...';
        try {
          const result = await loadEnrichmentModels();
          if (result.models?.length && !elements.enrichmentModel.value) {
            [elements.enrichmentModel.value] = result.models;
          }
          elements.enrichmentFeedback.textContent = result.models?.length
            ? `${formatNumber(result.models.length)} modelo(s) encontrados em ${safe(result.endpoint)}.`
            : `Nenhum modelo encontrado em ${safe(result.endpoint)}.`;
        } catch (error) {
          elements.enrichmentFeedback.textContent = error.message;
        }
      });
    }

    if (elements.enrichmentRun) {
      elements.enrichmentRun.addEventListener('click', async () => {
        elements.enrichmentFeedback.textContent = 'Executando enriquecimento do acervo...';
        try {
          const result = await runEnrichment();
          elements.enrichmentFeedback.textContent = `Fila iniciada com lote de ${formatNumber(result.batchLimit || elements.enrichmentBatchLimit.value || 5)} item(ns).`;
        } catch (error) {
          elements.enrichmentFeedback.textContent = error.message;
        }
      });
    }

    if (elements.enrichmentStop) {
      elements.enrichmentStop.addEventListener('click', async () => {
        elements.enrichmentFeedback.textContent = 'Solicitando parada da fila de IA...';
        try {
          await stopEnrichment();
          await refreshStatsAndSettings();
          elements.enrichmentFeedback.textContent = 'Parada solicitada.';
        } catch (error) {
          elements.enrichmentFeedback.textContent = error.message;
        }
      });
    }

    if (elements.localLibrarySync) {
      elements.localLibrarySync.addEventListener('click', async () => {
        elements.localLibraryFeedback.textContent = 'Sincronizando pasta local com o acervo...';
        try {
          const result = await runPost('/api/admin/local-library/sync');
          await refreshRuntime();
          elements.localLibraryFeedback.textContent =
            `${formatNumber(result.totalFiles || 0)} arquivo(s) sincronizados a partir de ${safe(result.root)}.`;
        } catch (error) {
          elements.localLibraryFeedback.textContent = error.message;
        }
      });
    }
  }

  async function init() {
    if (elements.configLead && !elements.configLead.textContent.trim()) {
      elements.configLead.textContent = 'Ferramentas internas de indexacao, download, logs e tratamento de acervo.';
    }
    elements.configPanel.classList.remove('hidden');
    bindEvents();
    await Promise.all([
      refreshStatsAndSettings(),
      refreshRuntime(),
      elements.maintenanceCandidates ? previewMaintenance() : Promise.resolve(),
      elements.textCleanupCandidates ? previewTextCleanup() : Promise.resolve(),
    ]);
    let statsTick = 0;
    state.pollHandle = setInterval(() => {
      refreshRuntime().catch(() => {});
      statsTick += 1;
      if (statsTick >= 4) {
        statsTick = 0;
        refreshStatsAndSettings().catch(() => {});
      }
    }, currentPage === 'indexing' ? 1000 : 2000);
  }

  window.addEventListener('beforeunload', () => {
    if (state.pollHandle) clearInterval(state.pollHandle);
  });

  init().catch(() => {
    elements.configLead.textContent = 'Falha ao abrir configuracao.';
  });
})();
