(function bootstrapMonitorPage() {
  const elements = {
    accessChart: document.querySelector('#monitorAccessChart'),
    accessTable: document.querySelector('#monitorAccessTable'),
    feedback: document.querySelector('#monitorFeedback'),
    kpis: document.querySelector('#monitorKpis'),
    refresh: document.querySelector('#monitorRefresh'),
    runtimeTable: document.querySelector('#monitorRuntimeTable'),
    searchChart: document.querySelector('#monitorSearchChart'),
    searchTable: document.querySelector('#monitorSearchTable'),
    usageChart: document.querySelector('#monitorUsageChart'),
  };

  const state = {
    pollHandle: null,
  };

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

  async function fetchJson(url) {
    const response = await fetch(url);
    if (response.status === 401 || response.status === 403) {
      window.location.assign('/login');
      throw new Error('Sessao expirada.');
    }
    if (!response.ok) {
      throw new Error(`Falha ao carregar ${url}: ${response.status}`);
    }
    return response.json();
  }

  function buildMinuteSeries(items, fieldName) {
    const now = new Date();
    now.setSeconds(0, 0);
    const buckets = [];
    for (let index = 59; index >= 0; index -= 1) {
      const bucketTime = new Date(now.getTime() - index * 60 * 1000);
      buckets.push({
        key: bucketTime.toISOString().slice(0, 16),
        label: bucketTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        value: 0,
      });
    }

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    (items || []).forEach((item) => {
      const date = new Date(item[fieldName]);
      if (Number.isNaN(date.getTime())) return;
      date.setSeconds(0, 0);
      const key = date.toISOString().slice(0, 16);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.value += 1;
    });

    return buckets;
  }

  function renderSparkline(container, title, color, series) {
    if (!container) return;
    const width = 900;
    const height = 220;
    const maxValue = Math.max(1, ...series.map((item) => item.value));
    const points = series.map((item, index) => {
      const x = (index / Math.max(1, series.length - 1)) * (width - 40) + 20;
      const y = height - 30 - ((item.value / maxValue) * (height - 70));
      return `${x},${y}`;
    }).join(' ');

    const labels = [0, 15, 30, 45, 59].map((index) => series[index]).filter(Boolean);

    container.innerHTML = `
      <div class="chart-card">
        <div class="chart-head">
          <strong>${escapeHtml(title)}</strong>
          <span>Pico ${formatNumber(maxValue)}/min</span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          <polyline class="chart-line-grid" points="20,20 20,190 880,190" />
          <polyline class="chart-line" style="--chart-color:${color}" points="${points}" />
          ${labels.map((item, index) => `
            <text x="${20 + (index / Math.max(1, labels.length - 1)) * (width - 40)}" y="${height - 8}" text-anchor="middle">${escapeHtml(item.label)}</text>
          `).join('')}
        </svg>
      </div>`;
  }

  function renderTable(container, columns, rows, emptyMessage) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div class="table-empty"><strong>Sem dados.</strong><p>${escapeHtml(emptyMessage)}</p></div>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table data-table-compact">
        <thead>
          <tr>${columns.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderKpis({ accessItems, searchItems, stats, indexerStatus, downloadStatus, enrichmentStatus }) {
    const searches5m = buildMinuteSeries(searchItems, 'created_at').slice(-5).reduce((total, item) => total + item.value, 0);
    const accesses5m = buildMinuteSeries(accessItems, 'created_at').slice(-5).reduce((total, item) => total + item.value, 0);
    const activeUsers = new Set(accessItems.slice(0, 120).map((item) => item.user_id).filter(Boolean)).size;
    elements.kpis.innerHTML = [
      { label: 'Acessos 5 min', value: formatNumber(accesses5m) },
      { label: 'Pesquisas 5 min', value: formatNumber(searches5m) },
      { label: 'Usuarios ativos na trilha', value: formatNumber(activeUsers) },
      { label: 'Pendentes', value: formatNumber(stats?.pendentes || 0) },
      { label: 'Indexador', value: indexerStatus?.active ? 'Executando' : 'Parado' },
      { label: 'Downloads', value: downloadStatus?.active ? 'Executando' : 'Parado' },
      { label: 'IA', value: enrichmentStatus?.runtime?.active ? 'Executando' : 'Parado' },
      { label: 'Falhas', value: formatNumber(stats?.falhas || 0) },
    ].map((item) => `
      <article class="monitor-kpi">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>`).join('');
  }

  async function refresh() {
    elements.feedback.textContent = 'Atualizando monitor...';
    const [accessLogs, searchLogs, indexerStatus, downloadStatus, enrichmentStatus, stats] = await Promise.all([
      fetchJson('/api/admin/activity/access-logs?limit=500'),
      fetchJson('/api/admin/activity/search-logs?limit=500'),
      fetchJson('/api/admin/indexer-status'),
      fetchJson('/api/admin/download-status'),
      fetchJson('/api/admin/enrichment/status'),
      fetchJson('/api/documents/stats'),
    ]);

    const accessItems = accessLogs.items || [];
    const searchItems = searchLogs.items || [];
    const accessSeries = buildMinuteSeries(accessItems, 'created_at');
    const searchSeries = buildMinuteSeries(searchItems, 'created_at');
    const usageSeries = accessSeries.map((bucket, index) => ({
      ...bucket,
      value: bucket.value + (searchSeries[index]?.value || 0),
    }));

    renderKpis({
      accessItems,
      searchItems,
      stats,
      indexerStatus,
      downloadStatus,
      enrichmentStatus,
    });

    renderSparkline(elements.usageChart, 'Eventos totais por minuto', '#0f766e', usageSeries);
    renderSparkline(elements.accessChart, 'Acessos por minuto', '#2563eb', accessSeries);
    renderSparkline(elements.searchChart, 'Pesquisas por minuto', '#7c3aed', searchSeries);

    renderTable(
      elements.runtimeTable,
      ['Motor', 'Status', 'Detalhe'],
      [
        [
          'Indexador',
          escapeHtml(indexerStatus.active ? 'Executando' : indexerStatus.stopRequested ? 'Parando' : 'Parado'),
          escapeHtml(`${formatNumber(indexerStatus.processedTotal || 0)} processados / ${formatNumber(indexerStatus.queue?.pendingContentGroups || 0)} pendentes`),
        ],
        [
          'Downloads',
          escapeHtml(downloadStatus.active ? 'Executando' : downloadStatus.stopRequested ? 'Parando' : 'Parado'),
          escapeHtml(`${formatNumber(downloadStatus.processedFiles || 0)} processados / ${formatNumber(downloadStatus.pendingFiles || 0)} pendentes`),
        ],
        [
          'Enriquecimento',
          escapeHtml(enrichmentStatus.runtime?.active ? 'Executando' : enrichmentStatus.runtime?.stopRequested ? 'Parando' : 'Parado'),
          escapeHtml(`${formatNumber(enrichmentStatus.runtime?.processedTotal || 0)} processados / gargalo ${enrichmentStatus.runtime?.bottleneckStage || '--'}`),
        ],
      ],
      'Os estados operacionais aparecem aqui.',
    );

    renderTable(
      elements.accessTable,
      ['Data', 'Usuario', 'Evento', 'Pagina', 'IP'],
      accessItems.slice(0, 20).map((item) => [
        escapeHtml(formatTimestamp(item.created_at)),
        escapeHtml(item.full_name || '--'),
        escapeHtml(item.event_type || '--'),
        escapeHtml(item.target_path || '--'),
        escapeHtml(item.ip_address || '--'),
      ]),
      'Os acessos recentes aparecem aqui.',
    );

    renderTable(
      elements.searchTable,
      ['Data', 'Usuario', 'Tipo', 'Consulta', 'Resultados'],
      searchItems.slice(0, 20).map((item) => [
        escapeHtml(formatTimestamp(item.created_at)),
        escapeHtml(item.full_name || '--'),
        escapeHtml(item.search_type || '--'),
        escapeHtml(item.query_text || '(sem termo)'),
        escapeHtml(formatNumber(item.result_total || 0)),
      ]),
      'As pesquisas recentes aparecem aqui.',
    );

    elements.feedback.textContent = `Atualizado em ${formatTimestamp(new Date().toISOString())}.`;
  }

  elements.refresh?.addEventListener('click', () => {
    refresh().catch((error) => {
      elements.feedback.textContent = error.message;
    });
  });

  refresh().catch((error) => {
    elements.feedback.textContent = error.message;
  });

  state.pollHandle = setInterval(() => {
    refresh().catch(() => {});
  }, 5000);

  window.addEventListener('beforeunload', () => {
    if (state.pollHandle) clearInterval(state.pollHandle);
  });
})();
