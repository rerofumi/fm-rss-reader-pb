
// 起動時の各種処理
onBootstrap((e) => {
  console.log("アプリ起動");
  //
  e.next();
})

// API sample
routerAdd("GET", "/api/hello/{name}", (e) => {
    let name = e.request.pathValue("name")
    return e.json(200, { "message": "Hello " + name })
})

// --- routing: MCP token managemont API
// トークン取得
routerAdd("POST", "/api/mcp/tokens", (e) => {
    id = "dummy"
    token = "dummy_token"
    return e.json(200, { "token": token, "id": id})
}, $apis.requireAuth())

// トークン一覧
routerAdd("GET", "/api/mcp/tokens", (e) => {
    // TODO: implement list tokens for current user
    return e.json(200, { items: [] })
}, $apis.requireAuth())

// トークン失効
routerAdd("DELETE", "/api/mcp/tokens/{id}", (e) => {
    // TODO: implement revoke token by id for current user
    let id = e.request.pathValue("id")
    return e.json(200, { success: true, id })
}, $apis.requireAuth())

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
}, $apis.requireAuth())

routerAdd("POST", "/api/llm/stream", (e) => {
    // Auth: pbJWT required
    // SSE: Accept: text/event-stream (TODO)
    return e.json(501, { error: { code: "not_implemented", message: "LLM stream is not implemented yet" } })
}, $apis.requireAuth())

routerAdd("GET", "/api/llm/models", (e) => {
    // Auth: pbJWT required
    // Optional endpoint: return allowed/available models
    return e.json(200, { models: [] })
}, $apis.requireAuth())
