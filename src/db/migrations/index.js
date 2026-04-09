const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const { getSequelize } = require('../sequelize');

const MIGRATIONS_TABLE = 'sequelize_meta_migrations';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((item) => (typeof item === 'string' ? item : item.tableName || item.table_name || ''))
    .some((item) => String(item).toLowerCase() === tableName.toLowerCase());
}

function loadMigrations() {
  const migrationsDir = __dirname;
  return fs.readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.js') && fileName !== 'index.js')
    .sort()
    .map((fileName) => require(path.join(migrationsDir, fileName)));
}

async function ensureMigrationsTable(queryInterface) {
  if (await tableExists(queryInterface, MIGRATIONS_TABLE)) {
    return;
  }

  await queryInterface.createTable(MIGRATIONS_TABLE, {
    applied_at: {
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      type: Sequelize.DATE,
    },
    name: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.STRING,
    },
  });
}

async function getAppliedMigrationNames(queryInterface) {
  const rows = await queryInterface.sequelize.query(
    `SELECT name FROM ${MIGRATIONS_TABLE}`,
    { type: Sequelize.QueryTypes.SELECT },
  );

  return new Set(rows.map((row) => row.name));
}

async function recordMigration(queryInterface, migrationName) {
  await queryInterface.bulkInsert(MIGRATIONS_TABLE, [{
    applied_at: new Date(),
    name: migrationName,
  }]);
}

async function runMigrations() {
  const sequelize = getSequelize();
  const queryInterface = sequelize.getQueryInterface();

  await ensureMigrationsTable(queryInterface);
  const appliedNames = await getAppliedMigrationNames(queryInterface);
  const migrations = loadMigrations();

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      continue;
    }

    await migration.up({ Sequelize, queryInterface, sequelize });
    await recordMigration(queryInterface, migration.name);
  }
}

module.exports = {
  runMigrations,
};
