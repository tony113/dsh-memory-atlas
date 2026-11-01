/**
 * 记忆星图 · 解析核心
 *
 * 移植自 tools/build.py，去掉所有路径假设：只认传进来的目录。
 * 纯函数，不碰网络也不碰 DSH —— 可以单独跑：
 *
 *     node -e "import('./atlas.js').then(async m => console.log(await m.buildAtlas('D:/yan')))"
 *
 * 产出 { center, title, nodes, edges, stats }，Client 只管画。
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'

const ARCHIVE_NAMES = ['我的记忆档案.md', '记忆档案.md', 'memory.md', 'archive.md']
const INBOX_NAMES = ['记忆收件箱', '收件箱', 'inbox', 'Inbox']
const SKIP_ARCHIVE = new Set(['readme.md', 'license', 'license.md', 'notice.md', 'changelog.md'])

const DEFAULT_OTHER_THEME = '其他'
const DEFAULT_LOG_SECTION = '## 14.'
const MAX_BODY = 1500

/* ------------------------------------------------------------------ 小工具 */

function nid(s) {
  return createHash('md5').update(String(s), 'utf8').digest('hex').slice(0, 10)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function sortedNames(list) {
  return list.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/* -------------------------------------------------------------- 找源文件 */

async function isFile(p) {
  try {
    return (await fs.stat(p)).isFile()
  } catch {
    return false
  }
}

async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory()
  } catch {
    return false
  }
}

/**
 * 档案正文：显式参数 → 常见名字 → 目录里最大的那个 .md。
 * 返回绝对路径；找不到返回 null（调用方决定怎么报错）。
 */
export async function findArchive(src, explicit) {
  const abs = explicit ? (isAbsolute(explicit) ? explicit : join(src, explicit)) : null
  if (abs) return (await isFile(abs)) ? abs : null

  for (const name of ARCHIVE_NAMES) {
    const p = join(src, name)
    if (await isFile(p)) return p
  }

  let entries
  try {
    entries = await fs.readdir(src, { withFileTypes: true })
  } catch {
    return null
  }

  const cands = []
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.md')) continue
    if (SKIP_ARCHIVE.has(e.name.toLowerCase())) continue
    cands.push(join(src, e.name))
  }
  if (!cands.length) return null

  let best = null
  let bestSize = -1
  for (const p of cands) {
    const st = await fs.stat(p).catch(() => null)
    if (st && st.size > bestSize) {
      best = p
      bestSize = st.size
    }
  }
  return best
}

/** 收件箱目录：显式参数 → 常见名字 → 没有就没有（收件箱是可选的）。 */
export async function findInbox(src, explicit) {
  const abs = explicit ? (isAbsolute(explicit) ? explicit : join(src, explicit)) : null
  if (abs) return (await isDir(abs)) ? abs : null

  for (const name of INBOX_NAMES) {
    const p = join(src, name)
    if (await isDir(p)) return p
  }
  return null
}

/* ------------------------------------------------------------------ 主题表 */

/**
 * 主题表：显式路径 → <src>/themes.json → 包内 themes.json。
 * 返回 { themes: [[name, keywords]], other }。
 */
export async function loadThemes(src, explicit, bundledPath) {
  const cands = []
  if (explicit) cands.push(isAbsolute(explicit) ? explicit : join(src, explicit))
  cands.push(join(src, 'themes.json'))
  if (bundledPath) cands.push(bundledPath)

  for (const p of cands) {
    if (!(await isFile(p))) continue
    let data
    try {
      data = JSON.parse(await fs.readFile(p, 'utf8'))
    } catch {
      continue
    }
    const list = Array.isArray(data) ? data : data.themes
    if (!Array.isArray(list)) continue
    const themes = list
      .filter((t) => t && typeof t.name === 'string')
      .map((t) => [t.name, (t.keywords || []).map(String)])
    const other = (!Array.isArray(data) && typeof data.default === 'string') ? data.default : null
    return { path: p, themes, other }
  }
  return { path: null, themes: [], other: null }
}

/** 可选：<src>/atlas.json 放中心名、标题这类只影响展示的默认值。 */
export async function loadAtlasMeta(src) {
  const p = join(src, 'atlas.json')
  if (!(await isFile(p))) return {}
  try {
    const data = JSON.parse(await fs.readFile(p, 'utf8'))
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

/* ------------------------------------------------------------------ 拆节点 */

function makeThemeOf(themes, other) {
  return (text) => {
    const t = String(text || '').toLowerCase()
    for (const [name, keywords] of themes) {
      for (const k of keywords) {
        if (k && t.includes(k.toLowerCase())) return name
      }
    }
    return other
  }
}

/** 档案里出现最多的年份，用来给「3月4日」这种没写年份的日期补全。 */
function baseYear(texts) {
  const counts = new Map()
  for (const t of texts) {
    for (const m of String(t || '').matchAll(/(20\d{2})-\d{2}-\d{2}/g)) {
      counts.set(m[1], (counts.get(m[1]) || 0) + 1)
    }
  }
  if (!counts.size) return null
  let best = null
  let bestN = -1
  for (const [y, n] of counts) {
    if (n > bestN) {
      best = Number(y)
      bestN = n
    }
  }
  return best
}

/** 收件箱目录里的条目文件，按名字排序。 */
async function inboxFiles(inboxDir) {
  if (!inboxDir) return []
  let names
  try {
    names = await fs.readdir(inboxDir)
  } catch {
    return []
  }
  return sortedNames(names).filter((n) => /^\d{4}-\d{2}-\d{2}/.test(n) && n.endsWith('.md'))
}

/**
 * 把一份档案拆成节点。三个来源依次处理：
 *   1. 收件箱条目（可选）
 *   2. 更新日志表格（每天一行）
 *   3. 正文里带日期的叙述段
 */
async function splitNodes(opts) {
  const { archiveText, inboxDir, themeOf, logSection, year, archiveName } = opts
  const nodes = []

  let logTag = 'log'
  if (logSection) {
    const m = /(\d+)/.exec(logSection)
    if (m) logTag = '§' + m[1]
  }

  /* 1. 收件箱条目 */
  for (const fn of await inboxFiles(inboxDir)) {
    const body = await fs.readFile(join(inboxDir, fn), 'utf8').catch(() => '')
    if (!body) continue
    for (const ch of body.split(/^## \[/m).slice(1)) {
      const head = ch.split(/\r?\n/)[0]
      const m = /^([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$/.exec(head)
      if (!m) continue
      const ts = m[1].trim()
      const srcTag = m[2].trim()
      const rest = m[3].trim()
      const date = ts.slice(0, 10)
      const time = ts.length >= 16 ? ts.slice(11, 16) : ''
      const slash = rest.indexOf('/')
      const section = slash >= 0 ? rest.slice(0, slash).trim() : ''
      const title = slash >= 0 ? rest.slice(slash + 1).trim() : rest
      const w = /份量：\s*(重|中|轻)/.exec(ch)
      const content = ch.slice(head.length).trim().slice(0, MAX_BODY)
      nodes.push({
        id: nid('inbox' + fn + head),
        date,
        time,
        kind: 'inbox',
        src: srcTag,
        section,
        title: title.slice(0, 60),
        weight: w ? w[1] : '',
        theme: themeOf(section + ' ' + title + ' ' + content),
        body: content,
        file: fn,
      })
    }
  }

  /* 2. 更新日志（表格里每天一行） */
  if (logSection) {
    const at = archiveText.indexOf(logSection)
    const tail = at >= 0 ? archiveText.slice(at) : ''
    for (const ln of tail.split(/\r?\n/)) {
      const m = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*$/.exec(ln)
      if (!m) continue
      const d = m[1]
      const content = m[2]
      nodes.push({
        id: nid('daily' + ln),
        date: d,
        time: '',
        kind: 'daily',
        src: 'archive',
        section: logTag,
        title: content.replace(/\*\*/g, '').slice(0, 70),
        weight: '',
        theme: themeOf(content),
        body: content,
        file: archiveName,
      })
    }
  }

  /* 3. 正文里带日期的叙述段 */
  for (const raw of archiveText.split(/\n\s*\n/)) {
    const p = raw.trim()
    if (!(p.length > 20 && p.length < 1200)) continue
    if ('|>#'.includes(p[0])) continue
    const m = /(20\d{2}-\d{2}-\d{2})|((\d{1,2})月(\d{1,2})日)/.exec(p)
    if (!m) continue

    let d
    if (m[1]) {
      d = m[1]
    } else {
      if (!year) continue
      d = `${String(year).padStart(4, '0')}-${pad2(m[3])}-${pad2(m[4])}`
    }

    let first = p.split(/[。！？\n]/)[0]
    first = first.replace(/^[#>\-*\s]+/, '').replace(/\*\*/g, '').slice(0, 60)
    if (first.length < 4) continue

    nodes.push({
      id: nid('para' + p.slice(0, 40)),
      date: d,
      time: '',
      kind: 'archive',
      src: 'archive',
      section: '',
      title: first,
      weight: '',
      theme: themeOf(p),
      body: p.slice(0, MAX_BODY),
      file: archiveName,
    })
  }

  return nodes
}

/* -------------------------------------------------------------------- 造边 */

function grams(text) {
  const t = String(text || '').toLowerCase().replace(/[^0-9a-z_\u4e00-\u9fff]/g, '')
  const c = new Map()
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2)
    c.set(g, (c.get(g) || 0) + 1)
  }
  return c
}

function cosine(a, b) {
  let sum = 0
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  for (const [k, x] of small) {
    const y = big.get(k)
    if (y) sum += x * y
  }
  return sum
}

/** 相似边（TF-IDF 双字组） + 引用边（正文点名的日期） + 同日边。 */
function buildEdges(nodes) {
  const n = nodes.length
  if (n < 2) return []

  const docs = nodes.map((x) => grams((x.title || '') + ' ' + (x.body || '')))
  const df = new Map()
  for (const g of docs) for (const k of g.keys()) df.set(k, (df.get(k) || 0) + 1)

  const idf = new Map()
  for (const [k, d] of df) idf.set(k, Math.log((n + 1.0) / (d + 1.0)) + 1.0)

  const vecs = docs.map((g) => {
    const v = new Map()
    let sq = 0
    for (const [k, c] of g) {
      const w = (1.0 + Math.log(c)) * idf.get(k)
      v.set(k, w)
      sq += w * w
    }
    const norm = Math.sqrt(sq) || 1.0
    for (const [k, w] of v) v.set(k, w / norm)
    return v
  })

  const edges = []
  const seen = new Set()
  const add = (a, b, kind, w) => {
    if (a === b) return
    const key = a < b ? a + '-' + b : b + '-' + a
    if (seen.has(key)) return
    seen.add(key)
    edges.push([a + 1, b + 1, kind, Math.round(w * 1000) / 1000]) // +1：0 留给中心
  }

  /* 相似边：倒排索引，每个点只连最像的 K 个 */
  const inv = new Map()
  for (let i = 0; i < n; i++) {
    for (const k of vecs[i].keys()) {
      if (!inv.has(k)) inv.set(k, [])
      inv.get(k).push(i)
    }
  }
  const K = 8
  const TH = 0.05
  for (let i = 0; i < n; i++) {
    const acc = new Map()
    for (const [k, w] of vecs[i]) {
      for (const j of inv.get(k) || []) {
        if (j === i) continue
        acc.set(j, (acc.get(j) || 0) + w * (vecs[j].get(k) || 0))
      }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, K)
    for (const [j, s] of top) {
      if (s >= TH) add(i, j, 'sim', s)
    }
  }

  /* 引用边：正文里点名的日期，连到那天最像的两条 */
  const dayMap = new Map()
  for (let i = 0; i < n; i++) {
    const d = nodes[i].date || ''
    if (!d) continue
    if (!dayMap.has(d)) dayMap.set(d, [])
    dayMap.get(d).push(i)
  }

  const yearHint = baseYear(nodes.map((x) => x.date || '')) || 0
  const yearTag = String(yearHint).padStart(4, '0')

  for (let i = 0; i < n; i++) {
    const txt = (nodes[i].title || '') + ' ' + (nodes[i].body || '')
    const refs = new Set()
    for (const m of txt.matchAll(/\d{4}-\d{2}-\d{2}/g)) refs.add(m[0])
    for (const m of txt.matchAll(/(?<![\d-])(\d{1,2})-(\d{1,2})(?![\d-])/g)) {
      refs.add(`${yearTag}-${pad2(m[1])}-${pad2(m[2])}`)
    }
    for (const m of txt.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
      refs.add(`${yearTag}-${pad2(m[1])}-${pad2(m[2])}`)
    }

    const own = nodes[i].date || ''
    // 排序：Set 迭代顺序本无保证，不排就对不出稳定结果
    for (const d of sortedNames([...refs])) {
      if (!d || d === own) continue
      const scored = (dayMap.get(d) || [])
        .filter((j) => j !== i)
        .map((j) => [cosine(vecs[i], vecs[j]), j])
        .sort((a, b) => (b[0] !== a[0] ? b[0] - a[0] : a[1] - b[1]))
      for (const [s, j] of scored.slice(0, 2)) {
        add(i, j, 'ref', Math.max(0.5, s))
      }
    }
  }

  /* 同日边：同一天相邻事件 */
  for (const [, idxs] of dayMap) {
    idxs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < idxs.length; k++) {
      add(idxs[k], idxs[k + 1], 'day', 0.3)
    }
  }

  return edges
}

/* ------------------------------------------------------------------ 主流程 */

/**
 * 读一个目录，出整张图。
 * 解析不了就抛出带人话的 Error —— 路由层把它转成 400。
 */
export async function buildAtlas(src, opts = {}) {
  const root = src ? (isAbsolute(src) ? src : join(process.cwd(), src)) : process.cwd()

  if (!(await isDir(root))) {
    throw new Error(`不是一个目录：${root}`)
  }

  const archivePath = await findArchive(root, opts.archive)
  if (!archivePath) {
    throw new Error(`在 ${root} 里没找到记忆档案（.md）。如果档案在别处，把路径填对。`)
  }

  const inboxDir = await findInbox(root, opts.inbox)
  const { themes, other } = await loadThemes(root, opts.themes, opts.bundledThemes)
  const meta = await loadAtlasMeta(root)
  const otherTheme = other || meta.other_theme || DEFAULT_OTHER_THEME
  const themeOf = makeThemeOf(themes, otherTheme)

  const archiveText = await fs.readFile(archivePath, 'utf8')
  const texts = [archiveText]
  for (const fn of await inboxFiles(inboxDir)) {
    const t = await fs.readFile(join(inboxDir, fn), 'utf8').catch(() => '')
    if (t) texts.push(t)
  }
  const year = baseYear(texts)

  const archiveName = basename(archivePath)
  const logSection = opts.logSection === undefined ? DEFAULT_LOG_SECTION : opts.logSection

  const raw = await splitNodes({ archiveText, inboxDir, themeOf, logSection, year, archiveName })

  // 去重（同 id）
  const seen = new Set()
  const uniq = []
  for (const node of raw) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    uniq.push(node)
  }
  uniq.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.time !== b.time) return a.time < b.time ? -1 : 1
    return 0
  })

  const edges = buildEdges(uniq)

  const kinds = {}
  const themeCount = {}
  for (const node of uniq) {
    kinds[node.kind] = (kinds[node.kind] || 0) + 1
    themeCount[node.theme] = (themeCount[node.theme] || 0) + 1
  }

  const center = typeof meta.center === 'string' && meta.center
    ? meta.center
    : (meta.title && typeof meta.title === 'string' ? null : null) || '我'

  return {
    source: root,
    archive: archiveName,
    inbox: inboxDir ? basename(inboxDir) : null,
    center: center || '我',
    title: typeof meta.title === 'string' && meta.title ? meta.title : `${center || '我'} · 记忆星图`,
    themes: themes.map(([name]) => name),
    otherTheme,
    nodes: uniq,
    edges,
    stats: {
      nodes: uniq.length,
      edges: edges.length,
      sim: edges.filter((e) => e[2] === 'sim').length,
      ref: edges.filter((e) => e[2] === 'ref').length,
      day: edges.filter((e) => e[2] === 'day').length,
      kinds,
      themes: themeCount,
      from: uniq.length ? uniq[0].date : null,
      to: uniq.length ? uniq[uniq.length - 1].date : null,
    },
  }
}
