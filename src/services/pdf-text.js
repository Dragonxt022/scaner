const path = require('node:path');
const { PDFParse } = require('pdf-parse');
const { createWorker, PSM } = require('tesseract.js');
const { Agent } = require('undici');
const config = require('../config');
const { analyzeTextQuality, cleanupExtractedText, shouldUseOcrFallback } = require('../utils/text');

const insecureDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

let workerPromise;

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.message === 'This operation was aborted';
}

function emitStage(options, stage, payload = {}) {
  if (typeof options.onStage === 'function') {
    options.onStage(stage, payload);
  }
}

function buildTimeoutMessage(timeoutMs, attempt, totalAttempts) {
  return `Timeout ao baixar PDF remoto apos ${Math.round(timeoutMs / 1000)}s (tentativa ${attempt}/${totalAttempts}).`;
}

async function fetchPdfBuffer(url, options = {}) {
  const totalAttempts = Math.max(1, config.indexDownloadRetries + 1);
  const startedAt = Date.now();
  emitStage(options, 'download', { startedAt, status: 'start' });

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const timeoutMs = Math.min(config.indexTimeoutMs * attempt, config.indexTimeoutMaxMs);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        dispatcher: config.allowInsecureTls ? insecureDispatcher : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Falha ao baixar PDF remoto: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      emitStage(options, 'download', {
        bytes: buffer.length,
        elapsedMs: Date.now() - startedAt,
        status: 'done',
      });
      return buffer;
    } catch (error) {
      const normalizedError = isAbortError(error)
        ? new Error(buildTimeoutMessage(timeoutMs, attempt, totalAttempts))
        : error;

      if (attempt >= totalAttempts) {
        emitStage(options, 'download', {
          elapsedMs: Date.now() - startedAt,
          error: normalizedError.message,
          status: 'error',
        });
        throw normalizedError;
      }

      if (!isAbortError(error) && !String(error?.message || '').includes('fetch failed')) {
        throw normalizedError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Falha inesperada ao baixar PDF remoto.');
}

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(config.ocrLanguage, 1, {
      cachePath: path.join(process.cwd(), 'data', 'tesseract-cache'),
      gzip: true,
      logger: () => {},
    }).then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    });
  }

  return workerPromise;
}

async function extractNativeText(parser, options = {}) {
  const startedAt = Date.now();
  emitStage(options, 'native', { startedAt, status: 'start' });
  const result = await parser.getText({
    disableNormalization: false,
    itemJoiner: ' ',
    pageJoiner: '\n-- page_number of total_number --\n',
  });

  const text = cleanupExtractedText(result.text || '');
  emitStage(options, 'native', {
    elapsedMs: Date.now() - startedAt,
    pageCount: result.pages?.length || 0,
    status: 'done',
    textLength: text.length,
  });
  return {
    extractor: 'pdf-parse',
    metrics: { nativeMs: Date.now() - startedAt },
    pageCount: result.pages?.length || 0,
    quality: analyzeTextQuality(text),
    text,
  };
}

async function runOcrFallback(parser, pageCount, options = {}) {
  const startedAt = Date.now();
  emitStage(options, 'ocr', { pageCount, startedAt, status: 'start' });
  const worker = await getOcrWorker();
  const maxPages = config.ocrMaxPages > 0 ? Math.min(pageCount, config.ocrMaxPages) : pageCount;
  const chunks = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const screenshot = await parser.getScreenshot({
      desiredWidth: config.ocrScreenshotWidth,
      first: pageNumber,
      imageBuffer: true,
      imageDataUrl: false,
      last: pageNumber,
    });

    const page = screenshot.pages?.[0];
    if (!page?.data) {
      continue;
    }

    const imageBuffer = Buffer.isBuffer(page.data) ? page.data : Buffer.from(page.data);
    const ocr = await worker.recognize(imageBuffer);
    const pageText = cleanupExtractedText(ocr.data?.text || '');

    if (pageText) {
      chunks.push(pageText);
    }
  }

  const text = cleanupExtractedText(chunks.join('\n\n'));
  emitStage(options, 'ocr', {
    elapsedMs: Date.now() - startedAt,
    pageCount: maxPages,
    status: 'done',
    textLength: text.length,
  });
  return {
    extractor: `${config.ocrLanguage}-ocr`,
    metrics: { ocrMs: Date.now() - startedAt },
    pageCount: maxPages,
    quality: analyzeTextQuality(text),
    text,
  };
}

async function extractRemotePdfText(url, options = {}) {
  const metrics = {
    downloadMs: 0,
    nativeMs: 0,
    ocrMs: 0,
  };
  const buffer = await fetchPdfBuffer(url, {
    onStage(stage, payload) {
      if (stage === 'download' && payload.status === 'done') {
        metrics.downloadMs = payload.elapsedMs || 0;
      }
      emitStage(options, stage, payload);
    },
  });
  const parser = new PDFParse({ data: buffer });
  const mode = options.mode || 'hybrid';

  try {
    const nativeResult = await extractNativeText(parser, {
      onStage(stage, payload) {
        if (stage === 'native' && payload.status === 'done') {
          metrics.nativeMs = payload.elapsedMs || 0;
        }
        emitStage(options, stage, payload);
      },
    });

    if (mode === 'native') {
      return {
        ...nativeResult,
        metrics,
      };
    }

    if (!config.ocrEnabled || !nativeResult.pageCount) {
      return {
        ...nativeResult,
        metrics,
      };
    }

    if (mode === 'ocr') {
      const ocrResult = await runOcrFallback(parser, nativeResult.pageCount, {
        onStage(stage, payload) {
          if (stage === 'ocr' && payload.status === 'done') {
            metrics.ocrMs = payload.elapsedMs || 0;
          }
          emitStage(options, stage, payload);
        },
      });
      return {
        ...(ocrResult.text ? ocrResult : nativeResult),
        metrics,
      };
    }

    const fallbackDecision = shouldUseOcrFallback(nativeResult.text);
    if (!fallbackDecision.useOcr) {
      return nativeResult;
    }

    const ocrResult = await runOcrFallback(parser, nativeResult.pageCount, {
      onStage(stage, payload) {
        if (stage === 'ocr' && payload.status === 'done') {
          metrics.ocrMs = payload.elapsedMs || 0;
        }
        emitStage(options, stage, payload);
      },
    });
    if (!ocrResult.text) {
      return {
        ...nativeResult,
        metrics,
      };
    }

    if (ocrResult.quality.score >= nativeResult.quality.score) {
      return {
        ...ocrResult,
        metrics,
      };
    }

    return {
      ...nativeResult,
      metrics,
    };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
}

module.exports = { extractRemotePdfText };
