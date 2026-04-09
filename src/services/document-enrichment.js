const fs = require('node:fs');
const path = require('node:path');
const { PDFParse } = require('pdf-parse');
const { Agent } = require('undici');
const { defineModels } = require('../db/models');
const config = require('../config');
const { getAppSettings } = require('./app-settings');
const { resolveAiEndpoint } = require('./ai-endpoint');
const { analyzeTextQuality, cleanupExtractedText, formatIndexedText, sanitizeSnippet } = require('../utils/text');
const {
  getDocumentById,
  getDocumentGroupIds,
  getDocumentsForEnrichment,
  getEnrichmentStats,
} = require('./repository');

const insecureDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

function getMediaRootDir() {
  return path.join(process.cwd(), 'data', 'media', 'previews');
}

function ensureMediaDirectories() {
  const root = getMediaRootDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function getPreviewWidthForQuality(quality) {
  if (quality === 'low') return 320;
  if (quality === 'high') return 640;
  return 420;
}

function removeExistingPreviewFiles(documentId) {
  const root = ensureMediaDirectories();
  for (const entry of fs.readdirSync(root)) {
    if (entry === `${documentId}.png` || entry.startsWith(`${documentId}-`)) {
      fs.rmSync(path.join(root, entry), { force: true });
    }
  }
}

function buildSummaryRequestBody(mode, model, prompt) {
  const systemText = 'Voce cria resumos de documentos administrativos brasileiros.';

  if (mode === 'responses') {
    return {
      input: prompt,
      instructions: systemText,
      model,
      temperature: 0.2,
    };
  }

  if (mode === 'rest_input') {
    return {
      input: prompt,
      model,
      system_prompt: systemText,
      temperature: 0.2,
    };
  }

  return {
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content: prompt },
    ],
    model,
    temperature: 0.2,
  };
}

function resolveModelEndpoints(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return [];
  }

  const candidates = new Set();

  try {
    const url = new URL(trimmed);
    const origin = url.origin;
    const pathName = url.pathname.replace(/\/+$/, '');

    if (pathName.endsWith('/chat/completions')) {
      candidates.add(`${origin}${pathName.replace(/\/chat\/completions$/, '/models')}`);
      candidates.add(`${origin}${pathName.replace(/\/api\/v1\/chat\/completions$/, '/api/v0/models')}`);
    } else if (pathName.endsWith('/chat')) {
      candidates.add(`${origin}${pathName.replace(/\/chat$/, '/models')}`);
      candidates.add(`${origin}${pathName.replace(/\/api\/v1\/chat$/, '/api/v0/models')}`);
    } else {
      candidates.add(`${origin}${pathName}/models`);
    }

    candidates.add(`${origin}/v1/models`);
    candidates.add(`${origin}/api/v1/models`);
    candidates.add(`${origin}/api/v0/models`);
  } catch {
    candidates.add(`${trimmed}/models`);
  }

  return [...candidates];
}

function normalizeModelItems(payload) {
  const rawItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];

  return [...new Set(rawItems
    .map((item) => item?.id || item?.modelKey || item?.name || item?.slug || '')
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}

function extractSummaryText(payload) {
  if (payload?.output_text) {
    return String(payload.output_text).trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    if (item?.type === 'message' && item?.content) {
      return String(item.content).trim();
    }
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      const text = content?.text || content?.output_text || '';
      if (text) {
        return String(text).trim();
      }
    }
  }

  return (
    payload?.choices?.[0]?.message?.content ||
    payload?.message?.content ||
    payload?.content ||
    payload?.text ||
    payload?.response ||
    ''
  ).trim();
}

async function fetchPdfBuffer(url) {
  const response = await fetch(url, {
    dispatcher: config.allowInsecureTls ? insecureDispatcher : undefined,
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar PDF remoto: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function buildFallbackSummary(document) {
  const description = String(document.descricao || document.nome_arquivo || '').trim();
  const context = buildSummaryContext(document);
  const snippets = context.excerpts.slice(0, 2).map((item) => sanitizeSnippet(item, 220));
  const keyPoints = context.keyPoints.slice(0, 3).join('; ');
  const summaryBody = [
    `Resumo do Documento: ${description || 'Documento administrativo indexado no acervo.'}`,
    context.subject && `Assunto: ${context.subject}`,
    context.contextLine && `Contexto: ${context.contextLine}`,
    keyPoints && `Principais Pontos: ${keyPoints}`,
    snippets[0] && `Trecho 1: ${snippets[0]}`,
    snippets[1] && `Trecho 2: ${snippets[1]}`,
  ].filter(Boolean).join('\n\n');
  return {
    model: 'fallback-local',
    source: 'local-fallback',
    text: summaryBody.slice(0, 1200),
  };
}

function normalizeForCompare(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSummaryWords(value) {
  return normalizeForCompare(value)
    .split(' ')
    .filter((term) => term.length >= 4);
}

function guessDocumentProfile(document) {
  const haystack = `${document.classificacao || ''} ${document.caixa || ''} ${document.descricao || ''} ${document.nome_arquivo || ''} ${document.extracted_text || ''}`.toLowerCase();
  if (haystack.includes('folha de pagamento') || haystack.includes('matricula') || haystack.includes('servidor')) {
    return 'payroll';
  }
  return 'generic';
}

function buildSummaryContext(document) {
  const profile = guessDocumentProfile(document);
  const formattedText = formatIndexedText(document.extracted_text || '', { profile });
  const cleanedText = cleanupExtractedText(document.extracted_text || '');
  const quality = analyzeTextQuality(cleanedText);

  const normalizedBlocks = formattedText
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const description = String(document.descricao || document.nome_arquivo || 'Documento').trim();
  const classificacao = String(document.classificacao || '').trim();
  const caixa = String(document.caixa || '').trim();
  const year = String(document.ano || '').trim();

  const municipalityMatch = cleanedText.match(/PREFEITURA MUNICIPAL DE\s+([A-ZÀ-Ý ]{4,})/i);
  const contextOrg = municipalityMatch ? `Prefeitura Municipal de ${municipalityMatch[1].trim()}` : '';

  const nameMatches = Array.from(cleanedText.matchAll(/\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}){1,5})\b/g))
    .map((match) => match[1].trim())
    .filter((name) => !name.startsWith('PREFEITURA MUNICIPAL') && !name.startsWith('SECRETARIA MUNICIPAL'))
    .slice(0, 4);

  const excerptCandidates = normalizedBlocks
    .map((block) => {
      const lower = block.toLowerCase();
      let score = 0;
      if (block.length >= 40 && block.length <= 420) score += 2;
      if (/[a-zà-ÿ]/i.test(block) && /[.!?:;]/.test(block)) score += 2;
      if (/\b(decreto|processo|controle|projeto|autografo|servidor|motorista|admiss[aã]o|parecer|lei|portaria|edital)\b/i.test(lower)) score += 4;
      if (year && block.includes(year)) score += 1;
      if (classificacao && lower.includes(classificacao.toLowerCase())) score += 1;
      if (caixa && lower.includes(caixa.toLowerCase().slice(0, 12))) score += 1;
      if (/\bcpf\b|\bcnpj\b|p[aá]gina\s+\d+/i.test(lower)) score -= 2;
      if ((block.match(/\d/g) || []).length > block.length * 0.35) score -= 2;
      return { block, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((item) => item.block);

  const contextLine = [classificacao, caixa, year && `ano ${year}`, contextOrg].filter(Boolean).join(' • ');

  const keyPoints = [
    description && `Documento identificado como ${description}`,
    contextOrg && `Origem institucional ligada a ${contextOrg}`,
    nameMatches[0] && `Nome relevante encontrado: ${nameMatches[0]}`,
    year && `Periodo de referencia: ${year}`,
    quality.score < 0.72 && 'Texto com qualidade OCR limitada; resumo gerado com foco nos trechos mais legiveis',
  ].filter(Boolean);

  return {
    cleanedText,
    contextLine,
    description,
    excerpts: excerptCandidates,
    keyPoints,
    profile,
    quality,
    subject: description,
  };
}

function buildSummaryPrompt(document) {
  const context = buildSummaryContext(document);
  const excerptText = context.excerpts.length
    ? context.excerpts.map((item, index) => `[Trecho ${index + 1}] ${item}`).join('\n')
    : sanitizeSnippet(context.cleanedText, 1200);

  return [
    'Crie um resumo institucional em portugues claro e legivel.',
    'Nao copie o OCR bruto. Nao repita cabecalhos, CNPJ, endereco completo, pagina ou lixo de digitalizacao.',
    'Se houver pouca qualidade no texto, use apenas o que estiver claramente compreensivel.',
    'Responda em quatro blocos curtos exatamente nesta ordem:',
    'Resumo do Documento: ...',
    'Assunto: ...',
    'Contexto: ...',
    'Principais Pontos: ...',
    '',
    `Titulo do cadastro: ${context.description}`,
    `Classificacao: ${document.classificacao || ''}`,
    `Caixa: ${document.caixa || ''}`,
    `Ano: ${document.ano || ''}`,
    context.contextLine ? `Contexto administrativo: ${context.contextLine}` : '',
    context.keyPoints.length ? `Sinais extraidos: ${context.keyPoints.join('; ')}` : '',
    `Qualidade OCR (0 a 1): ${context.quality.score.toFixed(2)}`,
    '',
    'Trechos legiveis do documento:',
    excerptText,
  ].filter(Boolean).join('\n');
}

function buildCompactSummaryPrompt(document) {
  const context = buildSummaryContext(document);
  const compactExcerpts = context.excerpts
    .slice(0, 3)
    .map((item, index) => `[Trecho ${index + 1}] ${sanitizeSnippet(item, 260)}`)
    .join('\n');

  return [
    'Crie um resumo institucional curto e bem organizado em portugues.',
    'Nao copie o OCR bruto.',
    'Use exatamente estes blocos:',
    'Resumo do Documento: ...',
    'Assunto: ...',
    'Contexto: ...',
    'Principais Pontos: ...',
    '',
    `Titulo: ${context.description}`,
    document.classificacao ? `Classificacao: ${document.classificacao}` : '',
    document.caixa ? `Caixa: ${document.caixa}` : '',
    document.ano ? `Ano: ${document.ano}` : '',
    context.contextLine ? `Contexto administrativo: ${context.contextLine}` : '',
    '',
    compactExcerpts || `Trecho unico: ${sanitizeSnippet(context.cleanedText, 700)}`,
  ].filter(Boolean).join('\n');
}

function isWeakSummary(summaryText, document) {
  const summary = normalizeForCompare(summaryText);
  const source = normalizeForCompare(document.extracted_text || '');
  if (!summary) {
    return true;
  }

  const summaryWords = [...new Set(extractSummaryWords(summaryText))];
  if (!summaryWords.length) {
    return true;
  }

  const overlapCount = summaryWords.filter((word) => source.includes(word)).length;
  const overlapRatio = overlapCount / summaryWords.length;
  const lineCount = String(summaryText || '').split(/\n+/).filter(Boolean).length;
  const hasLabels = /Resumo do Documento:|Assunto:|Contexto:|Principais Pontos:/i.test(summaryText);
  const digitHeavy = ((summary.match(/\d/g) || []).length / Math.max(summary.length, 1)) > 0.18;
  const looksRaw = /cnpj|pagina\s+\d|setor|cep|telefone/i.test(summaryText) && overlapRatio > 0.82;

  return !hasLabels || lineCount < 3 || digitHeavy || looksRaw || overlapRatio > 0.88;
}

async function generateCloudSummary(document, settings, options = {}) {
  const prompt = options.prompt || buildSummaryPrompt(document);
  const { endpoint, mode } = resolveAiEndpoint(settings.enrichmentBaseUrl);

  const headers = { 'content-type': 'application/json' };
  if (settings.enrichmentApiKey) {
    headers.authorization = `Bearer ${settings.enrichmentApiKey}`;
  }

  if (typeof options.onStage === 'function') {
    options.onStage('summary', {
      endpoint,
      provider: settings.enrichmentProvider || 'cloud',
      status: 'start',
      startedAt: Date.now(),
    });
  }
  const startedAt = Date.now();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildSummaryRequestBody(mode, settings.enrichmentModel, prompt)),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.error?.message || extractSummaryText(payload) || '';
    } catch {}
    if (typeof options.onStage === 'function') {
      options.onStage('summary', {
        elapsedMs: Date.now() - startedAt,
        error: detail ? `Falha ao gerar resumo em IA: ${response.status} - ${detail}` : `Falha ao gerar resumo em IA: ${response.status}`,
        status: 'error',
      });
    }
    throw new Error(detail ? `Falha ao gerar resumo em IA: ${response.status} - ${detail}` : `Falha ao gerar resumo em IA: ${response.status}`);
  }

  const result = await response.json();
  const text = extractSummaryText(result);
  if (!text || isWeakSummary(text, document)) {
    if (typeof options.onStage === 'function') {
      options.onStage('summary', {
        elapsedMs: Date.now() - startedAt,
        error: 'A IA nao retornou um resumo de qualidade aceitavel.',
        status: 'error',
      });
    }
    throw new Error('A IA nao retornou um resumo de qualidade aceitavel.');
  }

  if (typeof options.onStage === 'function') {
    options.onStage('summary', {
      elapsedMs: Date.now() - startedAt,
      status: 'done',
      textLength: text.length,
    });
  }

  return {
    model: settings.enrichmentModel || 'unknown',
    source: settings.enrichmentProvider || 'cloud',
    text: text.slice(0, 1200),
  };
}

async function listAvailableModels({ baseUrl, provider } = {}) {
  const endpointCandidates = resolveModelEndpoints(baseUrl);
  const results = [];

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const models = normalizeModelItems(payload);
      if (models.length) {
        return {
          endpoint,
          models,
          provider: provider || 'local',
        };
      }

      results.push({ endpoint, models: [] });
    } catch {
      continue;
    }
  }

  return {
    endpoint: endpointCandidates[0] || '',
    models: [],
    provider: provider || 'local',
  };
}

async function generateDocumentSummary(document, settings, options = {}) {
  if (settings.enrichmentProcessMode === 'images_only') {
    return null;
  }

  if (!settings.enrichmentSummaryEnabled) {
    return null;
  }

  if (!settings.enrichmentOverwriteSummary && String(document.summary_text || '').trim()) {
    return null;
  }

  if ((settings.enrichmentProvider === 'local' || settings.enrichmentProvider === 'cloud') &&
      settings.enrichmentBaseUrl &&
      settings.enrichmentModel) {
    try {
      return await generateCloudSummary(document, settings, options);
    } catch {
      try {
        return await generateCloudSummary(document, settings, {
          ...options,
          prompt: buildCompactSummaryPrompt(document),
        });
      } catch {
        return buildFallbackSummary(document);
      }
    }
  }

  return buildFallbackSummary(document);
}

async function generatePreviewImage(document, settings, options = {}) {
  if (settings.enrichmentProcessMode === 'summary_only') {
    return null;
  }

  if (!settings.enrichmentPreviewImagesEnabled || !document.pdf_url) {
    return null;
  }

  if (!settings.enrichmentOverwritePreviewImages && document.preview_image_path) {
    return null;
  }

  ensureMediaDirectories();
  if (typeof options.onStage === 'function') {
    options.onStage('image', { status: 'start', startedAt: Date.now() });
  }
  const startedAt = Date.now();
  const buffer = await fetchPdfBuffer(document.pdf_url);
  const parser = new PDFParse({ data: buffer });
  const desiredWidth = getPreviewWidthForQuality(settings.enrichmentPreviewImageQuality);
  const pageCount = Math.max(1, Number(settings.enrichmentPreviewImageCount || 1));

  try {
    if (settings.enrichmentOverwritePreviewImages) {
      removeExistingPreviewFiles(document.id);
    }

    const screenshot = await parser.getScreenshot({
      desiredWidth,
      first: 1,
      imageBuffer: true,
      imageDataUrl: false,
      last: pageCount,
    });
    const pages = Array.isArray(screenshot.pages) ? screenshot.pages : [];
    const page = pages[0];
    if (!page?.data) {
      return null;
    }

    const savedImages = [];
    for (const [index, pageItem] of pages.entries()) {
      if (!pageItem?.data) continue;
      const imageBuffer = Buffer.isBuffer(pageItem.data) ? pageItem.data : Buffer.from(pageItem.data);
      const fileName = index === 0 ? `${document.id}.png` : `${document.id}-${index + 1}.png`;
      const absolutePath = path.join(getMediaRootDir(), fileName);
      fs.writeFileSync(absolutePath, imageBuffer);
      savedImages.push({
        fileSize: imageBuffer.length,
        height: pageItem.height || null,
        mimeType: 'image/png',
        relativePath: fileName,
        width: pageItem.width || desiredWidth,
      });
    }

    const primaryImage = savedImages[0];
    if (!primaryImage) {
      return null;
    }

    if (typeof options.onStage === 'function') {
      options.onStage('image', {
        elapsedMs: Date.now() - startedAt,
        fileSize: primaryImage.fileSize,
        generatedImages: savedImages.length,
        status: 'done',
      });
    }

    return {
      ...primaryImage,
      generatedImages: savedImages.length,
    };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
}

async function enrichDocumentById(documentId, options = {}) {
  const document = getDocumentById(documentId);
  if (!document) {
    throw new Error('Documento nao encontrado.');
  }

  const settings = await getAppSettings();
  const itemStartedAt = Date.now();
  const metrics = {
    imageMs: 0,
    summaryMs: 0,
  };

  const result = { documentId };
  const summary = await generateDocumentSummary(document, settings, {
    onStage(stage, payload) {
      if (typeof options.onStage === 'function') {
        options.onStage(document, stage, payload);
      }
      if (stage === 'summary' && payload.status === 'done') {
        metrics.summaryMs = payload.elapsedMs || 0;
      }
    },
  });
  if (summary?.text) {
    await saveDocumentSummary(documentId, summary);
    result.summary = summary;
  }

  const previewImage = await generatePreviewImage(document, settings, {
    onStage(stage, payload) {
      if (typeof options.onStage === 'function') {
        options.onStage(document, stage, payload);
      }
      if (stage === 'image' && payload.status === 'done') {
        metrics.imageMs = payload.elapsedMs || 0;
      }
    },
  });
  if (previewImage?.relativePath) {
    await saveDocumentPreviewImage(documentId, previewImage);
    result.previewImage = previewImage;
  }

  result.itemElapsedMs = Date.now() - itemStartedAt;
  result.metrics = metrics;
  return result;
}

async function runEnrichmentBatch(limit = 5) {
  const settings = await getAppSettings();
  const items = getDocumentsForEnrichment(limit, {
    includeAlreadyEnriched: settings.enrichmentOverwriteSummary || settings.enrichmentOverwritePreviewImages,
  });
  const results = [];
  for (const item of items) {
    try {
      results.push(await enrichDocumentById(item.id));
    } catch (error) {
      results.push({ documentId: item.id, error: error.message });
    }
  }

  return {
    items: results,
    processed: results.length,
    stats: getEnrichmentStats(),
  };
}

async function saveDocumentSummary(documentId, summary) {
  const { DocumentEnrichment } = defineModels();
  const targetIds = getDocumentGroupIds(documentId);
  for (const targetId of targetIds) {
    await DocumentEnrichment.upsert({
      documentId: targetId,
      summaryModel: summary.model || '',
      summarySource: summary.source || '',
      summaryText: summary.text || '',
    });
  }
}

async function saveDocumentPreviewImage(documentId, image) {
  const { DocumentPreviewImage } = defineModels();
  const targetIds = getDocumentGroupIds(documentId);
  for (const targetId of targetIds) {
    await DocumentPreviewImage.upsert({
      documentId: targetId,
      fileSize: image.fileSize || 0,
      height: image.height || null,
      mimeType: image.mimeType || 'image/png',
      relativePath: image.relativePath,
      width: image.width || null,
    });
  }
}

function listDocumentPreviewImages(document) {
  const primaryPath = String(document?.preview_image_path || '').trim();
  if (!primaryPath) {
    return [];
  }

  const root = ensureMediaDirectories();
  const extension = path.extname(primaryPath) || '.png';
  const baseName = path.basename(primaryPath, extension);
  const prefix = `${baseName}-`;

  const entries = fs.readdirSync(root)
    .filter((entry) => entry === `${baseName}${extension}` || (entry.startsWith(prefix) && entry.endsWith(extension)))
    .sort((left, right) => {
      const parseOrder = (value) => {
        const match = value.match(/-(\d+)\.[^.]+$/);
        return match ? Number(match[1]) : 1;
      };
      return parseOrder(left) - parseOrder(right);
    });

  return entries.map((relativePath, index) => ({
    isPrimary: index === 0,
    label: index === 0 ? 'Capa' : `Pagina ${index + 1}`,
    relativePath,
    url: `/media/previews/${encodeURIComponent(relativePath)}`,
  }));
}

module.exports = {
  ensureMediaDirectories,
  enrichDocumentById,
  getMediaRootDir,
  listDocumentPreviewImages,
  listAvailableModels,
  runEnrichmentBatch,
};
