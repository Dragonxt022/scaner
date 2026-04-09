const { formatIndexedText, sanitizeSnippet } = require('../utils/text');
const { listTextCleanupCandidates, rewriteDocumentContent } = require('./repository');

function resolveProfile(strategy) {
  if (strategy === 'payroll-layout') {
    return 'payroll';
  }
  return 'generic';
}

function buildPreviewItem(item, profile) {
  const beforeText = String(item.extracted_text || '');
  const afterText = formatIndexedText(beforeText, { profile });
  const changed = afterText !== beforeText;
  const beforeSnippet = sanitizeSnippet(beforeText, 320);
  const afterSnippet = sanitizeSnippet(afterText, 320);

  return {
    afterSnippet,
    beforeSnippet,
    changed,
    deltaLength: afterText.length - beforeText.length,
    id: item.id,
    nome_arquivo: item.nome_arquivo,
    descricao: item.descricao,
    classificacao: item.classificacao,
    caixa: item.caixa,
    ano: item.ano,
    pdf_url: item.pdf_url,
    detail_url: item.detail_url,
    last_index_method: item.last_index_method,
    page_count: item.page_count,
    profile,
    qualityScore: item.quality?.score || 0,
    text_length: item.text_length,
  };
}

function previewTextCleanup({ strategy = 'low-quality', limit = 10, sampleSize = 200 } = {}) {
  const profile = resolveProfile(strategy);
  const candidates = listTextCleanupCandidates(strategy, limit, sampleSize);
  const items = candidates
    .map((item) => buildPreviewItem(item, profile))
    .filter((item) => item.changed);

  return {
    items,
    profile,
    strategy,
  };
}

function runTextCleanup({ strategy = 'low-quality', limit = 10, sampleSize = 200 } = {}) {
  const profile = resolveProfile(strategy);
  const candidates = listTextCleanupCandidates(strategy, limit, sampleSize);
  const results = [];

  for (const item of candidates) {
    const beforeText = String(item.extracted_text || '');
    const afterText = formatIndexedText(beforeText, { profile });
    if (!afterText || afterText === beforeText) {
      continue;
    }

    const rewrite = rewriteDocumentContent(item.id, afterText, {
      extractor: item.extractor || item.last_index_method || 'cleanup',
    });

    results.push({
      changed: true,
      deltaLength: afterText.length - beforeText.length,
      id: item.id,
      page_count: item.page_count,
      qualityScore: item.quality?.score || 0,
      rewrite,
      text_length: afterText.length,
    });
  }

  return {
    items: results,
    processed: results.length,
    profile,
    strategy,
  };
}

module.exports = {
  previewTextCleanup,
  runTextCleanup,
};
