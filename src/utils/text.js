const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const MULTISPACE = /\s+/g;
const PAGE_MARKERS = /--\s*\d+\s+of\s+\d+\s*--/gi;
const REPLACEMENT_CHAR = /\uFFFD/g;
const NON_TEXT_SYMBOLS = /[^\p{L}\p{N}\s.,;:!?()[\]/'"%+-]/gu;
const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const PORTUGUESE_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no',
  'nos', 'o', 'os', 'ou', 'para', 'por', 'que', 'se', 'um', 'uma',
]);
const COMMON_REPAIRS = new Map([
  ['Ã¡', 'á'],
  ['Ã¢', 'â'],
  ['Ã£', 'ã'],
  ['Ã§', 'ç'],
  ['Ã©', 'é'],
  ['Ãª', 'ê'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ã´', 'ô'],
  ['Ãµ', 'õ'],
  ['Ãº', 'ú'],
  ['Ã�', 'Á'],
  ['Ã‚', 'Â'],
  ['Ãƒ', 'Ã'],
  ['Ã‡', 'Ç'],
  ['Ã‰', 'É'],
  ['ÃŠ', 'Ê'],
  ['Ã“', 'Ó'],
  ['Ã”', 'Ô'],
  ['Ã•', 'Õ'],
  ['Ãš', 'Ú'],
  ['Âº', 'º'],
  ['Âª', 'ª'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€�', '”'],
  ['â€¦', '...'],
  ['â€¢', '•'],
]);
const MOJIBAKE_TOKENS = [...COMMON_REPAIRS.keys(), 'ï¿½'];

function looksMojibake(value) {
  return MOJIBAKE_TOKENS.some((token) => value.includes(token));
}

function decodeLatin1ToUtf8(value) {
  return Buffer.from(value, 'latin1').toString('utf8');
}

function applyCommonRepairs(value) {
  let repaired = value;
  for (const [before, after] of COMMON_REPAIRS.entries()) {
    repaired = repaired.replaceAll(before, after);
  }
  return repaired;
}

function repairText(value) {
  if (typeof value !== 'string') {
    return value;
  }

  let current = applyCommonRepairs(value.trim());
  if (!current) {
    return current;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!looksMojibake(current)) {
      break;
    }

    try {
      const decoded = applyCommonRepairs(decodeLatin1ToUtf8(current).trim());
      if (!decoded || decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      break;
    }
  }

  return current;
}

function cleanupExtractedText(value) {
  return repairText(String(value ?? ''))
    .replace(PAGE_MARKERS, ' ')
    .replace(CONTROL_CHARS, ' ')
    .replace(MULTISPACE, ' ')
    .trim();
}

function insertLineBreaks(value, patterns) {
  let output = value;
  for (const pattern of patterns) {
    output = output.replace(pattern, '\n\n$1');
  }
  return output;
}

function formatIndexedText(value, options = {}) {
  const profile = typeof options.profile === 'string' ? options.profile : 'generic';
  let text = cleanupExtractedText(value);
  if (!text) {
    return '';
  }

  text = text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([:;])(?=\S)/g, '$1 ')
    .replace(/([.!?])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/gu, '$1\n\n')
    .replace(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/g, '\n$1')
    .replace(/(Data Pagamento:\s*\d{2}\/\d{2}\/\d{4})/gi, '\n\n$1')
    .replace(/(Folha de Pagamento)/gi, '\n\n$1')
    .replace(/(Base FGTS\s+Valor FGTS\s+Base Prev\.\s+Base IRRF\s+Proventos\s+Descontos\s+Líquido)/gi, '\n\n$1')
    .replace(/(Matr[ií]cula\s+Nome do Trabalhador\s+Admiss[aã]o)/gi, '\n\n$1')
    .replace(/(Unidade:\s*\d+\s*-\s*[A-Z0-9%\-\/ ]{8,})/g, '\n$1');

  text = insertLineBreaks(text, [
    /(PREFEITURA MUNICIPAL DE [A-ZÁÀÂÃÉÊÍÓÔÕÚÇ ]{4,})/g,
    /(CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g,
    /(Mês\/Ano)/g,
    /(Página \d+ de \d+)/g,
    /(Base FGTS)/g,
    /(Matr[ií]cula)/g,
  ]);

  if (profile === 'payroll') {
    text = text
      .replace(/(\b[PD]\s+\d{3}\b)/g, '\n$1')
      .replace(/(Matr[ií]cula\s+Nome do Trabalhador)/gi, '\n\n$1')
      .replace(/(L[ií]quido\s+\d[\d.,]*)/g, '$1\n')
      .replace(/(\d{1,2}\.\d{2}[DH]\s+\d[\d.,]+)/g, '\n$1');
  }

  return text
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function normalizeWhitespace(value) {
  return cleanupExtractedText(value);
}

function normalizeSearchTerm(value) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeSnippet(value, maxLength = 240) {
  const text = normalizeWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function quoteFtsTerm(term) {
  return `"${term.replace(/"/g, '""')}"`;
}

function tokenizeSearchInput(input) {
  return Array.from(new Set(extractWords(input).map((term) => term.trim()).filter(Boolean)));
}

function buildFtsQuery(input) {
  const terms = tokenizeSearchInput(input);

  if (!terms.length) {
    return '';
  }

  return terms.map(quoteFtsTerm).join(' AND ');
}

function extractWords(value) {
  return Array.from(normalizeWhitespace(value).matchAll(WORD_PATTERN), (match) => match[0]);
}

function analyzeTextQuality(value) {
  const text = normalizeWhitespace(value);
  const sample = text.slice(0, 4000);
  const words = extractWords(sample);
  const replacementCount = (sample.match(REPLACEMENT_CHAR) || []).length;
  const nonTextCount = (sample.match(NON_TEXT_SYMBOLS) || []).length;
  const alphaCount = (sample.match(/\p{L}/gu) || []).length;
  const digitsCount = (sample.match(/\p{N}/gu) || []).length;
  const stopwordCount = words.filter((word) => PORTUGUESE_STOPWORDS.has(word.toLowerCase())).length;
  const gibberishWords = words.filter((word) => {
    const lower = word.toLowerCase();
    if (lower.length < 7) {
      return false;
    }

    const vowelCount = (lower.match(/[aeiouáàâãéêíóôõúü]/g) || []).length;
    const consonantClusters = (lower.match(/[^aeiouáàâãéêíóôõúü0-9]{5,}/g) || []).length;
    return vowelCount <= 1 || consonantClusters > 0;
  }).length;

  const sampleLength = Math.max(sample.length, 1);
  const wordCount = Math.max(words.length, 1);
  const replacementRatio = replacementCount / sampleLength;
  const nonTextRatio = nonTextCount / sampleLength;
  const gibberishRatio = gibberishWords / wordCount;
  const alphaRatio = alphaCount / sampleLength;
  const stopwordRatio = stopwordCount / wordCount;
  const digitRatio = digitsCount / sampleLength;

  let score = 1;
  score -= Math.min(0.45, replacementRatio * 12);
  score -= Math.min(0.25, nonTextRatio * 8);
  score -= Math.min(0.25, gibberishRatio * 1.2);
  score += Math.min(0.08, stopwordRatio * 0.6);
  score += alphaRatio >= 0.55 ? 0.05 : -0.08;
  score -= digitRatio > 0.2 ? 0.04 : 0;
  score = Math.max(0, Math.min(1, score));

  return {
    alphaRatio,
    gibberishRatio,
    hasPortugueseHints: stopwordCount >= 3,
    nonTextRatio,
    replacementCount,
    replacementRatio,
    sampleLength,
    score,
    stopwordRatio,
    wordCount,
  };
}

function shouldUseOcrFallback(value) {
  const quality = analyzeTextQuality(value);
  const tooShort = normalizeWhitespace(value).length < 300;
  const tooManyReplacementChars = quality.replacementCount >= 4 || quality.replacementRatio > 0.002;
  const tooMuchGarbage = quality.gibberishRatio > 0.18 || quality.nonTextRatio > 0.03;
  const weakPortugueseSignal = !quality.hasPortugueseHints && quality.score < 0.72;

  return {
    quality,
    useOcr: tooShort || tooManyReplacementChars || tooMuchGarbage || weakPortugueseSignal,
  };
}

module.exports = {
  analyzeTextQuality,
  buildFtsQuery,
  cleanupExtractedText,
  extractWords,
  formatIndexedText,
  normalizeSearchTerm,
  normalizeWhitespace,
  repairText,
  sanitizeSnippet,
  shouldUseOcrFallback,
  tokenizeSearchInput,
};
