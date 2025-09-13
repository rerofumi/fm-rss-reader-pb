
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
    console.log("###")
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
    // Auth: pbJWT required
    // Body: { type, payload, model?, options? }
    return e.json(501, { error: { code: "not_implemented", message: "LLM query is not implemented yet" } })
}, $apis.requireAuth("users"))

routerAdd("POST", "/api/llm/stream", (e) => {
    // Auth: pbJWT required
    // SSE: Accept: text/event-stream (TODO)
    return e.json(501, { error: { code: "not_implemented", message: "LLM stream is not implemented yet" } })
}, $apis.requireAuth("users"))

routerAdd("GET", "/api/llm/models", (e) => {
    // Auth: pbJWT required
    // Optional endpoint: return allowed/available models
    return e.json(200, { models: [] })
}, $apis.requireAuth("users"))
