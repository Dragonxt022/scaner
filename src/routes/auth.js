const express = require('express');
const config = require('../config');
const {
  acceptTermsForUser,
  authenticateUser,
  changeOwnPassword,
  clearSessionCookie,
  createSession,
  destroySessionByToken,
  normalizeCpf,
  requestAccess,
  requestPasswordReset,
  resetPasswordWithCode,
  serializePublicUser,
  setSessionCookie,
} = require('../services/auth');
const { recordAccessLog } = require('../services/audit');

const router = express.Router();

router.get('/session', (request, response) => {
  response.json({
    authEnabled: config.authEnabled,
    termsVersion: config.termsVersion,
    user: serializePublicUser(request.authUser),
  });
});

router.post('/login', (request, response) => {
  if (!config.authEnabled) {
    response.json({
      authEnabled: false,
      user: serializePublicUser(request.authUser),
    });
    return;
  }

  const cpf = normalizeCpf(request.body?.cpf);
  const password = String(request.body?.password || '');
  const result = authenticateUser(cpf, password);

  if (!result.ok) {
    response.status(401).json({ error: result.error || 'CPF ou senha invalidos.' });
    return;
  }
  const { user } = result;

  const token = createSession(user, request);
  setSessionCookie(response, token);
  recordAccessLog(request, user, 'login', 'Login efetuado com sucesso.');
  response.json({
    redirectTo: user.must_change_password ? '/security' : user.role === 'admin' ? '/config' : '/',
    user: serializePublicUser(user),
  });
});

router.post('/logout', (request, response) => {
  if (request.authUser) {
    recordAccessLog(request, request.authUser, 'logout', 'Logout solicitado pelo usuario.');
  }
  if (request.sessionToken) {
    destroySessionByToken(request.sessionToken);
  }
  clearSessionCookie(response);
  response.json({ ok: true });
});

router.post('/accept-terms', (request, response) => {
  if (!request.authUser) {
    response.status(401).json({ error: 'Sessao expirada ou acesso nao autenticado.' });
    return;
  }

  const updatedUser = acceptTermsForUser(request.authUser.id);
  const deviceContext = [
    `pagina: ${String(request.body?.pagePath || request.headers.referer || '').slice(0, 300)}`,
    `equipamento: ${String(request.body?.deviceLabel || '').slice(0, 300)}`,
    `plataforma: ${String(request.body?.platform || '').slice(0, 120)}`,
  ].join(' | ');

  recordAccessLog(
    request,
    request.authUser,
    'terms_accept',
    `Termo de responsabilidade aceito. ${deviceContext}`,
  );

  response.json({
    ok: true,
    termsVersion: config.termsVersion,
    user: updatedUser,
  });
});

router.post('/change-password', (request, response) => {
  if (!request.authUser) {
    response.status(401).json({ error: 'Sessao expirada ou acesso nao autenticado.' });
    return;
  }

  try {
    const updatedUser = changeOwnPassword(
      request.authUser.id,
      String(request.body?.currentPassword || ''),
      String(request.body?.newPassword || ''),
    );
    recordAccessLog(request, request.authUser, 'password_change', 'Senha alterada pelo proprio usuario.');
    response.json({
      ok: true,
      user: updatedUser,
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.post('/request-password-reset', (request, response) => {
  requestPasswordReset(request.body?.cpf, request.socket?.remoteAddress || '');
  response.json({
    ok: true,
    message: 'Solicitacao registrada. Procure um administrador para obter o codigo temporario.',
  });
});

router.post('/request-access', (request, response) => {
  try {
    requestAccess(
      request.body?.cpf,
      request.socket?.remoteAddress || '',
      request.body?.fullName,
      request.body?.password,
    );
    response.json({
      ok: true,
      message: 'Solicitacao de acesso registrada. Aguarde aprovacao administrativa.',
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.post('/reset-password', (request, response) => {
  try {
    const user = resetPasswordWithCode(
      request.body?.cpf,
      request.body?.code,
      request.body?.newPassword,
      request.socket?.remoteAddress || '',
    );
    response.json({
      ok: true,
      user,
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

module.exports = router;
