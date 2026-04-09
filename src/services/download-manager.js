const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const config = require('../config');
const { attachLocalFileToDocumentsByPdfUrl } = require('./repository');
const { getMimeTypeByExtension } = require('./local-library');
const { getLocalLibraryRoot, toPosixPath } = require('../utils/local-files');

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_TIMEOUT_MS = 30000;
const DOWNLOAD_STATE_PATH = path.join(process.cwd(), 'data', 'download-state.json');
const MAX_REDIRECTS = 5;
const MAX_RECENT_FAILURES = 8;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: !config.allowInsecureTls,
});

function createManifest() {
  return {
    version: 1,
    updatedAt: null,
    inventoryPath: path.join(config.artifactsDir, 'pdf-links.json'),
    destinationDir: getLocalLibraryRoot(),
    items: {},
  };
}

function createInitialState() {
  return {
    active: false,
    activeDownloads: new Map(),
    completedFiles: 0,
    concurrency: DEFAULT_CONCURRENCY,
    destinationDir: getLocalLibraryRoot(),
    failedFiles: 0,
    inventoryPath: path.join(config.artifactsDir, 'pdf-links.json'),
    lastUpdatedAt: null,
    manifest: createManifest(),
    manifestLoaded: false,
    message: 'Aguardando inicio.',
    overwrite: false,
    pendingFiles: 0,
    queue: [],
    recentFailures: [],
    retryCount: DEFAULT_RETRY_COUNT,
    sessionId: 0,
    startedAt: null,
    stopRequested: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    totalFiles: 0,
  };
}

let state = createInitialState();

function markUpdated() {
  const now = new Date().toISOString();
  state.lastUpdatedAt = now;
  state.manifest.updatedAt = now;
}

function sanitizeFileName(value) {
  const input = String(value || '').trim() || 'arquivo.pdf';
  const sanitized = input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 220);

  return sanitized || 'arquivo.pdf';
}

function buildUniqueEntries(records) {
  const urlMap = new Map();
  const usedNames = new Map();

  for (const record of records) {
    const url = String(record.pdfUrl || '').trim();
    if (!url || urlMap.has(url)) {
      continue;
    }

    const baseName = sanitizeFileName(record.nomeArquivo || path.basename(new URL(url).pathname) || 'arquivo.pdf');
    const lowerBaseName = baseName.toLowerCase();
    const duplicateIndex = usedNames.get(lowerBaseName) || 0;
    usedNames.set(lowerBaseName, duplicateIndex + 1);

    const parsedName = path.parse(baseName);
    const uniqueName =
      duplicateIndex === 0
        ? baseName
        : `${parsedName.name}--${duplicateIndex + 1}${parsedName.ext || '.pdf'}`;

    urlMap.set(url, {
      fileName: uniqueName,
      sourceName: baseName,
      url,
    });
  }

  return [...urlMap.values()];
}

async function ensureManifestLoaded() {
  if (state.manifestLoaded) {
    return;
  }

  try {
    const content = await fsp.readFile(DOWNLOAD_STATE_PATH, 'utf8');
    const parsed = JSON.parse(content);
    state.manifest = {
      ...createManifest(),
      ...parsed,
      items: parsed.items || {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    state.manifest = createManifest();
  }

  state.manifestLoaded = true;
  state.destinationDir = state.manifest.destinationDir || state.destinationDir;
  state.inventoryPath = state.manifest.inventoryPath || state.inventoryPath;
  markUpdated();
}

async function persistManifest() {
  await fsp.mkdir(path.dirname(DOWNLOAD_STATE_PATH), { recursive: true });
  await fsp.writeFile(DOWNLOAD_STATE_PATH, JSON.stringify(state.manifest, null, 2), 'utf8');
}

async function loadInventoryEntries() {
  const inventoryPath = path.join(config.artifactsDir, 'pdf-links.json');
  const content = await fsp.readFile(inventoryPath, 'utf8');
  const parsed = JSON.parse(content);

  return {
    entries: buildUniqueEntries(parsed),
    inventoryPath,
  };
}

async function hasCompletedFile(manifestItem) {
  if (!manifestItem?.targetPath) {
    return false;
  }

  try {
    const stats = await fsp.stat(manifestItem.targetPath);
    if (!stats.isFile()) {
      return false;
    }

    if (Number.isFinite(manifestItem.totalBytes) && manifestItem.totalBytes > 0) {
      return stats.size === manifestItem.totalBytes;
    }

    return stats.size > 0;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function buildQueue(entries, destinationDir) {
  let completedFiles = 0;
  let failedFiles = 0;
  const queue = [];

  for (const entry of entries) {
    const manifestItem = state.manifest.items[entry.url];

    if (manifestItem?.status === 'completed' && (await hasCompletedFile(manifestItem))) {
      completedFiles += 1;
      continue;
    }

    if (manifestItem?.status === 'failed') {
      failedFiles += 1;
      continue;
    }

    queue.push({
      ...entry,
      targetPath: path.join(destinationDir, entry.fileName),
    });
  }

  return {
    completedFiles,
    failedFiles,
    pendingFiles: queue.length,
    queue,
    totalFiles: entries.length,
  };
}

function buildSnapshot() {
  const activeDownloads = [...state.activeDownloads.values()]
    .map((item) => ({
      attempt: item.attempt,
      downloadedBytes: item.downloadedBytes,
      fileName: item.fileName,
      finalUrl: item.finalUrl,
      percent:
        Number.isFinite(item.totalBytes) && item.totalBytes > 0
          ? Math.min(100, Math.round((item.downloadedBytes / item.totalBytes) * 100))
          : null,
      slot: item.slot,
      startedAt: item.startedAt,
      status: item.status,
      targetPath: item.targetPath,
      totalBytes: item.totalBytes,
      url: item.url,
    }))
    .sort((left, right) => left.slot - right.slot);

  const processedFiles = state.completedFiles + state.failedFiles;
  const fileProgressPercent =
    state.totalFiles > 0 ? Math.min(100, Math.round((processedFiles / state.totalFiles) * 100)) : 0;

  return {
    active: state.active,
    activeDownloads,
    completedFiles: state.completedFiles,
    concurrency: state.concurrency,
    destinationDir: state.destinationDir,
    failedFiles: state.failedFiles,
    fileProgressPercent,
    inFlightFiles: activeDownloads.length,
    inventoryPath: state.inventoryPath,
    lastUpdatedAt: state.lastUpdatedAt,
    manifestPath: DOWNLOAD_STATE_PATH,
    message: state.message,
    overwrite: state.overwrite,
    pendingFiles: state.pendingFiles,
    processedFiles,
    recentFailures: state.recentFailures,
    retryCount: state.retryCount,
    startedAt: state.startedAt,
    stopRequested: state.stopRequested,
    timeoutMs: state.timeoutMs,
    totalFiles: state.totalFiles,
  };
}

async function getDownloadManagerStatus() {
  await ensureManifestLoaded();
  return buildSnapshot();
}

function appendFailure(failure) {
  state.recentFailures = [failure, ...state.recentFailures].slice(0, MAX_RECENT_FAILURES);
}

function buildRequestOptions(targetUrl) {
  const parsed = new URL(targetUrl);
  return {
    agent: parsed.protocol === 'https:' ? httpsAgent : httpAgent,
    headers: {
      accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
      'user-agent': 'scaner-downloader/1.0',
    },
    hostname: parsed.hostname,
    method: 'GET',
    path: `${parsed.pathname}${parsed.search}`,
    port: parsed.port || undefined,
    protocol: parsed.protocol,
  };
}

function openRequest(targetUrl, redirectsLeft, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.request(buildRequestOptions(targetUrl), (response) => {
      const statusCode = response.statusCode || 0;

      if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
        response.resume();

        if (redirectsLeft <= 0) {
          reject(new Error('Numero maximo de redirecionamentos excedido.'));
          return;
        }

        const redirectUrl = new URL(response.headers.location, targetUrl).href;
        openRequest(redirectUrl, redirectsLeft - 1, signal, timeoutMs).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }

      resolve({ response, finalUrl: targetUrl });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timeout apos ${timeoutMs}ms`));
    });

    request.on('error', reject);

    if (signal) {
      if (signal.aborted) {
        request.destroy(new Error('Abortado.'));
      } else {
        signal.addEventListener(
          'abort',
          () => {
            request.destroy(new Error('Abortado.'));
          },
          { once: true },
        );
      }
    }

    request.end();
  });
}

async function unlinkIfExists(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function resolveExistingFileAction(targetPath, overwrite, totalBytes) {
  try {
    const stats = await fsp.stat(targetPath);
    if (!stats.isFile()) {
      throw new Error('O destino ja existe e nao e um arquivo.');
    }

    if (overwrite) {
      await unlinkIfExists(targetPath);
      return { action: 'overwrite' };
    }

    if (Number.isFinite(totalBytes) && totalBytes >= 0 && stats.size === totalBytes) {
      return { action: 'complete-existing' };
    }

    throw new Error('O arquivo ja existe e nao pode ser sobrescrito com seguranca.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { action: 'download' };
    }

    throw error;
  }
}

async function markManifestCompleted(entry, downloadState, source) {
  state.manifest.items[entry.url] = {
    completedAt: new Date().toISOString(),
    fileName: entry.fileName,
    finalUrl: downloadState.finalUrl,
    lastError: null,
    source,
    status: 'completed',
    targetPath: downloadState.targetPath,
    totalBytes: downloadState.totalBytes,
    updatedAt: new Date().toISOString(),
    url: entry.url,
  };
  await persistManifest();
}

function buildLocalRelativePath(targetPath) {
  return toPosixPath(path.relative(getLocalLibraryRoot(), targetPath));
}

async function registerDownloadedLocalMirror(entry, downloadState) {
  const localRelativePath = buildLocalRelativePath(downloadState.targetPath);
  if (!localRelativePath || localRelativePath.startsWith('..')) {
    return;
  }

  attachLocalFileToDocumentsByPdfUrl(
    entry.url,
    localRelativePath,
    getMimeTypeByExtension(downloadState.targetPath || entry.fileName || ''),
  );
}

async function markManifestFailed(entry, downloadState, error) {
  state.manifest.items[entry.url] = {
    failedAt: new Date().toISOString(),
    fileName: entry.fileName,
    finalUrl: downloadState.finalUrl,
    lastError: error.message,
    status: 'failed',
    targetPath: downloadState.targetPath,
    totalBytes: downloadState.totalBytes,
    updatedAt: new Date().toISOString(),
    url: entry.url,
  };
  await persistManifest();
}

async function downloadSingleEntry(entry, slot) {
  const downloadState = {
    attempt: 0,
    controller: null,
    downloadedBytes: 0,
    fileName: entry.fileName,
    finalUrl: entry.url,
    slot,
    startedAt: new Date().toISOString(),
    status: 'connecting',
    targetPath: entry.targetPath,
    totalBytes: null,
    url: entry.url,
  };

  state.activeDownloads.set(entry.url, downloadState);
  markUpdated();

  const tempPath = `${entry.targetPath}.part`;
  await fsp.mkdir(path.dirname(entry.targetPath), { recursive: true });

  for (let attempt = 1; attempt <= state.retryCount + 1; attempt += 1) {
    const controller = new AbortController();
    downloadState.attempt = attempt;
    downloadState.controller = controller;
    downloadState.downloadedBytes = 0;
    downloadState.error = null;
    downloadState.startedAt = new Date().toISOString();
    downloadState.status = attempt === 1 ? 'connecting' : 'retrying';
    downloadState.totalBytes = null;
    markUpdated();

    try {
      await unlinkIfExists(tempPath);

      const { response, finalUrl } = await openRequest(entry.url, MAX_REDIRECTS, controller.signal, state.timeoutMs);
      downloadState.finalUrl = finalUrl;

      const totalBytes = Number(response.headers['content-length']);
      downloadState.totalBytes = Number.isFinite(totalBytes) && totalBytes >= 0 ? totalBytes : null;

      const existingAction = await resolveExistingFileAction(entry.targetPath, state.overwrite, downloadState.totalBytes);
      if (existingAction.action === 'complete-existing') {
        downloadState.status = 'done';
        await markManifestCompleted(entry, downloadState, 'existing');
        await registerDownloadedLocalMirror(entry, downloadState);
        state.completedFiles += 1;
        state.pendingFiles = Math.max(0, state.pendingFiles - 1);
        markUpdated();
        return;
      }

      downloadState.status = 'downloading';
      markUpdated();

      const fileStream = fs.createWriteStream(tempPath, { flags: 'w' });
      response.on('data', (chunk) => {
        downloadState.downloadedBytes += chunk.length;
        markUpdated();
      });

      await pipeline(response, fileStream, { signal: controller.signal });

      if (Number.isFinite(downloadState.totalBytes) && downloadState.downloadedBytes !== downloadState.totalBytes) {
        throw new Error('Download incompleto: tamanho final diferente do esperado.');
      }

      await fsp.rename(tempPath, entry.targetPath);
      downloadState.status = 'done';
      await markManifestCompleted(entry, downloadState, 'download');
      await registerDownloadedLocalMirror(entry, downloadState);
      state.completedFiles += 1;
      state.pendingFiles = Math.max(0, state.pendingFiles - 1);
      markUpdated();
      return;
    } catch (error) {
      await unlinkIfExists(tempPath);

      const aborted = state.stopRequested || error.message === 'Abortado.';
      downloadState.status = aborted ? 'stopped' : 'error';
      downloadState.error = error.message;
      markUpdated();

      if (aborted) {
        throw error;
      }

      if (attempt > state.retryCount) {
        await markManifestFailed(entry, downloadState, error);
        state.failedFiles += 1;
        state.pendingFiles = Math.max(0, state.pendingFiles - 1);
        appendFailure({
          fileName: entry.fileName,
          message: error.message,
          url: entry.url,
        });
        markUpdated();
        throw error;
      }
    }
  }
}

async function workerLoop(slot, sessionId) {
  while (state.sessionId === sessionId && !state.stopRequested) {
    const entry = state.queue.shift();
    if (!entry) {
      return;
    }

    try {
      await downloadSingleEntry(entry, slot);
    } catch (error) {
      if (state.stopRequested || error.message === 'Abortado.') {
        return;
      }
    } finally {
      state.activeDownloads.delete(entry.url);
      markUpdated();
    }
  }
}

async function runSession(sessionId) {
  const workers = Array.from({ length: state.concurrency }, (_, index) => workerLoop(index + 1, sessionId));

  try {
    await Promise.all(workers);
  } finally {
    for (const activeDownload of state.activeDownloads.values()) {
      activeDownload.controller?.abort();
    }

    state.activeDownloads.clear();
    state.active = false;
    state.message = state.stopRequested
      ? 'Downloads interrompidos. O progresso concluido foi preservado.'
      : 'Fila de downloads concluida.';
    markUpdated();
    await persistManifest();
  }
}

async function startBackgroundDownloads(options = {}) {
  await ensureManifestLoaded();

  if (state.active) {
    return buildSnapshot();
  }

  const { entries, inventoryPath } = await loadInventoryEntries();
  const concurrency = Math.max(1, Number(options.concurrency) || DEFAULT_CONCURRENCY);
  const retryCount = Math.max(0, Number(options.retryCount) || DEFAULT_RETRY_COUNT);
  const timeoutMs = Math.max(5000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const destinationDir = getLocalLibraryRoot();
  const overwrite = Boolean(options.overwrite);
  const queueData = await buildQueue(entries, destinationDir);

  state.active = true;
  state.activeDownloads = new Map();
  state.completedFiles = queueData.completedFiles;
  state.concurrency = concurrency;
  state.destinationDir = destinationDir;
  state.failedFiles = queueData.failedFiles;
  state.inventoryPath = inventoryPath;
  state.message =
    queueData.pendingFiles > 0
      ? `Fila preparada com ${queueData.pendingFiles} pendentes. Concluidos anteriores: ${queueData.completedFiles}.`
      : 'Nao ha downloads pendentes. Verifique se a fila ja foi concluida ou se existem falhas registradas.';
  state.overwrite = overwrite;
  state.pendingFiles = queueData.pendingFiles;
  state.queue = queueData.queue;
  state.retryCount = retryCount;
  state.sessionId += 1;
  state.startedAt = new Date().toISOString();
  state.stopRequested = false;
  state.timeoutMs = timeoutMs;
  state.totalFiles = queueData.totalFiles;
  state.manifest.destinationDir = destinationDir;
  state.manifest.inventoryPath = inventoryPath;
  markUpdated();
  await persistManifest();

  if (queueData.pendingFiles > 0) {
    void runSession(state.sessionId);
  } else {
    state.active = false;
  }

  return buildSnapshot();
}

async function stopBackgroundDownloads() {
  await ensureManifestLoaded();

  if (!state.active) {
    return buildSnapshot();
  }

  state.stopRequested = true;
  state.message = 'Solicitacao de parada recebida. Os itens concluidos continuam salvos para retomar depois.';
  for (const activeDownload of state.activeDownloads.values()) {
    activeDownload.controller?.abort();
  }
  markUpdated();
  await persistManifest();
  return buildSnapshot();
}

module.exports = {
  getDownloadManagerStatus,
  startBackgroundDownloads,
  stopBackgroundDownloads,
};
