const path = require('node:path');
const express = require('express');
const config = require('./config');
const authRoutes = require('./routes/auth');
const webRoutes = require('./routes/web');
const searchRoutes = require('./routes/search');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const { attachAuthContext, enforceHttps, requireAdminApi, requireAuthApi } = require('./middlewares/auth');
const { ensureLocalLibraryRoot } = require('./services/local-library');

function createApp() {
  const app = express();
  const publicDir = path.join(process.cwd(), 'public');
  const mediaDir = path.join(process.cwd(), 'data', 'media');
  const localLibraryDir = ensureLocalLibraryRoot();
  const viewsDir = path.join(process.cwd(), 'src', 'views');

  app.disable('x-powered-by');
  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  if (config.appLogging) {
    app.use((request, response, next) => {
      const startedAt = Date.now();
      response.on('finish', () => {
        const elapsedMs = Date.now() - startedAt;
        console.log(
          `[HTTP] ${request.method} ${request.originalUrl} -> ${response.statusCode} ${elapsedMs}ms`,
        );
      });
      next();
    });
  }

  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(enforceHttps);
  app.use(attachAuthContext);
  app.use(express.static(publicDir, {
    dotfiles: 'ignore',
    etag: true,
    fallthrough: true,
    index: false,
  }));
  app.use('/media', express.static(mediaDir, {
    dotfiles: 'ignore',
    etag: true,
    fallthrough: true,
    index: false,
  }));
  app.use('/acervo-local', (request, response, next) => {
    if (request.authUser) {
      next();
      return;
    }
    response.status(401).end('Sessao expirada ou acesso nao autenticado.');
  }, express.static(localLibraryDir, {
    dotfiles: 'ignore',
    etag: true,
    fallthrough: true,
    index: false,
  }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/search', requireAuthApi, searchRoutes);
  app.use('/api/documents', requireAuthApi, documentRoutes);
  app.use('/api/admin', requireAdminApi, adminRoutes);
  app.use('/', webRoutes);

  app.all('/api/{*splat}', (request, response) => {
    response.status(404).json({
      error: `Rota nao encontrada: ${request.method} ${request.path}`,
    });
  });

  app.all('/{*splat}', (_request, response) => {
    response.status(404).render('404', {
      pageTitle: 'Acervo Publico - Pagina nao encontrada',
    });
  });

  app.use((error, request, response, _next) => {
    if (config.appLogging) {
      console.error(
        `[ERROR] ${request.method} ${request.originalUrl}: ${error.message || 'Erro interno no servidor.'}`,
      );
    }
    response.status(500).json({
      error: error.message || 'Erro interno no servidor.',
    });
  });

  return app;
}

module.exports = { createApp };
