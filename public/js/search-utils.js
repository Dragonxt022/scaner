(function attachSearchUtils(global) {
  const COMMON_REPAIRS = new Map([
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡', 'Ã¡'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢', 'Ã¢'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£', 'Ã£'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§', 'Ã§'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©', 'Ã©'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª', 'Ãª'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­', 'Ã­'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³', 'Ã³'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´', 'Ã´'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµ', 'Ãµ'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº', 'Ãº'],
  ]);

  function repairText(value) {
    if (typeof value !== 'string') return value;
    let output = value;
    for (const [before, after] of COMMON_REPAIRS.entries()) {
      output = output.replaceAll(before, after);
    }
    return output.trim();
  }

  function safeText(value, fallback = 'Nao informado') {
    const text = repairText(String(value ?? '').trim());
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function buildOption(select, values, defaultLabel) {
    const previous = select.value;
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = safeText(value, value);
      select.appendChild(option);
    });

    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  function highlightTerms(text, query) {
    const cleanText = escapeHtml(safeText(text, ''));
    const terms = safeText(query, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    if (!terms.length) return cleanText;

    let output = cleanText;
    for (const term of terms) {
      const escaped = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
    }
    return output;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function inferSearchIntent(query) {
    const terms = safeText(query, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((item) => item.trim())
      .filter(Boolean);

    if (terms.length <= 3) {
      return {
        inferred: false,
        normalizedQuery: safeText(query, ''),
        tokens: terms,
      };
    }

    const stopWords = new Set(['a', 'ao', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'por', 'que', 'sem', 'um', 'uma']);
    const relevantTerms = terms
      .filter((item) => item.length > 2 && !stopWords.has(item))
      .sort((left, right) => right.length - left.length)
      .slice(0, 4);

    return {
      inferred: relevantTerms.length >= 2,
      normalizedQuery: relevantTerms.length >= 2 ? relevantTerms.join(' ') : safeText(query, ''),
      tokens: relevantTerms.length ? relevantTerms : terms,
    };
  }

  global.AcervoSearchUtils = {
    buildOption,
    escapeHtml,
    formatNumber,
    highlightTerms,
    inferSearchIntent,
    safeText,
    scrollToTop,
  };
})(window);
