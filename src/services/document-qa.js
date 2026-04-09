const { getAppSettings } = require('./app-settings');
const { getDocumentById } = require('./repository');
const { resolveAiEndpoint } = require('./ai-endpoint');

const MAX_SUMMARY_CHARS = 700;
const MAX_CHUNK_CHARS = 650;
const MAX_CONTEXT_CHARS = 2200;

function extractAnswerText(payload) {
  function pickText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value.map((item) => pickText(item)).filter(Boolean).join('\n').trim();
    }
    if (typeof value === 'object') {
      return (
        pickText(value.text) ||
        pickText(value.output_text) ||
        pickText(value.content) ||
        pickText(value.value) ||
        ''
      ).trim();
    }
    return '';
  }

  if (payload?.output_text) {
    return String(payload.output_text).trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    if (item?.type === 'message' && item?.content) {
      const text = pickText(item.content);
      if (text) {
        return text;
      }
    }
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      const text = pickText(content);
      if (text) {
        return text;
      }
    }
  }

  return (
    pickText(payload?.choices?.[0]?.message?.content) ||
    pickText(payload?.message?.content) ||
    pickText(payload?.content) ||
    pickText(payload?.text) ||
    pickText(payload?.response) ||
    ''
  ).trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getQuestionTerms(question) {
  return [...new Set(
    normalizeText(question)
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3),
  )];
}

function buildContextChunks(text, maxChunkLength = 1400) {
  const normalized = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = '';

  for (const block of blocks) {
    if (!buffer) {
      buffer = block;
      continue;
    }

    if (`${buffer} ${block}`.length <= maxChunkLength) {
      buffer = `${buffer} ${block}`;
      continue;
    }

    chunks.push(buffer);
    buffer = block;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function selectRelevantChunks(extractedText, question, limit = 4) {
  const chunks = buildContextChunks(extractedText);
  if (!chunks.length) {
    return [];
  }

  const normalizedQuestion = normalizeText(question);
  const questionTerms = getQuestionTerms(question);

  return chunks
    .map((chunk, index) => {
      const normalizedChunk = normalizeText(chunk);
      let score = 0;

      if (normalizedQuestion && normalizedChunk.includes(normalizedQuestion)) {
        score += 20;
      }

      for (const term of questionTerms) {
        if (normalizedChunk.includes(term)) {
          score += term.length >= 6 ? 4 : 2;
        }
      }

      if (!score && index === 0) {
        score = 1;
      }

      return { chunk, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    })
    .slice(0, limit)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.chunk.slice(0, maxChunkLengthForQuestion(question)));
}

function maxChunkLengthForQuestion(question) {
  const normalized = normalizeText(question);
  if (/\b(quem|nome|cpf|servidor|cargo|lotacao|admissao)\b/.test(normalized)) {
    return 420;
  }
  if (/\b(quando|data|ano|periodo)\b/.test(normalized)) {
    return 520;
  }
  return MAX_CHUNK_CHARS;
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildCompactContext(document, question) {
  const relevantChunks = selectRelevantChunks(document.extracted_text, question, 3);
  const parts = [
    `Titulo: ${truncateText(document.descricao || document.nome_arquivo || 'Documento', 160)}`,
    `Classificacao: ${truncateText(document.classificacao || '', 80)}`,
    `Caixa: ${truncateText(document.caixa || '', 120)}`,
    `Ano: ${truncateText(document.ano || '', 16)}`,
  ];

  const summary = truncateText(document.summary_text || '', MAX_SUMMARY_CHARS);
  if (summary) {
    parts.push(`Resumo: ${summary}`);
  }

  for (const [index, chunk] of relevantChunks.entries()) {
    parts.push(`Trecho ${index + 1}: ${truncateText(chunk, maxChunkLengthForQuestion(question))}`);
  }

  let context = parts.filter(Boolean).join('\n');
  if (context.length > MAX_CONTEXT_CHARS) {
    context = truncateText(context, MAX_CONTEXT_CHARS);
  }
  return context;
}

function buildDocumentQaPrompt(document, question) {
  const context = buildCompactContext(document, question);

  return [
    'Responda em portugues com base apenas no documento fornecido.',
    'Se a resposta nao estiver claramente no documento, diga que a informacao nao foi encontrada no arquivo.',
    'Seja objetivo, claro e institucional.',
    'Priorize o resumo e no maximo tres trechos selecionados do documento em vez de tentar inferir informacoes fora do contexto.',
    'Nao repita o OCR inteiro e nao reproduza cabecalhos desnecessarios.',
    '',
    context,
    '',
    `Pergunta: ${question}`,
  ].join('\n');
}

function buildRequestBody(mode, model, prompt) {
  const systemText = 'Voce responde perguntas sobre documentos administrativos brasileiros usando apenas o contexto fornecido.';

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

async function askQuestionAboutDocument(documentId, question) {
  const normalizedId = Number(documentId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('Identificador de documento invalido.');
  }

  const normalizedQuestion = String(question || '').trim();
  if (normalizedQuestion.length < 3) {
    throw new Error('Pergunta invalida. Escreva ao menos 3 caracteres.');
  }

  const document = getDocumentById(normalizedId);
  if (!document) {
    throw new Error('Documento nao encontrado.');
  }

  const settings = await getAppSettings();
  if (!settings.enrichmentBaseUrl || !settings.enrichmentModel) {
    throw new Error('Configure a IA local ou em nuvem antes de usar perguntas sobre documentos.');
  }

  const { endpoint, mode } = resolveAiEndpoint(settings.enrichmentBaseUrl);
  const headers = { 'content-type': 'application/json' };
  if (settings.enrichmentApiKey) {
    headers.authorization = `Bearer ${settings.enrichmentApiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildRequestBody(mode, settings.enrichmentModel, buildDocumentQaPrompt(document, normalizedQuestion))),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = extractAnswerText(payload) || payload?.error?.message || '';
    } catch {}
    throw new Error(detail ? `Falha ao consultar a IA: ${response.status} - ${detail}` : `Falha ao consultar a IA: ${response.status}`);
  }

  const payload = await response.json();
  const answer = extractAnswerText(payload);
  if (!answer) {
    throw new Error('A IA nao retornou uma resposta valida.');
  }

  return {
    answer,
    documentId: normalizedId,
    model: settings.enrichmentModel,
    question: normalizedQuestion,
  };
}

module.exports = {
  askQuestionAboutDocument,
};
