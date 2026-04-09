const { ensureDatabase } = require('../db/client');
const { getIndexerQueueStats, resetIndexing } = require('../services/repository');

function main() {
  ensureDatabase();

  const before = getIndexerQueueStats();
  const after = resetIndexing();

  console.log(
    JSON.stringify(
      {
        after,
        before,
        message: 'Indexação resetada. Catálogo preservado e conteúdo removido.',
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error('Falha ao resetar indexação:', error);
  process.exit(1);
}
