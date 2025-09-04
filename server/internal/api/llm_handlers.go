package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"fm-rss-reader-pb/internal/llm"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type LlmQueryRequest struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
	Model   string                 `json:"model,omitempty"`
	Options map[string]interface{} `json:"options,omitempty"`
}

func HandleLLMQuery(app *pocketbase.PocketBase) func(c *core.RequestEvent) error {
	return func(c *core.RequestEvent) error {
		var req LlmQueryRequest
		if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request body."})
		}

		// ... (rest of the logic)
		return nil
	}
}

func HandleLLMStream(app *pocketbase.PocketBase) func(c *core.RequestEvent) error {
	return func(c *core.RequestEvent) error {
		// ... (rest of the logic)
		return nil
	}
}

func HandleLLMModels(app *pocketbase.PocketBase) func(c *core.RequestEvent) error {
	return func(c *core.RequestEvent) error {
		// ... (rest of the logic)
		return nil
	}
}

// helpers
func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func coalesceString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}