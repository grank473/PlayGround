import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const root = resolve(process.env.STATIC_DIR || join(projectDir, 'dist'))
const port = Number.parseInt(process.env.PORT || '3000', 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`)
  process.exit(1)
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`Static output is missing index.html: ${root}`)
  process.exit(1)
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

function safePath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const candidate = resolve(root, `.${decoded}`)
  if (candidate !== root && !candidate.startsWith(root + sep)) return null
  return candidate
}

function resolveFile(pathname) {
  const candidate = safePath(pathname)
  if (!candidate) return null
  try {
    const info = statSync(candidate)
    if (info.isDirectory()) {
      const index = join(candidate, 'index.html')
      return existsSync(index) ? index : null
    }
    if (info.isFile()) return candidate
  } catch {}
  if (!extname(pathname)) {
    const fallback = join(root, 'index.html')
    return existsSync(fallback) ? fallback : null
  }
  return null
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Method Not Allowed')
    return
  }

  let pathname
  try {
    pathname = new URL(request.url || '/', 'http://localhost').pathname
  } catch {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }

  const file = resolveFile(pathname)
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not Found')
    return
  }

  const info = statSync(file)
  response.writeHead(200, {
    'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(file)
  stream.on('error', () => {
    if (!response.headersSent) response.writeHead(500)
    response.end()
  })
  stream.pipe(response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`)
})

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
