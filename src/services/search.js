const { getDocumentDecorations, searchDocuments, getStats } = require('./repository');
const { buildFtsQuery, normalizeSearchTerm, sanitizeSnippet, tokenizeSearchInput } = require('../utils/text');

const SEARCH_CACHE_TTL_MS = 30_000;
const searchCache = new Map();

function buildPreviewSnippet(item) {
  const ftsSnippet = sanitizeSnippet(item.fts_snippet || '', 420);
  if (ftsSnippet) {
    return ftsSnippet;
  }

  return sanitizeSnippet(item.descricao || item.nome_arquivo || '', 420);
}

function buildMatchDetails(item, query) {
  const normalizedTerms = tokenizeSearchInput(query).map((term) => normalizeSearchTerm(term)).filter(Boolean);
  const fields = [
    ['hash', item.hash_verificacao],
    ['arquivo', item.nome_arquivo],
    ['descricao', item.descricao],
    ['classificacao', item.classificacao],
    ['caixa', item.caixa],
    ['ano', item.ano],
  ];
  const matchedFields = [];
  let matchedTerms = 0;

  for (const term of normalizedTerms) {
    let termMatched = false;

    for (const [fieldName, value] of fields) {
      const normalizedValue = normalizeSearchTerm(value);
      if (normalizedValue && normalizedValue.includes(term)) {
        matchedFields.push(fieldName);
        termMatched = true;
      }
    }

    if (!termMatched && item.fts_match_source && normalizeSearchTerm(item.fts_snippet).includes(term)) {
      matchedFields.push('conteudo');
      termMatched = true;
    }

    if (termMatched) {
      matchedTerms += 1;
    }
  }

  if (!matchedFields.length && item.fts_match_source) {
    matchedFields.push('conteudo');
  }

  return {
    fields: [...new Set(matchedFields)],
    matchedTerms,
  };
}

function listDocuments(params) {
  const cacheKey = JSON.stringify([
    params.ano || '',
    params.caixa || '',
    params.classificacao || '',
    params.onlyIndexed === 'true',
    params.page || 1,
    params.pageSize || 50,
    params.q || '',
  ]);
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(250, Math.max(1, Number(params.pageSize || 50)));
  const query = params.q || '';
  const ftsQuery = buildFtsQuery(query);
  const metadataTerms = tokenizeSearchInput(query);

  const result = searchDocuments({
    ano: params.ano || '',
    caixa: params.caixa || '',
    classificacao: params.classificacao || '',
    ftsQuery,
    limit: pageSize,
    metadataTerms,
    offset: (page - 1) * pageSize,
    onlyIndexed: params.onlyIndexed === 'true',
    rawQuery: query,
  });
  const decorationMap = getDocumentDecorations(result.items.map((item) => item.id));

  const payload = {
    items: result.items.map((item) => {
      const { score_breakdown: scoreBreakdown, ...rest } = item;
      const snippet = buildPreviewSnippet(item);
      const decorations = decorationMap.get(item.id) || {};
      return {
        ...decorations,
        ...rest,
        matchDetails: buildMatchDetails(item, query),
        previewText: snippet || '',
        score: scoreBreakdown?.total || 0,
        scoreBreakdown: scoreBreakdown || null,
        snippet: snippet || '',
        summary: sanitizeSnippet(decorations.summary_text || item.descricao || item.nome_arquivo),
      };
    }),
    page,
    pageSize,
    query,
    stats: getStats(),
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
  };
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    value: payload,
  });
  return payload;
}

module.exports = { listDocuments };
