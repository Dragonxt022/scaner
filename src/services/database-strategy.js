const config = require('../config');

function getDatabaseStrategy() {
  if (config.dbDialect === 'mysql') {
    return {
      adminCrud: 'sequelize-mysql',
      dialect: 'mysql',
      indexingStrategy: 'metadata-via-sequelize, conteudo textual ainda pendente de migracao',
      searchStrategy: 'planejado: mysql fulltext + fallback por metadata',
      supportedForFullApp: false,
    };
  }

  return {
    adminCrud: 'sequelize-sqlite',
    dialect: 'sqlite',
    indexingStrategy: 'sqlite + document_contents + FTS5',
    searchStrategy: 'fts5 bm25 snippet + fallback metadata',
    supportedForFullApp: true,
  };
}

module.exports = {
  getDatabaseStrategy,
};
