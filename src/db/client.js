const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');

let db;

function migrateDatabase(database) {
  const hasDocumentsTable = database
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documents'`)
    .get();
  const addColumnIfMissing = (tableName, name, sql) => {
    const hasTable = database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(tableName);
    if (!hasTable) {
      return;
    }

    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
    if (!columns.includes(name)) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${sql}`);
    }
  };

  if (hasDocumentsTable) {
    addColumnIfMissing('documents', 'content_key', 'content_key TEXT');
    addColumnIfMissing('documents', 'index_attempts', 'index_attempts INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('documents', 'last_index_method', 'last_index_method TEXT');
    addColumnIfMissing('documents', 'last_error_at', 'last_error_at TEXT');
    addColumnIfMissing('documents', 'access_count', 'access_count INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('documents', 'last_accessed_at', 'last_accessed_at TEXT');

    database.exec(`
      UPDATE documents
      SET content_key = COALESCE(NULLIF(content_key, ''), NULLIF(hash_verificacao, ''), pdf_url)
      WHERE content_key IS NULL OR content_key = ''
    `);
  }

  addColumnIfMissing('app_users', 'failed_login_attempts', 'failed_login_attempts INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('app_users', 'locked_until', 'locked_until TEXT');
  addColumnIfMissing('app_users', 'must_change_password', 'must_change_password INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('app_users', 'password_changed_at', 'password_changed_at TEXT');
  addColumnIfMissing('app_users', 'terms_accepted_at', 'terms_accepted_at TEXT');
  addColumnIfMissing('app_users', 'terms_version', 'terms_version TEXT');
}

function ensureDatabase() {
  if (config.dbDialect !== 'sqlite') {
    throw new Error(
      `DB_DIALECT=${config.dbDialect} configurado, mas a camada atual de repositorio/busca ainda depende de SQLite/FTS5. ` +
      'O Sequelize ja foi instalado e a conexao multi-banco foi preparada, mas a migracao funcional completa ainda nao foi concluida.',
    );
  }

  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateDatabase(db);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function getDb() {
  return ensureDatabase();
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { ensureDatabase, getDb, closeDatabase };
