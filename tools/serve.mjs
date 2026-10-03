// Serves the preview page, .preview/, at http://localhost:8765, to this
// machine only. Run from the repository root, after tools/preview.mjs:
//
//   node tools/serve.mjs

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

const PORT = 8765
const dir = join(process.cwd(), '.preview')

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' }

if (!existsSync(join(dir, 'index.html'))) {
  console.error('There is no .preview/index.html yet: run `node tools/preview.mjs` first.')
  process.exit(1)
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const file = normalize(join(dir, path.endsWith('/') ? `${path}index.html` : path))
  // Nothing outside the folder, however the path is spelled.
  if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  createReadStream(file).pipe(response)
}).listen(PORT, '127.0.0.1', () => console.log(`Serving the preview at http://localhost:${PORT}`))
