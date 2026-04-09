const fs = require('node:fs');
const path = require('node:path');
const { PDFParse } = require('pdf-parse');
const { cleanupExtractedText } = require('../utils/text');
const { ensureLocalLibraryRoot, getMimeTypeByExtension, isIndexableTextMime, isPdfMime } = require('./local-library');

function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

async function extractLocalPdfText(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText({
      disableNormalization: false,
      itemJoiner: ' ',
      pageJoiner: '\n-- page_number of total_number --\n',
    });
    const text = cleanupExtractedText(result.text || '');
    return {
      extractor: 'local-pdf-parse',
      metrics: {
        downloadMs: 0,
        nativeMs: 0,
        ocrMs: 0,
      },
      pageCount: result.pages?.length || 0,
      text,
    };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
}

function extractLocalTextFile(absolutePath, mimeType) {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const normalized = mimeType === 'text/html' ? stripHtml(raw) : raw;
  const text = cleanupExtractedText(normalized);

  return {
    extractor: 'local-text',
    metrics: {
      downloadMs: 0,
      nativeMs: 0,
      ocrMs: 0,
    },
    pageCount: 1,
    text,
  };
}

function buildFallbackLocalText(fileName, relativePath, mimeType) {
  const parts = [
    `Arquivo local: ${fileName}`,
    `Caminho: ${relativePath}`,
    `Tipo: ${mimeType}`,
    'Extracao textual completa nao suportada para este formato no momento.',
  ];

  return {
    extractor: 'local-metadata',
    metrics: {
      downloadMs: 0,
      nativeMs: 0,
      ocrMs: 0,
    },
    pageCount: 1,
    text: cleanupExtractedText(parts.join('\n')),
  };
}

async function extractLocalDocumentText(document) {
  const root = ensureLocalLibraryRoot();
  const relativePath = String(document?.local_relative_path || '').trim();
  if (!relativePath) {
    throw new Error('Documento local sem caminho relativo configurado.');
  }

  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo local nao encontrado: ${relativePath}`);
  }

  const fileName = path.basename(absolutePath);
  const mimeType = String(document?.mime_type || getMimeTypeByExtension(fileName)).toLowerCase();

  if (isPdfMime(mimeType, fileName)) {
    return extractLocalPdfText(absolutePath);
  }

  if (isIndexableTextMime(mimeType)) {
    return extractLocalTextFile(absolutePath, mimeType);
  }

  return buildFallbackLocalText(fileName, relativePath, mimeType);
}

module.exports = {
  extractLocalDocumentText,
};
