import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

// Plugin: chạy /api/*.ts như Vercel Functions trong dev (mà không cần `vercel dev`)
function apiDevPlugin(): Plugin {
  const apiRoot = path.resolve(__dirname, 'api')

  function resolveHandler(urlPath: string): { file: string; params: Record<string, string> } | null {
    const rel = urlPath.replace(/^\/api\//, '').replace(/\/+$/, '')
    const segments = rel.length === 0 ? [] : rel.split('/')

    const candidates: Array<{ file: string; params: Record<string, string> }> = []

    // 1) /api/foo.ts
    candidates.push({ file: path.join(apiRoot, segments.join('/') + '.ts'), params: {} })
    // 2) /api/foo/index.ts
    candidates.push({ file: path.join(apiRoot, segments.join('/'), 'index.ts'), params: {} })
    // 3) Dynamic [param] segment cuối: /api/services/[id].ts
    if (segments.length >= 1) {
      const parent = segments.slice(0, -1)
      const last = segments[segments.length - 1]
      // Tìm bất kỳ file [name].ts trong thư mục parent
      const parentDir = path.join(apiRoot, ...parent)
      if (fs.existsSync(parentDir)) {
        for (const entry of fs.readdirSync(parentDir)) {
          const m = entry.match(/^\[(.+)\]\.ts$/)
          if (m) {
            candidates.push({
              file: path.join(parentDir, entry),
              params: { [m[1]]: decodeURIComponent(last) }
            })
          }
        }
      }
    }

    for (const c of candidates) {
      if (fs.existsSync(c.file)) return c
    }
    return null
  }

  async function readBody(req: any): Promise<unknown> {
    if (req.method === 'GET' || req.method === 'HEAD') return undefined
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) return resolve(undefined)
        const ctype = String(req.headers['content-type'] || '')
        if (ctype.includes('application/json')) {
          try {
            resolve(JSON.parse(raw))
          } catch (e) {
            reject(e)
          }
        } else {
          resolve(raw)
        }
      })
      req.on('error', reject)
    })
  }

  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, 'http://localhost')
        const match = resolveHandler(url.pathname)
        if (!match) return next()

        try {
          const mod = await server.ssrLoadModule(match.file)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            return res.end('API handler không có default export')
          }

          const query: Record<string, string> = { ...match.params }
          for (const [k, v] of url.searchParams) query[k] = v

          const body = await readBody(req)

          // Patch req
          ;(req as any).body = body
          ;(req as any).query = query

          // Patch res với helper kiểu Vercel
          const r = res as any
          r.status = (code: number) => {
            res.statusCode = code
            return r
          }
          r.json = (data: unknown) => {
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(data))
            return r
          }
          r.send = (data: unknown) => {
            if (typeof data === 'object') return r.json(data)
            res.end(String(data ?? ''))
            return r
          }

          await handler(req, res)
        } catch (err: any) {
          console.error('[api-dev]', err)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: err?.message ?? 'Internal error' }))
          }
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  // Nạp .env vào process.env để API handlers (chạy SSR) đọc được MONGODB_URI...
  const env = loadEnv(mode, '.', '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    plugins: [react(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  }
})
