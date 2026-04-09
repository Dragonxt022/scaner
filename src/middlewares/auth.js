const config = require('../config');
const { getSessionUserByToken, normalizeCpf, parseCookies, serializePublicUser } = require('../services/auth');

function isPrivateHost(hostname) {
  const value = String(hostname || '').toLowerCase().split(':')[0];
  if (!value) return true;
  if (value === 'localhost' || value === '127.0.0.1' || value === '::1') return true;
  if (/^10\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
  return false;
}

function enforceHttps(request, response, next) {
  if (!config.enforceHttpsOutsideLocalNetwork) {
    next();
    return;
  }

  const hostHeader = String(request.headers.host || '');
  if (isPrivateHost(hostHeader)) {
    next();
    return;
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const secure = request.secure || forwardedProto === 'https';
  if (secure) {
    next();
    return;
  }

  response.redirect(301, `https://${hostHeader}${request.originalUrl || '/'}`);
}

function attachAuthContext(request, response, next) {
  if (!config.authEnabled) {
    request.authUser = {
      cpf: normalizeCpf(config.defaultAdminCpf),
      full_name: config.defaultAdminName,
      id: 0,
      is_active: 1,
      role: 'admin',
    };
    response.locals.currentUser = serializePublicUser(request.authUser);
    response.locals.authEnabled = false;
    response.locals.canAccessAdmin = true;
    next();
    return;
  }

  const cookies = parseCookies(request.headers.cookie || '');
  const sessionToken = cookies[config.sessionCookieName];
  const user = getSessionUserByToken(sessionToken);
  request.authUser = user || null;
  request.sessionToken = sessionToken || '';
  response.locals.currentUser = serializePublicUser(user);
  response.locals.authEnabled = true;
  response.locals.canAccessAdmin = Boolean(user?.role === 'admin');
  next();
}

function requireAuthApi(request, response, next) {
  if (request.authUser) {
    if (request.authUser.must_change_password && !request.path.startsWith('/auth/')) {
      response.status(428).json({ error: 'Troca de senha obrigatoria antes de continuar.' });
      return;
    }
    next();
    return;
  }
  response.status(401).json({ error: 'Sessao expirada ou acesso nao autenticado.' });
}

function requireAdminApi(request, response, next) {
  if (request.authUser?.role === 'admin') {
    next();
    return;
  }
  response.status(request.authUser ? 403 : 401).json({
    error: request.authUser ? 'Acesso restrito a administradores.' : 'Sessao expirada ou acesso nao autenticado.',
  });
}

function requireAuthPage(request, response, next) {
  if (request.authUser) {
    if (request.authUser.must_change_password && request.path !== '/security') {
      response.redirect(302, '/security');
      return;
    }
    next();
    return;
  }
  response.redirect(302, `/login?next=${encodeURIComponent(request.originalUrl || '/')}`);
}

function requireAdminPage(request, response, next) {
  if (request.authUser?.role === 'admin') {
    if (request.authUser.must_change_password && request.path !== '/security') {
      response.redirect(302, '/security');
      return;
    }
    next();
    return;
  }
  if (!request.authUser) {
    response.redirect(302, `/login?next=${encodeURIComponent(request.originalUrl || '/config')}`);
    return;
  }
  response.redirect(302, '/');
}

module.exports = {
  attachAuthContext,
  enforceHttps,
  requireAdminApi,
  requireAdminPage,
  requireAuthApi,
  requireAuthPage,
};
