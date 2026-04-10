const express = require('express');
const { recordAccessLog } = require('../services/audit');
const { requireAdminPage, requireAuthPage } = require('../middlewares/auth');

const router = express.Router();

function buildRedirectTarget(basePath, query = {}) {
  const params = new URLSearchParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `${basePath}${suffix}`;
}

function renderConfigPage(response, request, activeSection) {
  response.render('config', {
    activeSection,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico - Configuracao',
  });
}

router.get('/login', (request, response) => {
  if (request.authUser) {
    if (request.authUser.must_change_password) {
      response.redirect(302, '/security');
      return;
    }
    response.redirect(302, request.authUser.role === 'admin' ? '/config' : '/');
    return;
  }

  response.render('login', {
    next: typeof request.query?.next === 'string' ? request.query.next.trim() : '',
    pageTitle: 'Acervo Publico - Login',
  });
});

router.get('/', requireAuthPage, (request, response) => {
  recordAccessLog(request, request.authUser, 'page_view', 'Acesso a pagina de pesquisa.');
  response.render('index', {
    canAccessAdmin: response.locals.canAccessAdmin,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico',
  });
});

router.get('/index.html', (_request, response) => {
  response.redirect(302, '/');
});

router.get('/document', requireAuthPage, (request, response) => {
  recordAccessLog(request, request.authUser, 'page_view', 'Acesso ao detalhe de documento.');
  response.render('document', {
    canAccessAdmin: response.locals.canAccessAdmin,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico - Documento',
  });
});

router.get('/document.html', (request, response) => {
  response.redirect(302, buildRedirectTarget('/document', request.query));
});

router.get('/security', requireAuthPage, (request, response) => {
  response.render('security', {
    canAccessAdmin: response.locals.canAccessAdmin,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico - Seguranca',
  });
});

router.get('/history', requireAuthPage, (request, response) => {
  recordAccessLog(request, request.authUser, 'page_view', 'Acesso ao historico proprio de pesquisas.');
  response.render('history', {
    canAccessAdmin: response.locals.canAccessAdmin,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico - Meu historico',
  });
});

router.get('/monitor', requireAdminPage, (request, response) => {
  recordAccessLog(request, request.authUser, 'page_view', 'Acesso ao monitor ao vivo.');
  response.render('monitor', {
    canAccessAdmin: response.locals.canAccessAdmin,
    currentUser: response.locals.currentUser,
    pageTitle: 'Acervo Publico - Monitor ao vivo',
  });
});

router.get('/config', requireAdminPage, (request, response) => {
  recordAccessLog(request, request.authUser, 'page_view', 'Acesso ao painel administrativo.');
  renderConfigPage(response, request, 'dashboard');
});

router.get('/config/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'settings');
});

router.get('/config/indexing', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/indexing/run');
});

router.get('/config/indexing/run', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'indexingRun');
});

router.get('/config/indexing/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'indexingSettings');
});

router.get('/config/downloads', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/downloads/run');
});

router.get('/config/downloads/run', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'downloadsRun');
});

router.get('/config/downloads/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'downloadsSettings');
});

router.get('/config/logs', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'logs');
});

router.get('/config/audit', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/access-logs');
});

router.get('/config/access-logs', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'accessLogs');
});

router.get('/config/search-history', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'searchHistory');
});

router.get('/config/maintenance', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/maintenance/run');
});

router.get('/config/maintenance/run', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'maintenanceRun');
});

router.get('/config/maintenance/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'maintenanceSettings');
});

router.get('/config/enrichment', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/enrichment/run');
});

router.get('/config/enrichment/run', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'enrichmentRun');
});

router.get('/config/enrichment/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'enrichmentSettings');
});

router.get('/config/local-library', requireAdminPage, (request, response) => {
  response.redirect(302, '/config/local-library/run');
});

router.get('/config/local-library/run', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'localLibraryRun');
});

router.get('/config/local-library/settings', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'localLibrarySettings');
});

router.get('/config/users', requireAdminPage, (request, response) => {
  renderConfigPage(response, request, 'users');
});

router.get('/config.html', (request, response) => {
  response.redirect(302, buildRedirectTarget('/config', request.query));
});

module.exports = router;
