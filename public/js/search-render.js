(function attachSearchRender(global) {
  const { escapeHtml, formatNumber, highlightTerms, safeText } = global.AcervoSearchUtils;

  function buildResultIcon(item) {
    const text = `${safeText(item.classificacao, '')} ${safeText(item.nome_arquivo, '')}`.toLowerCase();
    if (text.includes('pdf')) return 'pdf';
    if (text.includes('contrat')) return 'ctr';
    if (text.includes('licit')) return 'lic';
    if (text.includes('saude')) return 'sau';
    return 'doc';
  }

  function getPrimaryFileUrl(item) {
    return item.local_file_url || item.pdf_url || '#';
  }

  function buildResultDomain(item) {
    if (item.source_kind === 'local' || item.local_relative_path) {
      return 'arquivo local';
    }
    try {
      return new URL(item.pdf_url).hostname.replace(/^www\./, '');
    } catch {
      return 'documento';
    }
  }

  function buildSearchContext(search) {
    const hasQuery = Boolean((search?.query || '').trim());
    if (!hasQuery) {
      return 'Explore o acervo documental e refine a navegacao pelos filtros quando precisar.';
    }

    if (search?.usedInferredQuery && search?.originalQuery && search?.query) {
      return `Exibindo resultados para "${safeText(search.query, '')}" com base na intencao detectada em "${safeText(search.originalQuery, '')}".`;
    }

    return `${formatNumber(search.total || 0)} resultado(s) para "${safeText(search.query, '')}".`;
  }

  function buildImagesContext(search) {
    const count = (search?.items || []).filter((item) => item.preview_image_path).length;
    if (!count) {
      return 'Nenhuma imagem encontrada nesta pagina de resultados.';
    }
    return `${formatNumber(count)} miniatura(s) de documentos encontradas nesta pagina.`;
  }

  function formatPanelCopy(text) {
    return safeText(text || '', '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildHeroCopy(stats, search) {
    const hasQuery = Boolean((search?.query || '').trim());
    if (!hasQuery) {
      return `${formatNumber(stats.totalDocumentos)} registros, ${formatNumber(stats.pdfsUnicos)} PDFs unicos e ${formatNumber(stats.indexados)} documentos ja indexados para busca textual.`;
    }

    return `Mostrando ${formatNumber(search.items?.length || 0)} item(ns) nesta pagina entre ${formatNumber(search.total || 0)} resultado(s) encontrados no acervo.`;
  }

  function getVisibleItems(state, search) {
    const items = search?.items || [];
    if (state.activeTab === 'images') {
      return items.filter((item) => item.preview_image_path);
    }
    if (state.activeTab === 'summary') {
      return items.filter((item) => String(item.summary || '').trim());
    }
    return items;
  }

  function renderStats(elements, stats, state, search) {
    state.stats = stats;
    elements.heroCopy.textContent = buildHeroCopy(stats, search);
    if (elements.resultsContext) {
      elements.resultsContext.textContent = buildSearchContext(search);
    }
  }

  function renderEmptyState(elements, message) {
    elements.resultsList.innerHTML =
      `<article class="empty-card"><h4>${escapeHtml(message)}</h4><p class="muted-copy">Ajuste os filtros ou tente outros termos.</p></article>`;
    if (elements.imageResults) {
      elements.imageResults.classList.add('hidden');
      elements.imageResults.innerHTML = '';
    }
    if (elements.utilityPanel) {
      elements.utilityPanel.classList.add('hidden');
      elements.utilityPanel.innerHTML = '';
    }
  }

  function renderUtilityPanel(elements, search) {
    if (!elements.utilityPanel) return;
    const visualItems = (search.items || []).filter((item) => item.preview_image_path).slice(0, 4);
    const topItem = search.items?.[0];
    const relatedItems = (search.items || []).slice(1, 5);

    if (!topItem && !visualItems.length) {
      elements.utilityPanel.classList.add('hidden');
      elements.utilityPanel.innerHTML = '';
      return;
    }

    const gallery = visualItems.length
      ? `
        <section class="panel-card visual-gallery-card">
          <div class="section-head">
            <div>
              <p class="panel-kicker">Imagens relacionadas</p>
              <h3>Visao rapida do acervo</h3>
            </div>
          </div>
          <div class="visual-gallery-grid">
            ${visualItems.map((item) => `
              <a class="visual-gallery-item" href="/document?id=${encodeURIComponent(item.id)}">
                <img src="/media/previews/${escapeHtml(item.preview_image_path)}" alt="${escapeHtml(safeText(item.descricao || item.nome_arquivo))}" loading="lazy" />
                <span>${escapeHtml(safeText(item.descricao || item.nome_arquivo))}</span>
              </a>
            `).join('')}
          </div>
        </section>
      `
      : '';

    const spotlight = topItem
      ? `
        <section class="panel-card spotlight-card">
          <p class="panel-kicker">Destaque da pesquisa</p>
          <h3>${escapeHtml(safeText(topItem.descricao || topItem.nome_arquivo))}</h3>
          ${topItem.preview_image_path ? `<img src="/media/previews/${escapeHtml(topItem.preview_image_path)}" alt="${escapeHtml(safeText(topItem.descricao || topItem.nome_arquivo))}" loading="lazy" />` : ''}
          <p class="spotlight-copy">${escapeHtml(formatPanelCopy(topItem.summary || topItem.snippet || topItem.previewText || 'Sem resumo enriquecido para este documento.'))}</p>
          <div class="meta-chips">
            <span class="chip">${escapeHtml(safeText(topItem.classificacao))}</span>
            <span class="chip">Caixa ${escapeHtml(safeText(topItem.caixa))}</span>
            <span class="chip">${escapeHtml(safeText(topItem.ano))}</span>
          </div>
          <div class="result-actions">
            <a href="/document?id=${encodeURIComponent(topItem.id)}">Abrir detalhes</a>
            <a href="${escapeHtml(getPrimaryFileUrl(topItem))}" target="_blank" rel="noreferrer">${topItem.source_kind === 'local' || topItem.local_relative_path ? 'Abrir arquivo' : 'Abrir PDF'}</a>
          </div>
        </section>
      `
      : '';

    const related = relatedItems.length
      ? `
        <section class="panel-card related-results-card">
          <div class="section-head">
            <div>
              <p class="panel-kicker">Mais resultados</p>
              <h3>Continue explorando</h3>
            </div>
          </div>
          <div class="related-results-list">
            ${relatedItems.map((item) => `
              <a class="related-result-item" href="/document?id=${encodeURIComponent(item.id)}">
                ${item.preview_image_path ? `<img src="/media/previews/${escapeHtml(item.preview_image_path)}" alt="${escapeHtml(safeText(item.descricao || item.nome_arquivo))}" loading="lazy" />` : '<span class="related-result-thumb fallback">DOC</span>'}
                <span class="related-result-copy">
                  <strong>${escapeHtml(safeText(item.descricao || item.nome_arquivo))}</strong>
                  <small>${escapeHtml(safeText(item.classificacao))} · ${escapeHtml(safeText(item.ano))}</small>
                </span>
              </a>
            `).join('')}
          </div>
        </section>
      `
      : '';

    elements.utilityPanel.innerHTML = `${spotlight}${related}${gallery}`;
    elements.utilityPanel.classList.remove('hidden');
  }

  function buildSkeletonCards(count = 5) {
    return Array.from({ length: count }, (_, index) => `
      <article class="result-card result-card-skeleton" aria-hidden="true">
        <div class="result-main">
          <div class="result-head">
            <div class="result-source">
              <span class="result-icon skeleton-box"></span>
              <div class="result-site">
                <div class="skeleton-line skeleton-line-small"></div>
                <div class="skeleton-line skeleton-line-medium"></div>
              </div>
            </div>
          </div>
          <div class="skeleton-line skeleton-line-title ${index === 0 ? 'skeleton-line-title-large' : ''}"></div>
          <div class="skeleton-line skeleton-line-wide"></div>
          <div class="skeleton-line skeleton-line-wide"></div>
          <div class="skeleton-line skeleton-line-medium"></div>
          <div class="result-actions">
            <span class="skeleton-chip"></span>
            <span class="skeleton-chip"></span>
            <span class="skeleton-chip"></span>
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderResults(elements, state, search) {
    const { items, page, query, totalPages } = search;
    const visibleItems = getVisibleItems(state, search);

    if (!items.length) {
      elements.bottomPager.classList.add('hidden');
      renderEmptyState(elements, query ? 'Nenhum documento encontrado para esta pesquisa.' : 'Nenhum documento disponivel.');
      return;
    }

    if (!visibleItems.length) {
      const tabMessages = {
        images: 'Nenhuma imagem encontrada nesta pagina de resultados.',
        summary: 'Nenhum resumo enriquecido encontrado nesta pagina.',
      };
      elements.resultsList.innerHTML =
        `<article class="empty-card"><h4>${escapeHtml(tabMessages[state.activeTab] || 'Nenhum resultado visivel neste modo.')}</h4><p class="muted-copy">Mude de aba, ajuste a busca ou avance a pagina.</p></article>`;
      if (elements.imageResults) {
        elements.imageResults.innerHTML = '<article class="empty-card"><h4>Nenhuma imagem nesta pagina.</h4><p class="muted-copy">Abra a aba Tudo ou avance a pagina para procurar outras miniaturas.</p></article>';
      }
      elements.pageInfo.dataset.page = String(page);
      elements.pageInfo.textContent = `Pagina ${page} de ${formatNumber(totalPages)}`;
      elements.prevPage.disabled = page <= 1;
      elements.nextPage.disabled = page >= totalPages;
      elements.bottomPager.classList.toggle('hidden', totalPages <= 1);
      elements.utilityPanel?.classList.add('hidden');
      return;
    }

    elements.resultsList.innerHTML = visibleItems
      .map((item, index) => {
        const resultDomain = buildResultDomain(item);
        const icon = buildResultIcon(item);
        const detailUrl = `/document?id=${encodeURIComponent(item.id)}`;
        const snippetHtml = item.previewText
          ? highlightTerms(item.snippet || item.previewText, query)
          : '<span class="muted-copy">Sem trecho relevante disponivel para este documento.</span>';
        const previewImageHtml = item.preview_image_path
          ? `<div class="result-thumbnail"><a href="${escapeHtml(detailUrl)}"><img src="/media/previews/${escapeHtml(item.preview_image_path)}" alt="Preview do documento" loading="lazy" /></a></div>`
          : '';
        const featuredClass = index === 0 ? ' result-card-featured' : '';
        const visualClass = item.preview_image_path ? ' has-visual' : '';

        return `
          <article class="result-card${featuredClass}${visualClass}" data-result-id="${escapeHtml(String(item.id))}">
            <div class="result-main">
              <div class="result-head">
                <div class="result-source">
                  <span class="result-icon">${escapeHtml(icon)}</span>
                  <div class="result-site">
                    <div class="result-domain">${escapeHtml(resultDomain)}</div>
                    <div class="result-url">${escapeHtml(safeText(item.classificacao))} - Caixa ${escapeHtml(safeText(item.caixa))} - ${escapeHtml(safeText(item.ano))}</div>
                  </div>
                </div>
              </div>

              <a class="result-title" href="${escapeHtml(detailUrl)}">${escapeHtml(safeText(item.descricao || item.nome_arquivo))}</a>
              <p class="result-summary">${escapeHtml(safeText(item.summary || item.nome_arquivo))}</p>
              <p class="result-snippet">${snippetHtml}</p>

              <div class="result-actions">
                <a href="${escapeHtml(detailUrl)}">Abrir detalhes</a>
                <a href="${escapeHtml(getPrimaryFileUrl(item))}" target="_blank" rel="noreferrer">${item.source_kind === 'local' || item.local_relative_path ? 'Abrir arquivo' : 'Abrir PDF'}</a>
                <a href="${escapeHtml(item.source_kind === 'local' ? getPrimaryFileUrl(item) : (item.detail_url || item.pdf_url))}" target="_blank" rel="noreferrer">${item.source_kind === 'local' ? 'Origem local' : 'Referencia'}</a>
              </div>
            </div>

            ${previewImageHtml}
          </article>
        `;
      })
      .join('');

    const imageItems = items.filter((item) => item.preview_image_path);
    if (elements.imageResults) {
      elements.imageResults.innerHTML = imageItems.length
        ? `
          <div class="image-results-head">
            <h3>Imagens encontradas</h3>
            <p class="muted-copy">Clique em qualquer miniatura para abrir diretamente a pagina do documento.</p>
          </div>
          <div class="image-results-grid">
            ${imageItems.map((item) => `
              <a class="image-result-card" href="/document?id=${encodeURIComponent(item.id)}">
                <img src="/media/previews/${escapeHtml(item.preview_image_path)}" alt="${escapeHtml(safeText(item.descricao || item.nome_arquivo))}" loading="lazy" />
                <div class="image-result-body">
                  <span>${escapeHtml(safeText(item.descricao || item.nome_arquivo))}</span>
                  <small>${escapeHtml(safeText(item.classificacao))} - ${escapeHtml(safeText(item.ano))}</small>
                </div>
              </a>
            `).join('')}
          </div>
        `
        : '<article class="empty-card"><h4>Nenhuma imagem nesta pagina.</h4><p class="muted-copy">Tente outra consulta ou abra a aba Tudo para ver os resultados completos.</p></article>';
    }

    if (state.activeTab === 'images' && elements.resultsContext) {
      elements.resultsContext.textContent = buildImagesContext(search);
    }

    elements.pageInfo.dataset.page = String(page);
    elements.pageInfo.textContent = `Pagina ${page} de ${formatNumber(totalPages)}`;
    elements.prevPage.disabled = page <= 1;
    elements.nextPage.disabled = page >= totalPages;
    elements.bottomPager.classList.toggle('hidden', totalPages <= 1);
    if (state.activeTab === 'images') {
      elements.utilityPanel?.classList.add('hidden');
    } else {
      renderUtilityPanel(elements, search);
    }
  }

  function updateSearchMode(elements, state, search) {
    const hasSearchContext =
      Boolean((search?.query || '').trim()) ||
      Boolean(search?.page > 1) ||
      Boolean(search?.items?.length) ||
      Boolean(state.advancedOpen) ||
      Boolean(search?.selectedFilters?.classificacao) ||
      Boolean(search?.selectedFilters?.caixa) ||
      Boolean(search?.selectedFilters?.ano) ||
      Boolean(search?.selectedFilters?.onlyIndexed);

    document.body.classList.toggle('search-mode', hasSearchContext);
    document.body.classList.toggle('search-images-mode', hasSearchContext && state.activeTab === 'images');
    elements.layout.classList.toggle('panel-open', Boolean(search?.items?.some((item) => item.preview_image_path)));
    elements.searchTabs?.classList.toggle('hidden', !hasSearchContext);
    elements.resultsHeader?.classList.toggle('hidden', !hasSearchContext);
    elements.pageShell?.classList.toggle('hidden', !hasSearchContext);
    elements.searchTabButtons?.forEach((button) => {
      button.classList.toggle('active', (button.dataset.tab || 'all') === state.activeTab);
    });
    elements.imageResults?.classList.toggle('hidden', state.activeTab !== 'images');
    elements.resultsList?.classList.toggle('hidden', state.activeTab === 'images');
    elements.bottomPager?.classList.toggle('hidden', (search?.totalPages || 0) <= 1);
    elements.utilityPanel?.classList.toggle('hidden', state.activeTab === 'images');
  }

  function setSearchLoading(elements, state, loading) {
    state.searchLoading = Boolean(loading);
    elements.resultsList.classList.toggle('loading', state.searchLoading);
    elements.searchLoadingState.classList.toggle('hidden', !state.searchLoading);
    if (state.searchLoading) {
      elements.resultsList.innerHTML = buildSkeletonCards();
      elements.bottomPager.classList.add('hidden');
      elements.imageResults?.classList.add('hidden');
      if (elements.utilityPanel) {
        elements.utilityPanel.classList.add('hidden');
        elements.utilityPanel.innerHTML = '';
      }
    }
  }

  global.AcervoSearchRender = {
    renderResults,
    renderStats,
    setSearchLoading,
    updateSearchMode,
  };
})(window);
