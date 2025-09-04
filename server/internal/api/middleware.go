package api

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// EnsureRecordAuth is a middleware that verifies that the current request
// has an authenticated PocketBase user (RecordAuth).
func EnsureRecordAuth(next core.HandlerFunc) core.HandlerFunc {
	return func(c *core.RequestEvent) error {
		if c.Get("authRecord") == nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized"})
		}
		return next(c)
	}
}
