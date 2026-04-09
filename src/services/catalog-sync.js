const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const { replaceDocuments } = require('./repository');
const { normalizeWhitespace, repairText } = require('../utils/text');

const CLASSIFICATION_ALIASES = new Map([
  ['ADIMINISTRAÇÃO GERAL', 'ADMINISTRAÇÃO GERAL'],
]);

function normalizeCatalogValue(value) {
  return normalizeWhitespace(value)
    .replace(/\s+,/g, ',')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

function buildSourceKey(record) {
  return normalizeCatalogValue(record.detailUrl || `${record.hashVerificacao}::${record.pdfUrl}`);
}

function buildContentKey(record) {
  return normalizeCatalogValue(`${record.hashVerificacao || ''}::${record.pdfUrl || ''}`);
}

function normalizeClassification(value) {
  const normalized = normalizeCatalogValue(value);
  return CLASSIFICATION_ALIASES.get(normalized) || normalized;
}

function normalizeRecord(record) {
  return {
    ano: normalizeCatalogValue(record.ano),
    caixa: normalizeCatalogValue(record.caixa),
    classificacao: normalizeClassification(record.classificacao),
    descricao: normalizeCatalogValue(record.descricao),
    detail_url: normalizeCatalogValue(record.detailUrl),
    hash_verificacao: normalizeCatalogValue(record.hashVerificacao),
    nome_arquivo: normalizeCatalogValue(record.nomeArquivo),
    pdf_url: normalizeCatalogValue(record.pdfUrl),
  };
}

async function syncCatalogFromArtifacts() {
  const sourceFile = path.join(config.artifactsDir, 'pdf-links.json');
  const content = await fs.readFile(sourceFile, 'utf8');
  const parsed = JSON.parse(content);
  const records = [];

  for (const rawRecord of parsed) {
    const record = normalizeRecord(
      Object.fromEntries(Object.entries(rawRecord).map(([key, value]) => [key, typeof value === 'string' ? repairText(value) : value])),
    );

    if (!record.pdf_url || !record.detail_url) {
      continue;
    }

    const sourceKey = buildSourceKey({
      detailUrl: record.detail_url,
      hashVerificacao: record.hash_verificacao,
      pdfUrl: record.pdf_url,
    });
    const contentKey = buildContentKey({
      hashVerificacao: record.hash_verificacao,
      pdfUrl: record.pdf_url,
    });

    if (!sourceKey || !contentKey) {
      continue;
    }

    records.push({
      ...record,
      content_key: contentKey,
      source_key: sourceKey,
    });
  }

  replaceDocuments(records);

  return {
    sourceFile,
    totalLidos: parsed.length,
    totalUnicos: records.length,
  };
}

module.exports = { syncCatalogFromArtifacts };
