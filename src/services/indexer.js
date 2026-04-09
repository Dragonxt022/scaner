const config = require('../config');
const { extractRemotePdfText } = require('./pdf-text');
const { enrichDocumentById } = require('./document-enrichment');
const {
  getDocumentsToIndex,
  markDocumentError,
  markDocumentProcessing,
  saveDocumentContent,
} = require('./repository');

async function processDocument(document, options = {}) {
  const mode = options.mode || 'hybrid';
  const runFullProcess = options.runFullProcess !== false;
  const itemStartedAt = Date.now();
  if (typeof options.onItemStart === 'function') {
    options.onItemStart(document, { mode, runFullProcess, startedAt: itemStartedAt });
  }
  markDocumentProcessing(document.id, mode);

  try {
    const extracted = await extractRemotePdfText(document.pdf_url, {
      mode,
      onStage: (stage, payload) => {
        if (typeof options.onStage === 'function') {
          options.onStage(document, stage, payload);
        }
      },
    });
    if (!extracted.text) {
      throw new Error('O PDF nao retornou texto pesquisavel.');
    }

    saveDocumentContent(document.id, extracted.text, extracted);
    let enrichmentError = '';
    let enrichmentResult = null;

    if (runFullProcess) {
      try {
        enrichmentResult = await enrichDocumentById(document.id, {
          onStage: (enrichmentDocument, stage, payload) => {
            if (typeof options.onStage === 'function') {
              options.onStage(enrichmentDocument, stage, payload);
            }
          },
        });
      } catch (error) {
        enrichmentError = error.message;
      }
    }

    const result = {
      documentId: document.id,
      enrichmentError,
      enrichmentResult,
      extractor: extracted.extractor,
      metrics: {
        ...(extracted.metrics || {}),
        imageMs: enrichmentResult?.metrics?.imageMs || 0,
        summaryMs: enrichmentResult?.metrics?.summaryMs || 0,
      },
      pageCount: extracted.pageCount,
      status: 'indexed',
      textLength: extracted.text.length,
    };
    result.itemElapsedMs = Date.now() - itemStartedAt;
    result.bottleneckStage = Object.entries({
      download: result.metrics.downloadMs || 0,
      native: result.metrics.nativeMs || 0,
      ocr: result.metrics.ocrMs || 0,
    }).sort((left, right) => right[1] - left[1])[0]?.[0] || 'native';
    if (typeof options.onItemComplete === 'function') {
      options.onItemComplete(document, result);
    }
    return result;
  } catch (error) {
    markDocumentError(document.id, error.message, mode);
    const result = {
      documentId: document.id,
      error: error.message,
      itemElapsedMs: Date.now() - itemStartedAt,
      mode,
      status: 'error',
    };
    if (typeof options.onItemError === 'function') {
      options.onItemError(document, result);
    }
    return result;
  }
}

async function runIndexBatch({
  concurrency = config.indexConcurrency,
  limit = 20,
  mode = 'hybrid',
  onItemComplete,
  onItemError,
  onItemStart,
  onStage,
  retryFailures = false,
  runFullProcess = true,
} = {}) {
  const queue = [...getDocumentsToIndex(limit, { includeErrors: retryFailures })];
  const results = [];
  const processOptions = {
    mode,
    runFullProcess,
  };

  if (typeof onItemStart === 'function') processOptions.onItemStart = onItemStart;
  if (typeof onStage === 'function') processOptions.onStage = onStage;
  if (typeof onItemComplete === 'function') processOptions.onItemComplete = onItemComplete;
  if (typeof onItemError === 'function') processOptions.onItemError = onItemError;

  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      results.push(await processDocument(next, processOptions));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));

  return {
    mode,
    processed: results.length,
    retryFailures,
    runFullProcess,
    results,
  };
}

module.exports = { processDocument, runIndexBatch };
