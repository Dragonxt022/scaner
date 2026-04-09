function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function resolveAiEndpoint(baseUrl) {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (!trimmed) {
    return { endpoint: '', mode: 'responses' };
  }

  try {
    const url = new URL(trimmed);
    const origin = url.origin;
    const pathName = url.pathname.replace(/\/+$/, '');

    if (pathName.endsWith('/v1/responses') || pathName.endsWith('/responses')) {
      return { endpoint: `${origin}${pathName}`, mode: 'responses' };
    }

    if (pathName.endsWith('/v1/chat/completions') || pathName.endsWith('/chat/completions')) {
      return { endpoint: `${origin}${pathName}`, mode: 'chat_completions' };
    }

    if (pathName.endsWith('/api/v1/chat')) {
      return { endpoint: `${origin}/v1/responses`, mode: 'responses' };
    }

    if (pathName.endsWith('/v1')) {
      return { endpoint: `${origin}${pathName}/responses`, mode: 'responses' };
    }

    return { endpoint: `${origin}/v1/responses`, mode: 'responses' };
  } catch {
    if (trimmed.endsWith('/v1/responses') || trimmed.endsWith('/responses')) {
      return { endpoint: trimmed, mode: 'responses' };
    }

    if (trimmed.endsWith('/v1/chat/completions') || trimmed.endsWith('/chat/completions')) {
      return { endpoint: trimmed, mode: 'chat_completions' };
    }

    if (trimmed.endsWith('/api/v1/chat')) {
      return { endpoint: trimmed.replace(/\/api\/v1\/chat$/i, '/v1/responses'), mode: 'responses' };
    }

    if (trimmed.endsWith('/v1')) {
      return { endpoint: `${trimmed}/responses`, mode: 'responses' };
    }

    return { endpoint: `${trimmed}/v1/responses`, mode: 'responses' };
  }
}

module.exports = {
  resolveAiEndpoint,
};
