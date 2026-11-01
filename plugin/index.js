/**
 * 记忆星图 · Host 半
 *
 * 只在 Host 上做两件事：读目录、出 JSON。图怎么画全归 Client 半。
 * 路由挂在 webServer 上，Client 用同源 fetch 取 —— 这样不用碰 typert 契约，
 * 也就没有 Client 端拿不到的 Host 服务。
 */
import { readdir, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAtlas } from './atlas.js'

export const name = 'yan-memory-atlas'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLED_THEMES = join(HERE, 'themes.json')

/* ------------------------------------------------------------------ 响应 */

function sendJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  response.end(text)
}

/**
 * 只接受同源的请求。浏览器会带上 Origin；Node/CLI 不会，那种情况放行。
 * 这不是权限系统 —— 面板本来就是给本机用户看的 —— 只是挡住「随便哪个网页
 * 都能借你的浏览器读你的档案」这一条。
 */
function sameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------- 路由 */

async function handleGraph(request, response) {
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, error: '来源不受信任' })
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, error: '只支持 GET' })

  const url = new URL(request.url, 'http://localhost')
  const source = (url.searchParams.get('source') || '').trim()
  if (!source) return sendJson(response, 400, { ok: false, error: '给一个档案目录' })

  try {
    const atlas = await buildAtlas(source, {
      bundledThemes: BUNDLED_THEMES,
      archive: url.searchParams.get('archive') || undefined,
      inbox: url.searchParams.get('inbox') || undefined,
      themes: url.searchParams.get('themes') || undefined,
      logSection: url.searchParams.has('logSection') ? (url.searchParams.get('logSection') || '') : undefined,
    })
    return sendJson(response, 200, { ok: true, ...atlas })
  } catch (error) {
    return sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/** 列一层目录，给面板里的目录选择器用。只列目录，不列文件内容。 */
async function handleBrowse(request, response) {
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, error: '来源不受信任' })
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, error: '只支持 GET' })

  const url = new URL(request.url, 'http://localhost')
  const raw = (url.searchParams.get('path') || '').trim()

  if (!raw) {
    // 根：Windows 列盘符，其它平台就是 /
    const roots = []
    if (process.platform === 'win32') {
      for (let c = 65; c <= 90; c++) {
        const drive = String.fromCharCode(c) + ':\\'
        try {
          const st = await stat(drive)
          if (st.isDirectory()) roots.push({ name: drive, path: drive, dir: true })
        } catch {
          /* 没有这个盘 */
        }
      }
    } else {
      roots.push({ name: '/', path: '/', dir: true })
    }
    return sendJson(response, 200, { ok: true, path: '', parent: null, entries: roots })
  }

  const target = resolve(raw)
  let entries
  try {
    entries = await readdir(target, { withFileTypes: true })
  } catch (error) {
    return sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => ({ name: e.name, path: join(target, e.name), dir: true }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  // 顺手标出「这一层里像不像一个记忆目录」，让用户少点几次
  const names = new Set(entries.map((e) => e.name))
  const looksLikeMemory = ['我的记忆档案.md', '记忆档案.md', 'memory.md', 'archive.md']
    .some((n) => names.has(n))

  return sendJson(response, 200, {
    ok: true,
    path: target,
    parent: dirname(target) === target ? null : dirname(target),
    entries: dirs,
    looksLikeMemory,
  })
}

/** 不填路径时给出几个像样的起点，省得用户从 C:\ 开始点。 */
async function handleSuggest(request, response) {
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, error: '来源不受信任' })
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, error: '只支持 GET' })

  const home = homedir()
  const candidates = [process.cwd(), home, join(home, 'Documents'), join(home, 'notes'), join(home, '记忆')]

  const found = []
  for (const p of candidates) {
    try {
      const st = await stat(p)
      if (st.isDirectory()) found.push(p)
    } catch {
      /* 没有就算了 */
    }
  }
  return sendJson(response, 200, { ok: true, home, cwd: process.cwd(), candidates: found, tmp: tmpdir() })
}

/* -------------------------------------------------------------------- 挂载 */

export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    const webServer = hostCtx.webServer
    hostCtx.effect(() => {
      const disposers = [
        webServer.register({ kind: 'exact', path: '/yan-atlas/graph', handler: handleGraph }),
        webServer.register({ kind: 'exact', path: '/yan-atlas/browse', handler: handleBrowse }),
        webServer.register({ kind: 'exact', path: '/yan-atlas/suggest', handler: handleSuggest }),
      ]
      return () => {
        for (const off of disposers) {
          try {
            if (typeof off === 'function') off()
          } catch {
            /* 已经关了 */
          }
        }
      }
    }, 'yan-memory-atlas: routes')
  })
}
