const crypto = require('node:crypto');
const config = require('../config');
const { getDb } = require('../db/client');

const PASSWORD_RULE_TEXT = 'A senha deve ter ao menos 6 caracteres, 1 letra maiuscula, 1 numero e 1 caractere especial.';

function ensureAuthSchema() {
  const db = getDb();

  db.exec(`
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
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
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
    )
  `);

  const columns = db.prepare(`PRAGMA table_info(app_users)`).all().map((column) => column.name);
  const addColumn = (name, sql) => {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE app_users ADD COLUMN ${sql}`);
      columns.push(name);
    }
  };
  addColumn('failed_login_attempts', 'failed_login_attempts INTEGER NOT NULL DEFAULT 0');
  addColumn('locked_until', 'locked_until TEXT');
  addColumn('must_change_password', 'must_change_password INTEGER NOT NULL DEFAULT 0');
  addColumn('password_changed_at', 'password_changed_at TEXT');
  addColumn('terms_accepted_at', 'terms_accepted_at TEXT');
  addColumn('terms_version', 'terms_version TEXT');
}

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function parseCookies(headerValue) {
  const cookies = {};
  for (const chunk of String(headerValue || '').split(';')) {
    const [name, ...rest] = chunk.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('=') || '');
  }
  return cookies;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hashSessionToken(token) {
  return hashValue(token);
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expected] = String(storedHash || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) {
    return false;
  }

  const actual = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 6) {
    return { ok: false, error: PASSWORD_RULE_TEXT };
  }
  if (!/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, error: PASSWORD_RULE_TEXT };
  }
  return { ok: true };
}

function serializePublicUser(user) {
  if (!user) return null;
  return {
    cpf: user.cpf,
    created_at: user.created_at,
    failed_login_attempts: Number(user.failed_login_attempts || 0),
    full_name: user.full_name,
    id: user.id,
    is_active: Boolean(user.is_active),
    last_login_at: user.last_login_at,
    locked_until: user.locked_until || null,
    must_change_password: Boolean(user.must_change_password),
    password_changed_at: user.password_changed_at || null,
    role: user.role,
    terms_accepted_at: user.terms_accepted_at || null,
    terms_version: user.terms_version || null,
    updated_at: user.updated_at,
  };
}

function getUserByCpf(cpf) {
  ensureAuthSchema();
  return getDb().prepare(`
    SELECT *
    FROM app_users
    WHERE cpf = ?
  `).get(normalizeCpf(cpf));
}

function getUserById(id) {
  ensureAuthSchema();
  return getDb().prepare(`
    SELECT *
    FROM app_users
    WHERE id = ?
  `).get(Number(id) || 0);
}

function listUsers() {
  ensureAuthSchema();
  return getDb().prepare(`
    SELECT *
    FROM app_users
    ORDER BY
      CASE role WHEN 'admin' THEN 0 ELSE 1 END,
      is_active DESC,
      full_name COLLATE NOCASE ASC
  `).all().map(serializePublicUser);
}

function createUser({
  cpf,
  fullName,
  password,
  role = 'user',
  isActive = true,
  mustChangePassword = true,
} = {}) {
  ensureAuthSchema();
  const normalizedCpf = normalizeCpf(cpf);
  if (normalizedCpf.length !== 11) {
    throw new Error('CPF invalido. Informe 11 digitos.');
  }

  const normalizedName = String(fullName || '').trim();
  if (normalizedName.length < 3) {
    throw new Error('Informe o nome completo do usuario.');
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'user';
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  if (getUserByCpf(normalizedCpf)) {
    throw new Error('Ja existe um usuario cadastrado com este CPF.');
  }

  const result = getDb().prepare(`
    INSERT INTO app_users (
      cpf,
      full_name,
      role,
      password_hash,
      is_active,
      must_change_password,
      password_changed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    normalizedCpf,
    normalizedName,
    normalizedRole,
    createPasswordHash(password),
    isActive ? 1 : 0,
    mustChangePassword ? 1 : 0,
    mustChangePassword ? null : new Date().toISOString(),
  );

  return serializePublicUser(getUserById(result.lastInsertRowid));
}

function updateUser(userId, payload = {}) {
  ensureAuthSchema();
  const existing = getUserById(userId);
  if (!existing) {
    throw new Error('Usuario nao encontrado.');
  }

  const fullName = Object.prototype.hasOwnProperty.call(payload, 'fullName')
    ? String(payload.fullName || '').trim()
    : existing.full_name;
  if (fullName.length < 3) {
    throw new Error('Informe o nome completo do usuario.');
  }

  const role = payload.role === 'admin' ? 'admin' : payload.role === 'user' ? 'user' : existing.role;
  const isActive = Object.prototype.hasOwnProperty.call(payload, 'isActive')
    ? Boolean(payload.isActive)
    : Boolean(existing.is_active);

  let passwordHash = existing.password_hash;
  let mustChangePassword = Object.prototype.hasOwnProperty.call(payload, 'mustChangePassword')
    ? Boolean(payload.mustChangePassword)
    : Boolean(existing.must_change_password);
  let passwordChangedAt = existing.password_changed_at || null;

  if (payload.password) {
    const passwordCheck = validatePasswordStrength(payload.password);
    if (!passwordCheck.ok) {
      throw new Error(passwordCheck.error);
    }
    passwordHash = createPasswordHash(payload.password);
    if (!Object.prototype.hasOwnProperty.call(payload, 'mustChangePassword')) {
      mustChangePassword = true;
    }
    passwordChangedAt = mustChangePassword ? null : new Date().toISOString();
  }

  getDb().prepare(`
    UPDATE app_users
    SET
      full_name = ?,
      role = ?,
      is_active = ?,
      password_hash = ?,
      must_change_password = ?,
      password_changed_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    fullName,
    role,
    isActive ? 1 : 0,
    passwordHash,
    mustChangePassword ? 1 : 0,
    passwordChangedAt,
    existing.id,
  );

  return serializePublicUser(getUserById(existing.id));
}

function changeOwnPassword(userId, currentPassword, newPassword) {
  ensureAuthSchema();
  const existing = getUserById(userId);
  if (!existing) {
    throw new Error('Usuario nao encontrado.');
  }
  if (!verifyPassword(currentPassword, existing.password_hash)) {
    throw new Error('Senha atual invalida.');
  }
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  getDb().prepare(`
    UPDATE app_users
    SET
      password_hash = ?,
      must_change_password = 0,
      password_changed_at = CURRENT_TIMESTAMP,
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(createPasswordHash(newPassword), existing.id);

  return serializePublicUser(getUserById(existing.id));
}

function acceptTermsForUser(userId) {
  ensureAuthSchema();
  const existing = getUserById(userId);
  if (!existing) {
    throw new Error('Usuario nao encontrado.');
  }

  getDb().prepare(`
    UPDATE app_users
    SET
      terms_accepted_at = CURRENT_TIMESTAMP,
      terms_version = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(config.termsVersion, existing.id);

  return serializePublicUser(getUserById(existing.id));
}

function ensureDefaultAdminUser() {
  ensureAuthSchema();
  if (!config.authEnabled) {
    return null;
  }

  const totalAdmins = getDb().prepare(`
    SELECT COUNT(*) AS total
    FROM app_users
    WHERE role = 'admin'
  `).get()?.total || 0;

  if (totalAdmins > 0) {
    return null;
  }

  return createUser({
    cpf: config.defaultAdminCpf,
    fullName: config.defaultAdminName,
    mustChangePassword: true,
    password: config.defaultAdminPassword,
    role: 'admin',
  });
}

function createSession(user, request) {
  ensureAuthSchema();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const sessionHours = Math.max(1, Number(config.sessionDurationHours || 12));

  getDb().prepare(`
    INSERT INTO user_sessions (user_id, token_hash, expires_at, last_seen_at, user_agent, ip_address)
    VALUES (?, ?, datetime('now', ?), CURRENT_TIMESTAMP, ?, ?)
  `).run(
    user.id,
    tokenHash,
    `+${sessionHours} hour`,
    String(request.headers['user-agent'] || '').slice(0, 500),
    getRequestIp(request),
  );

  getDb().prepare(`
    UPDATE app_users
    SET
      last_login_at = CURRENT_TIMESTAMP,
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id);

  return rawToken;
}

function destroySessionByToken(token) {
  ensureAuthSchema();
  if (!token) return;
  getDb().prepare(`DELETE FROM user_sessions WHERE token_hash = ?`).run(hashSessionToken(token));
}

function getSessionUserByToken(token) {
  ensureAuthSchema();
  if (!token) return null;

  const idleMinutes = Math.max(1, Number(config.sessionIdleMinutes || 30));
  const row = getDb().prepare(`
    SELECT u.*, s.id AS session_id
    FROM user_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND datetime(s.expires_at) > datetime('now')
      AND datetime(s.last_seen_at) > datetime('now', ?)
      AND u.is_active = 1
    LIMIT 1
  `).get(hashSessionToken(token), `-${idleMinutes} minute`);

  if (!row) {
    getDb().prepare(`DELETE FROM user_sessions WHERE token_hash = ?`).run(hashSessionToken(token));
    return null;
  }

  getDb().prepare(`
    UPDATE user_sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(row.session_id);

  return row;
}

function registerLoginFailure(user) {
  ensureAuthSchema();
  if (!user?.id) return;

  const nextAttempts = Number(user.failed_login_attempts || 0) + 1;
  const shouldLock = nextAttempts >= Math.max(1, Number(config.maxLoginAttempts || 5));
  getDb().prepare(`
    UPDATE app_users
    SET
      failed_login_attempts = ?,
      locked_until = CASE WHEN ? THEN datetime('now', ?) ELSE locked_until END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    shouldLock ? 0 : nextAttempts,
    shouldLock ? 1 : 0,
    `+${Math.max(1, Number(config.loginLockMinutes || 15))} minute`,
    user.id,
  );
}

function isUserLocked(user) {
  if (!user?.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

function authenticateUser(cpf, password) {
  ensureAuthSchema();
  const user = getUserByCpf(cpf);
  if (!user || !user.is_active) {
    return { error: 'CPF ou senha invalidos.', ok: false };
  }
  if (isUserLocked(user)) {
    return { error: 'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.', ok: false };
  }
  if (!verifyPassword(password, user.password_hash)) {
    registerLoginFailure(user);
    return { error: 'CPF ou senha invalidos.', ok: false };
  }
  return { ok: true, user };
}

function getRequestIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket?.remoteAddress || '';
}

function setSessionCookie(response, token) {
  const maxAge = Math.max(1, Number(config.sessionDurationHours || 12)) * 60 * 60;
  response.setHeader(
    'Set-Cookie',
    `${config.sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${config.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function listPasswordResetRequests(limit = 100) {
  ensureAuthSchema();
  return getDb().prepare(`
    SELECT
      r.*,
      u.cpf,
      u.full_name,
      u.role,
      a.full_name AS admin_full_name
    FROM password_reset_requests r
    JOIN app_users u ON u.id = r.user_id
    LEFT JOIN app_users a ON a.id = r.admin_user_id
    ORDER BY datetime(r.requested_at) DESC, r.id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit || 100))));
}

function requestPasswordReset(cpf, requestIp) {
  ensureAuthSchema();
  const user = getUserByCpf(cpf);
  if (!user || !user.is_active) {
    return { ok: true };
  }

  getDb().prepare(`
    INSERT INTO password_reset_requests (user_id, requested_by_ip, status, requested_at)
    VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(user.id, String(requestIp || '').slice(0, 120));

  return { ok: true };
}

function issuePasswordResetCode(requestId, adminUserId) {
  ensureAuthSchema();
  const existing = getDb().prepare(`
    SELECT *
    FROM password_reset_requests
    WHERE id = ?
  `).get(Number(requestId) || 0);

  if (!existing) {
    throw new Error('Solicitacao de recuperacao nao encontrada.');
  }
  if (existing.status === 'consumed') {
    throw new Error('Esta solicitacao ja foi consumida.');
  }

  const rawCode = crypto.randomBytes(8).toString('hex').slice(0, Math.max(6, Number(config.passwordResetCodeLength || 8))).toUpperCase();
  const expiresMinutes = Math.max(5, Number(config.passwordResetExpiryMinutes || 30));

  getDb().prepare(`
    UPDATE password_reset_requests
    SET
      status = 'issued',
      issued_code_hash = ?,
      issued_code_preview = ?,
      issued_at = CURRENT_TIMESTAMP,
      expires_at = datetime('now', ?),
      admin_user_id = ?
    WHERE id = ?
  `).run(
    hashValue(rawCode),
    `${rawCode.slice(0, 4)}...`,
    `+${expiresMinutes} minute`,
    adminUserId || null,
    existing.id,
  );

  return {
    code: rawCode,
    request: getDb().prepare(`
      SELECT
        r.*,
        u.cpf,
        u.full_name,
        u.role
      FROM password_reset_requests r
      JOIN app_users u ON u.id = r.user_id
      WHERE r.id = ?
    `).get(existing.id),
  };
}

function resetPasswordWithCode(cpf, code, newPassword, requestIp) {
  ensureAuthSchema();
  const user = getUserByCpf(cpf);
  if (!user) {
    throw new Error('CPF ou codigo invalidos.');
  }

  const requestRow = getDb().prepare(`
    SELECT *
    FROM password_reset_requests
    WHERE user_id = ?
      AND status = 'issued'
      AND datetime(expires_at) > datetime('now')
    ORDER BY datetime(issued_at) DESC, id DESC
    LIMIT 1
  `).get(user.id);

  if (!requestRow || hashValue(code) !== requestRow.issued_code_hash) {
    throw new Error('CPF ou codigo invalidos.');
  }

  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  getDb().prepare(`
    UPDATE app_users
    SET
      password_hash = ?,
      must_change_password = 0,
      password_changed_at = CURRENT_TIMESTAMP,
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(createPasswordHash(newPassword), user.id);

  getDb().prepare(`
    UPDATE password_reset_requests
    SET
      status = 'consumed',
      consumed_at = CURRENT_TIMESTAMP,
      consumed_by_ip = ?
    WHERE id = ?
  `).run(String(requestIp || '').slice(0, 120), requestRow.id);

  return serializePublicUser(getUserById(user.id));
}

module.exports = {
  PASSWORD_RULE_TEXT,
  acceptTermsForUser,
  authenticateUser,
  changeOwnPassword,
  clearSessionCookie,
  createSession,
  createUser,
  destroySessionByToken,
  ensureDefaultAdminUser,
  getRequestIp,
  getSessionUserByToken,
  getUserByCpf,
  getUserById,
  issuePasswordResetCode,
  listPasswordResetRequests,
  listUsers,
  normalizeCpf,
  parseCookies,
  requestPasswordReset,
  resetPasswordWithCode,
  serializePublicUser,
  setSessionCookie,
  updateUser,
  validatePasswordStrength,
};
