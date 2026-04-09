(function bootstrapHistoryPage() {
  const elements = {
    feedback: document.querySelector('#myHistoryFeedback'),
    list: document.querySelector('#myHistoryList'),
    search: document.querySelector('#myHistorySearch'),
  };

  const state = {
    items: [],
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

  function normalizeText(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function render() {
    const term = normalizeText(elements.search?.value);
    const items = !term
      ? state.items
      : state.items.filter((item) => [
          item.query_text,
          item.search_type,
          item.classificacao,
          item.caixa,
          item.ano,
        ].some((field) => normalizeText(field).includes(term)));

    if (!items.length) {
      elements.list.innerHTML = `
        <div class="table-empty">
          <strong>Nenhuma pesquisa encontrada.</strong>
          <p>Quando voce pesquisar no sistema, o historico aparecera aqui.</p>
        </div>`;
      elements.feedback.textContent = 'Nenhum registro localizado com o filtro atual.';
      return;
    }

    elements.list.innerHTML = `
      <table class="data-table data-table-compact">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Consulta</th>
            <th>Resultados</th>
            <th>Classificacao</th>
            <th>Caixa/Ano</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHtml(formatTimestamp(item.created_at))}</td>
              <td>${escapeHtml(item.search_type || '--')}</td>
              <td>${escapeHtml(item.query_text || '(sem termo)')}</td>
              <td>${formatNumber(item.result_total || 0)}</td>
              <td>${escapeHtml(item.classificacao || 'todas classificacoes')}</td>
              <td>${escapeHtml(`${item.caixa || 'todas caixas'} / ${item.ano || 'todos anos'}`)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    elements.feedback.textContent = `${formatNumber(items.length)} pesquisa(s) propria(s) exibida(s).`;
  }

  async function init() {
    const response = await fetch('/api/search/history?limit=200');
    if (response.status === 401 || response.status === 403) {
      window.location.assign('/login');
      return;
    }
    if (!response.ok) {
      throw new Error(`Falha ao carregar historico: ${response.status}`);
    }
    const payload = await response.json();
    state.items = payload.items || [];
    render();
  }

  elements.search?.addEventListener('input', render);

  init().catch((error) => {
    elements.feedback.textContent = error.message;
  });
})();
