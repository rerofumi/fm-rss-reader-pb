package mcp

import (
	"encoding/json"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func HandleRSSJSONRPC(app *pocketbase.PocketBase) func(c *core.RequestEvent) error {
	return func(c *core.RequestEvent) error {
		var req JsonRpcRequest
		if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
			return c.JSON(http.StatusBadRequest, &JsonRpcResponse{Jsonrpc: "2.0", Error: ErrParse, ID: nil})
		}

		// ... (rest of the logic)
		return nil
	}
}