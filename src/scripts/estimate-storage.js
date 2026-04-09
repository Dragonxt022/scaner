const fs = require('node:fs/promises');
const path = require('node:path');

const inventoryPath = path.resolve(process.cwd(), process.env.INVENTORY_PATH || 'artifacts/pdf-links.json');
const outputPath = path.resolve(process.cwd(), process.env.OUTPUT_PATH || 'artifacts/pdf-size-report.json');
const concurrency = Number(process.env.CONCURRENCY || 8);
const timeoutMs = Number(process.env.TIMEOUT_MS || 15000);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'desconhecido';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function parseTotalFromContentRange(headerValue) {
  if (!headerValue) {
    return null;
  }

  const match = String(headerValue).match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function requestFileSize(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (headResponse.ok) {
      const contentLength = Number(headResponse.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength >= 0) {
        return {
          ok: true,
          size: contentLength,
          method: 'HEAD',
          status: headResponse.status,
        };
      }
    }

    const rangeResponse = await fetch(url, {
      method: 'GET',
      headers: { range: 'bytes=0-0' },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      return {
        ok: false,
        size: null,
        method: 'RANGE',
        status: rangeResponse.status,
        error: `HTTP ${rangeResponse.status}`,
      };
    }

    const totalFromRange = parseTotalFromContentRange(rangeResponse.headers.get('content-range'));
    const contentLength = Number(rangeResponse.headers.get('content-length'));
    const size = totalFromRange ?? (Number.isFinite(contentLength) && contentLength > 1 ? contentLength : null);

    return {
      ok: Number.isFinite(size),
      size,
      method: 'RANGE',
      status: rangeResponse.status,
      error: Number.isFinite(size) ? null : 'Tamanho nao informado pelo servidor',
    };
  } catch (error) {
    return {
      ok: false,
      size: null,
      method: 'ERROR',
      status: null,
      error: error.name === 'AbortError' ? `Timeout apos ${timeoutMs}ms` : error.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(runners);

  return results;
}

async function loadUniquePdfUrls() {
  const raw = await fs.readFile(inventoryPath, 'utf8');
  const records = JSON.parse(raw);
  const urls = Array.from(
    new Set(
      records
        .map((record) => record.pdfUrl)
        .filter((value) => typeof value === 'string' && value.trim()),
    ),
  );

  return { records, urls };
}

async function main() {
  const { records, urls } = await loadUniquePdfUrls();
  console.log(`Registros no inventario: ${records.length}`);
  console.log(`PDFs unicos encontrados: ${urls.length}`);
  console.log(`Consultando tamanho dos arquivos com concorrencia ${concurrency}...`);

  const results = await mapWithConcurrency(urls, concurrency, async (url, index) => {
    const result = await requestFileSize(url);

    if ((index + 1) % 100 === 0 || index === urls.length - 1) {
      console.log(`Consultas concluidas: ${index + 1}/${urls.length}`);
    }

    return {
      url,
      ...result,
    };
  });

  const okResults = results.filter((item) => item.ok && Number.isFinite(item.size));
  const failedResults = results.filter((item) => !item.ok);
  const totalBytes = okResults.reduce((sum, item) => sum + item.size, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    inventoryPath,
    totalRecords: records.length,
    uniquePdfCount: urls.length,
    resolvedSizeCount: okResults.length,
    unresolvedSizeCount: failedResults.length,
    totalBytes,
    totalHuman: formatBytes(totalBytes),
    failures: failedResults,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log(`Tamanho total conhecido: ${report.totalHuman} (${report.totalBytes} bytes)`);
  console.log(`Arquivos com tamanho resolvido: ${report.resolvedSizeCount}/${report.uniquePdfCount}`);
  console.log(`Relatorio salvo em: ${outputPath}`);

  if (failedResults.length > 0) {
    console.log(`Arquivos sem tamanho identificado: ${failedResults.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
