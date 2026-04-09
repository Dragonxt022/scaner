const fs = require('node:fs');
const path = require('node:path');
const { syncDocumentsForSource, listDocumentsBySourceKind } = require('./repository');
const {
  LOCAL_LIBRARY_DIRNAME,
  buildLocalLibraryUrl,
  getLocalLibraryRoot,
  toPosixPath,
} = require('../utils/local-files');

const LOCAL_LIBRARY_SOURCE_PREFIX = 'local-file::';

function ensureLocalLibraryRoot() {
  const root = getLocalLibraryRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function getMimeTypeByExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.txt':
    case '.log':
    case '.md':
      return 'text/plain';
    case '.json':
      return 'application/json';
    case '.csv':
      return 'text/csv';
    case '.xml':
      return 'application/xml';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function isIndexableTextMime(mimeType) {
  return [
    'text/plain',
    'application/json',
    'text/csv',
    'application/xml',
    'text/html',
  ].includes(String(mimeType || '').toLowerCase());
}

function isPdfMime(mimeType, fileName = '') {
  return String(mimeType || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(String(fileName || ''));
}

function walkLibraryFiles(rootDir, currentDir = rootDir, collected = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry || entry.name.startsWith('.')) continue;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkLibraryFiles(rootDir, absolutePath, collected);
      continue;
    }
    if (!entry.isFile()) continue;
    collected.push(absolutePath);
  }
  return collected;
}

function buildLocalDocumentRecord(absolutePath) {
  const root = ensureLocalLibraryRoot();
  const relativePath = toPosixPath(path.relative(root, absolutePath));
  const stats = fs.statSync(absolutePath);
  const fileName = path.basename(absolutePath);
  const mimeType = getMimeTypeByExtension(fileName);
  const folderLabel = toPosixPath(path.dirname(relativePath)) === '.' ? 'Acervo local' : toPosixPath(path.dirname(relativePath));
  const title = path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, ' ').trim() || fileName;
  const browserUrl = buildLocalLibraryUrl(relativePath);

  return {
    source_key: `${LOCAL_LIBRARY_SOURCE_PREFIX}${relativePath}`,
    source_kind: 'local',
    content_key: `${LOCAL_LIBRARY_SOURCE_PREFIX}${relativePath}`,
    hash_verificacao: `LOCAL-${relativePath}`.slice(0, 255),
    pdf_url: browserUrl,
    detail_url: browserUrl,
    local_relative_path: relativePath,
    mime_type: mimeType,
    nome_arquivo: fileName,
    classificacao: isPdfMime(mimeType, fileName) ? 'Acervo local PDF' : 'Acervo local',
    caixa: folderLabel,
    descricao: title,
    ano: String(new Date(stats.mtime).getFullYear()),
  };
}

function syncLocalLibrary() {
  const root = ensureLocalLibraryRoot();
  const files = walkLibraryFiles(root);
  const documents = files.map((absolutePath) => buildLocalDocumentRecord(absolutePath));
  syncDocumentsForSource(LOCAL_LIBRARY_SOURCE_PREFIX, documents);

  return {
    items: documents,
    root,
    totalFiles: documents.length,
  };
}

function listLocalLibraryItems(limit = 300) {
  return listDocumentsBySourceKind('local', limit);
}

module.exports = {
  LOCAL_LIBRARY_DIRNAME,
  LOCAL_LIBRARY_SOURCE_PREFIX,
  buildLocalLibraryUrl,
  ensureLocalLibraryRoot,
  getLocalLibraryRoot,
  getMimeTypeByExtension,
  isIndexableTextMime,
  isPdfMime,
  listLocalLibraryItems,
  syncLocalLibrary,
};
