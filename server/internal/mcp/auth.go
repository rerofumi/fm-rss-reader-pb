package mcp

import (
	"fmt"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"golang.org/x/crypto/bcrypt"
)

// AuthenticateMCPToken validates an MCP token from the request and returns the user ID.
func AuthenticateMCPToken(app *pocketbase.PocketBase, c *core.RequestEvent) (string, error) {
	authHeader := c.Request.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return "", fmt.Errorf("authorization header is missing or invalid")
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")

	if !strings.HasPrefix(token, "MCP-") {
		return "", fmt.Errorf("invalid token format: expected MCP- token")
	}

	tokenParts := strings.SplitN(strings.TrimPrefix(token, "MCP-"), "_", 2)
	if len(tokenParts) != 2 {
		return "", fmt.Errorf("invalid MCP token format")
	}
	keyPrefix := tokenParts[0]
	keySecret := tokenParts[1]

	var tokenRecord struct {
		UserID    string `db:"user"`
		TokenHash string `db:"token_hash"`
	}
	err := app.DB().Select("user", "token_hash").From("mcp_tokens").Where(dbx.HashExp{"key_prefix": keyPrefix}).Limit(1).One(&tokenRecord)
	if err != nil {
		return "", fmt.Errorf("invalid MCP token")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(tokenRecord.TokenHash), []byte(keySecret)); err != nil {
		return "", fmt.Errorf("invalid MCP token")
	}

	return tokenRecord.UserID, nil
}