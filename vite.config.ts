import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin } from 'vite'
import http from 'http'

/** Vite plugin: proxies /local-llm-proxy/* to localhost:<port> to bypass CORS in dev */
// Security: Only allow known LLM server ports to prevent SSRF
const ALLOWED_LLM_PORTS = new Set(['1234', '1235', '8080', '8081', '11434', '11435', '5000', '5001', '3000', '3001'])

function localLlmProxy(): Plugin {
  return {
    name: 'local-llm-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/local-llm-proxy')) return next()

        const parsed = new URL(req.url, 'http://localhost')
        const port = parsed.searchParams.get('__port') || '1234'
        parsed.searchParams.delete('__port')

        if (!ALLOWED_LLM_PORTS.has(port)) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: `Port ${port} is not in the allowed list for local LLM proxy` } }))
          return
        }

        const targetPath = parsed.pathname.replace(/^\/local-llm-proxy/, '') + parsed.search

        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          const proxyReq = http.request(
            { hostname: '127.0.0.1', port: Number(port), path: targetPath, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
              proxyRes.pipe(res)
            },
          )
          proxyReq.on('error', () => {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: `Cannot connect to localhost:${port}` } }))
          })
          if (chunks.length) proxyReq.write(Buffer.concat(chunks))
          proxyReq.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localLlmProxy()],
  base: './', // Relative paths for Electron file:// protocol
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nodes': path.resolve(__dirname, './onion_flow_nodes'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'onion_flow_nodes/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.*', 'src/vite-env.d.ts'],
    },
  },
})
