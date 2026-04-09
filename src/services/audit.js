const { getDb } = require('../db/client');
const { getRequestIp } = require('./auth');

function recordAccessLog(request, user, eventType, details = '') {
  if (!user?.id) return;
  getDb().prepare(`
    INSERT INTO user_access_logs (user_id, event_type, target_path, method, ip_address, user_agent, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    String(eventType || 'access').slice(0, 80),
    String(request.originalUrl || request.path || '').slice(0, 500),
    String(request.method || '').slice(0, 20),
    getRequestIp(request),
    String(request.headers['user-agent'] || '').slice(0, 500),
    String(details || '').slice(0, 1000),
  );
}

function recordSearchLog(user, payload = {}) {
  if (!user?.id) return;
  getDb().prepare(`
    INSERT INTO user_search_logs (
      user_id,
      query_text,
      search_type,
      classificacao,
      caixa,
      ano,
      only_indexed,
      page,
      page_size,
      result_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    String(payload.queryText || '').slice(0, 500),
    String(payload.searchType || 'text').slice(0, 40),
    String(payload.classificacao || '').slice(0, 120),
    String(payload.caixa || '').slice(0, 120),
    String(payload.ano || '').slice(0, 20),
    payload.onlyIndexed ? 1 : 0,
    Math.max(1, Number(payload.page || 1)),
    Math.max(1, Number(payload.pageSize || 10)),
    Math.max(0, Number(payload.resultTotal || 0)),
  );
}

function listAccessLogs(limit = 100) {
  return getDb().prepare(`
    SELECT
      l.id,
      l.event_type,
      l.target_path,
      l.method,
      l.ip_address,
      l.user_agent,
      l.details,
      l.created_at,
      u.id AS user_id,
      u.cpf,
      u.full_name,
      u.role
    FROM user_access_logs l
    JOIN app_users u ON u.id = l.user_id
    ORDER BY datetime(l.created_at) DESC, l.id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit || 100))));
}

function listSearchLogs(limit = 100) {
  return getDb().prepare(`
    SELECT
      l.id,
      l.query_text,
      l.search_type,
      l.classificacao,
      l.caixa,
      l.ano,
      l.only_indexed,
      l.page,
      l.page_size,
      l.result_total,
      l.created_at,
      u.id AS user_id,
      u.cpf,
      u.full_name,
      u.role
    FROM user_search_logs l
    JOIN app_users u ON u.id = l.user_id
    ORDER BY datetime(l.created_at) DESC, l.id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit || 100))));
}

function listSearchLogsByUser(userId, limit = 100) {
  return getDb().prepare(`
    SELECT
      l.id,
      l.query_text,
      l.search_type,
      l.classificacao,
      l.caixa,
      l.ano,
      l.only_indexed,
      l.page,
      l.page_size,
      l.result_total,
      l.created_at,
      u.id AS user_id,
      u.cpf,
      u.full_name,
      u.role
    FROM user_search_logs l
    JOIN app_users u ON u.id = l.user_id
    WHERE l.user_id = ?
    ORDER BY datetime(l.created_at) DESC, l.id DESC
    LIMIT ?
  `).all(
    Number(userId || 0),
    Math.max(1, Math.min(500, Number(limit || 100))),
  );
}

module.exports = {
  listAccessLogs,
  listSearchLogs,
  listSearchLogsByUser,
  recordAccessLog,
  recordSearchLog,
};
