import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { roomMiddleware } from './roomHttp.ts'
import { configuredRooms } from './configuredRooms.ts'

const root = resolve('dist')
if (!existsSync(resolve(root, 'index.html'))) throw new Error('Сначала выполните npm run build')
const service = await configuredRooms()
const api = roomMiddleware(service)
const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  void api(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    let path: string
    try { path = resolve(root, '.' + decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)) }
    catch { res.writeHead(400).end(); return }
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return }
    if (!existsSync(path) || !statSync(path).isFile()) {
      if (extname(path)) { res.writeHead(404).end(); return }
      path = resolve(root, 'index.html')
    }
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.method === 'HEAD') { res.end(); return }
    createReadStream(path).pipe(res)
  })
})
server.listen(Number(process.env.PORT || 5173), process.env.HOST || '0.0.0.0', () => console.log(`Market Trials: port ${process.env.PORT || 5173}`))
function stop() { server.close(async () => { await service.close(); process.exit(0) }) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
