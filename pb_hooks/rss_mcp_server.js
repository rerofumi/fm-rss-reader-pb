// pb_hooks/rss_mcp_server.js
// MCP (Model Context Protocol) JSON-RPC 2.0 server for /mcp/rss
// References:
// - doc/02_backend_specification.md (sections 3 and 4)
// - pb_hooks/llm_bridge.js (for llm.summarize/translate/ask)
// - Supabase reference implementation: fm_memo_chunk/backend/supabase/functions/mcp-server/index.ts

// ---- JSON-RPC helpers ----
function makeJsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function makeJsonRpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data: data || {} } };
}

// Standard JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

// Custom error codes (as in reference)
const ERR_AUTH_HEADER = -32001;
const ERR_API_KEY_FORMAT = -32002;
const ERR_API_KEY_INVALID = -32003;
const ERR_API_KEY_REVOKED = -32004;
const ERR_JWT_INVALID = -32005; // not used here

// ---- Token hashing (mirror of mcp_token_manager.js) ----
function hashToken(token) {
  function rrot(x, n) { return (x >>> n) | (x << (32 - n)); }
  function toBytes(s) { const b = []; for (let i=0;i<s.length;i++){ const c=s.charCodeAt(i); if(c<128)b.push(c); else if(c<2048)b.push(192|c>>6,128|c&63); else if(c<55296||c>=57344)b.push(224|c>>12,128|c>>6&63,128|c&63); else { i++; const cp=65536+((c&1023)<<10)|(s.charCodeAt(i)&1023); b.push(240|cp>>18,128|cp>>12&63,128|cp>>6&63,128|cp&63);} } return b; }
  const K = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  const bytes = toBytes(token);
  const l = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((l >>> (i * 8)) & 0xff);
  let H0 = 1779033703, H1 = 3144134277, H2 = 1013904242, H3 = 2773480762, H4 = 1359893119, H5 = 2600822924, H6 = 528734635, H7 = 1541459225;
  const W = new Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = (bytes[i + t*4] << 24) | (bytes[i + t*4 + 1] << 16) | (bytes[i + t*4 + 2] << 8) | (bytes[i + t*4 + 3]);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rrot(W[t-15],7) ^ rrot(W[t-15],18) ^ (W[t-15] >>> 3);
      const s1 = rrot(W[t-2],17) ^ rrot(W[t-2],19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    let a=H0,b=H1,c=H2,d=H3,e=H4,f=H5,g=H6,h=H7;
    for (let t = 0; t < 64; t++) {
      const S1 = rrot(e,6) ^ rrot(e,11) ^ rrot(e,25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rrot(a,2) ^ rrot(a,13) ^ rrot(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d + temp1) >>> 0; d=c; c=b; b=a; a=(temp1 + temp2) >>> 0;
    }
    H0=(H0+a)>>>0; H1=(H1+b)>>>0; H2=(H2+c)>>>0; H3=(H3+d)>>>0; H4=(H4+e)>>>0; H5=(H5+f)>>>0; H6=(H6+g)>>>0; H7=(H7+h)>>>0;
  }
  function toHex(n){ return ("00000000" + n.toString(16)).slice(-8); }
  return toHex(H0)+toHex(H1)+toHex(H2)+toHex(H3)+toHex(H4)+toHex(H5)+toHex(H6)+toHex(H7);
}

// ---- Header utilities ----
function getHeader(e, name) {
  const key = String(name);
  // 1) If request.header is a function
  try {
    if (e.request && typeof e.request.header === 'function') {
      const v = e.request.header(key);
      if (typeof v === 'string' && v) return v;
    }
  } catch (_) {}
  // 2) If request.headers or request.header is an object map
  try {
    const hdrs = e.request && (e.request.headers || e.request.header || null);
    if (hdrs && typeof hdrs === 'object') {
      const v = hdrs[key] || hdrs[key.toLowerCase()] || hdrs[key.toUpperCase()];
      if (typeof v === 'string' && v) return v;
    }
  } catch (_) {}
  // 3) requestInfo()
  try {
    if (typeof e.requestInfo === 'function') {
      const info = e.requestInfo();
      const h = info && (info.header || info.headers);
      if (h && typeof h === 'object') {
        const v = h[key] || h[key.toLowerCase()] || h[key.toUpperCase()];
        if (typeof v === 'string' && v) return v;
      }
    }
  } catch (_) {}
  return '';
}

// ---- Auth via MCP token or PocketBase JWT ----
function authenticateRequest(e) {
  let authHeader = getHeader(e, "Authorization");
  if (!authHeader) authHeader = getHeader(e, "authorization");
  if (!authHeader || !/^Bearer\s+/.test(String(authHeader))) {
    throw new UnauthorizedError("Authorization header is missing or invalid.");
  }
  const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();

  // 1) Prefer MCP token if it matches prefix
  if (token.startsWith("MCP-")) {
    const th = hashToken(token);
    const rec = $app.findFirstRecordByFilter(
      "mcp_tokens",
      "token_hash={:h}",
      { h: th }
    );
    if (!rec) throw new UnauthorizedError("Invalid MCP token.");

    const expires = rec.get("expires_at") || null;
    if (expires) {
      try {
        const expMs = Date.parse(String(expires));
        if (!isNaN(expMs) && Date.now() > expMs) {
          throw new UnauthorizedError("MCP token expired.");
        }
      } catch (_) {}
    }
    // best-effort last_used update
    try { rec.set("last_used_at", new Date().toISOString()); $app.save(rec); } catch (_) {}
    const userId = rec.get("user");
    if (!userId) throw new UnauthorizedError("Token record missing user.");
    return { userId, kind: "mcp", tokenRecord: rec };
  }

  // 2) Fallback: treat as PocketBase auth JWT (users collection)
  // Try generic signature first (preferred in newer PB):
  try {
    const user1 = $app.findAuthRecordByToken(token);
    if (user1 && user1.id) {
      return { userId: user1.id, kind: "pbjwt", authRecord: user1 };
    }
  } catch (_) {}
  // Try explicit collection variants for compatibility:
  try {
    const user2 = $app.findAuthRecordByToken("_pb_users_auth_", token);
    if (user2 && user2.id) {
      return { userId: user2.id, kind: "pbjwt", authRecord: user2 };
    }
  } catch (_) {}
  try {
    const user3 = $app.findAuthRecordByToken("users", token);
    if (user3 && user3.id) {
      return { userId: user3.id, kind: "pbjwt", authRecord: user3 };
    }
  } catch (_) {}
  throw new UnauthorizedError("Invalid token");
}

// ---- Tools ----
function toolsList() {
  return {
    tools: [
      // --- RSS: genres ---
      {
        name: "genre.list",
        description: "List all genres of the authenticated user.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "genre.create",
        description: "Create a new genre.",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      },
      {
        name: "genre.update",
        description: "Rename an existing genre.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
          required: ["id", "name"]
        }
      },
      {
        name: "genre.delete",
        description: "Delete a genre and its feeds.",
        inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
      },
      // --- RSS: feeds ---
      {
        name: "feed.list",
        description: "List feeds under a genre.",
        inputSchema: { type: "object", properties: { genreId: { type: "string" } }, required: ["genreId"] }
      },
      {
        name: "feed.add",
        description: "Add an RSS feed URL to a genre. Label is auto-fetched from the feed title.",
        inputSchema: { type: "object", properties: { genreId: { type: "string" }, url: { type: "string" } }, required: ["genreId", "url"] }
      },
      {
        name: "feed.remove",
        description: "Remove a feed by id.",
        inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
      },
      // --- RSS: articles ---
      {
        name: "articles.fetchByGenre",
        description: "Fetch articles from all feeds under a genre and merge by recency.",
        inputSchema: { type: "object", properties: { genreId: { type: "string" }, limit: { type: "number" } }, required: ["genreId"] }
      },
      {
        name: "articles.fetchByUrl",
        description: "Fetch articles directly from a single feed URL.",
        inputSchema: { type: "object", properties: { url: { type: "string" }, limit: { type: "number" } }, required: ["url"] }
      }
    ]
  };
}

// ---- DB utilities ----
function nowISO() { return new Date().toISOString(); }

function ensureGenreOwnership(userId, genreId) {
  const g = $app.findRecordById("genres", genreId);
  if (!g) throw new NotFoundError("genre not found");
  if (g.get("user") !== userId) throw new ForbiddenError("forbidden");
  return g;
}

function ensureFeedOwnership(userId, feedId) {
  const f = $app.findRecordById("feeds", feedId);
  if (!f) throw new NotFoundError("feed not found");
  if (f.get("user") !== userId) throw new ForbiddenError("forbidden");
  return f;
}

function listGenres(userId) {
  // PocketBase sort syntax doesn't accept "ASC/ DESC" keywords.
  // Use ascending by sort_order, then stabilize by name in JS for ties.
  const recs = $app.findRecordsByFilter("genres", "user={:u}", "sort_order", 500, 0, { u: userId });
  recs.sort((a, b) => {
    const sa = Number(a.get("sort_order") || 0);
    const sb = Number(b.get("sort_order") || 0);
    if (sa !== sb) return sa - sb;
    const na = String(a.get("name") || "");
    const nb = String(b.get("name") || "");
    return na.localeCompare(nb, 'ja');
  });
  const items = recs.map((r) => ({ id: r.id, name: r.get("name"), createdAt: r.get("created") || null }));
  return { genres: items };
}

function createGenre(userId, name) {
  if (!name || !String(name).trim()) throw new BadRequestError("name is required");
  const c = $app.findCollectionByNameOrId("genres");
  const r = new Record(c);
  const now = nowISO();
  r.set("user", userId);
  r.set("name", String(name).trim());
  r.set("created", now);
  r.set("updated", now);
  $app.save(r);
  return { id: r.id, name: r.get("name"), createdAt: r.get("created") };
}

function updateGenre(userId, id, name) {
  if (!id) throw new BadRequestError("id is required");
  if (!name || !String(name).trim()) throw new BadRequestError("name is required");
  const r = ensureGenreOwnership(userId, id);
  r.set("name", String(name).trim());
  r.set("updated", nowISO());
  $app.save(r);
  return { id: r.id, name: r.get("name"), updatedAt: r.get("updated") };
}

function deleteGenre(userId, id) {
  const g = ensureGenreOwnership(userId, id);
  // delete feeds under this genre (cascadeDelete=false on schema)
  const feeds = $app.findRecordsByFilter("feeds", "user={:u} && genre={:g}", "", 1000, 0, { u: userId, g: id });
  for (const f of feeds) { $app.delete(f); }
  $app.delete(g);
  return { success: true };
}

function listFeeds(userId, genreId) {
  ensureGenreOwnership(userId, genreId);
  // PB orderBy syntax: 'label' for asc (no 'ASC'). Stabilize by url in JS.
  const recs = $app.findRecordsByFilter("feeds", "user={:u} && genre={:g}", "label", 1000, 0, { u: userId, g: genreId });
  recs.sort((a, b) => {
    const la = String(a.get("label") || "");
    const lb = String(b.get("label") || "");
    const cmp = la.localeCompare(lb, 'ja');
    if (cmp !== 0) return cmp;
    const ua = String(a.get("url") || "");
    const ub = String(b.get("url") || "");
    return ua.localeCompare(ub);
  });
  const items = recs.map((r) => ({ id: r.id, url: r.get("url"), title: r.get("label") || null, createdAt: r.get("created") || null }));
  return { feeds: items };
}

function hostFromUrl(u) {
  try {
    // JSVM may not have URL class; fallback regex
    const m = String(u).match(/^https?:\/\/([^\/]+)/i);
    return m ? m[1] : String(u);
  } catch (_) { return String(u); }
}

function httpGet(url, timeoutSec) {
  const res = $http.send({ method: 'GET', url: url, headers: { 'User-Agent': 'fm-rss-reader/0.1 (+mcp)' }, timeout: Math.max(5, timeoutSec || 20) });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const bodyStr = toString(res.body);
    throw new ApiError(res.statusCode, 'upstream http error', { status: res.statusCode, raw: bodyStr });
  }
  const text = typeof res.body === 'string' ? res.body : toString(res.body);
  return { text, status: res.statusCode, headers: res.headers || {} };
}

function textBetween(s, startTag, endTag) {
  const i = s.indexOf(startTag);
  if (i < 0) return '';
  const j = s.indexOf(endTag, i + startTag.length);
  if (j < 0) return '';
  return s.slice(i + startTag.length, j);
}

function stripTags(s) { return String(s).replace(/<[^>]*>/g, '').trim(); }
function unwrapCdata(s) { return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); }
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseDateToISO(s) { const t = Date.parse(String(s||'').trim()); return isNaN(t) ? null : new Date(t).toISOString(); }

function splitItems(xml) {
  // Try RSS 2.0 <item>
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) { items.push(m[0]); }
  if (items.length) return { type: 'rss', items };
  // Try Atom <entry>
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) { items.push(m[0]); }
  if (items.length) return { type: 'atom', items };
  return { type: 'unknown', items: [] };
}

function extractFeedTitle(xml) {
  // RSS/Atom feed-level title (first <title> before entries)
  let inner = textBetween(xml, '<title', '</title>').replace(/^[^>]*>/, '');
  inner = unwrapCdata(inner);
  let title = stripTags(inner);
  if (!title) {
    const m = xml.match(/<feed[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m) {
      const unwrapped = unwrapCdata(m[1]);
      title = stripTags(unwrapped);
    }
  }
  return decodeEntities(title || '');
}

function extractLinkFromItemXml(xml, type) {
  if (type === 'atom') {
    // <link href="..."/> or <link rel="alternate" href="..."/>
    const m = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (m) return m[1];
  }
  // RSS or fallback: <link>...</link>
  const raw = textBetween(xml, '<link', '</link>').replace(/^[^>]*>/, '');
  if (raw) return stripTags(raw);
  return '';
}

function extractTextTag(xml, tag) {
  const innerRaw = textBetween(xml, `<${tag}`, `</${tag}>`).replace(/^[^>]*>/, '');
  const inner = unwrapCdata(innerRaw);
  return decodeEntities(stripTags(inner));
}

function parseRssAtom(xml, feedUrl) {
  const { type, items } = splitItems(xml);
  const feedTitle = extractFeedTitle(xml) || hostFromUrl(feedUrl);
  const out = [];
  for (const it of items) {
    const title = extractTextTag(it, 'title');
    const link = extractLinkFromItemXml(it, type) || feedUrl;
    // Published date
    let pub = extractTextTag(it, 'pubDate');
    if (!pub) pub = extractTextTag(it, 'published');
    if (!pub) pub = extractTextTag(it, 'updated');
    const published = parseDateToISO(pub);
    // Snippet / Description
    let desc = extractTextTag(it, 'content');
    if (!desc) desc = extractTextTag(it, 'summary');
    if (!desc) desc = extractTextTag(it, 'description');
    const descPlain = stripTags(desc);
    const contentSnippet = descPlain.slice(0, 400);
    const description = descPlain.slice(0, 100);
    out.push({ title, link, published, contentSnippet, description, feed: { title: feedTitle, url: feedUrl } });
  }
  return out;
}

function addFeed(userId, genreId, url) {
  ensureGenreOwnership(userId, genreId);
  const c = $app.findCollectionByNameOrId("feeds");
  const r = new Record(c);
  const now = nowISO();
  // Try fetch once to determine title
  let label = '';
  try {
    const resp = httpGet(url, 15);
    label = extractFeedTitle(resp.text) || hostFromUrl(url);
  } catch (_) {
    label = hostFromUrl(url);
  }
  r.set("user", userId);
  r.set("genre", genreId);
  r.set("url", url);
  r.set("label", label);
  r.set("user_url_key", `${userId}:${url}`);
  r.set("created", now);
  r.set("updated", now);
  try { $app.save(r); } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (/unique/i.test(msg)) throw new BadRequestError("feed already exists for this user/url");
    throw err;
  }
  return { id: r.id, url, title: label, createdAt: r.get("created") };
}

function removeFeed(userId, id) {
  const f = ensureFeedOwnership(userId, id);
  $app.delete(f);
  return { success: true };
}

function fetchArticlesFromUrl(url, limit) {
  const resp = httpGet(url, 20);
  const articles = parseRssAtom(resp.text, url);
  const n = (typeof limit === 'number' && limit > 0) ? Math.floor(limit) : articles.length;
  return articles.slice(0, n);
}

function fetchArticlesByGenre(userId, genreId, limit) {
  ensureGenreOwnership(userId, genreId);
  const feeds = $app.findRecordsByFilter("feeds", "user={:u} && genre={:g} && (disabled = false || disabled = null)", "", 1000, 0, { u: userId, g: genreId });
  let all = [];
  for (const f of feeds) {
    try {
      const url = f.get("url");
      const resp = httpGet(url, 20);
      const parts = parseRssAtom(resp.text, url);
      all = all.concat(parts);
    } catch (_) {
      // ignore individual feed failure
    }
  }
  // sort by published desc
  all.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });
  const n = (typeof limit === 'number' && limit > 0) ? Math.floor(limit) : all.length;
  return all.slice(0, n);
}

function toolsCall(e, userId, params) {
  const name = params && params.name ? String(params.name) : "";
  const toolArgs = (params && typeof params.arguments === "object") ? params.arguments : {};
  if (!name) {
    throw new BadRequestError("Tool name is required");
  }

  // --- Genres ---
  if (name === "genre.list") {
    const data = listGenres(userId);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  if (name === "genre.create") {
    const nameArg = String(toolArgs.name || "").trim();
    const created = createGenre(userId, nameArg);
    return { content: [{ type: "text", text: JSON.stringify(created) }] };
  }
  if (name === "genre.update") {
    const id = String(toolArgs.id || "");
    const nameArg = String(toolArgs.name || "").trim();
    const updated = updateGenre(userId, id, nameArg);
    return { content: [{ type: "text", text: JSON.stringify(updated) }] };
  }
  if (name === "genre.delete") {
    const id = String(toolArgs.id || "");
    const out = deleteGenre(userId, id);
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  }

  // --- Feeds ---
  if (name === "feed.list") {
    const genreId = String(toolArgs.genreId || "");
    const out = listFeeds(userId, genreId);
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  }
  if (name === "feed.add") {
    const genreId = String(toolArgs.genreId || "");
    const url = String(toolArgs.url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new BadRequestError("url must be http(s)");
    const out = addFeed(userId, genreId, url);
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  }
  if (name === "feed.remove") {
    const id = String(toolArgs.id || "");
    const out = removeFeed(userId, id);
    return { content: [{ type: "text", text: JSON.stringify(out) }] };
  }

  // --- Articles ---
  if (name === "articles.fetchByUrl") {
    const url = String(toolArgs.url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new BadRequestError("url must be http(s)");
    const limit = (typeof toolArgs.limit === 'number') ? toolArgs.limit : undefined;
    const articles = fetchArticlesFromUrl(url, limit);
    return { content: [{ type: "text", text: JSON.stringify({ articles }) }] };
  }
  if (name === "articles.fetchByGenre") {
    const genreId = String(toolArgs.genreId || "");
    const limit = (typeof toolArgs.limit === 'number') ? toolArgs.limit : undefined;
    const articles = fetchArticlesByGenre(userId, genreId, limit);
    return { content: [{ type: "text", text: JSON.stringify({ articles }) }] };
  }

  throw new NotFoundError(`Tool not found: ${name}`);
}

// ---- MCP protocol methods ----
function mcpInitialize() {
  return {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    serverInfo: { name: "fm-rss-reader-pb", version: "0.1.0" }
  };
}

function mcpShutdown() {
  // no-op; client may close session
  return null;
}

// ---- Request dispatcher ----
function handleSingleRpc(e, rpc) {
  const { jsonrpc, method, params, id } = rpc;
  if (jsonrpc !== "2.0" || !method) {
    return { status: 200, body: makeJsonRpcError(id, INVALID_REQUEST, "Invalid Request. Not conforming to JSON-RPC 2.0.") };
  }

  // Notifications (no id): acknowledge with 202
  const isNotification = (typeof id === 'undefined');
  if (isNotification) {
    // common notification that some clients send
    if (method === 'notifications/initialized') {
      return { status: 202, body: null };
    }
    return { status: 202, body: null };
  }

  try {
    // initialize is allowed without auth
    if (method === 'mcp.initialize' || method === 'initialize') {
      const result = mcpInitialize();
      return { status: 200, body: makeJsonRpcResult(id, result) };
    }

    // authenticate for all other methods (MCP token or PB JWT)
    const auth = authenticateRequest(e); // throws on failure

    if (method === 'mcp.shutdown' || method === 'shutdown') {
      const result = mcpShutdown();
      return { status: 200, body: makeJsonRpcResult(id, result) };
    }

    if (method === 'tools/list') {
      const result = toolsList();
      return { status: 200, body: makeJsonRpcResult(id, result) };
    }

    if (method === 'tools/call') {
      const result = toolsCall(e, auth.userId, params || {});
      return { status: 200, body: makeJsonRpcResult(id, result) };
    }


    return { status: 200, body: makeJsonRpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`) };
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (err instanceof BadRequestError) {
      return { status: 200, body: makeJsonRpcError(id, INVALID_PARAMS, msg) };
    }
    if (err instanceof UnauthorizedError) {
      return { status: 401, body: makeJsonRpcError(id, ERR_AUTH_HEADER, msg) };
    }
    if (err instanceof NotFoundError) {
      return { status: 200, body: makeJsonRpcError(id, METHOD_NOT_FOUND, msg) };
    }
    // generic
    return { status: 500, body: makeJsonRpcError(id, INTERNAL_ERROR, msg) };
  }
}

function handleBatchRpc(e, rpcArray) {
  // Per JSON-RPC spec, notifications in batch are omitted from response.
  const responses = [];
  let httpStatus = 200;
  for (const rpc of rpcArray) {
    const r = handleSingleRpc(e, rpc);
    if (r.body && typeof r.body === 'object' && r.body.jsonrpc === '2.0' && Object.prototype.hasOwnProperty.call(r.body, 'id')) {
      // Only include non-notification responses
      responses.push(r.body);
    }
    // Track highest severity HTTP status (simple heuristic)
    if (r.status >= 400) httpStatus = r.status;
  }
  // If all were notifications, responses[] may be empty; spec allows returning nothing, but we return empty array.
  return { status: httpStatus, body: responses };
}

function handle(e) {
  // Parse body
  let raw = '';
  try {
    raw = toString(e.request.body, 1024 * 1024);
  } catch (_) {
    return e.json(400, makeJsonRpcError(null, PARSE_ERROR, 'Invalid body'));
  }

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) {
    return e.json(200, makeJsonRpcError(null, PARSE_ERROR, 'Parse error. Invalid JSON was received.'));
  }

  if (Array.isArray(payload)) {
    const r = handleBatchRpc(e, payload);
    return e.json(r.status, r.body);
  }

  const r = handleSingleRpc(e, payload);
  if (r.body === null) {
    // 202 Accepted with empty body
    return e.json(202, {});
  }
  return e.json(r.status, r.body);
}

module.exports = {
  handle,
};