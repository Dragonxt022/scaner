const fs = require('node:fs');
const path = require('node:path');
const { syncLocalLibrary, listLocalLibraryItems } = require('./local-library');
const { getAppSettings } = require('./app-settings');

let watcher = null;
let knownContentKeys = new Set();
let debounceTimer = null;

function initKnownSet() {
  try {
    const items = listLocalLibraryItems(10000) || [];
    knownContentKeys = new Set(items.map((it) => String(it.content_key || '').trim()).filter(Boolean));
  } catch (err) {
    console.warn('[watcher] falha ao inicializar lista conhecida:', err.message || err);
    knownContentKeys = new Set();
  }
}

async function handleChangeEvent(root) {
  // debounce rapid events
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const settings = await getAppSettings();
      if (!settings.localLibraryAutoSync) return;

      const result = syncLocalLibrary();
      const newItems = (result.items || []).filter((it) => !knownContentKeys.has(String(it.content_key)));
      for (const it of result.items || []) {
        if (it && it.content_key) knownContentKeys.add(String(it.content_key));
      }

      if (newItems.length) {
        console.log(`[watcher] ${newItems.length} novo(s) arquivo(s) detectado(s) e sincronizado(s)`);
      }
    } catch (err) {
      console.error('[watcher] erro ao sincronizar acervo local:', err.message || err);
    }
  }, 300);
}

function startLocalLibraryWatcher() {
  try {
    if (watcher) return;
    initKnownSet();
    const root = path.join(process.cwd(), 'data', 'local-acervo');
    // create root if missing
    try { fs.mkdirSync(root, { recursive: true }); } catch {}

    watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      handleChangeEvent(root);
    });

    console.log('[watcher] observador de `data/local-acervo` iniciado.');
  } catch (err) {
    console.error('[watcher] falha ao iniciar observador:', err.message || err);
    watcher = null;
  }
}

function stopLocalLibraryWatcher() {
  try {
    if (!watcher) return;
    watcher.close();
    watcher = null;
    console.log('[watcher] observador de `data/local-acervo` parado.');
  } catch (err) {
    console.warn('[watcher] falha ao parar observador:', err.message || err);
  }
}

module.exports = {
  startLocalLibraryWatcher,
  stopLocalLibraryWatcher,
};
