const path = require('node:path');

const LOCAL_LIBRARY_DIRNAME = 'local-acervo';

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function getLocalLibraryRoot() {
  return path.join(process.cwd(), 'data', LOCAL_LIBRARY_DIRNAME);
}

function buildLocalLibraryUrl(relativePath) {
  return `/acervo-local/${toPosixPath(relativePath)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

module.exports = {
  LOCAL_LIBRARY_DIRNAME,
  buildLocalLibraryUrl,
  getLocalLibraryRoot,
  toPosixPath,
};
