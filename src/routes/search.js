const express = require('express');
const { listDocuments } = require('../services/search');
const { inferSearchQueryFromImage } = require('../services/ai-search');
const { listSearchLogsByUser, recordSearchLog } = require('../services/audit');

const router = express.Router();

router.get('/history', (request, response) => {
  response.json({
    items: listSearchLogsByUser(request.authUser?.id, Number(request.query?.limit || 200)),
  });
});

router.get('/', (request, response) => {
  const result = listDocuments(request.query);
  recordSearchLog(request.authUser, {
    ano: request.query?.ano,
    caixa: request.query?.caixa,
    classificacao: request.query?.classificacao,
    onlyIndexed: request.query?.onlyIndexed === 'true',
    page: request.query?.page,
    pageSize: request.query?.pageSize,
    queryText: request.query?.q,
    resultTotal: result.total,
    searchType: 'text',
  });
  response.json(result);
});

router.post('/image', async (request, response) => {
  const analysis = await inferSearchQueryFromImage(request.body?.imageDataUrl);
  const extractedSearchText = String(analysis.extractedText || '').slice(0, 320).trim();
  const fallbackQuery = String(analysis.query || '').trim();
  let usedQuery = extractedSearchText || fallbackQuery;
  let usedExtractedText = Boolean(extractedSearchText);
  let search = listDocuments({
    page: 1,
    pageSize: Number(request.body?.pageSize || 10),
    q: usedQuery,
  });

  if (!search.items.length && fallbackQuery && fallbackQuery !== usedQuery) {
    usedQuery = fallbackQuery;
    usedExtractedText = false;
    search = listDocuments({
      page: 1,
      pageSize: Number(request.body?.pageSize || 10),
      q: usedQuery,
    });
  }

  recordSearchLog(request.authUser, {
    page: 1,
    pageSize: Number(request.body?.pageSize || 10),
    queryText: usedQuery,
    resultTotal: search.total,
    searchType: 'image',
  });

  response.json({
    ...analysis,
    search,
    usedExtractedText,
    usedQuery,
  });
});

module.exports = router;
