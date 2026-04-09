(function bootstrapDocumentPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const COLLAPSED_PARAGRAPHS = 6;

  function safe(value, fallback = '--') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function setText(selector, value, fallback = '--') {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = safe(value, fallback);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function formatRichSummary(summaryText, documentTitle = '') {
    const raw = escapeHtml(summaryText).trim();
    if (!raw) {
      return '';
    }

    const normalized = raw
      .replace(/\r/g, '\n')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?:^|\n)([A-ZÀ-Ý][^:\n]{2,40}:)\s*/g, '\n<strong>$1</strong> ')
      .trim();

    const normalizedTitle = normalizeText(documentTitle);
    const blocks = normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    const filteredBlocks = blocks.filter((block, index) => {
      if (index !== 0 || !normalizedTitle) {
        return true;
      }

      const plainBlock = normalizeText(block.replace(/<[^>]+>/g, ' '));
      return !(plainBlock.includes('resumo do documento') && plainBlock.includes(normalizedTitle));
    });

    return filteredBlocks
      .map((block) => `<p class="detail-summary-paragraph">${block.split('\n').map((line) => line.trim()).filter(Boolean).join('<br>')}</p>`)
      .join('');
  }

  function normalizeExtractedText(text) {
    return String(text ?? '')
      .replace(/\b(?:Data\s+de\s+emiss[aã]o|Emitido\s+em)\s*:?\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/giu, '')
      .replace(/\r/g, '\n')
      .replace(/\t+/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/[ ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function buildParagraphs(text) {
    const normalized = normalizeExtractedText(text);
    if (!normalized) return [];

    const usesParagraphBreaks = normalized.includes('\n\n');
    const chunks = usesParagraphBreaks
      ? normalized.split(/\n{2,}/)
      : normalized.split(/(?<=[.!?])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/u);

    const paragraphs = [];
    let buffer = '';

    for (const chunk of chunks) {
      const piece = chunk.replace(/\n+/g, ' ').trim();
      if (!piece) continue;

      if (usesParagraphBreaks) {
        paragraphs.push(piece);
        continue;
      }

      buffer = buffer ? `${buffer} ${piece}` : piece;
      if (buffer.length >= 420) {
        paragraphs.push(buffer);
        buffer = '';
      }
    }

    if (buffer) paragraphs.push(buffer);
    return paragraphs;
  }

  function renderExtractedText(text) {
    const meta = document.querySelector('#detailTextMeta');
    const container = document.querySelector('#detailTextPreview');
    const toggle = document.querySelector('#detailExpandText');
    const paragraphs = buildParagraphs(text);

    if (!meta || !container || !toggle) return;

    if (!paragraphs.length) {
      meta.textContent = 'Nenhum trecho textual disponivel.';
      container.innerHTML = '<p class="detail-text-empty">Sem texto indexado para este documento.</p>';
      toggle.classList.add('hidden');
      return;
    }

    const wordCount = normalizeExtractedText(text).split(/\s+/).filter(Boolean).length;
    meta.textContent = `${paragraphs.length} bloco(s) de leitura • ${wordCount.toLocaleString('pt-BR')} palavras aproximadas`;
    container.innerHTML = paragraphs
      .map((paragraph) => `<p class="detail-text-paragraph">${safe(paragraph, '')}</p>`)
      .join('');

    const shouldCollapse = paragraphs.length > COLLAPSED_PARAGRAPHS;
    container.classList.toggle('is-collapsed', shouldCollapse);
    container.dataset.expanded = shouldCollapse ? 'false' : 'true';
    toggle.classList.toggle('hidden', !shouldCollapse);
    toggle.textContent = 'Visualizar mais';
  }

  function setAiStatus(message, { error = false, visible = true } = {}) {
    const element = document.querySelector('#detailAiStatus');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('hidden', !visible || !message);
    element.classList.toggle('error-copy', Boolean(error));
  }

  function setAiAnswer(payload) {
    const element = document.querySelector('#detailAiAnswer');
    if (!element) return;

    const answer = String(payload?.answer || '').trim();
    if (!answer) {
      element.classList.add('hidden');
      element.innerHTML = '';
      return;
    }

    element.innerHTML = `
      <div class="detail-ai-answer-head">
        <span>Resposta da IA</span>
        <small>${safe(payload?.model, 'modelo nao informado')}</small>
      </div>
      <p>${answer}</p>
    `;
    element.classList.remove('hidden');
  }

  async function fetchSettings() {
    const response = await fetch('/api/admin/settings');
    if (!response.ok) return { autoIndexOnDetailView: false };
    return response.json();
  }

  async function registerAccess(documentId) {
    await fetch(`/api/documents/${encodeURIComponent(documentId)}/access`, { method: 'POST' });
  }

  async function triggerAutoIndex(documentId) {
    const response = await fetch(`/api/admin/reindex/document/${encodeURIComponent(documentId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'hybrid' }),
    });
    return response.ok;
  }

  async function triggerAutoEnrichment(documentId) {
    const response = await fetch(`/api/admin/enrichment/document/${encodeURIComponent(documentId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    return response.ok;
  }

  function setReprocessFeedback(message, { error = false, visible = true } = {}) {
    const element = document.querySelector('#detailReprocessFeedback');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('hidden', !visible || !message);
    element.classList.toggle('error-copy', Boolean(error));
  }

  async function loadDocument(documentId) {
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
    if (!response.ok) {
      throw new Error('Documento nao encontrado.');
    }
    return response.json();
  }

  async function loadDocumentImages(documentId) {
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/images`);
    if (!response.ok) {
      return { items: [] };
    }
    return response.json();
  }

  async function askDocumentQuestion(documentId, question) {
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Nao foi possivel consultar a IA para este documento.');
    }
    return payload;
  }

  function renderDocument(item) {
    const title = safe(item.descricao || item.nome_arquivo, 'Documento');
    document.title = `Acervo Publico - ${title}`;
    setText('#detailTitle', title);
    setText('#detailBreadcrumbTitle', title);
    setText('#detailLead', `${safe(item.classificacao)} - Caixa ${safe(item.caixa)} - ${safe(item.ano)}`);
    setText('#detailDescricao', item.descricao || item.nome_arquivo, 'Sem descricao cadastrada.');
    setText('#detailFile', item.nome_arquivo);
    setText('#detailHash', item.hash_verificacao);
    setText('#detailClassificacao', item.classificacao);
    setText('#detailCaixa', item.caixa);
    setText('#detailAno', item.ano);
    setText('#detailStatus', item.index_status, 'Nao informado');
    renderExtractedText(item.extracted_text);

    const summaryCard = document.querySelector('#detailSummaryCard');
    const summaryRich = document.querySelector('#detailSummaryRich');
    if (summaryCard && summaryRich) {
      const formattedSummary = formatRichSummary(item.summary_text, title);
      if (formattedSummary) {
        summaryRich.innerHTML = formattedSummary;
        summaryCard.classList.remove('hidden');
      } else {
        summaryRich.textContent = 'Sem resumo enriquecido.';
        summaryCard.classList.add('hidden');
      }
    }

    const pdfUrl = item.pdf_url || '#';
    const sourceUrl = item.detail_url || item.pdf_url || '#';
    document.querySelector('#detailPdf').href = pdfUrl;
    document.querySelector('#detailSource').href = sourceUrl;

  }

  function renderDocumentImages(item, imagesPayload) {
    const visualWrap = document.querySelector('#detailSidebarVisualWrap');
    const visual = document.querySelector('#detailSidebarVisual');
    const gallery = document.querySelector('#detailSidebarGallery');
    if (!visualWrap || !visual || !gallery) {
      return;
    }

    const images = Array.isArray(imagesPayload?.items) ? imagesPayload.items : [];
    if (!images.length) {
      visual.removeAttribute('src');
      gallery.innerHTML = '';
      visualWrap.classList.add('hidden');
      return;
    }

    const setActiveImage = (image) => {
      visual.src = image.url;
      visual.alt = `${image.label} de ${safe(item.descricao || item.nome_arquivo, 'documento')}`;
      gallery.querySelectorAll('.detail-side-thumb').forEach((button) => {
        button.classList.toggle('active', button.dataset.path === image.relativePath);
      });
    };

    gallery.innerHTML = images.map((image) => `
      <button class="detail-side-thumb${image.isPrimary ? ' active' : ''}" type="button" data-path="${escapeHtml(image.relativePath)}" data-url="${escapeHtml(image.url)}" aria-label="Abrir ${escapeHtml(image.label)}">
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.label)}" loading="lazy" />
        <span>${escapeHtml(image.label)}</span>
      </button>
    `).join('');

    gallery.querySelectorAll('.detail-side-thumb').forEach((button, index) => {
      button.addEventListener('click', () => {
        setActiveImage(images[index]);
      });
    });

    setActiveImage(images[0]);
    visualWrap.classList.remove('hidden');
  }

  async function init() {
    if (!id) {
      setText('#detailLead', 'Documento nao informado.');
      setText('#detailTitle', 'Documento indisponivel');
      renderExtractedText('');
      return;
    }

    const [item, imagesPayload] = await Promise.all([
      loadDocument(id),
      loadDocumentImages(id),
    ]);
    renderDocument(item);
    renderDocumentImages(item, imagesPayload);
    registerAccess(id).catch(() => {});

    const settings = await fetchSettings().catch(() => ({ autoIndexOnDetailView: false }));
    const needsEnrichment =
      item.index_status === 'indexed' &&
      !String(item.summary_text || '').trim() &&
      !String(item.preview_image_path || '').trim() &&
      (settings.enrichmentSummaryEnabled || settings.enrichmentPreviewImagesEnabled);

    if (needsEnrichment) {
      setText('#detailLead', 'Documento indexado sem resumo e sem imagens. Tentando completar o enriquecimento.');
      const startedEnrichment = await triggerAutoEnrichment(id).catch(() => false);
      if (startedEnrichment) {
        const [enrichedDocument, enrichedImages] = await Promise.all([
          loadDocument(id).catch(() => null),
          loadDocumentImages(id).catch(() => ({ items: [] })),
        ]);
        if (enrichedDocument) {
          renderDocument(enrichedDocument);
          renderDocumentImages(enrichedDocument, enrichedImages);
        }
      }
    }

    const needsIndexing = item.index_status !== 'indexed' && !String(item.extracted_text || '').trim();
    if (!settings.autoIndexOnDetailView || !needsIndexing) {
      return;
    }

    setText('#detailLead', 'Documento sem texto anexado. Tentando indexacao automatica.');
    const started = await triggerAutoIndex(id).catch(() => false);
    if (!started) {
      return;
    }

    const refreshed = await loadDocument(id).catch(() => null);
    if (refreshed) {
      renderDocument(refreshed);
      const refreshedImages = await loadDocumentImages(id).catch(() => ({ items: [] }));
      renderDocumentImages(refreshed, refreshedImages);
    }
  }

  function bindAiQuestionForm() {
    const form = document.querySelector('#detailAiForm');
    const input = document.querySelector('#detailAiQuestion');
    const fab = document.querySelector('#detailAiFab');
    const drawer = document.querySelector('#detailAiDrawer');
    const close = document.querySelector('#detailAiClose');
    if (!form || !input || !id || !fab || !drawer || !close) {
      return;
    }

    fab.addEventListener('click', () => {
      drawer.classList.toggle('hidden');
      if (!drawer.classList.contains('hidden')) {
        input.focus();
      }
    });

    close.addEventListener('click', () => {
      drawer.classList.add('hidden');
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const question = String(input.value || '').trim();
      if (question.length < 3) {
        setAiStatus('Escreva uma pergunta com pelo menos 3 caracteres.', { error: true });
        drawer.classList.remove('hidden');
        return;
      }

      setAiAnswer(null);
      setAiStatus('Consultando a IA sobre este documento...');
      form.classList.add('is-loading');

      try {
        const payload = await askDocumentQuestion(id, question);
        setAiStatus('Resposta pronta.');
        setAiAnswer(payload);
        drawer.classList.remove('hidden');
      } catch (error) {
        setAiStatus(error.message, { error: true });
        drawer.classList.remove('hidden');
      } finally {
        form.classList.remove('is-loading');
      }
    });
  }

  function bindTextExpansion() {
    const toggle = document.querySelector('#detailExpandText');
    const container = document.querySelector('#detailTextPreview');
    if (!toggle || !container) {
      return;
    }

    toggle.addEventListener('click', () => {
      const expanded = container.dataset.expanded === 'true';
      container.dataset.expanded = expanded ? 'false' : 'true';
      container.classList.toggle('is-collapsed', expanded);
      toggle.textContent = expanded ? 'Visualizar mais' : 'Ocultar parte do texto';
    });
  }

  function bindCopyText() {
    const trigger = document.querySelector('#detailCopyText');
    const container = document.querySelector('#detailTextPreview');
    if (!trigger || !container) {
      return;
    }

    trigger.addEventListener('click', async () => {
      const text = String(container.textContent || '').trim();
      if (!text) {
        trigger.textContent = 'Sem texto';
        setTimeout(() => {
          trigger.textContent = 'Copiar texto';
        }, 1400);
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        trigger.textContent = 'Texto copiado';
      } catch {
        trigger.textContent = 'Falha ao copiar';
      }

      setTimeout(() => {
        trigger.textContent = 'Copiar texto';
      }, 1600);
    });
  }

  function bindReprocess() {
    const trigger = document.querySelector('#detailReprocess');
    if (!trigger || !id) {
      return;
    }

    trigger.addEventListener('click', async () => {
      trigger.disabled = true;
      setReprocessFeedback('Refazendo processamento do documento...');

      try {
        const started = await triggerAutoIndex(id);
        if (!started) {
          throw new Error('Nao foi possivel iniciar o reprocessamento deste documento.');
        }

        const refreshed = await loadDocument(id);
        renderDocument(refreshed);
        const refreshedImages = await loadDocumentImages(id).catch(() => ({ items: [] }));
        renderDocumentImages(refreshed, refreshedImages);
        setReprocessFeedback('Processo refeito e documento atualizado.');
      } catch (error) {
        setReprocessFeedback(error.message || 'Falha ao refazer o processo.', { error: true });
      } finally {
        trigger.disabled = false;
        setTimeout(() => {
          setReprocessFeedback('', { visible: false });
        }, 2800);
      }
    });
  }

  bindTextExpansion();
  bindCopyText();
  bindReprocess();
  bindAiQuestionForm();

  init().catch(() => {
    setText('#detailLead', 'Falha ao carregar documento.');
    setText('#detailTitle', 'Documento indisponivel');
    renderExtractedText('');
  });
})();
