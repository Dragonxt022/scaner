const { ensureDatabase } = require('../db/client');
const { runIndexBatch } = require('../services/indexer');
const { getIndexerQueueStats, getStats } = require('../services/repository');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value ?? 0);
}

function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  ensureDatabase();

  const batchLimit = readNumberEnv('BATCH_LIMIT', 25);
  const maxBatches = readNumberEnv('MAX_BATCHES', 1000);
  const maxProcessed = readNumberEnv('MAX_PROCESSED', 5000);
  const sleepMs = readNumberEnv('SLEEP_MS', 1500);
  const stopOnFirstError = process.env.STOP_ON_FIRST_ERROR === 'true';

  const startedAt = Date.now();
  let processedTotal = 0;
  let indexedTotal = 0;
  let errorTotal = 0;

  console.log('Loop de indexação iniciado.');
  console.log(
    `Configuração: lote=${batchLimit}, max_lotes=${maxBatches}, max_processados=${maxProcessed}, pausa_ms=${sleepMs}, stop_on_first_error=${stopOnFirstError}`,
  );

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const queueBefore = getIndexerQueueStats();
    if (!queueBefore.pendingContentGroups) {
      console.log('Fila vazia. Encerrando.');
      break;
    }

    console.log(
      `[lote ${batch}] pendentes=${formatNumber(queueBefore.pendingDocuments)} registros, grupos=${formatNumber(queueBefore.pendingContentGroups)}`,
    );

    const result = await runIndexBatch({ limit: batchLimit });
    const indexedInBatch = result.results.filter((item) => item.status === 'indexed').length;
    const errorsInBatch = result.results.filter((item) => item.status === 'error').length;

    processedTotal += result.processed;
    indexedTotal += indexedInBatch;
    errorTotal += errorsInBatch;

    console.log(
      `[lote ${batch}] processados=${formatNumber(result.processed)}, indexados=${formatNumber(indexedInBatch)}, erros=${formatNumber(errorsInBatch)}`,
    );

    if (!result.processed) {
      console.log('Nenhum item foi processado no lote. Encerrando.');
      break;
    }

    if (stopOnFirstError && errorsInBatch) {
      console.log('Erro detectado com STOP_ON_FIRST_ERROR=true. Encerrando.');
      break;
    }

    if (processedTotal >= maxProcessed) {
      console.log(`Limite máximo de processados atingido (${formatNumber(maxProcessed)}). Encerrando.`);
      break;
    }

    if (batch < maxBatches) {
      await sleep(sleepMs);
    }
  }

  const finalStats = getStats();
  const finalQueue = getIndexerQueueStats();
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);

  console.log('Resumo final:');
  console.log(
    JSON.stringify(
      {
        elapsedSeconds,
        errorTotal,
        indexedTotal,
        processedTotal,
        queue: finalQueue,
        stats: finalStats,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('Falha no loop de indexação:', error);
  process.exit(1);
});
