package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/forms"
	"golang.org/x/crypto/bcrypt"
)

// McpTokenRequest represents the request body for creating a new MCP token.
type McpTokenRequest struct {
	Name      string    `json:"name,omitempty"`
	Scopes    []string  `json:"scopes,omitempty"`
	ExpiresAt time.Time `json:"expiresAt,omitempty"`
}

// McpTokenResponse represents the response body for creating a new MCP token.
// The full token string is only returned once upon creation.
type McpTokenResponse struct {
	Token     string    `json:"token"` // Format: "MCP-<key_prefix>_<key_secret>"
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expiresAt,omitempty"`
}

// McpTokenListItem represents an item in the list of MCP tokens.
type McpTokenListItem struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Scopes     []string  `json:"scopes"`
	ExpiresAt  time.Time `json:"expiresAt,omitempty"`
	LastUsedAt time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

// McpTokenListResponse represents the response body for listing MCP tokens.
type McpTokenListResponse struct {
	Items []McpTokenListItem `json:"items"`
}

// A temporary struct to extract the ID from the auth record context.
type authRecordForID struct {
	ID string `json:"id"`
}

// generateTokenSecret generates a cryptographically secure random secret.
func generateTokenSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// generateTokenPrefix generates a short prefix for the token.
func generateTokenPrefix() (string, error) {
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// hashTokenSecret hashes the token secret using bcrypt.
func hashTokenSecret(secret string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

// getIDFromAuthRecord extracts the user ID from the auth record in the context.
func getIDFromAuthRecord(c *core.RequestEvent) (string, error) {
	authRecord := c.Get("authRecord")
	if authRecord == nil {
		return "", fmt.Errorf("not authenticated")
	}

	jsonData, err := json.Marshal(authRecord)
	if err != nil {
		return "", fmt.Errorf("failed to process auth record")
	}

	var tempRec authRecordForID
	if err := json.Unmarshal(jsonData, &tempRec); err != nil {
		return "", fmt.Errorf("failed to parse auth record")
	}

	if tempRec.ID == "" {
		return "", fmt.Errorf("invalid auth record")
	}

	return tempRec.ID, nil
}

// HandleCreateMCPToken handles POST /api/mcp/tokens
func HandleCreateMCPToken(app *pocketbase.PocketBase) core.HandlerFunc {
	return func(c *core.RequestEvent) error {
		userID, err := getIDFromAuthRecord(c)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": err.Error()})
		}

		var req McpTokenRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request body."})
		}

		dao := app.Dao()
		collection, err := dao.FindCollectionByNameOrId("mcp_tokens")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Collection not found."})
		}

		form := forms.NewRecordUpsert(app, nil)
		form.Collection = collection
		form.LoadData(map[string]any{
			"user":   userID,
			"name":   req.Name,
			"scopes": req.Scopes,
		})
		if !req.ExpiresAt.IsZero() {
			form.LoadData(map[string]any{"expires_at": req.ExpiresAt})
		}

		keyPrefix, _ := generateTokenPrefix()
		keySecret, _ := generateTokenSecret()
		tokenHash, _ := hashTokenSecret(keySecret)
		form.LoadData(map[string]any{
			"key_prefix": keyPrefix,
			"token_hash": tokenHash,
		})

		if err := form.Submit(); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create token."})
		}

		fullToken := fmt.Sprintf("MCP-%s_%s", keyPrefix, keySecret)
		resp := McpTokenResponse{
			Token:     fullToken,
			ID:        form.Record.Id,
			Name:      form.Record.GetString("name"),
			ExpiresAt: form.Record.GetDateTime("expires_at").Time(),
		}
		return c.JSON(http.StatusCreated, resp)
	}
}

// HandleListMCPTokens handles GET /api/mcp/tokens
func HandleListMCPTokens(app *pocketbase.PocketBase) core.HandlerFunc {
	return func(c *core.RequestEvent) error {
		userID, err := getIDFromAuthRecord(c)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": err.Error()})
		}

		dao := app.Dao()
		records, err := dao.FindRecordsByExpr("mcp_tokens", dbx.HashExp{"user": userID})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to query tokens."})
		}

		items := make([]McpTokenListItem, 0, len(records))
		for _, record := range records {
			item := McpTokenListItem{
				ID:        record.Id,
				Name:      record.GetString("name"),
				CreatedAt: record.GetCreated().Time(),
			}
			item.Scopes, _ = record.Get("scopes").([]string)
			item.ExpiresAt = record.GetDateTime("expires_at").Time()
			item.LastUsedAt = record.GetDateTime("last_used_at").Time()
			items = append(items, item)
		}

		return c.JSON(http.StatusOK, McpTokenListResponse{Items: items})
	}
}

// HandleDeleteMCPToken handles DELETE /api/mcp/tokens/:id
func HandleDeleteMCPToken(app *pocketbase.PocketBase) core.HandlerFunc {
	return func(c *core.RequestEvent) error {
		userID, err := getIDFromAuthRecord(c)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": err.Error()})
		}

		tokenID := c.PathParam("id")
		dao := app.Dao()
		record, err := dao.FindRecordById("mcp_tokens", tokenID)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"message": "Token not found."})
		}

		if record.GetString("user") != userID {
			return c.JSON(http.StatusForbidden, map[string]string{"message": "Forbidden."})
		}

		if err := dao.DeleteRecord(record); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to delete token."})
		}

		return c.NoContent(http.StatusNoContent)
	}
}