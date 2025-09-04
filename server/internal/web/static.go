package web

import (
	"io"
	"mime"
	"os"
	"io/fs"
	"path"
	"path/filepath"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// RegisterStatic registers a simple static file handler to serve pb_public with SPA fallback.
func RegisterStatic(e *core.ServeEvent) {
	fsRoot := os.DirFS("pb_public")
	// Explicit root and index
	e.Router.GET("/", func(c *core.RequestEvent) error { return serveFSFile(c, fsRoot, "index.html") })
	e.Router.GET("/index.html", func(c *core.RequestEvent) error { return serveFSFile(c, fsRoot, "index.html") })
	// Wildcard fallback for other static assets and SPA routing
	e.Router.GET("/*", func(c *core.RequestEvent) error {
		p := c.Request.URL.Path
		clean := strings.TrimPrefix(path.Clean(p), "/")
		// security: prevent path escape
		clean = strings.ReplaceAll(clean, "..", "")
		if clean == "" { clean = "index.html" }
		if err := serveFSFile(c, fsRoot, clean); err != nil {
			// SPA fallback
			return serveFSFile(c, fsRoot, "index.html")
		}
		return nil
	})
}

func serveFSFile(c *core.RequestEvent, fsys fs.FS, name string) error {
	f, err := fsys.Open(name)
	if err != nil {
		// return error to let caller decide fallback
		return err
	}
	defer f.Close()

	// simple content-type by extension
	ext := strings.ToLower(filepath.Ext(name))
	if ext != "" {
		if ct := mime.TypeByExtension(ext); ct != "" {
			c.Response.Header().Set("Content-Type", ct)
		}
	}
	_, _ = io.Copy(c.Response, f)
	return nil
}
