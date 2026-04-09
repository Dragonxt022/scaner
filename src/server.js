const os = require('node:os');
const config = require('./config');
const { createApp } = require('./app');
const { ensureDatabase } = require('./db/client');
const { runMigrations } = require('./db/migrations');
const { authenticateDatabase } = require('./db/sequelize');
const { syncCatalogFromArtifacts } = require('./services/catalog-sync');
const { ensureDefaultAdminUser } = require('./services/auth');

function resolveLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const items of Object.values(interfaces)) {
    for (const item of items || []) {
      if (!item || item.internal || item.family !== 'IPv4') continue;
      addresses.push(item.address);
    }
  }

  return [...new Set(addresses)];
}

async function bootstrap() {
  const database = await authenticateDatabase();
  console.log(`Banco conectado via Sequelize: ${database.dialect} -> ${database.database}`);
  await runMigrations();

  ensureDatabase();
  const seededAdmin = ensureDefaultAdminUser();
  if (seededAdmin) {
    console.log(`Admin inicial criado: CPF ${seededAdmin.cpf} com senha definida em ADMIN_DEFAULT_PASSWORD.`);
  }

  if (config.syncCatalogOnBoot) {
    const result = await syncCatalogFromArtifacts();
    console.log(`Catalogo sincronizado: ${result.totalUnicos} documentos unicos.`);
  }

  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`Interface disponivel localmente em http://localhost:${config.port}`);
    if (config.host === '0.0.0.0') {
      const addresses = resolveLocalNetworkAddresses();
      for (const address of addresses) {
        console.log(`Interface disponivel na rede em http://${address}:${config.port}`);
      }
    } else {
      console.log(`Interface vinculada ao host ${config.host}:${config.port}`);
    }
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar a aplicacao:', error);
  process.exitCode = 1;
});
