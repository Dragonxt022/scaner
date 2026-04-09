(function attachSearchController(global) {
  const { fetchFilters, fetchImageSearch, fetchSearch, fetchStats } = global.AcervoSearchApi;
  const { renderResults, renderStats, setSearchLoading, updateSearchMode } = global.AcervoSearchRender;
  const { buildOption, inferSearchIntent, scrollToTop } = global.AcervoSearchUtils;

  function createElements() {
    return {
      advancedFilters: document.querySelector('#advancedFilters'),
      advancedToggle: document.querySelector('#advancedToggle'),
      bottomPager: document.querySelector('#bottomPager'),
      boxFilter: document.querySelector('#boxFilter'),
      brandHome: document.querySelector('#brandHome'),
      classificationFilter: document.querySelector('#classificationFilter'),
      clearFilters: document.querySelector('#clearFilters'),
      configEntry: document.querySelector('#configEntry'),
      heroCard: document.querySelector('#heroCard'),
      heroCopy: document.querySelector('#heroCopy'),
      imageResults: document.querySelector('#imageResults'),
      imageSearchInput: document.querySelector('#imageSearchInput'),
      imageSearchPreview: document.querySelector('#imageSearchPreview'),
      imageSearchToggle: document.querySelector('#imageSearchToggle'),
      indexedOnlyToggle: document.querySelector('#indexedOnlyToggle'),
      layout: document.querySelector('#layout'),
      nextPage: document.querySelector('#nextPage'),
      pageInfo: document.querySelector('#pageInfo'),
      pageSize: document.querySelector('#pageSize'),
      pageShell: document.querySelector('#pageShell'),
      prevPage: document.querySelector('#prevPage'),
      queryPrediction: document.querySelector('#queryPrediction'),
      resultsHeader: document.querySelector('#resultsHeader'),
      resultsContext: document.querySelector('#resultsContext'),
      resultsList: document.querySelector('#resultsList'),
      searchForm: document.querySelector('#searchForm'),
      searchInput: document.querySelector('#searchInput'),
      searchLoadingState: document.querySelector('#searchLoadingState'),
      searchTabs: document.querySelector('#searchTabs'),
      searchTabButtons: [...document.querySelectorAll('.search-tab')],
      utilityPanel: document.querySelector('#utilityPanel'),
      yearFilter: document.querySelector('#yearFilter'),
    };
  }

  function createState() {
    return {
      activeTab: 'all',
      advancedOpen: false,
      filtersLoaded: false,
      hasSubmittedSearch: false,
      pendingInference: null,
      pendingVisionSearch: false,
      lastSearch: null,
      page: 1,
      pageSize: 10,
      requestSerial: 0,
      restoringHistory: false,
      searchDebounce: null,
      searchLoading: false,
      stats: null,
    };
  }

  function setAdvancedFiltersOpen(elements, state, open) {
    state.advancedOpen = Boolean(open);
    elements.advancedFilters.classList.toggle('hidden', !state.advancedOpen);
    elements.advancedToggle.classList.toggle('active', state.advancedOpen);
    elements.advancedToggle.setAttribute('aria-label', state.advancedOpen ? 'Ocultar filtros' : 'Abrir filtros');
    elements.advancedToggle.setAttribute('title', state.advancedOpen ? 'Ocultar filtros' : 'Abrir filtros');
  }

  function openConfigArea() {
    window.open('/config', '_blank', 'noopener');
  }

  function readStateFromDom(elements) {
    return {
      advanced: elements.advancedFilters && !elements.advancedFilters.classList.contains('hidden'),
      ano: elements.yearFilter.value,
      caixa: elements.boxFilter.value,
      classificacao: elements.classificationFilter.value,
      onlyIndexed: elements.indexedOnlyToggle.checked,
      page: Number(elements.pageInfo?.dataset.page || 1) || 1,
      pageSize: Number(elements.pageSize.value || 10) || 10,
      q: elements.searchInput.value.trim(),
    };
  }

  function buildUrlFromState(snapshot) {
    const params = new URLSearchParams();
    if (snapshot.tab && snapshot.tab !== 'all') params.set('tab', snapshot.tab);
    if (snapshot.q) params.set('q', snapshot.q);
    if (snapshot.classificacao) params.set('classificacao', snapshot.classificacao);
    if (snapshot.caixa) params.set('caixa', snapshot.caixa);
    if (snapshot.ano) params.set('ano', snapshot.ano);
    if (snapshot.onlyIndexed) params.set('onlyIndexed', 'true');
    if (snapshot.page && snapshot.page > 1) params.set('page', String(snapshot.page));
    if (snapshot.pageSize && snapshot.pageSize !== 10) params.set('pageSize', String(snapshot.pageSize));
    if (snapshot.advanced) params.set('advanced', 'true');
    const query = params.toString();
    return query ? `/?${query}` : '/';
  }

  function pushHistoryState(elements, state, replace = false) {
    const snapshot = {
      advanced: state.advancedOpen,
      ano: elements.yearFilter.value,
      caixa: elements.boxFilter.value,
      classificacao: elements.classificationFilter.value,
      onlyIndexed: elements.indexedOnlyToggle.checked,
      page: state.page,
      pageSize: state.pageSize,
      q: elements.searchInput.value.trim(),
      tab: state.activeTab,
    };
    const url = buildUrlFromState(snapshot);
    if (replace) {
      window.history.replaceState(snapshot, '', url);
      return;
    }
    window.history.pushState(snapshot, '', url);
  }

  function parseStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
      advanced: params.get('advanced') === 'true',
      ano: params.get('ano') || '',
      caixa: params.get('caixa') || '',
      classificacao: params.get('classificacao') || '',
      onlyIndexed: params.get('onlyIndexed') === 'true',
      page: Math.max(1, Number(params.get('page') || 1) || 1),
      pageSize: Math.max(1, Number(params.get('pageSize') || 10) || 10),
      q: params.get('q') || '',
      tab: params.get('tab') || 'all',
    };
  }

  function applyStateToDom(elements, state, snapshot) {
    elements.searchInput.value = snapshot.q || '';
    elements.classificationFilter.value = snapshot.classificacao || '';
    elements.boxFilter.value = snapshot.caixa || '';
    elements.yearFilter.value = snapshot.ano || '';
    elements.indexedOnlyToggle.checked = Boolean(snapshot.onlyIndexed);
    elements.pageSize.value = String(snapshot.pageSize || 10);
    state.page = Math.max(1, Number(snapshot.page || 1) || 1);
    state.pageSize = Number(snapshot.pageSize || 10) || 10;
    state.activeTab = snapshot.tab || 'all';
    setAdvancedFiltersOpen(elements, state, Boolean(snapshot.advanced));
  }

  async function loadFilters(elements, state) {
    if (state.filtersLoaded) return;
    const filters = await fetchFilters();
    buildOption(elements.classificationFilter, filters.classificacoes, 'Todas');
    buildOption(elements.boxFilter, filters.caixas, 'Todas');
    buildOption(elements.yearFilter, filters.anos, 'Todos');
    state.filtersLoaded = true;
  }

  async function runSearch(elements, state) {
    const payload = {
      ano: elements.yearFilter.value,
      caixa: elements.boxFilter.value,
      classificacao: elements.classificationFilter.value,
      onlyIndexed: elements.indexedOnlyToggle.checked,
      page: state.page,
      pageSize: state.pageSize,
      q: elements.searchInput.value.trim(),
    };
    const initialSearch = await fetchSearch(payload);
    const intent = inferSearchIntent(payload.q);

    if (payload.q && intent.inferred && !initialSearch.items.length) {
      const inferredSearch = await fetchSearch({
        ...payload,
        q: intent.normalizedQuery,
      });
      if (inferredSearch.items.length) {
        return {
          ...inferredSearch,
          originalQuery: payload.q,
          usedInferredQuery: true,
        };
      }
    }

    return {
      ...initialSearch,
      inference: intent.inferred ? intent : null,
      originalQuery: payload.q,
      usedInferredQuery: false,
    };
  }

  async function refreshSearchOnly(elements, state, options = {}) {
    const requestId = ++state.requestSerial;
    await loadFilters(elements, state);
    setSearchLoading(elements, state, true);

    try {
      const search = await runSearch(elements, state);
      if (requestId !== state.requestSerial) return;
      state.lastSearch = search;
      renderStats(elements, search.stats, state, search);
      renderResults(elements, state, search);
      updateSearchMode(elements, state, search);
      if (!options.skipHistory && !state.restoringHistory) {
        pushHistoryState(elements, state, Boolean(options.replaceHistory));
      }
    } finally {
      if (requestId === state.requestSerial) {
        setSearchLoading(elements, state, false);
      }
    }
  }

  async function refreshAll(elements, state, options = {}) {
    await loadFilters(elements, state);
    if (!state.hasSubmittedSearch && !options.force) {
      renderStats(elements, await fetchStats(), state, null);
      updateSearchMode(elements, state, null);
      return;
    }
    await refreshSearchOnly(elements, state, options);
  }

  function rerenderCurrentView(elements, state) {
    if (!state.lastSearch) return;
    renderStats(elements, state.lastSearch.stats, state, state.lastSearch);
    renderResults(elements, state, state.lastSearch);
    updateSearchMode(elements, state, state.lastSearch);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem selecionada.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Nao foi possivel abrir a imagem selecionada.'));
      image.src = dataUrl;
    });
  }

  async function cropImageDataUrl(dataUrl) {
    const image = await loadImage(dataUrl);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, Math.floor((image.naturalWidth - side) / 2));
    const sourceY = Math.max(0, Math.floor((image.naturalHeight - side) / 2));
    const outputSize = Math.min(1024, side || 1024);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, outputSize, outputSize);
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  function renderImagePreview(elements, dataUrl, options = {}) {
    if (!elements.imageSearchPreview) return;
    if (!dataUrl) {
      elements.imageSearchPreview.classList.add('hidden');
      elements.imageSearchPreview.innerHTML = '';
      return;
    }

    const label = options.label || 'Imagem usada na busca';
    const extractedText = String(options.extractedText || '').trim();
    const usedQuery = String(options.usedQuery || '').trim();
    const sourceLabel = options.usedExtractedText === false
      ? 'Consulta final usada'
      : 'Busca feita pelo texto extraido';
    const extractedTextHtml = extractedText
      ? `
        <div class="image-search-preview-text">
          <span>Texto extraido da imagem</span>
          <p>${extractedText}</p>
        </div>
      `
      : '';
    const usedQueryHtml = usedQuery
      ? `
        <div class="image-search-preview-text image-search-preview-query">
          <span>${sourceLabel}</span>
          <p>${usedQuery}</p>
        </div>
      `
      : '';

    elements.imageSearchPreview.innerHTML = `
      <div class="image-search-preview-card">
        <img src="${dataUrl}" alt="${label}" />
        <div class="image-search-preview-copy">
          <strong>${label}</strong>
          <span>Recorte automatico aplicado antes da analise com IA.</span>
          ${extractedTextHtml}
          ${usedQueryHtml}
        </div>
      </div>
    `;
    elements.imageSearchPreview.classList.remove('hidden');
  }

  async function executeImageSearch(elements, state, rawDataUrl) {
    state.pendingVisionSearch = true;
    elements.queryPrediction.classList.remove('hidden');
    elements.queryPrediction.innerHTML = '<span class="query-prediction-action static">Analisando imagem com IA...</span>';

    try {
      const croppedDataUrl = await cropImageDataUrl(rawDataUrl);
      renderImagePreview(elements, croppedDataUrl);
      const result = await fetchImageSearch(croppedDataUrl, state.pageSize);
      renderImagePreview(elements, croppedDataUrl, {
        extractedText: result.extractedText,
        label: 'Imagem enviada para OCR',
        usedExtractedText: result.usedExtractedText,
        usedQuery: result.usedQuery || result.query,
      });
      elements.searchInput.value = result.query;
      state.hasSubmittedSearch = true;
      state.page = 1;
      state.lastSearch = result.search;
      elements.queryPrediction.classList.remove('hidden');
      elements.queryPrediction.innerHTML = `
        <span class="query-prediction-action static">
          ${result.usedExtractedText ? 'Busca feita com texto extraido da imagem.' : `Texto extraido sem resultado direto; busca refinada para "${result.query}".`}
        </span>
      `;
      renderStats(elements, result.search.stats, state, result.search);
      renderResults(elements, state, result.search);
      updateSearchMode(elements, state, result.search);
      pushHistoryState(elements, state);
      scrollToTop();
    } catch (error) {
      elements.queryPrediction.classList.remove('hidden');
      elements.queryPrediction.innerHTML = `<span class="query-prediction-action static error">${error.message}</span>`;
    } finally {
      state.pendingVisionSearch = false;
    }
  }

  function renderPrediction(elements, state) {
    if (!elements.queryPrediction) return;
    const rawQuery = elements.searchInput.value.trim();
    const intent = inferSearchIntent(rawQuery);
    state.pendingInference = intent.inferred ? intent : null;

      if (!intent.inferred || !rawQuery) {
        elements.queryPrediction.classList.add('hidden');
        elements.queryPrediction.innerHTML = '';
        return;
    }

    elements.queryPrediction.innerHTML = `
      <button class="query-prediction-action" type="button" data-use-prediction="true">
        Tentar busca inteligente por "${intent.normalizedQuery}"
      </button>
    `;
    elements.queryPrediction.classList.remove('hidden');
  }

  async function refreshStatusOnly(elements, state) {
    try {
      renderStats(elements, await fetchStats(), state, state.lastSearch);
    } catch {}
  }

  function scheduleRefresh(elements, state) {
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(() => {
      refreshSearchOnly(elements, state).catch(() => {
        setSearchLoading(elements, state, false);
        elements.resultsList.innerHTML =
          '<article class="empty-card"><h4>Nao foi possivel carregar os resultados.</h4><p class="muted-copy">Tente novamente.</p></article>';
      });
    }, 120);
  }

  async function restoreFromHistory(elements, state, snapshot) {
    state.restoringHistory = true;
    try {
      await loadFilters(elements, state);
      applyStateToDom(elements, state, snapshot);
      await refreshSearchOnly(elements, state, { skipHistory: true });
    } finally {
      state.restoringHistory = false;
    }
  }

  function bindEvents(elements, state) {
    elements.searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      state.hasSubmittedSearch = true;
      state.page = 1;
      await refreshSearchOnly(elements, state);
      scrollToTop();
    });

    elements.searchInput.addEventListener('input', () => {
      renderPrediction(elements, state);
    });

    [elements.classificationFilter, elements.boxFilter, elements.yearFilter, elements.indexedOnlyToggle].forEach((element) => {
      element.addEventListener('input', async () => {
        if (!state.hasSubmittedSearch) return;
        state.page = 1;
        await refreshSearchOnly(elements, state);
        scrollToTop();
      });
    });

    elements.pageSize.addEventListener('change', async () => {
      if (!state.hasSubmittedSearch) return;
      state.pageSize = Number(elements.pageSize.value);
      state.page = 1;
      await refreshSearchOnly(elements, state);
      scrollToTop();
    });

    elements.prevPage.addEventListener('click', async () => {
      if (state.page > 1) {
        state.page -= 1;
        await refreshSearchOnly(elements, state);
        scrollToTop();
      }
    });

    elements.nextPage.addEventListener('click', async () => {
      state.page += 1;
      await refreshSearchOnly(elements, state);
      scrollToTop();
    });

    elements.clearFilters.addEventListener('click', async () => {
      elements.searchInput.value = '';
      elements.classificationFilter.value = '';
      elements.boxFilter.value = '';
      elements.yearFilter.value = '';
      elements.indexedOnlyToggle.checked = false;
      elements.pageSize.value = '10';
      state.activeTab = 'all';
      state.hasSubmittedSearch = false;
      state.pageSize = 10;
      state.page = 1;
      setAdvancedFiltersOpen(elements, state, false);
      await refreshAll(elements, state);
      scrollToTop();
    });

    elements.searchTabButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const nextTab = button.dataset.tab || 'all';
        if (nextTab === state.activeTab) return;
        const previousTab = state.activeTab;
        state.activeTab = nextTab;

        if (nextTab === 'indexed') {
          state.hasSubmittedSearch = true;
          if (!elements.indexedOnlyToggle.checked) {
            elements.indexedOnlyToggle.checked = true;
          }
          state.page = 1;
          await refreshSearchOnly(elements, state);
          return;
        }

        if (previousTab === 'indexed' && elements.indexedOnlyToggle.checked) {
          elements.indexedOnlyToggle.checked = false;
          state.page = 1;
          await refreshSearchOnly(elements, state);
          return;
        }

        rerenderCurrentView(elements, state);
        pushHistoryState(elements, state);
      });
    });

    elements.advancedToggle.addEventListener('click', () => {
      setAdvancedFiltersOpen(elements, state, !state.advancedOpen);
      pushHistoryState(elements, state);
    });

    elements.imageSearchToggle?.addEventListener('click', () => {
      elements.imageSearchInput?.click();
    });

    elements.imageSearchInput?.addEventListener('change', async (event) => {
      const [file] = [...(event.target.files || [])];
      if (!file) return;
      try {
        const imageDataUrl = await readFileAsDataUrl(file);
        await executeImageSearch(elements, state, imageDataUrl);
      } finally {
        event.target.value = '';
      }
    });

    elements.searchInput.addEventListener('paste', async (event) => {
      const clipboardItems = [...(event.clipboardData?.items || [])];
      const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const imageDataUrl = await readFileAsDataUrl(file);
      await executeImageSearch(elements, state, imageDataUrl);
    });

    elements.queryPrediction?.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-use-prediction]');
      if (!trigger || !state.pendingInference) return;
      elements.searchInput.value = state.pendingInference.normalizedQuery;
      state.hasSubmittedSearch = true;
      state.page = 1;
      renderPrediction(elements, state);
      await refreshSearchOnly(elements, state);
      scrollToTop();
    });

    elements.configEntry.addEventListener('click', openConfigArea);

    window.addEventListener('popstate', async (event) => {
      const snapshot = event.state || parseStateFromUrl();
      state.hasSubmittedSearch = Boolean(snapshot.q || snapshot.classificacao || snapshot.caixa || snapshot.ano || snapshot.onlyIndexed || snapshot.page > 1);
      await restoreFromHistory(elements, state, snapshot);
    });
  }

  async function init() {
    const elements = createElements();
    const state = createState();
    bindEvents(elements, state);
    await loadFilters(elements, state);
    const initialState = parseStateFromUrl();
    state.hasSubmittedSearch = Boolean(initialState.q || initialState.classificacao || initialState.caixa || initialState.ano || initialState.onlyIndexed || initialState.page > 1);
    applyStateToDom(elements, state, initialState);
    renderPrediction(elements, state);
    await refreshAll(elements, state, { force: state.hasSubmittedSearch, replaceHistory: true });
    setInterval(() => {
      refreshStatusOnly(elements, state).catch(() => {});
    }, 2000);
  }

  global.AcervoSearchController = { init, openConfigArea };
})(window);
