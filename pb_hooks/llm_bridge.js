// pb_hooks/llm_bridge.js
// Bridge to OpenRouter for summarize/translate/ask operations.
// Reads OPENROUTER_API_KEY from environment and performs chat completion calls.

let __OPENROUTER_API_KEY_CACHE = null;

function ensureApiKey() {
  if (__OPENROUTER_API_KEY_CACHE) return __OPENROUTER_API_KEY_CACHE;

  // 1) Try environment first
  let key = $os.getenv('OPENROUTER_API_KEY') || '';

  // 2) Fallback: try to load from project .env next to pb_hooks
  if (!key) {
    try {
      const hooksDir = __hooks; // absolute path to pb_hooks
      const rootDir = $filepath.dir(hooksDir);
      const envPath = $filepath.join(rootDir, '.env');
      const envBytes = $os.readFile(envPath);
      const envText = toString(envBytes);
      const lines = envText.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^OPENROUTER_API_KEY\s*=\s*(.*)$/);
        if (m) {
          let v = m[1].trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          key = v;
          break;
        }
      }
    } catch (_) {
      // ignore
    }
  }

  if (!key) {
    throw new InternalServerError('Missing OPENROUTER_API_KEY');
  }

  __OPENROUTER_API_KEY_CACHE = key;
  return key;
}

function normOptions(options) {
  const o = options || {};
  const out = {};
  if (typeof o.temperature === 'number') out.temperature = o.temperature;
  if (typeof o.topP === 'number') out.top_p = o.topP; // OpenAI style
  if (typeof o.maxTokens === 'number') out.max_tokens = o.maxTokens;
  return out;
}

function buildMessages(type, payload) {
  if (type === 'summarize') {
    const text = String(payload?.text || '');
    const language = String(payload?.language || 'ja');
    if (!text) throw new BadRequestError('payload.text is required');
    return [
      { role: 'system', content: `You are a helpful assistant. Summarize the given article concisely in ${language}. Use bullet points if appropriate. Avoid adding extraneous commentary.` },
      { role: 'user', content: text },
    ];
  }
  if (type === 'translate') {
    const text = String(payload?.text || '');
    const target = String(payload?.targetLang || 'ja');
    if (!text) throw new BadRequestError('payload.text is required');
    return [
      { role: 'system', content: `You are a translator. Translate the user content into ${target}. Preserve meaning and style.` },
      { role: 'user', content: text },
    ];
  }
  if (type === 'ask') {
    // Accept either payload.question or payload.text (fallback) for convenience.
    let question = payload?.question;
    if (!question && payload?.text) question = payload.text;
    question = String(question || '').trim();
    const context = String(payload?.context || '');
    if (!question) throw new BadRequestError('payload.question is required');
    const messages = [
      { role: 'system', content: 'You are a helpful assistant. Answer accurately. If context is provided, ground your answer in it.' },
    ];
    if (context) messages.push({ role: 'user', content: `Context:\n${context}` });
    messages.push({ role: 'user', content: question });
    return messages;
  }
  throw new BadRequestError('unknown type');
}

function toContentString(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    return v.map((p) => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') {
        // try common fields
        if (typeof p.text === 'string') return p.text;
        if (typeof p.content === 'string') return p.content;
        if (Array.isArray(p.content)) return p.content.map(x => (typeof x === 'string' ? x : (x?.text || ''))).join('');
      }
      return '';
    }).join('');
  }
  if (v && typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (typeof v.content === 'string') return v.content;
  }
  return '';
}

function extractResult(json) {
  // Try OpenAI style first
  let content = toContentString(json?.choices?.[0]?.message?.content);
  // Fallbacks for other shapes
  if (!content) content = toContentString(json?.choices?.[0]?.text);
  if (!content) content = toContentString(json?.message?.content);

  const usedModel = json?.model || json?.choices?.[0]?.model || '';
  const usage = json?.usage || {};
  const normUsage = {
    promptTokens: usage.prompt_tokens || usage.promptTokens || 0,
    completionTokens: usage.completion_tokens || usage.completionTokens || 0,
    totalTokens: usage.total_tokens || usage.totalTokens || (usage.prompt_tokens||0) + (usage.completion_tokens||0),
  };
  return { content, model: usedModel, usage: normUsage };
}

function callOpenRouter(type, payload, model, options) {
  const apiKey = ensureApiKey();
  const messages = buildMessages(type, payload);
  const req = {
    model: model || 'openrouter/auto',
    messages,
    ...normOptions(options),
  };

  const res = $http.send({
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'X-Title': 'fm-rss-reader-pb',
    },
    body: JSON.stringify(req),
    timeout: 120,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const bodyStr = toString(res.body);
    throw new ApiError(res.statusCode, 'OpenRouter upstream error', { raw: bodyStr, status: res.statusCode });
  }

  const result = extractResult(res.json);
  return {
    result: result.content,
    model: result.model || (model || 'openrouter/auto'),
    usage: result.usage,
  };
}

// Simple 60s cache for models
let __MODELS_CACHE = { at: 0, data: [] };

function listModels() {
  const now = Date.now();
  if (__MODELS_CACHE && (now - (__MODELS_CACHE.at || 0) < 60 * 1000) && Array.isArray(__MODELS_CACHE.data) && __MODELS_CACHE.data.length) {
    return __MODELS_CACHE.data;
  }

  const apiKey = ensureApiKey();
  const res = $http.send({
    method: 'GET',
    url: 'https://openrouter.ai/api/v1/models',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'X-Title': 'fm-rss-reader-pb',
    },
    timeout: 60,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const bodyStr = toString(res.body);
    throw new ApiError(res.statusCode, 'OpenRouter models upstream error', { raw: bodyStr, status: res.statusCode });
  }

  // Normalize models list
  const raw = res.json;
  const items = Array.isArray(raw?.data) ? raw.data : [];
  const models = items.map((m) => ({
    id: m?.id || m?.name || '',
    name: m?.name || m?.id || '',
    description: m?.description || '',
  })).filter((m) => m.id);

  __MODELS_CACHE = { at: now, data: models };
  return models;
}

module.exports = {
  callOpenRouter,
  listModels,
};
