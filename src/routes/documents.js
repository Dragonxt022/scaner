const express = require('express');
const { getDocumentById, getFilters, getStats, registerDocumentAccess } = require('../services/repository');
const { askQuestionAboutDocument } = require('../services/document-qa');
const { listDocumentPreviewImages } = require('../services/document-enrichment');
const { recordAccessLog } = require('../services/audit');

const router = express.Router();

router.get('/stats', (_request, response) => {
  response.json(getStats());
});

router.get('/filters', (_request, response) => {
  response.json(getFilters());
});

router.get('/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const document = getDocumentById(id);
  if (!document) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  response.json(document);
});

router.get('/:id/images', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const document = getDocumentById(id);
  if (!document) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  response.json({
    documentId: id,
    items: listDocumentPreviewImages(document),
  });
});

router.post('/:id/access', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const updated = registerDocumentAccess(id);
  if (!updated) {
    response.status(404).json({ error: 'Documento nao encontrado.' });
    return;
  }

  recordAccessLog(request, request.authUser, 'document_access', `Documento ${id} acessado.`);
  response.status(204).end();
});

router.post('/:id/ask', async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Identificador de documento invalido.' });
    return;
  }

  const question = String(request.body?.question || '').trim();
  if (question.length < 3) {
    response.status(400).json({ error: 'Pergunta invalida. Escreva ao menos 3 caracteres.' });
    return;
  }

  const result = await askQuestionAboutDocument(id, question);
  response.json(result);
});

module.exports = router;
