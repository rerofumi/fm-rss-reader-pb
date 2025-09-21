// pb_hooks/llm_bridge.js
// Bridge to OpenRouter for summarize/translate/ask operations.
// Reads OPENROUTER_API_KEY from environment and performs chat completion calls.

let __OPENROUTER_API_KEY_CACHE = null;

// ---- Article fetch & clip helpers ----
const __DEFAULT_CLIP = {
  maxBytes: 524288,   // 512 KB
  maxChars: 12000,    // 12k chars
  timeoutMs: 12000,   // 12s
  maxRedirects: 3,
};

function __clamp(n, min, max) {
  n = n | 0;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function __sanitizeClip(opts) {
  const o = Object.assign({}, __DEFAULT_CLIP, opts || {});
  o.maxBytes = __clamp(o.maxBytes || 0, 65536, 1048576);   // 64KB .. 1MB
  o.maxChars = __clamp(o.maxChars || 0, 2000, 20000);      // 2k .. 20k
  o.timeoutMs = __clamp(o.timeoutMs || 0, 3000, 20000);
  o.maxRedirects = __clamp(o.maxRedirects || 0, 0, 5);
  return o;
}

function __lowerHeaders(h) {
  const out = {};
  if (h && typeof h === 'object') {
    for (const k in h) {
      try { out[String(k).toLowerCase()] = h[k]; } catch (_) {}
    }
  }
  return out;
}

function __getHeader(headers, name) {
  const h = headers || {};
  const key = String(name).toLowerCase();
  const v = h[key];
  if (v == null) return '';
  return String(v);
}

function __decodeEntities(s) {
  if (!s) return '';
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s).replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g1) => {
    try {
      if (!g1) return m;
      if (g1[0] === '#') {
        if ((g1[1] || '').toLowerCase() === 'x') {
          const cp = parseInt(g1.slice(2), 16);
          return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
        }
        const cp = parseInt(g1.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
      }
      return Object.prototype.hasOwnProperty.call(named, g1) ? named[g1] : m;
    } catch (_) { return m; }
  });
}

function __htmlToText(html) {
  let s = String(html || '');
  // Hint line breaks around common block elements
  s = s.replace(/<(\/)?(p|div|br|li|h[1-6]|section|article|header|footer)\b[^>]*>/gi, '\n$1');
  // Remove script/style/noscript blocks
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // Remove all tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode entities and normalize whitespace
  s = __decodeEntities(s);
  s = s.replace(/\r/g, '\n');
  s = s.replace(/[ \t\f\v]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map(l => l.trim()).join('\n');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

function __fetchAndClipArticle(url, clipOpts) {
  if (!url || typeof url !== 'string') return { text: '', truncated: false };
  const clip = __sanitizeClip(clipOpts);
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

  let current = url;
  let redirects = 0;

  try {
    while (redirects <= clip.maxRedirects) {
      const res = $http.send({
        method: 'GET',
        url: current,
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        },
        timeout: Math.max(clip.timeoutMs, 1),
      });

      const status = res?.statusCode || res?.status || 0;
      const headers = __lowerHeaders(res?.headers || {});

      // Handle redirects
      if (status >= 300 && status < 400) {
        const loc = __getHeader(headers, 'location');
        if (!loc) break;
        try {
          const resolved = new URL(loc, current).toString();
          current = resolved;
          redirects++;
          continue;
        } catch (_) {
          break;
        }
      }

      if (status < 200 || status >= 300) {
        return { text: '', truncated: false };
      }

      const ct = __getHeader(headers, 'content-type');
      if (!/^text\/html/i.test(ct)) {
        return { text: '', truncated: false };
      }

      let raw = '';
      try {
        raw = toString(res.body);
      } catch (_) {
        try { raw = String(res.body || ''); } catch (_) { raw = ''; }
      }
      if (!raw) return { text: '', truncated: false };

      if (raw.length > clip.maxBytes) {
        raw = raw.slice(0, clip.maxBytes);
      }

      let text = __htmlToText(raw);
      let truncated = false;
      if (text.length > clip.maxChars) {
        text = text.slice(0, clip.maxChars);
        truncated = true;
      }

      try { $app.logger().info(`llm_bridge: fetched article ok, htmlLen=${raw.length}, textLen=${text.length}, truncated=${truncated}`); } catch (_) {}
      return { text, truncated };
    }
  } catch (e) {
    try { $app.logger().warn(`llm_bridge: fetch failed for ${url}: ${e && e.message ? e.message : e}`); } catch (_) {}
  }
  return { text: '', truncated: false };
}

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

  // If summarize/ask and articleUrl present, try to fetch and clip the article.
  try {
    const p = (payload && typeof payload === 'object') ? payload : {};
    const t = String(type || '');
    const url = String(p.articleUrl || '').trim();
    if (url && (t === 'summarize' || t === 'ask')) {
      const clip = (p.clip && typeof p.clip === 'object') ? p.clip : undefined;
      const out = __fetchAndClipArticle(url, clip);
      if (out && typeof out.text === 'string' && out.text.trim()) {
        if (t === 'summarize') {
          p.text = out.text;
        } else if (t === 'ask') {
          p.context = out.text;
        }
      }
    }
  } catch (_) {
    // Swallow and fall back silently to provided text/context
  }

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
