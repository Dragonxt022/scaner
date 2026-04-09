const { getAppSettings } = require('./app-settings');
const { resolveAiEndpoint } = require('./ai-endpoint');

function buildImageRequestBody(mode, model, safeImageDataUrl) {
  const systemText = 'Voce extrai texto visivel de imagens de documentos em portugues. Devolva somente o texto encontrado, limpo, sem markdown, sem comentarios e sem explicacoes.';
  const userText = 'Leia a imagem e devolva apenas o texto visivel mais relevante para busca documental. Preserve nomes, numeros, datas, processos, caixas, classificacoes e termos centrais.';
  const ollamaImage = safeImageDataUrl.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');

  if (mode === 'responses') {
    return {
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: userText,
            },
            {
              type: 'input_image',
              image_url: safeImageDataUrl,
            },
          ],
        },
      ],
      instructions: systemText,
      model,
      temperature: 0.1,
    };
  }

  if (mode === 'rest_input') {
    return {
      input: [
        {
          type: 'text',
          content: userText,
        },
        {
          type: 'image',
          data_url: safeImageDataUrl,
        },
      ],
      model,
      system_prompt: systemText,
      temperature: 0.1,
    };
  }

  if (mode === 'ollama_chat') {
    return {
      model,
      messages: [
        {
          content: systemText,
          role: 'system',
        },
        {
          content: userText,
          images: [ollamaImage],
          role: 'user',
        },
      ],
      options: {
        temperature: 0.1,
      },
      stream: false,
    };
  }

  if (mode === 'ollama_generate') {
    return {
      images: [ollamaImage],
      model,
      options: {
        temperature: 0.1,
      },
      prompt: userText,
      stream: false,
      system: systemText,
    };
  }

  return {
    messages: [
      {
        role: 'system',
        content: systemText,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userText,
          },
          {
            type: 'image_url',
            image_url: {
              url: safeImageDataUrl,
            },
          },
        ],
      },
    ],
    model,
    temperature: 0.1,
  };
}

function extractText(payload) {
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

function sanitizeImageDataUrl(imageDataUrl) {
  const value = String(imageDataUrl || '').trim();
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value)) {
    throw new Error('Imagem invalida. Envie PNG, JPG ou WEBP em base64.');
  }
  return value;
}

function deriveSearchQueryFromText(extractedText) {
  const normalized = String(extractedText || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s/-]+/gu, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  const stopWords = new Set([
    'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
    'o', 'os', 'ou', 'para', 'por', 'que', 'sem', 'sob', 'um', 'uma', 'uns', 'umas',
  ]);
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const selected = [];
  const seen = new Set();

  for (const token of tokens) {
    const cleanToken = token.replace(/^[-/]+|[-/]+$/g, '');
    if (!cleanToken) continue;
    const lower = cleanToken.toLowerCase();
    const isImportantNumber = /^\d{2,}$/.test(cleanToken);
    const isRelevantWord = cleanToken.length >= 3 && !stopWords.has(lower);
    if (!isImportantNumber && !isRelevantWord) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    selected.push(cleanToken);
    if (selected.length >= 10) {
      break;
    }
  }

  return selected.join(' ').trim() || normalized.slice(0, 180);
}

async function inferSearchQueryFromImage(imageDataUrl) {
  const settings = await getAppSettings();
  if (!settings.enrichmentBaseUrl || !settings.enrichmentModel) {
    throw new Error('Configure a IA local com modelo e endpoint antes de usar busca por imagem.');
  }

  const { endpoint, mode } = resolveAiEndpoint(settings.enrichmentBaseUrl);
  const headers = { 'content-type': 'application/json' };
  if (settings.enrichmentApiKey) {
    headers.authorization = `Bearer ${settings.enrichmentApiKey}`;
  }

  const safeImageDataUrl = sanitizeImageDataUrl(imageDataUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildImageRequestBody(mode, settings.enrichmentModel, safeImageDataUrl)),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.error?.message || extractText(payload) || '';
    } catch {}
    throw new Error(detail ? `Falha ao analisar a imagem com IA: ${response.status} - ${detail}` : `Falha ao analisar a imagem com IA: ${response.status}`);
  }

  const payload = await response.json();
  const extractedText = extractText(payload).replace(/\s+/g, ' ').trim();
  const query = deriveSearchQueryFromText(extractedText);
  if (!query) {
    throw new Error('A IA nao retornou texto valido para a imagem.');
  }

  return {
    extractedText,
    model: settings.enrichmentModel,
    provider: settings.enrichmentProvider || 'local',
    query,
  };
}

module.exports = {
  inferSearchQueryFromImage,
};
