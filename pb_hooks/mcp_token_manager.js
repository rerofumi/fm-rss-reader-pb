// pb_hooks/mcp_token_manager.js
// Manages MCP access tokens in the `mcp_tokens` collection.
// Spec refs: doc/02_backend_specification.md (section 3.2, 10)

// Utilities

function nowISO() {
  return new Date().toISOString();
}

function generateTokenPlain() {
  // NOTE: Replace with cryptographically secure random generator if available.
  // For initial implementation, use a simple random fallback.
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return "MCP-" + rand.slice(0, 48);
}

// Minimal SHA-256 implementation (hex output)
function hashToken(token) {
  // Source: tiny JS SHA-256 (adapted), suitable for non-crypto-critical hashing.
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

function requireUserId(e) {
  // The auth record is populated in `e.auth` by the middleware.
  const authRecord = e.auth;
  if (!authRecord || !authRecord.id) {
    throw new UnauthorizedError("Missing auth context");
  }
  return authRecord.id;
}

function createToken(e) {
  try {
    const userId = requireUserId(e);

    // Define the expected request body structure and bind it.
    const body = new DynamicModel({
      name: "",
    });
    e.bindBody(body);

    const name = body.name || "";
    // Ensure scopes is an array, defaulting to ["tools.call"]
    const scopes = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ["tools.call"];
    const expiresAt = body.expiresAt || null;

    const tokenPlain = generateTokenPlain();
    const tokenHash = hashToken(tokenPlain);
    const keyPrefix = tokenPlain.slice(0, 12);

    const collection = $app.findCollectionByNameOrId("mcp_tokens");
    const record = new Record(collection);

    record.set("user", userId);
    record.set("token_hash", tokenHash);
    record.set("key_prefix", keyPrefix);
    record.set("name", name);
    record.set("scopes", scopes);
    if (expiresAt) {
      record.set("expires_at", expiresAt);
    }

    // Set timestamps for the required fields
    const now = new Date().toISOString();
    record.set("created", now);
    record.set("updated", now);

    $app.save(record);

    return e.json(200, {
      token: tokenPlain,
      id: record.id,
      expiresAt: record.get("expires_at") || null,
    });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return e.json(400, { error: { code: "mcp_tokens.create_failed", message: msg, details: {} } });
  }
}

function listTokens(e) {
  try {
    const userId = requireUserId(e);
    const items = $app.findRecordsByFilter(
        "mcp_tokens",
        "user = {:uid}",
        "-created", // Now sorting by the explicitly added 'created' field
        200,        // limit
        0,          // offset
        { uid: userId } // params
      )
      .map((r) => ({
        id: r.id,
        name: r.get("name"),
        scopes: r.get("scopes") || [],
        expiresAt: r.get("expires_at") || null,
        lastUsedAt: r.get("last_used_at") || null,
        createdAt: r.get("created") || null, // Use the default system field 'created'
      }));

    return e.json(200, { items });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return e.json(400, { error: { code: "mcp_tokens.list_failed", message: msg, details: {} } });
  }
}

function revokeToken(e) {
  try {
    const userId = requireUserId(e);
    const id = e.request.pathValue("id");
    if (!id) throw new BadRequestError("Missing token id");

    const rec = $app.findRecordById("mcp_tokens", id);
    if (!rec) throw new NotFoundError("Token not found");

    if (rec.get("user") !== userId) {
      throw new ForbiddenError("Forbidden");
    }

    $app.delete(rec);
    return e.json(200, { success: true, id });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return e.json(400, { error: { code: "mcp_tokens.revoke_failed", message: msg, details: {} } });
  }
}

module.exports = {
  createToken,
  listTokens,
  revokeToken,
};
