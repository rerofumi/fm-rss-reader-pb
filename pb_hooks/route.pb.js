
// 起動時の各種処理
onBootstrap((e) => {
  //
  e.next();
})

// API sample
routerAdd("GET", "/api/hello/{name}", (e) => {
  const testModule = require(`${__hooks}/module_test.js`)
  testModule.test(e)
  //
  let name = e.request.pathValue("name")
  return e.json(200, { "message": "Hello " + name })
})

routerAdd("POST", "/api/hello", (e) => {
    const data = new DynamicModel({ name: "" })
    e.bindBody(data)
    let name = data.name
  return e.json(200, { "message": "Hello " + name })
})

// --- routing: MCP token managemont API
// トークン取得
routerAdd("POST", "/api/mcp/tokens", (e) => {
    try {
        const MCPTokenManager = require(`${__hooks}/mcp_token_manager.js`)
        return MCPTokenManager.createToken(e)
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err)
        return e.json(400, { error: { code: "route.mcp_tokens.create_failed", message: msg, details: {} } })
    }
}, $apis.requireAuth("_superusers", "users"))

// トークン一覧
routerAdd("GET", "/api/mcp/tokens", (e) => {
    try {
        const MCPTokenManager = require(`${__hooks}/mcp_token_manager.js`)
        return MCPTokenManager.listTokens(e)
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err)
        return e.json(400, { error: { code: "route.mcp_tokens.list_failed", message: msg, details: {} } })
    }
}, $apis.requireAuth("_superusers", "users"))

// トークン失効
routerAdd("DELETE", "/api/mcp/tokens/{id}", (e) => {
    try {
        const MCPTokenManager = require(`${__hooks}/mcp_token_manager.js`)
        return MCPTokenManager.revokeToken(e)
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err)
        return e.json(400, { error: { code: "route.mcp_tokens.revoke_failed", message: msg, details: {} } })
    }
}, $apis.requireAuth("_superusers", "users"))

// --- routing: MCP JSON-RPC endpoint
routerAdd("POST", "/mcp/rss", (e) => {
    // TODO: authenticate via MCP token (Bearer MCP-...)
    // TODO: implement JSON-RPC 2.0 handling (mcp.initialize, mcp.shutdown, tools/list, tools/call)
    return e.json(200, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32601, message: "Not implemented" }
    })
})

// --- routing: LLM Bridge API (REST)
routerAdd("POST", "/api/llm/query", (e) => {
    try {
        // Bind via manual JSON parse to avoid strict DynamicModel binding issues.
        const raw = toString(e.request.body, 1024 * 1024);
        let body = {};
        try {
            body = JSON.parse(raw || '{}');
        } catch (parseErr) {
            throw new BadRequestError("invalid JSON body");
        }

        const type = String((body && body.type) ? body.type : "").trim();
        const payload = (body && typeof body.payload === 'object' && body.payload) ? body.payload : {};
        const model = (body && body.model) ? body.model : "";
        const options = (body && typeof body.options === 'object' && body.options) ? body.options : {};
        if (!type) throw new BadRequestError("type is required");

        const bridge = require(`${__hooks}/llm_bridge.js`);
        const out = bridge.callOpenRouter(type, payload, model, options);
        return e.json(200, out);
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        const code = (err instanceof BadRequestError) ? 400
            : (err instanceof UnauthorizedError) ? 401
            : (err instanceof ForbiddenError) ? 403
            : (err instanceof TooManyRequestsError) ? 429
            : 500;
        return e.json(code, { error: { code: "llm.query_failed", message: msg, details: {} } });
    }
}, $apis.requireAuth("users"))


routerAdd("GET", "/api/llm/models", (e) => {
    try {
        const bridge = require(`${__hooks}/llm_bridge.js`)
        const models = bridge.listModels()
        return e.json(200, { models })
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err)
        const code = (err instanceof BadRequestError) ? 400
            : (err instanceof UnauthorizedError) ? 401
            : (err instanceof ForbiddenError) ? 403
            : (err instanceof TooManyRequestsError) ? 429
            : 500
        return e.json(code, { error: { code: "llm.models_failed", message: msg, details: {} } })
    }
}, $apis.requireAuth("_superusers", "users"))
