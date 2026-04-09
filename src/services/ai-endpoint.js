function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function getSafeUrl(trimmed) {
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function resolveAiEndpoint(baseUrl) {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (!trimmed) {
    return { endpoint: '', mode: 'responses' };
  }

  const url = getSafeUrl(trimmed);
  if (url) {
    const origin = url.origin;
    const pathName = url.pathname.replace(/\/+$/, '');

    if (pathName.endsWith('/v1/responses') || pathName.endsWith('/responses')) {
      return { endpoint: `${origin}${pathName}`, mode: 'responses' };
    }

    if (pathName.endsWith('/v1/chat/completions') || pathName.endsWith('/chat/completions')) {
      return { endpoint: `${origin}${pathName}`, mode: 'chat_completions' };
    }

    if (pathName.endsWith('/api/chat')) {
      return { endpoint: `${origin}${pathName}`, mode: 'ollama_chat' };
    }

    if (pathName.endsWith('/api/generate')) {
      return { endpoint: `${origin}${pathName}`, mode: 'ollama_generate' };
    }

    if (pathName.endsWith('/api')) {
      return { endpoint: `${origin}${pathName}/chat`, mode: 'ollama_chat' };
    }

    if (pathName.endsWith('/api/v1/chat')) {
      return { endpoint: `${origin}/v1/responses`, mode: 'responses' };
    }

    if (pathName.endsWith('/v1')) {
      return { endpoint: `${origin}${pathName}/responses`, mode: 'responses' };
    }

    return { endpoint: `${origin}/v1/responses`, mode: 'responses' };
  }

  if (trimmed.endsWith('/v1/responses') || trimmed.endsWith('/responses')) {
    return { endpoint: trimmed, mode: 'responses' };
  }

  if (trimmed.endsWith('/v1/chat/completions') || trimmed.endsWith('/chat/completions')) {
    return { endpoint: trimmed, mode: 'chat_completions' };
  }

  if (trimmed.endsWith('/api/chat')) {
    return { endpoint: trimmed, mode: 'ollama_chat' };
  }

  if (trimmed.endsWith('/api/generate')) {
    return { endpoint: trimmed, mode: 'ollama_generate' };
  }

  if (trimmed.endsWith('/api')) {
    return { endpoint: `${trimmed}/chat`, mode: 'ollama_chat' };
  }

  if (trimmed.endsWith('/api/v1/chat')) {
    return { endpoint: trimmed.replace(/\/api\/v1\/chat$/i, '/v1/responses'), mode: 'responses' };
  }

  if (trimmed.endsWith('/v1')) {
    return { endpoint: `${trimmed}/responses`, mode: 'responses' };
  }

  return { endpoint: `${trimmed}/v1/responses`, mode: 'responses' };
}

function resolveModelEndpoints(baseUrl) {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (!trimmed) {
    return [];
  }

  const candidates = new Set();
  const url = getSafeUrl(trimmed);

  if (url) {
    const origin = url.origin;
    const pathName = url.pathname.replace(/\/+$/, '');

    if (pathName.endsWith('/api/chat') || pathName.endsWith('/api/generate') || pathName.endsWith('/api')) {
      candidates.add(`${origin}/api/tags`);
    }

    if (pathName.endsWith('/chat/completions')) {
      candidates.add(`${origin}${pathName.replace(/\/chat\/completions$/i, '/models')}`);
      candidates.add(`${origin}${pathName.replace(/\/api\/v1\/chat\/completions$/i, '/api/v0/models')}`);
    } else if (pathName.endsWith('/chat')) {
      candidates.add(`${origin}${pathName.replace(/\/chat$/i, '/models')}`);
      candidates.add(`${origin}${pathName.replace(/\/api\/v1\/chat$/i, '/api/v0/models')}`);
    } else if (pathName.endsWith('/v1')) {
      candidates.add(`${origin}${pathName}/models`);
    }

    candidates.add(`${origin}/api/tags`);
    candidates.add(`${origin}/v1/models`);
    candidates.add(`${origin}/api/v1/models`);
    candidates.add(`${origin}/api/v0/models`);
  } else {
    if (trimmed.endsWith('/api/chat') || trimmed.endsWith('/api/generate') || trimmed.endsWith('/api')) {
      candidates.add(trimmed.replace(/\/(chat|generate)$/i, '').replace(/\/+$/, '') + '/tags');
    }
    candidates.add(`${trimmed}/models`);
  }

  return [...candidates];
}

module.exports = {
  resolveAiEndpoint,
  resolveModelEndpoints,
};
