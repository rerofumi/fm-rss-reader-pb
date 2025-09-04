onBeforeServe((e) => {
  const r = e.router
  // Serve pb_public/index.html at root
  r.add('GET', '/', (c) => {
    const path = __hooks + '/../pb_public/index.html'
    try {
      const f = os.open(path)
      c.response.addHeader('Content-Type', 'text/html; charset=utf-8')
      io.copy(c.response, f)
      f.close()
      return
    } catch (err) {
      return c.json(404, { error: 'index.html not found' })
    }
  })

  // Fallback to index.html for SPA routes
  r.add('GET', '/*', (c) => {
    const path = __hooks + '/../pb_public/index.html'
    try {
      const f = os.open(path)
      c.response.addHeader('Content-Type', 'text/html; charset=utf-8')
      io.copy(c.response, f)
      f.close()
      return
    } catch (err) {
      return c.json(404, { error: 'index.html not found' })
    }
  })
})

