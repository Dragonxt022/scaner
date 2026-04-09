PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  content_key TEXT NOT NULL,
  hash_verificacao TEXT,
  pdf_url TEXT NOT NULL,
  detail_url TEXT,
  nome_arquivo TEXT,
  classificacao TEXT,
  caixa TEXT,
  descricao TEXT,
  ano TEXT,
  index_status TEXT NOT NULL DEFAULT 'pending',
  index_error TEXT,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  text_length INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0,
  last_indexed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_hash_verificacao ON documents(hash_verificacao);
CREATE INDEX IF NOT EXISTS idx_documents_content_key ON documents(content_key);
CREATE INDEX IF NOT EXISTS idx_documents_ano ON documents(ano);
CREATE INDEX IF NOT EXISTS idx_documents_caixa ON documents(caixa);
CREATE INDEX IF NOT EXISTS idx_documents_classificacao ON documents(classificacao);
CREATE INDEX IF NOT EXISTS idx_documents_index_status ON documents(index_status);
CREATE INDEX IF NOT EXISTS idx_documents_access_count ON documents(access_count);
CREATE INDEX IF NOT EXISTS idx_documents_last_accessed_at ON documents(last_accessed_at);

CREATE TABLE IF NOT EXISTS document_contents (
  document_id INTEGER PRIMARY KEY,
  extracted_text TEXT NOT NULL,
  extractor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  nome_arquivo,
  classificacao,
  caixa,
  descricao,
  ano,
  extracted_text,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_enrichments (
  document_id INTEGER PRIMARY KEY,
  summary_text TEXT,
  summary_source TEXT,
  summary_model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_preview_images (
  document_id INTEGER PRIMARY KEY,
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cpf TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_changed_at TEXT,
  terms_accepted_at TEXT,
  terms_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users(is_active);
CREATE INDEX IF NOT EXISTS idx_app_users_locked_until ON app_users(locked_until);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  target_path TEXT,
  method TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON user_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_created_at ON user_access_logs(created_at);

CREATE TABLE IF NOT EXISTS user_search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  query_text TEXT,
  search_type TEXT NOT NULL DEFAULT 'text',
  classificacao TEXT,
  caixa TEXT,
  ano TEXT,
  only_indexed INTEGER NOT NULL DEFAULT 0,
  page INTEGER NOT NULL DEFAULT 1,
  page_size INTEGER NOT NULL DEFAULT 10,
  result_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_search_logs_user_id ON user_search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_logs_created_at ON user_search_logs(created_at);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by_ip TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  issued_code_hash TEXT,
  issued_code_preview TEXT,
  issued_at TEXT,
  expires_at TEXT,
  consumed_at TEXT,
  consumed_by_ip TEXT,
  admin_user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY(admin_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at ON password_reset_requests(expires_at);
