package main

import (
	"log"
	"os"

	apiHandlers "fm-rss-reader-pb/internal/api"
	mcpServer "fm-rss-reader-pb/internal/mcp"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	app.OnServe().Bind(func(e *core.ServeEvent) error {
		// MCP JSON-RPC route
		e.Router.POST("/mcp/rss", mcpServer.HandleRSSJSONRPC(app))

		// REST API routes
		api := e.Router.Group("/api")
		api.Use(apiHandlers.EnsureRecordAuth)

		api.POST("/llm/query", apiHandlers.HandleLLMQuery(app))
		api.POST("/llm/stream", apiHandlers.HandleLLMStream(app))
		api.GET("/llm/models", apiHandlers.HandleLLMModels(app))
		
		mcpTokens := api.Group("/mcp/tokens")
		mcpTokens.POST("", apiHandlers.HandleCreateMCPToken(app))
		mcpTokens.GET("", apiHandlers.HandleListMCPTokens(app))
		mcpTokens.DELETE("/:id", apiHandlers.HandleDeleteMCPToken(app))

		// Serve static file from pb_public
		e.Router.GET("/*", func(c *core.RequestEvent) error {
			path := "pb_public" + c.Request.URL.Path
			if _, err := os.Stat(path); os.IsNotExist(err) {
				path = "pb_public/index.html"
			}
			return c.File(path)
		})

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
