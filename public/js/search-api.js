(function attachSearchApi(global) {
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

  async function fetchStats() {
    return fetchJson('/api/documents/stats');
  }

  async function fetchFilters() {
    return fetchJson('/api/documents/filters');
  }

  async function fetchSearch(params) {
    const query = new URLSearchParams({
      ano: params.ano || '',
      caixa: params.caixa || '',
      classificacao: params.classificacao || '',
      onlyIndexed: String(Boolean(params.onlyIndexed)),
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 10),
      q: params.q || '',
    });
    return fetchJson(`/api/search?${query.toString()}`);
  }

  async function fetchImageSearch(imageDataUrl, pageSize = 10) {
    const response = await fetch('/api/search/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        pageSize,
      }),
    });
    if (!response.ok) {
      if (response.status === 428) {
        window.location.assign('/security');
        throw new Error('Troca de senha obrigatoria.');
      }
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/login');
        throw new Error('Sessao expirada.');
      }
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Falha ao analisar a imagem: ${response.status}`);
    }
    return response.json();
  }

  global.AcervoSearchApi = {
    fetchFilters,
    fetchImageSearch,
    fetchSearch,
    fetchStats,
  };
})(window);
