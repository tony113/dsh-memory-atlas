window.__ModuleLoader__.load({
  id: 'dsh-memory-atlas',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'yan-memory-atlas'
    const PANEL_ID = 'yan-memory-atlas'
    const PANEL_ORDER = 2          // 插件页(0) 之后、计划任务(10) 之前
    const STORE_KEY = 'yan-memory-atlas:source'

    /* ------------------------------------------------------------ 文案 */

    const DICT = {
      zh: {
        nav: '记忆星图',
        title: '记忆星图',
        pick: '换个目录',
        reload: '重画',
        search: '说一句话，把相关的星拉出来（Esc 清）',
        noHit: '没找到',
        empty: '还没有指向任何记忆目录',
        emptyHint: '挑一个放着记忆档案（.md）的文件夹，星图从里面长出来。',
        choose: '选择目录',
        useThis: '用这个目录',
        up: '上一级',
        loading: '正在读…',
        nodes: '个节点',
        links: '条连线',
        none: '没有可显示的内容',
        close: '关闭',
        date: '日期',
        section: '章节',
        weight: '份量',
        where: '目录',
        linked: '连着',
        looksLikeMemory: '这一层有记忆档案',
        pickTheme: '点一下：只看这一类，并列出全部',
        pathPlaceholder: '也可以直接粘贴路径，回车确认',
        go: '去',
        hint: '拖拽旋转 · 滚轮缩放 · 点点星看原话',
      },
      en: {
        nav: 'Memory Atlas',
        title: 'Memory Atlas',
        pick: 'Change folder',
        reload: 'Redraw',
        search: 'Say a phrase to pull out the stars it touches (Esc to clear)',
        noHit: 'Nothing found',
        empty: 'Not pointing at a memory folder yet',
        emptyHint: 'Pick a folder holding your memory archive (.md) — the atlas grows out of it.',
        choose: 'Choose folder',
        useThis: 'Use this folder',
        up: 'Up',
        loading: 'Reading…',
        nodes: 'nodes',
        links: 'links',
        none: 'Nothing to show',
        close: 'Close',
        date: 'Date',
        section: 'Section',
        weight: 'Weight',
        where: 'Folder',
        linked: 'Linked',
        looksLikeMemory: 'This folder has an archive',
        pickTheme: 'Click to isolate this theme and list it',
        pathPlaceholder: 'Or paste a path and press Enter',
        go: 'Go',
        hint: 'Drag to rotate · Scroll to zoom · Click a star to read its source',
      },
    }

    /* ------------------------------------------------------------ 样式 */

    const CSS = `
.ym-root { position: relative; height: 100%; min-height: 0; box-sizing: border-box; padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px)); display: flex; flex-direction: column; background: #05080f; color: #dfe8ff; font: 13px/1.5 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; overflow: hidden; }
.ym-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid rgba(120,150,220,.14); flex: none; }
.ym-bar h1 { font-size: 13px; font-weight: 600; letter-spacing: .04em; margin: 0; }
.ym-meta { color: rgba(190,210,255,.5); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ym-grow { flex: 1; min-width: 0; }
.ym-btn { background: rgba(120,160,255,.1); border: 1px solid rgba(120,160,255,.22); color: #cfe0ff; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.ym-btn:hover { background: rgba(120,160,255,.2); }
.ym-btn:disabled { opacity: .4; cursor: default; }
.ym-stage { position: relative; flex: 1; min-height: 0; }
.ym-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
.ym-stage canvas.ym-drag { cursor: grabbing; }
.ym-legend { position: absolute; left: 12px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px 6px; max-width: 74%; pointer-events: auto; }
.ym-leg-btn { font-size: 11px; color: rgba(200,215,255,.62); display: inline-flex; align-items: center; gap: 5px; background: transparent; border: 0; border-radius: 4px; padding: 1px 5px; cursor: pointer; font-family: inherit; }
.ym-leg-btn:hover { background: rgba(120,160,255,.16); color: #dfe8ff; }
.ym-leg-btn.on { background: rgba(120,160,255,.26); color: #fff; }
.ym-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.ym-hint { position: absolute; left: 12px; bottom: 36px; font-size: 11px; line-height: 1.45; color: rgba(180,200,255,.3); pointer-events: none; }
.ym-q { width: 230px; background: rgba(120,160,255,.08); border: 1px solid rgba(120,160,255,.2); border-radius: 6px; color: #dfe8ff; padding: 4px 9px; font-size: 12px; font-family: inherit; }
.ym-q:focus { outline: 1px solid rgba(120,160,255,.5); }
.ym-q::placeholder { color: rgba(180,200,255,.32); }
.ym-hits { position: absolute; left: 12px; top: 12px; display: flex; flex-wrap: wrap; gap: 6px; max-width: 56%; }
.ym-hit { background: rgba(120,160,255,.12); border: 1px solid rgba(120,160,255,.24); border-radius: 10px; padding: 1px 9px; font-size: 11px; color: rgba(214,228,252,.9); cursor: pointer; font-family: inherit; }
.ym-hit:hover { background: rgba(120,160,255,.24); }

/* 点图例后从右边滑出来的主题清单；同时把星图整体缩小左移，让出位置 */
.ym-pane { position: absolute; top: 0; right: 0; bottom: 0; width: 300px; z-index: 6; display: flex; flex-direction: column;
  background: rgba(8,12,22,.94); border-left: 1px solid rgba(120,160,255,.16);
  transform: translateX(102%); transition: transform .45s cubic-bezier(.2,.8,.2,1); }
.ym-pane.on { transform: none; }
.ym-pane-h { display: flex; align-items: baseline; gap: 8px; padding: 12px 14px 10px; border-bottom: 1px solid rgba(120,160,255,.12); flex: none; }
.ym-pane-h b { font-size: 13px; font-weight: 600; }
.ym-pane-h span { font-size: 11px; color: rgba(160,185,240,.55); }
.ym-pane-x { margin-left: auto; background: transparent; border: 0; color: rgba(180,200,255,.5); font-size: 15px; line-height: 1; cursor: pointer; padding: 0 2px; font-family: inherit; }
.ym-pane-x:hover { color: #dfe8ff; }
.ym-pane-list { overflow: auto; padding: 6px 8px 14px; }
.ym-pane-list::-webkit-scrollbar { width: 8px; }
.ym-pane-list::-webkit-scrollbar-thumb { background: rgba(120,160,255,.22); border-radius: 4px; }
.ym-pane-list::-webkit-scrollbar-track { background: transparent; }
.ym-item { display: block; width: 100%; text-align: left; background: transparent; border: 0; color: rgba(214,228,252,.86); font-family: inherit; font-size: 12px; line-height: 1.5; padding: 5px 6px; border-radius: 5px; cursor: pointer; }
.ym-item:hover { background: rgba(120,160,255,.14); color: #fff; }
.ym-item i { font-style: normal; color: rgba(160,185,240,.38); font-size: 10.5px; margin-left: 5px; }
/* 星图让位的动效：缩小 + 稍微转一点，时长和右侧面板一致 */
.ym-stage { transition: transform .45s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 50%; }
.ym-stage.ym-cramped { transform: scale(.68) translateX(-7%) rotate(-1.2deg); }

.ym-empty { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
.ym-empty h2 { font-size: 15px; font-weight: 600; margin: 0; }
.ym-empty p { margin: 0; color: rgba(190,210,255,.55); max-width: 420px; font-size: 12.5px; }
.ym-err { color: #ffb4b4; font-size: 12px; max-width: 520px; word-break: break-all; }

.ym-card { position: absolute; right: 14px; top: 12px; width: 300px; max-height: calc(100% - 24px); overflow: auto; background: rgba(10,16,32,.94); border: 1px solid rgba(120,160,255,.2); border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(6px); }
.ym-card h3 { font-size: 13px; margin: 0 0 6px; line-height: 1.4; }
.ym-card dl { margin: 0; font-size: 11.5px; color: rgba(190,210,255,.62); display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.ym-card dt { color: rgba(160,185,240,.45); }
.ym-card dd { margin: 0; }
.ym-card p { margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: rgba(215,228,255,.78); white-space: pre-wrap; word-break: break-word; }
.ym-nbrs { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(120,160,255,.12); }
.ym-nbrs-h { font-size: 11px; color: rgba(160,185,240,.5); margin-bottom: 4px; letter-spacing: .02em; }
.ym-nbr { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 2px 0; color: rgba(200,220,255,.75); font-size: 11.5px; cursor: pointer; font-family: inherit; line-height: 1.45; }
.ym-nbr:hover { color: #fff; text-decoration: underline; }
.ym-card .ym-x { position: absolute; right: 8px; top: 6px; background: none; border: 0; color: rgba(180,200,255,.5); font-size: 15px; cursor: pointer; line-height: 1; padding: 2px 4px; }

.ym-modal { position: absolute; inset: 0; background: rgba(2,4,10,.72); display: flex; align-items: center; justify-content: center; padding: 20px; }
.ym-box { width: min(560px, 100%); max-height: 100%; display: flex; flex-direction: column; background: #0a1020; border: 1px solid rgba(120,160,255,.24); border-radius: 12px; overflow: hidden; }
.ym-box-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(120,160,255,.14); }
.ym-box-head input { flex: 1; min-width: 0; background: rgba(120,160,255,.08); border: 1px solid rgba(120,160,255,.2); border-radius: 6px; color: #dfe8ff; padding: 5px 9px; font-size: 12px; font-family: inherit; }
.ym-box-head input:focus { outline: 1px solid rgba(120,160,255,.5); }
.ym-list { overflow: auto; padding: 4px 0; flex: 1; min-height: 120px; max-height: 46vh; }
.ym-row { display: flex; align-items: center; gap: 8px; padding: 6px 14px; cursor: pointer; font-size: 12.5px; }
.ym-row:hover { background: rgba(120,160,255,.1); }
.ym-row .ym-i { opacity: .6; }
.ym-box-foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(120,160,255,.14); }
.ym-note { color: rgba(170,200,255,.6); font-size: 11.5px; }
`

    /* ------------------------------------------------------------ 引擎 */

    // 主题配色：先查挑好的色，认不出的按色相均匀分配 ——
    // 这样 7 类、12 类、用户自己起二十个名字都有颜色，不会一锅灰。
    const PREFERRED = {
      视频: '#4fd6c9', 记忆系统: '#5b8cff', 'QQ 桥': '#7cd0ff', 感情: '#ff6f86',
      命理: '#b98cff', 白酒: '#ffc861', 工作: '#8b97ad', 其他: '#6a7d9c',
      车机: '#ff9d5c', 工具链: '#5ee0a8', 手机: '#8fd3ff', 约定: '#ff8fd0',
      健康: '#a8e05f', 技术: '#5b8cff', 学习: '#5ee0a8', 生活: '#4fd6c9',
      关系: '#ff8fd0', 想法: '#b98cff',
    }
    const WEIGHT = { 重: 1.9, 中: 1.0, 轻: 0.55 }
    const KINDS = ['sim', 'ref', 'day', 'root']

    function themeNames(themes) {
      return (themes || []).map((x) => (typeof x === 'string' ? x : x && x.name)).filter(Boolean)
    }

    function buildColors(themes, otherName) {
      const other = otherName || '其他'
      const out = { core: '#ffffff' }
      out[other] = '#6a7d9c'
      const free = []
      for (const name of themeNames(themes)) {
        if (name === other) continue
        if (PREFERRED[name]) out[name] = PREFERRED[name]
        else free.push(name)
      }
      free.forEach((name, i) => {
        const hue = Math.round((i * 360) / Math.max(free.length, 1))
        out[name] = 'hsl(' + hue + ' 68% 64%)'
      })
      return out
    }

    /**
     * 星图引擎：3D 力导向 + 透视投影 + canvas 绘制。
     * 移植自 tools/gen.py 的网页模板，改成「挂在容器里」而不是占满 window。
     */
    function createEngine(canvas, data, opts) {
      const ctx = canvas.getContext('2d')
      const nodes = data.nodes || []
      const COLORS = buildColors(
        themeNames(data.themes).concat(Object.keys((data.stats && data.stats.themes) || {})),
        data.otherTheme,
      )
      const colorOf = (theme) => COLORS[theme] || '#6a7d9c'
      const CN = {
        title: data.center || '我',
        theme: 'core',
        date: '',
        weight: '重',
        body: '',
        meta: '',
        src: '',
        isCore: true,
      }
      const ALL = [CN].concat(nodes)
      const N = ALL.length

      // 时间归一化：0 = 最早，1 = 最近（新的在外圈）
      const stamps = nodes.filter((n) => n.date).map((n) => +new Date(n.date)).filter((t) => !isNaN(t))
      const dmin = stamps.length ? Math.min(...stamps) : 0
      const dmax = stamps.length ? Math.max(...stamps) : 1
      for (const n of nodes) {
        const t = n.date ? +new Date(n.date) : NaN
        n.rank = isNaN(t) ? 0.5 : (t - dmin) / Math.max(1, dmax - dmin)
      }

      const EDGES = []
      const seen = new Set()
      const ADJ = new Map()
      const NBR = new Map()

      function touch(a, b) {
        if (!ADJ.has(a)) ADJ.set(a, new Set())
        if (!ADJ.has(b)) ADJ.set(b, new Set())
        ADJ.get(a).add(b)
        ADJ.get(b).add(a)
      }

      function addEdge(a, b, kind, w) {
        if (a === b) return
        const k = a < b ? a + '-' + b : b + '-' + a
        if (seen.has(k)) return
        seen.add(k)
        EDGES.push([a, b, kind, w || 0])
        touch(a, b)
        if (!NBR.has(a)) NBR.set(a, [])
        if (!NBR.has(b)) NBR.set(b, [])
        NBR.get(a).push([b, kind, w || 0])
        NBR.get(b).push([a, kind, w || 0])
      }

      for (let i = 1; i < N; i++) addEdge(0, i, 'root')
      for (const e of data.edges || []) addEdge(e[0], e[1], e[2], e[3])

      /* ---------- 力导向 ---------- */
      let pos = []
      let maxAbs = 1

      function simulate(iters) {
        const n = N
        const k = 1.55
        const rnd = (i, s) => {
          const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453
          return v - Math.floor(v)
        }
        pos = new Array(n)
        for (let i = 0; i < n; i++) {
          const a = rnd(i, 1) * Math.PI * 2
          const b = rnd(i, 2) * Math.PI - Math.PI / 2
          const r = i === 0 ? 0 : 0.6 + rnd(i, 3) * 2.2
          pos[i] = { x: Math.cos(a) * Math.cos(b) * r, y: Math.sin(b) * r, z: Math.sin(a) * Math.cos(b) * r }
        }
        const disp = new Array(n)
        for (let it = 0; it < iters; it++) {
          for (let i = 0; i < n; i++) disp[i] = { x: 0, y: 0, z: 0 }

          for (let i = 0; i < n; i++) {
            const pi = pos[i]
            for (let j = i + 1; j < n; j++) {
              const pj = pos[j]
              const dx = pi.x - pj.x
              const dy = pi.y - pj.y
              const dz = pi.z - pj.z
              const d2 = dx * dx + dy * dy + dz * dz + 0.02
              const d = Math.sqrt(d2)
              const f = (k * k) / d2
              disp[i].x += (dx / d) * f
              disp[i].y += (dy / d) * f
              disp[i].z += (dz / d) * f
              disp[j].x -= (dx / d) * f
              disp[j].y -= (dy / d) * f
              disp[j].z -= (dz / d) * f
            }
          }

          for (const [a, b] of EDGES) {
            const pa = pos[a]
            const pb = pos[b]
            const dx = pa.x - pb.x
            const dy = pa.y - pb.y
            const dz = pa.z - pb.z
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6
            const f = (d - k) * 0.13
            disp[a].x -= (dx / d) * f
            disp[a].y -= (dy / d) * f
            disp[a].z -= (dz / d) * f
            disp[b].x += (dx / d) * f
            disp[b].y += (dy / d) * f
            disp[b].z += (dz / d) * f
          }

          for (let i = 1; i < n; i++) {
            const t = (nodes[i - 1] && nodes[i - 1].rank) || 0
            const target = 0.55 + t * 2.5
            const r = Math.hypot(pos[i].x, pos[i].y, pos[i].z) + 1e-6
            const pull = (r - target) * 0.06
            disp[i].x -= (pos[i].x / r) * pull
            disp[i].y -= (pos[i].y / r) * pull
            disp[i].z -= (pos[i].z / r) * pull
          }

          for (let i = 1; i < n; i++) {
            const d = Math.hypot(disp[i].x, disp[i].y, disp[i].z) + 1e-6
            const lim = Math.min(d, 0.55)
            pos[i].x += (disp[i].x / d) * lim
            pos[i].y += (disp[i].y / d) * lim
            pos[i].z += (disp[i].z / d) * lim
          }
        }
        maxAbs = 0
        for (const p of pos) maxAbs = Math.max(maxAbs, Math.hypot(p.x, p.y, p.z))
      }

      /* ---------- 视角与画布 ---------- */
      let W = 1
      let H = 1
      let DPR = Math.min(2, window.devicePixelRatio || 1)
      let yaw = 0.55
      let pitch = -0.35
      let zoom = 1.0
      let spin = 0
      let hover = -1
      let sel = -1
      /** 每帧复用的投影数组，避免每帧分配 N 个新对象、把 GC 拖起来。 */
      const Q = new Array(N)
      /** 每帧复用的「远→近」绘制顺序索引。 */
      const ORDER = new Array(N)
      for (let i = 0; i < N; i++) ORDER[i] = i
      const EMPTY_SET = new Set()
      let selNbrsFor = -2
      let selNbrs = null
      /* 帧率采样：每秒回调一次，界面拿它显示，也用它判断优化有没有用。 */
      let fpsFrames = 0
      let fpsAt = 0
      let focusSet = null
      let alive = true
      let raf = 0

      /* ---------- 语义检索：说一句话，把相关的星拉出来 ---------- */
      function norm(s) {
        return String(s || '')
          .toLowerCase()
          .replace(/[^0-9a-z_\u4e00-\u9fff]/g, '')
      }
      const QDF = new Map()
      const NODE_GRAMS = []
      ;(function buildIndex() {
        const df = new Map()
        const gs = []
        for (let i = 0; i < N; i++) {
          const nd = i === 0 ? CN : nodes[i - 1]
          const t = norm(nd.title) + ' ' + norm(nd.body)
          const c = new Map()
          for (let k = 0; k < t.length - 1; k++) {
            const g = t.substr(k, 2)
            c.set(g, (c.get(g) || 0) + 1)
          }
          gs.push(c)
          for (const g of c.keys()) df.set(g, (df.get(g) || 0) + 1)
        }
        gs.forEach((c) => {
          const v = new Map()
          let ss = 0
          for (const [g, n] of c) {
            const w = (1 + Math.log(n)) * (Math.log((N + 1) / ((df.get(g) || 0) + 1)) + 1)
            v.set(g, w)
            ss += w * w
          }
          const q = Math.sqrt(ss) || 1
          for (const [g, w] of v) v.set(g, w / q)
          NODE_GRAMS.push(v)
        })
        for (const [g, n] of df) QDF.set(g, n)
      })()

      /** 说一句话，返回命中的前几个节点（组件拿它显示标题）。空查询清掉聚焦。 */
      function query(text) {
        sel = -1
        const t = norm(text)
        if (t.length < 2) {
          focusSet = null
          return []
        }
        const c = new Map()
        for (let k = 0; k < t.length - 1; k++) {
          const g = t.substr(k, 2)
          c.set(g, (c.get(g) || 0) + 1)
        }
        const qv = new Map()
        let ss = 0
        for (const [g, n] of c) {
          if (!QDF.has(g)) continue
          const w = (1 + Math.log(n)) * (Math.log((N + 1) / (QDF.get(g) + 1)) + 1)
          qv.set(g, w)
          ss += w * w
        }
        if (!qv.size) {
          focusSet = null
          return []
        }
        const qn = Math.sqrt(ss) || 1
        const hits = []
        for (let i = 0; i < N; i++) {
          let s = 0
          const v = NODE_GRAMS[i]
          for (const [g, w] of qv) {
            const x = v.get(g)
            if (x) s += (w / qn) * x
          }
          if (s > 0.02) hits.push([s, i])
        }
        hits.sort((a, b) => b[0] - a[0])
        const top = hits.slice(0, 5)
        const set = new Set()
        top.forEach(([s, i]) => {
          set.add(i)
          for (const nb of ADJ.get(i) || []) set.add(nb)
        })
        focusSet = set.size ? set : null
        return top.map(([s, i]) => (i === 0 ? CN : nodes[i - 1]))
      }

      const STARS = []
      {
        const r = (i, s) => {
          const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453
          return v - Math.floor(v)
        }
        for (let i = 0; i < 420; i++) {
          STARS.push({ x: r(i, 21), y: r(i, 22), s: 0.3 + r(i, 23) * 1.1, a: 0.04 + r(i, 24) * 0.2 })
        }
      }

      /* 背景（径向渐变 + 420 颗星尘）只在尺寸变化时画一次，缓存成位图。
         每帧重画一次渐变 + 几百次 fillRect 是这个星图最大的开销之一。 */
      const bgCanvas = document.createElement('canvas')
      function paintBg() {
        bgCanvas.width = Math.round(W * DPR) || 1
        bgCanvas.height = Math.round(H * DPR) || 1
        const b = bgCanvas.getContext('2d')
        b.setTransform(DPR, 0, 0, DPR, 0, 0)
        const grad = b.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78)
        grad.addColorStop(0, '#0a1020')
        grad.addColorStop(0.55, '#05080f')
        grad.addColorStop(1, '#020407')
        b.fillStyle = grad
        b.fillRect(0, 0, W, H)
        b.fillStyle = '#cfe0ff'
        for (const s of STARS) {
          b.globalAlpha = s.a
          b.fillRect(s.x * W, s.y * H, s.s, s.s)
        }
        b.globalAlpha = 1
      }

      /* 中心的白色光晕：同样缓存成一张小图，省掉每帧 createRadialGradient。 */
      const CORE_R = 40
      const coreSprite = document.createElement('canvas')
      {
        coreSprite.width = CORE_R * 2
        coreSprite.height = CORE_R * 2
        const c = coreSprite.getContext('2d')
        const g = c.createRadialGradient(CORE_R, CORE_R, 0, CORE_R, CORE_R, CORE_R)
        g.addColorStop(0, 'rgba(255,255,255,.95)')
        g.addColorStop(0.18, 'rgba(225,235,255,.5)')
        g.addColorStop(0.5, 'rgba(140,170,255,.12)')
        g.addColorStop(1, 'rgba(80,120,200,0)')
        c.fillStyle = g
        c.beginPath()
        c.arc(CORE_R, CORE_R, CORE_R, 0, 7)
        c.fill()
      }

      function resize() {
        const rect = canvas.getBoundingClientRect()
        W = Math.max(1, rect.width)
        H = Math.max(1, rect.height)
        DPR = Math.min(2, window.devicePixelRatio || 1)
        canvas.width = Math.round(W * DPR)
        canvas.height = Math.round(H * DPR)
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
        paintBg()
      }

      function proj(p) {
        const yy = yaw + spin
        const cy = Math.cos(yy)
        const sy = Math.sin(yy)
        const cp = Math.cos(pitch)
        const sp = Math.sin(pitch)
        const x0 = p.x * cy - p.z * sy
        let z = p.x * sy + p.z * cy
        const y0 = p.y * cp - z * sp
        z = p.y * sp + z * cp
        const scale = (Math.min(W, H) * 0.42) / Math.max(1e-6, maxAbs) * zoom
        const persp = Math.min(2.0, Math.max(0.45, 1 / (1 + z * 0.1)))
        return {
          sx: W / 2 + x0 * scale * persp * 1.35,
          sy: H / 2 - y0 * scale * persp * 1.35,
          z,
          persp,
        }
      }

      /* ---------- 绘制 ---------- */
      function draw() {
        if (!alive) return
        // 一直慢慢转：点星这件事现在有右侧清单兜底，不用为了点得准而停转。
        spin += 0.0008
        ctx.clearRect(0, 0, W, H)
        if (bgCanvas.width) ctx.drawImage(bgCanvas, 0, 0, W, H)

        if (sel !== selNbrsFor) {
          selNbrsFor = sel
          selNbrs = sel >= 0 ? ADJ.get(sel) || EMPTY_SET : null
        }
        for (let i = 0; i < N; i++) Q[i] = proj(pos[i])
        const dim = sel >= 0
        const inFocus = (i) => !focusSet || focusSet.has(i)

        // 联想线
        // 900 多条线如果一条一条 beginPath+stroke，Canvas 要发 900 次绘制调用 ——
        // 这是最大的开销。把它们按「颜色 + 透明度档 + 线宽档」分桶，
        // 每个桶一条路径一次 stroke，调用数从 ~900 降到十几个。
        ctx.lineCap = 'round'
        const buckets = new Map()
        for (const [a, b, kind, dd] of EDGES) {
          if (kind === 'root') continue
          const qa = Q[a]
          const qb = Q[b]
          const theme = (a === 0 ? 'core' : nodes[a - 1] && nodes[a - 1].theme) || '其他'
          const depth = (qa.persp + qb.persp) * 0.5
          const hot = sel >= 0 && (a === sel || b === sel)
          if (hot) {
            ctx.globalAlpha = 0.22
            ctx.strokeStyle = colorOf(theme)
            ctx.lineWidth = 8
            ctx.beginPath()
            ctx.moveTo(qa.sx, qa.sy)
            ctx.lineTo(qb.sx, qb.sy)
            ctx.stroke()
            ctx.globalAlpha = 1
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1.8
            ctx.beginPath()
            ctx.moveTo(qa.sx, qa.sy)
            ctx.lineTo(qb.sx, qb.sy)
            ctx.stroke()
            continue
          }
          const KA =
            kind === 'sim' ? 0.09 + 0.32 * (dd || 0)
            : kind === 'ref' ? 0.22
            : kind === 'day' ? 0.26
            : 0.09
          const alpha = (dim ? 0.03 : KA) * depth * (focusSet && !(focusSet.has(a) && focusSet.has(b)) ? 0.12 : 1)
          // 太淡的线画了也看不见，直接跳过。
          if (alpha < 0.02) continue
          const color = kind === 'ref' ? '#f0d9a8' : colorOf(theme)
          const width = (kind === 'ref' ? 0.7 : 0.55) * depth + 0.22
          const key = color + '|' + Math.round(alpha * 16) + '|' + width.toFixed(2)
          let bk = buckets.get(key)
          if (!bk) {
            bk = { color, alpha, width, segs: [] }
            buckets.set(key, bk)
          }
          bk.segs.push(qa.sx, qa.sy, qb.sx, qb.sy)
        }
        for (const bk of buckets.values()) {
          ctx.globalAlpha = bk.alpha
          ctx.strokeStyle = bk.color
          ctx.lineWidth = bk.width
          ctx.beginPath()
          const s = bk.segs
          for (let k = 0; k < s.length; k += 4) {
            ctx.moveTo(s[k], s[k + 1])
            ctx.lineTo(s[k + 2], s[k + 3])
          }
          ctx.stroke()
        }

        // 中心辐射（同样分桶：188 条线塞进几条路径）
        const core = Q[0]
        const radBuckets = new Map()
        for (let i = 1; i < N; i++) {
          const q = Q[i]
          const theme = (nodes[i - 1] && nodes[i - 1].theme) || '其他'
          const hot = sel >= 0 && (i === sel || sel === 0)
          const alpha = hot ? 1 : (dim ? 0.02 : 0.07) * q.persp * (focusSet && !focusSet.has(i) ? 0.12 : 1)
          if (alpha < 0.02 && !hot) continue
          const key = (hot ? '#e8f0ff' : colorOf(theme)) + '|' + Math.round(alpha * 16)
          let bk = radBuckets.get(key)
          if (!bk) {
            bk = { color: hot ? '#e8f0ff' : colorOf(theme), alpha, width: hot ? 2.4 : 0.45, segs: [] }
            radBuckets.set(key, bk)
          }
          bk.segs.push(core.sx, core.sy, q.sx, q.sy)
        }
        for (const bk of radBuckets.values()) {
          ctx.globalAlpha = bk.alpha
          ctx.strokeStyle = bk.color
          ctx.lineWidth = bk.width
          ctx.beginPath()
          const s = bk.segs
          for (let k = 0; k < s.length; k += 4) {
            ctx.moveTo(s[k], s[k + 1])
            ctx.lineTo(s[k + 2], s[k + 3])
          }
          ctx.stroke()
        }
        ctx.globalAlpha = 1

        // 星核（位图缓存，省掉每帧 createRadialGradient）
        ctx.globalAlpha = 1
        ctx.drawImage(coreSprite, core.sx - CORE_R, core.sy - CORE_R, CORE_R * 2, CORE_R * 2)

        // 星点，远到近（复用预分配数组，每帧只排序不分配）
        ORDER.sort((a, b) => Q[b].z - Q[a].z)
        for (const i of ORDER) {
          const q = Q[i]
          const nd = i === 0 ? CN : nodes[i - 1]
          const c = colorOf(nd.theme)
          const w = WEIGHT[nd.weight] || 1
          const persp = q.persp
          const isNbr = sel >= 0 && selNbrs.has(i)
          const boost = i === sel ? 2.1 : isNbr || i === hover ? 1.5 : 1
          const rad = Math.max(0.8, (1.0 + w * 1.45) * persp * Math.min(1.9, zoom)) * boost

          ctx.fillStyle = c
          ctx.globalAlpha = (0.05 * persp + 0.01) * (isNbr || i === sel ? 2.6 : 1) * (inFocus(i) ? 1 : 0.1)
          ctx.beginPath()
          ctx.arc(q.sx, q.sy, rad * 6.0, 0, 7)
          ctx.fill()

          ctx.globalAlpha = (0.15 * persp + 0.02) * (isNbr || i === sel ? 2.2 : 1) * (inFocus(i) ? 1 : 0.1)
          ctx.beginPath()
          ctx.arc(q.sx, q.sy, rad * 2.6, 0, 7)
          ctx.fill()

          ctx.globalAlpha = (0.55 + persp * 0.45) * (inFocus(i) ? 1 : 0.1)
          ctx.beginPath()
          ctx.arc(q.sx, q.sy, rad * 0.62, 0, 7)
          ctx.fill()

          if (i === 0) {
            ctx.fillStyle = '#fff'
            ctx.globalAlpha = 1
            ctx.beginPath()
            ctx.arc(q.sx, q.sy, rad * 0.5, 0, 7)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }

        // 标签：中心常驻；点中一颗星时，把它和与它相连的星一起标出来 ——
        // 不用再一个个挪鼠标去问「旁边那颗是什么」。
        ctx.textAlign = 'center'
        ctx.font = '11px -apple-system, "Microsoft YaHei", sans-serif'
        ctx.fillStyle = 'rgba(235,242,255,.95)'
        ctx.fillText(CN.title, core.sx, core.sy + 26)

        const tagged = new Set()
        if (sel >= 0) {
          tagged.add(sel)
          for (const j of selNbrs || []) tagged.add(j)
        }
        if (hover > 0) tagged.add(hover)

        for (const i of tagged) {
          if (i === 0) continue
          const nd = nodes[i - 1]
          if (!nd) continue
          const q = Q[i]
          const isSel = i === sel
          const label = String(nd.title || '').slice(0, 20)
          if (!label) continue
          ctx.font = isSel
            ? '600 12px -apple-system, "Microsoft YaHei", sans-serif'
            : '11px -apple-system, "Microsoft YaHei", sans-serif'
          const tw = ctx.measureText(label).width
          const lh = isSel ? 17 : 15
          const baseY = q.sy - (isSel ? 26 : 23)
          ctx.fillStyle = 'rgba(8,12,22,.72)'
          ctx.fillRect(q.sx - tw / 2 - 3, baseY, tw + 6, lh)
          ctx.fillStyle = isSel ? 'rgba(255,255,255,.98)' : 'rgba(214,228,252,.9)'
          ctx.fillText(label, q.sx, baseY + lh - 4)
        }
        ctx.textAlign = 'center'

        fpsFrames++
        const tNow = performance.now()
        if (tNow - fpsAt >= 1000) {
          if (opts.onFps) opts.onFps(Math.round((fpsFrames * 1000) / (tNow - fpsAt)))
          fpsFrames = 0
          fpsAt = tNow
        }
        raf = requestAnimationFrame(draw)
      }

      /* ---------- 交互 ---------- */
      function pick(mx, my) {
        let best = -1
        let bd = 18 * 18
        for (let i = 0; i < N; i++) {
          const q = Q[i] || proj(pos[i])
          const d = (q.sx - mx) * (q.sx - mx) + (q.sy - my) * (q.sy - my)
          if (d < bd) {
            bd = d
            best = i
          }
        }
        return best
      }

      let dragging = false
      let lx = 0
      let ly = 0
      let moved = 0
      let downX = 0
      let downY = 0

      function localXY(e) {
        const rect = canvas.getBoundingClientRect()
        return [e.clientX - rect.left, e.clientY - rect.top]
      }

      const onDown = (e) => {
        dragging = true
        moved = 0
        lx = e.clientX
        ly = e.clientY
        downX = e.clientX
        downY = e.clientY
        canvas.classList.add('ym-drag')
      }
      const onUp = () => {
        dragging = false
        canvas.classList.remove('ym-drag')
      }
      const onMove = (e) => {
        if (dragging) {
          const dx = e.clientX - lx
          const dy = e.clientY - ly
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = 1
          yaw += dx * 0.006
          pitch = Math.max(-1.35, Math.min(1.35, pitch + dy * 0.004))
          lx = e.clientX
          ly = e.clientY
        } else {
          const [mx, my] = localXY(e)
          hover = pick(mx, my)
        }
      }
      const onWheel = (e) => {
        e.preventDefault()
        zoom = Math.max(0.4, Math.min(7, zoom * (e.deltaY > 0 ? 0.92 : 1.08)))
      }
      /** 选中一颗星，把「和它相连的」一并交给宿主去列在详情卡里。 */
      const onPickNode = (i) => {
        sel = i
        const list =
          i >= 0
            ? (NBR.get(i) || [])
                .filter(([j, kind]) => kind !== 'root')
                .sort((a, b) => (b[2] || 0) - (a[2] || 0))
                .slice(0, 24)
                .map(([j, kind, w]) => ({ i: j, node: j === 0 ? CN : nodes[j - 1], kind, w }))
            : []
        opts.onSelect && opts.onSelect(i >= 0 ? ALL[i] : null, i, list)
      }
      const onClick = (e) => {
        // 用「按下点」和「松开点」的距离判断是不是拖拽 ——
        // 只看 moved 会把「鼠标刚滑过来就点」误判成拖动，点不中星。
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) return
        const [mx, my] = localXY(e)
        onPickNode(pick(mx, my))
      }

      canvas.addEventListener('mousedown', onDown)
      window.addEventListener('mouseup', onUp)
      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('click', onClick)

      const observer = new ResizeObserver(() => resize())
      observer.observe(canvas)

      simulate(nodes.length > 400 ? 90 : 150)
      resize()
      draw()

      return {
        query,
        select(i) {
          onPickNode(i)
        },
        /** 按节点 id 选中（右侧主题清单里点一条时用）。 */
        selectById(id) {
          for (let i = 1; i < N; i++) {
            if (nodes[i - 1] && nodes[i - 1].id === id) {
              onPickNode(i)
              return true
            }
          }
          return false
        },
        clearQuery() {
          focusSet = null
        },
        /** 只亮起某个主题的全部节点（图例点一下就用这个）。返回命中数量。 */
        focusTheme(name) {
          sel = -1
          selNbrsFor = -2
          const set = new Set()
          for (let i = 1; i < N; i++) {
            if (((nodes[i - 1] && nodes[i - 1].theme) || '其他') === name) set.add(i)
          }
          focusSet = set.size ? set : null
          return set.size
        },
        dispose() {
          alive = false
          cancelAnimationFrame(raf)
          observer.disconnect()
          canvas.removeEventListener('mousedown', onDown)
          window.removeEventListener('mouseup', onUp)
          canvas.removeEventListener('mousemove', onMove)
          canvas.removeEventListener('wheel', onWheel)
          canvas.removeEventListener('click', onClick)
        },
      }
    }

    /* ------------------------------------------------------------ 取数 */

    function api(path) {
      const relative = path.replace(/^\/+/, '')
      if (typeof document === 'undefined') return '/' + relative
      // 必须基于 document.baseURI：反代前缀部署下用绝对路径会 404。
      // search 不能丢 —— URL.pathname 会把它吃掉。
      const u = new URL(relative, document.baseURI)
      return u.pathname + u.search
    }

    async function getJson(path) {
      const res = await fetch(api(path), { headers: { accept: 'application/json' } })
      let body = null
      try {
        body = await res.json()
      } catch {
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res.ok || body.ok === false) throw new Error((body && body.error) || `HTTP ${res.status}`)
      return body
    }

    /* ------------------------------------------------------------ 目录选择器 */

    function DirPicker({ t, initial, onPick, onCancel }) {
      const [path, setPath] = React.useState(initial || '')
      const [list, setList] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')

      const load = React.useCallback(
        async (target) => {
          setBusy(true)
          setError('')
          try {
            const q = target ? '?path=' + encodeURIComponent(target) : ''
            const body = await getJson('/yan-atlas/browse' + q)
            setList(body)
            setPath(body.path || '')
          } catch (err) {
            setError(String(err.message || err))
          } finally {
            setBusy(false)
          }
        },
        [],
      )

      React.useEffect(() => {
        load(initial || '')
      }, [initial, load])

      const go = () => {
        if (path.trim()) load(path.trim())
      }

      return h(
        'div',
        { className: 'ym-modal' },
        h(
          'div',
          { className: 'ym-box' },
          h(
            'div',
            { className: 'ym-box-head' },
            h('input', {
              value: path,
              placeholder: t('pathPlaceholder'),
              spellCheck: false,
              onChange: (e) => setPath(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') go()
              },
            }),
            h('button', { className: 'ym-btn', onClick: go, disabled: busy }, t('go')),
          ),
          h(
            'div',
            { className: 'ym-list' },
            busy && !list ? h('div', { className: 'ym-row ym-note' }, t('loading')) : null,
            error ? h('div', { className: 'ym-row ym-err' }, error) : null,
            list && list.parent
              ? h(
                  'div',
                  { className: 'ym-row', onClick: () => load(list.parent) },
                  h('span', { className: 'ym-i' }, '↑'),
                  t('up'),
                )
              : null,
            (list ? list.entries : []).map((entry) =>
              h(
                'div',
                { key: entry.path, className: 'ym-row', onClick: () => load(entry.path) },
                h('span', { className: 'ym-i' }, '📁'),
                entry.name,
              ),
            ),
          ),
          h(
            'div',
            { className: 'ym-box-foot' },
            h(
              'button',
              { className: 'ym-btn', onClick: () => onPick(path || list?.path || ''), disabled: !(path || list?.path) },
              t('useThis'),
            ),
            list && list.looksLikeMemory ? h('span', { className: 'ym-note' }, '✓ ' + t('looksLikeMemory')) : null,
            h('div', { className: 'ym-grow' }),
            h('button', { className: 'ym-btn', onClick: onCancel }, t('close')),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------ 详情卡 */

    function DetailCard({ node, nbrs, t, onClose, onJump }) {
      if (!node) return null
      const rows = []
      if (node.date) rows.push([t('date'), node.date + (node.time ? ' ' + node.time : '')])
      if (node.section) rows.push([t('section'), node.section])
      if (node.weight) rows.push([t('weight'), node.weight])
      if (node.theme && node.theme !== 'core') rows.push([t('where'), node.theme])
      return h(
        'div',
        { className: 'ym-card' },
        h('button', { className: 'ym-x', onClick: onClose }, '×'),
        h('h3', null, String(node.title || '').slice(0, 80)),
        rows.length ? h('dl', null, rows.map(([k, v]) => [h('dt', { key: 'k' + k }, k), h('dd', { key: 'v' + k }, v)])) : null,
        node.body ? h('p', null, String(node.body).slice(0, 600)) : null,
        nbrs && nbrs.length
          ? h(
              'div',
              { className: 'ym-nbrs' },
              h('div', { className: 'ym-nbrs-h' }, `${t('linked')} · ${nbrs.length}`),
              nbrs.map((n, k) =>
                h(
                  'button',
                  { key: k, className: 'ym-nbr', onClick: () => onJump(n) },
                  String(n.node.title || '—').slice(0, 32),
                ),
              ),
            )
          : null,
      )
    }

    /* ------------------------------------------------------------ 面板 */

    function AtlasPanel({ t }) {
      const [source, setSource] = React.useState(() => {
        try {
          return localStorage.getItem(STORE_KEY) || ''
        } catch {
          return ''
        }
      })
      const [status, setStatus] = React.useState('idle') // idle | loading | ready | error
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [picking, setPicking] = React.useState(false)
      const [selected, setSelected] = React.useState(null)
      const [nbrs, setNbrs] = React.useState([])
      const [fps, setFps] = React.useState(0)
      /** 点图例后从右边滑出的主题清单：{ name, items } */
      const [pane, setPane] = React.useState(null)

      const openTheme = (name) => {
        const all = (data && data.nodes) || []
        const items = all.filter((nd) => ((nd && nd.theme) || '其他') === name)
        setPane({ name, items })
        setSelected(null)
        setNbrs([])
        setHits([])
        setQ('')
        if (engineRef.current && engineRef.current.focusTheme) engineRef.current.focusTheme(name)
      }

      const closePane = () => {
        setPane(null)
        if (engineRef.current) engineRef.current.clearQuery()
      }
      const [q, setQ] = React.useState('')
      const [hits, setHits] = React.useState([])
      const canvasRef = React.useRef(null)
      const engineRef = React.useRef(null)

      const load = React.useCallback(async (target) => {
        const dir = (target || '').trim()
        if (!dir) {
          setStatus('idle')
          setData(null)
          return
        }
        setStatus('loading')
        setError('')
        try {
          const body = await getJson('/yan-atlas/graph?source=' + encodeURIComponent(dir))
          try {
            localStorage.setItem(STORE_KEY, dir)
          } catch {
            /* 隐私模式下存不了，无所谓 */
          }
          setSource(dir)
          setData(body)
          setQ('')
          setHits([])
          setStatus('ready')
        } catch (err) {
          setError(String((err && err.message) || err))
          setStatus('error')
        }
      }, [])

      // 首次进入：有记着的目录就直接画
      React.useEffect(() => {
        if (source) load(source)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      // 数据变了就重建引擎
      React.useEffect(() => {
        if (!canvasRef.current || status !== 'ready' || !data) return
        if (engineRef.current) engineRef.current.dispose()
        engineRef.current = createEngine(canvasRef.current, data, {
          onSelect: (node, i, list) => {
            setSelected(node)
            setNbrs(list || [])
          },
          onFps: (f) => setFps(f),
        })
        setSelected(null)
        setNbrs([])
        return () => {
          if (engineRef.current) {
            engineRef.current.dispose()
            engineRef.current = null
          }
        }
      }, [status, data])

      const stats = data && data.stats
      const colors = React.useMemo(
        () =>
          buildColors(
            themeNames(data && data.themes).concat(
              Object.keys((stats && stats.themes) || {}),
            ),
            data && data.otherTheme,
          ),
        [data],
      )

      return h(
        'div',
        { className: 'ym-root' },
        h(
          'div',
          { className: 'ym-bar' },
          h('h1', null, t('title')),
          h('div', { className: 'ym-grow ym-meta' }, data ? data.source : ''),
          h('input', {
            className: 'ym-q',
            placeholder: t('search'),
            value: q,
            spellCheck: false,
            onChange: (e) => {
              const v = e.target.value
              setQ(v)
              setSelected(null)
              setHits(engineRef.current ? engineRef.current.query(v) || [] : [])
            },
            onKeyDown: (e) => {
              if (e.key === 'Escape') {
                setQ('')
                setHits([])
                setSelected(null)
                if (engineRef.current) engineRef.current.clearQuery()
              }
            },
          }),
          stats
            ? h(
                'span',
                { className: 'ym-meta' },
                `${stats.nodes} ${t('nodes')} · ${stats.edges} ${t('links')}`,
              )
            : null,
          h('button', { className: 'ym-btn', onClick: () => setPicking(true) }, t('pick')),
          h('button', { className: 'ym-btn', onClick: () => load(source), disabled: !source || status === 'loading' }, t('reload')),
        ),

        h(
          'div',
          { className: 'ym-stage' + (pane ? ' ym-cramped' : ''), onClick: status === 'idle' ? () => setPicking(true) : undefined },
          h('canvas', { ref: canvasRef }),

          status === 'idle'
            ? h(
                'div',
                { className: 'ym-empty' },
                h('h2', null, t('empty')),
                h('p', null, t('emptyHint')),
                h('button', { className: 'ym-btn', onClick: () => setPicking(true) }, t('choose')),
              )
            : null,

          status === 'loading' ? h('div', { className: 'ym-empty' }, h('p', null, t('loading'))) : null,

          status === 'error'
            ? h(
                'div',
                { className: 'ym-empty' },
                h('h2', null, t('none')),
                h('p', { className: 'ym-err' }, error),
                h('button', { className: 'ym-btn', onClick: () => setPicking(true) }, t('pick')),
              )
            : null,

          status === 'ready' && hits.length
            ? h(
                'div',
                { className: 'ym-hits' },
                hits.map((nd, i) =>
                  h(
                    'button',
                    { key: i, className: 'ym-hit', onClick: () => setSelected(nd) },
                    String(nd.title || '—').slice(0, 26),
                  ),
                ),
              )
            : null,

          status === 'ready' ? h('div', { className: 'ym-hint' }, t('hint') + (fps ? ' · ' + fps + ' fps' : '')) : null,
          selected
            ? h(DetailCard, {
                node: selected,
                nbrs,
                t,
                onClose: () => {
                  setSelected(null)
                  setNbrs([])
                },
                onJump: (n) => {
                  setSelected(n.node)
                  if (engineRef.current) engineRef.current.select(n.i)
                },
              })
            : null,
        ),

        // 图例挂在 root 上而不是 stage 里 —— 否则星图缩小让位时图例跟着缩，点起来费劲。
        status === 'ready' && stats
          ? h(
              'div',
              { className: 'ym-legend' },
              Object.entries(stats.themes)
                .sort((a, b) => b[1] - a[1])
                .map(([name, n]) =>
                  h(
                    'button',
                    {
                      key: name,
                      className: 'ym-leg-btn' + (pane && pane.name === name ? ' on' : ''),
                      onClick: () => openTheme(name),
                      title: t('pickTheme'),
                    },
                    h('i', { className: 'ym-dot', style: { background: colors[name] || '#6a7d9c' } }),
                    `${name} ${n}`,
                  ),
                ),
            )
          : null,

        h(
          'div',
          { className: 'ym-pane' + (pane ? ' on' : ''), 'aria-hidden': pane ? 'false' : 'true' },
          pane
            ? [
                h(
                  'div',
                  { className: 'ym-pane-h', key: 'h' },
                  h('i', { className: 'ym-dot', style: { background: colors[pane.name] || '#6a7d9c' } }),
                  h('b', null, pane.name),
                  h('span', null, String(pane.items.length)),
                  h('button', { className: 'ym-pane-x', onClick: closePane, title: t('close') }, '×'),
                ),
                h(
                  'div',
                  { className: 'ym-pane-list', key: 'l' },
                  pane.items.map((nd, i) =>
                    h(
                      'button',
                      {
                        key: (nd && nd.id) || i,
                        className: 'ym-item',
                        onClick: () => {
                          if (engineRef.current && nd) engineRef.current.selectById(nd.id)
                        },
                      },
                      String((nd && nd.title) || '—'),
                      nd && nd.date ? h('i', null, nd.date) : null,
                    ),
                  ),
                ),
              ]
            : null,
        ),

        picking
          ? h(DirPicker, {
              t,
              initial: source,
              onPick: (dir) => {
                setPicking(false)
                load(dir)
              },
              onCancel: () => setPicking(false),
            })
          : null,
      )
    }

    /* ------------------------------------------------------------ 图标 */

    function AtlasIcon({ size }) {
      const s = size || 16
      return h(
        'svg',
        { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('circle', { cx: 12, cy: 12, r: 2.1, fill: 'currentColor' }),
        h('circle', { cx: 12, cy: 12, r: 4.6, stroke: 'currentColor', strokeOpacity: 0.55, strokeWidth: 1.2 }),
        h('circle', { cx: 12, cy: 12, r: 8.2, stroke: 'currentColor', strokeOpacity: 0.3, strokeWidth: 1 }),
        h('circle', { cx: 12, cy: 3.8, r: 1.2, fill: 'currentColor', fillOpacity: 0.85 }),
        h('circle', { cx: 19.4, cy: 16.2, r: 1.2, fill: 'currentColor', fillOpacity: 0.85 }),
        h('circle', { cx: 4.6, cy: 16.2, r: 1.2, fill: 'currentColor', fillOpacity: 0.85 }),
      )
    }

    /* ------------------------------------------------------------ 注册 */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'yan-memory-atlas: dictionaries')

        // 样式只在浏览器侧注入一次
        if (typeof document !== 'undefined') {
          ctx.effect(() => {
            const style = document.createElement('style')
            style.dataset.yanAtlas = '1'
            style.textContent = CSS
            document.head.appendChild(style)
            return () => {
              try {
                style.remove()
              } catch {
                /* 已经没了 */
              }
            }
          }, 'yan-memory-atlas: styles')
        }

        const t = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.panellist', () => {
          ctx.effect(() => {
            const offPanel = ctx.slots.register(
              { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) },
              () => h(AtlasPanel, { t }),
            )
            const offRow = ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: PANEL_ORDER,
                label: () => t('nav'),
                locale: NS,
              },
              (owner) => h(AtlasIcon, { size: (owner && owner.size) || 16 }),
            )
            return () => {
              try {
                if (typeof offRow === 'function') offRow()
              } catch {
                /* ignore */
              }
              try {
                if (typeof offPanel === 'function') offPanel()
              } catch {
                /* ignore */
              }
            }
          }, 'yan-memory-atlas: panel')
        })
      },
    }
  },
})
