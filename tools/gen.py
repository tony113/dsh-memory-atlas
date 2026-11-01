#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""记忆星图 · 页面生成

读 nodes.json + edges.json，生成一个零依赖的 index.html（Canvas 2D）。
力导向布局、透视投影、语义检索、点星看原文。

    python tools/build.py --src ../my-memory
    python tools/gen.py   --src ../my-memory

--src 同时是读取目录和默认输出目录；--out 可以把 html 写到别处。

中心节点显示什么，由 --center / --title 决定（或在 <src>/atlas.json 里配）：
    {"center": "砚", "title": "砚 · 记忆星图", "center_body": "这些事都经过我。"}
"""
import argparse
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

HTML = r'''<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>@@TITLE@@</title>
<style>
  html,body{margin:0;height:100%;background:#03050a;overflow:hidden;
    font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#dfe8f5}
  canvas{display:block;width:100vw;height:100vh;cursor:grab}
  canvas.drag{cursor:grabbing}
  #hud{position:fixed;left:22px;top:18px;pointer-events:none;user-select:none}
  #hud h1{font-size:15px;font-weight:600;letter-spacing:.18em;margin:0 0 6px;color:#eaf2ff}
  #hud .sub{font-size:11px;color:#7d90ae;letter-spacing:.06em}
  #legend{position:fixed;left:22px;bottom:14px;font-size:11px;color:#8fa2c0;display:flex;gap:13px;flex-wrap:wrap;max-width:78vw;pointer-events:none}
  #legend i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:1px}
  #hint{position:fixed;right:22px;bottom:14px;font-size:11px;color:#4d5e7c;pointer-events:none}
  #find{position:fixed;left:22px;bottom:42px;z-index:3}
  #find input{width:320px;background:rgba(10,16,30,.82);border:1px solid #1b2942;color:#cfe0ff;
    font-size:12px;padding:7px 11px;border-radius:4px;outline:none;font-family:inherit}
  #find input:focus{border-color:#33527d;background:rgba(12,20,38,.95)}
  #find input::placeholder{color:#4d5e7c}
  #qres{position:fixed;left:22px;bottom:72px;font-size:11px;color:#8fa2c0;max-width:42vw;line-height:1.7;z-index:3}
  #qres a{color:#a9c2e6;cursor:pointer;text-decoration:none;border-bottom:1px dotted #2c4060}
  #qres a:hover{color:#eaf2ff}
  #panel{position:fixed;right:0;top:0;width:380px;height:100vh;background:rgba(7,11,20,.94);
    border-left:1px solid #17233c;padding:22px 24px;box-sizing:border-box;overflow:auto;
    transform:translateX(100%);transition:transform .28s ease;backdrop-filter:blur(8px)}
  #panel.on{transform:translateX(0)}
  #panel .pdate{font-size:11px;color:#5d7ba8;letter-spacing:.05em}
  #panel h2{font-size:15px;margin:8px 0 10px;color:#eaf2ff;line-height:1.5;font-weight:600}
  #panel .pmeta{font-size:11px;color:#64789a;margin-bottom:14px}
  #panel .pbody{font-size:12.5px;line-height:1.85;color:#b8c8e0;white-space:pre-wrap}
  #panel .pfoot{margin-top:18px;padding-top:12px;border-top:1px solid #17233c;font-size:11px;color:#54688a;line-height:1.7}
  #panel .pnbr{margin-top:16px;padding-top:12px;border-top:1px solid #17233c}
  #panel .pnbr .pntitle{font-size:10.5px;color:#54688a;letter-spacing:.08em;margin-bottom:8px}
  #panel .pnbr a{display:block;font-size:11.5px;line-height:1.6;color:#9fb4d4;text-decoration:none;padding:3px 0;border-bottom:1px dashed rgba(23,35,60,.9);cursor:pointer}
  #panel .pnbr a:hover{color:#eaf2ff}
  #panel .pnbr a b{font-weight:400;color:#6f86a8;font-size:10.5px;margin-right:6px}
  #close{position:absolute;right:14px;top:12px;width:24px;height:24px;border:0;background:transparent;color:#7c8fae;font-size:18px;cursor:pointer}
  #loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:#03050a;color:#7d90ae;font-size:12px;letter-spacing:.1em;z-index:9;transition:opacity .4s}
  #loading.off{opacity:0;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hud"><h1>@@TITLE@@</h1><div class="sub" id="sub"></div></div>
<div id="legend"></div>
<div id="hint">拖拽旋转 · 滚轮缩放 · 点星星看原话</div>
<div id="qres"></div>
<div id="find"><input id="q" placeholder="说一句话，把相关的星拉出来（Esc 清）" autocomplete="off" spellcheck="false"></div>
<div id="loading">正在铺开星图…</div>
<div id="panel"><button id="close">×</button><div id="pc"></div></div>
<script>
const NODES = __DATA__;
const EDGES_DATA = __EDGES__;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);

const COLORS = {'视频':'#4fd6c9','记忆系统':'#5b8cff','QQ 桥':'#7cd0ff','感情':'#ff6f86',
  '命理':'#b98cff','白酒':'#ffc861','工作':'#8b97ad','其他':'#6a7d9c','core':'#ffffff',
  '车机':'#ff9d5c','工具链':'#5ee0a8','手机':'#8fd3ff','约定':'#ff8fd0','健康':'#a8e05f'};
const WEIGHT = {'重':1.9,'中':1.0,'轻':0.55};

// ---------- 节点与边 ----------
// 时间归一化：0=最早，1=最近
(function(){
  const ts = NODES.filter(n => n.date).map(n => +new Date(n.date)).filter(t => !isNaN(t));
  const dmin = Math.min.apply(null, ts), dmax = Math.max.apply(null, ts);
  NODES.forEach(n => {
    const t = n.date ? +new Date(n.date) : NaN;
    n.rank = isNaN(t) ? 0.5 : (t - dmin) / Math.max(1, dmax - dmin);
  });
})();
const CN = { title:'@@CENTER@@', theme:'core', date:'', weight:'重', body:'@@CENTER_BODY@@', meta:'@@CENTER_META@@', src:'', isCore:true };
const ALL = [CN].concat(NODES);
const N = ALL.length;

const EDGES = [];
const seen = new Set();
const ADJ = new Map();          // 邻接表：谁跟谁连着
const NBR = new Map();          // 带类型的邻居：[[对方, kind, 相似度], ...]
function touch(a, b){
  if (!ADJ.has(a)) ADJ.set(a, new Set());
  if (!ADJ.has(b)) ADJ.set(b, new Set());
  ADJ.get(a).add(b); ADJ.get(b).add(a);
}
function addEdge(a, b, kind, w){
  if (a === b) return;
  const k = a < b ? a+'-'+b : b+'-'+a;
  if (seen.has(k)) return;
  seen.add(k); EDGES.push([a, b, kind, w || 0]);
  touch(a, b);
  if (!NBR.has(a)) NBR.set(a, []);
  if (!NBR.has(b)) NBR.set(b, []);
  NBR.get(a).push([b, kind, w || 0]);
  NBR.get(b).push([a, kind, w || 0]);
}
// 1) 每颗星都连到中心的@@CENTER@@
for (let i = 1; i < N; i++) addEdge(0, i, 'root');
// 2) 联想边：由 build.py 造好（相似 / 引用 / 同日）
if (EDGES_DATA && EDGES_DATA.length) {
  for (const e of EDGES_DATA) addEdge(e[0], e[1], e[2], e[3]);
} else {
// 退回旧规则：同主题按时间相邻
const byTheme = {};
for (let i = 1; i < N; i++) {
  const t = NODES[i-1].theme || '其他';
  (byTheme[t] = byTheme[t] || []).push(i);
}
Object.values(byTheme).forEach(arr => {
  arr.sort((a,b) => (NODES[a-1].date||'') < (NODES[b-1].date||'') ? -1 : 1);
  for (let k = 0; k < arr.length - 1; k++) addEdge(arr[k], arr[k+1], 'theme');
});
// 3) 同一天的相邻事件
const byDay = {};
for (let i = 1; i < N; i++) {
  const d = NODES[i-1].date || '';
  if (!d) continue;
  (byDay[d] = byDay[d] || []).push(i);
}
Object.values(byDay).forEach(arr => {
  for (let k = 0; k < arr.length - 1; k++) addEdge(arr[k], arr[k+1], 'day');
});
}

// ---------- 力导向 ----------
let pos = [];
let maxAbs = 1;
function simulate(iters){
  const n = N, k = 1.55;
  pos = new Array(n);
  const rnd = (i, s) => { const v = Math.sin(i*12.9898 + s*78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    // 初始：按时间从内到外撒开（早期在内，近期在外）
    const d = NODES[i-1] ? (NODES[i-1].rank || 0) : 0;
    const a = rnd(i,1)*Math.PI*2, b = rnd(i,2)*Math.PI - Math.PI/2;
    const r = i === 0 ? 0 : 0.6 + rnd(i,3)*2.2;
    pos[i] = { x: Math.cos(a)*Math.cos(b)*r, y: Math.sin(b)*r, z: Math.sin(a)*Math.cos(b)*r };
  }
  const disp = new Array(n);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) disp[i] = {x:0,y:0,z:0};
    // 排斥
    for (let i = 0; i < n; i++) {
      const pi = pos[i];
      for (let j = i+1; j < n; j++) {
        const pj = pos[j];
        let dx = pi.x-pj.x, dy = pi.y-pj.y, dz = pi.z-pj.z;
        let d2 = dx*dx + dy*dy + dz*dz + 0.02;
        const d = Math.sqrt(d2);
        const f = k*k / d2;
        disp[i].x += dx/d*f; disp[i].y += dy/d*f; disp[i].z += dz/d*f;
        disp[j].x -= dx/d*f; disp[j].y -= dy/d*f; disp[j].z -= dz/d*f;
      }
    }
    // 弹簧
    for (const [a,b] of EDGES) {
      const pa = pos[a], pb = pos[b];
      let dx = pa.x-pb.x, dy = pa.y-pb.y, dz = pa.z-pb.z;
      const d = Math.sqrt(dx*dx+dy*dy+dz*dz) + 1e-6;
      const f = (d - k) * 0.13;
      disp[a].x -= dx/d*f; disp[a].y -= dy/d*f; disp[a].z -= dz/d*f;
      disp[b].x += dx/d*f; disp[b].y += dy/d*f; disp[b].z += dz/d*f;
    }
    // 向心 + 时间外推
    for (let i = 1; i < n; i++) {
      const nd = NODES[i-1];
      const t = nd.rank || 0;                       // 0=最早 1=最近
      const target = 0.55 + t * 2.5;                // 新的在外
      const r = Math.hypot(pos[i].x, pos[i].y, pos[i].z) + 1e-6;
      const pull = (r - target) * 0.06;
      disp[i].x -= pos[i].x/r*pull; disp[i].y -= pos[i].y/r*pull; disp[i].z -= pos[i].z/r*pull;
    }
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y, disp[i].z) + 1e-6;
      const lim = Math.min(d, 0.55);
      pos[i].x += disp[i].x/d*lim; pos[i].y += disp[i].y/d*lim; pos[i].z += disp[i].z/d*lim;
    }
  }
  maxAbs = 0;
  for (const p of pos) maxAbs = Math.max(maxAbs, Math.hypot(p.x, p.y, p.z));
}

// ---------- 视角 ----------
let yaw = 0.55, pitch = -0.35, zoom = 1.0, spin = 0;
let hover = -1, sel = -1;

const STARS = [];
(function(){
  const r = (i,s) => { const v = Math.sin(i*12.9898 + s*78.233)*43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 520; i++) STARS.push({x: r(i,21), y: r(i,22), s: 0.3 + r(i,23)*1.1, a: 0.04 + r(i,24)*0.20});
})();

function resize(){
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

// ---------- 语义检索：说一句话，把相关的星拉出来 ----------
let focusSet = null, focusTop = [];
function norm(s){ return String(s || '').toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, ''); }
const QDF = new Map();
const NODE_GRAMS = [];
(function(){
  const df = new Map(), gs = [];
  for (let i = 0; i < N; i++) {
    const nd = i === 0 ? CN : NODES[i-1];
    const t = norm(nd.title) + ' ' + norm(nd.body);
    const c = new Map();
    for (let k = 0; k < t.length - 1; k++) {
      const g = t.substr(k, 2);
      c.set(g, (c.get(g) || 0) + 1);
    }
    gs.push(c);
    for (const g of c.keys()) df.set(g, (df.get(g) || 0) + 1);
  }
  gs.forEach(c => {
    const v = new Map(); let ss = 0;
    for (const [g, n] of c) {
      const w = (1 + Math.log(n)) * (Math.log((N + 1) / ((df.get(g) || 0) + 1)) + 1);
      v.set(g, w); ss += w * w;
    }
    const q = Math.sqrt(ss) || 1;
    for (const [g, w] of v) v.set(g, w / q);
    NODE_GRAMS.push(v);
  });
  for (const [g, n] of df) QDF.set(g, n);
})();

function runQuery(text){
  const t = norm(text);
  const qres = document.getElementById('qres');
  if (t.length < 2) { focusSet = null; focusTop = []; qres.innerHTML = ''; return; }
  sel = -1;
  document.getElementById('panel').classList.remove('on');
  const c = new Map();
  for (let k = 0; k < t.length - 1; k++) {
    const g = t.substr(k, 2);
    c.set(g, (c.get(g) || 0) + 1);
  }
  const qv = new Map(); let ss = 0;
  for (const [g, n] of c) {
    if (!QDF.has(g)) continue;
    const w = (1 + Math.log(n)) * (Math.log((N + 1) / (QDF.get(g) + 1)) + 1);
    qv.set(g, w); ss += w * w;
  }
  if (!qv.size) { focusSet = null; focusTop = []; qres.innerHTML = ''; return; }
  const qn = Math.sqrt(ss) || 1;
  const hits = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    const v = NODE_GRAMS[i];
    for (const [g, w] of qv) {
      const x = v.get(g);
      if (x) s += (w / qn) * x;
    }
    if (s > 0.02) hits.push([s, i]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  const top = hits.slice(0, 5);
  focusTop = top.map(x => x[1]);
  const set = new Set();
  top.forEach(([s, i]) => { set.add(i); (NBR.get(i) || []).forEach(nb => set.add(nb[0])); });
  focusSet = set.size ? set : null;
  qres.innerHTML = top.length
    ? top.map(([s, i]) => {
        const nd = i === 0 ? CN : NODES[i-1];
        return `<a onclick="showPanel(${i})">${esc(String(nd.title || '').slice(0, 26))}</a>`;
      }).join('　')
    : '没找到';
}

function proj(p){
  const yy = yaw + spin;
  const cy = Math.cos(yy), sy = Math.sin(yy), cp = Math.cos(pitch), sp = Math.sin(pitch);
  let x = p.x*cy - p.z*sy, z = p.x*sy + p.z*cy;
  let y = p.y*cp - z*sp; z = p.y*sp + z*cp;
  const scale = Math.min(W, H) * 0.42 / Math.max(1e-6, maxAbs) * zoom;
  const persp = Math.min(2.0, Math.max(0.45, 1 / (1 + z * 0.10)));   // 透视：越远越小
  return { sx: W/2 + x*scale*persp*1.35, sy: H/2 - y*scale*persp*1.35, z, persp };
}

function draw(){
  spin += 0.0008;
  ctx.clearRect(0,0,W,H);
  const g = ctx.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,Math.max(W,H)*0.78);
  g.addColorStop(0,'#0a1020'); g.addColorStop(0.55,'#05080f'); g.addColorStop(1,'#020407');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  // 背景星尘
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#cfe0ff';
    ctx.fillRect(s.x*W, s.y*H, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  const Q = pos.map(proj);

  // 线：先画同主题/同日，再画中心辐射
  const selNbrs = sel >= 0 ? (ADJ.get(sel) || new Set()) : null;
  const dim = sel >= 0;
  ctx.lineCap = 'round';
  for (const [a,b,kind,dd] of EDGES) {
    if (kind === 'root') continue;
    const qa = Q[a], qb = Q[b];
    const t = (a === 0 ? 'core' : (NODES[a-1] && NODES[a-1].theme)) || '其他';
    const depth = (qa.persp + qb.persp) * 0.5;
    const hot = sel >= 0 && (a === sel || b === sel);
    if (hot) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = COLORS[t] || '#6a7d9c';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(qa.sx, qa.sy); ctx.lineTo(qb.sx, qb.sy); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
    } else {
      const KA = kind === 'sim' ? 0.09 + 0.32 * (dd || 0)
               : kind === 'ref' ? 0.22
               : kind === 'theme' ? 0.26 : 0.09;
      ctx.globalAlpha = (dim ? 0.03 : KA) * depth;
      ctx.strokeStyle = kind === 'ref' ? '#f0d9a8' : (COLORS[t] || '#6a7d9c');
      ctx.lineWidth = (kind === 'ref' ? 0.7 : 0.55) * depth + 0.22;
    }
    ctx.beginPath(); ctx.moveTo(qa.sx, qa.sy); ctx.lineTo(qb.sx, qb.sy); ctx.stroke();
  }
  // 中心辐射线
  const core = Q[0];
  for (let i = 1; i < N; i++) {
    const q = Q[i];
    const t = (NODES[i-1] && NODES[i-1].theme) || '其他';
    const hot = sel >= 0 && (i === sel || sel === 0);
    if (hot) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e8f0ff';
      ctx.lineWidth = 2.4;
    } else {
      ctx.globalAlpha = (dim ? 0.02 : 0.07) * q.persp;
      ctx.strokeStyle = COLORS[t] || '#6a7d9c';
      ctx.lineWidth = 0.45;
    }
    ctx.beginPath(); ctx.moveTo(core.sx, core.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 星核（@@CENTER@@）
  const cg = ctx.createRadialGradient(core.sx,core.sy,0,core.sx,core.sy,40);
  cg.addColorStop(0,'rgba(255,255,255,.95)');
  cg.addColorStop(.18,'rgba(225,235,255,.5)');
  cg.addColorStop(.5,'rgba(140,170,255,.12)');
  cg.addColorStop(1,'rgba(80,120,200,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(core.sx,core.sy,40,0,7); ctx.fill();

  // 点（远到近）
  const order = Q.map((q,i) => i).sort((a,b) => Q[b].z - Q[a].z);
  for (const i of order) {
    const q = Q[i];
    const nd = i === 0 ? CN : NODES[i-1];
    const c = COLORS[nd.theme] || '#6a7d9c';
    const w = WEIGHT[nd.weight] || 1;
    const persp = q.persp;
    const isNbr = sel >= 0 && selNbrs.has(i);
    const boost = (i === sel) ? 2.1 : (isNbr ? 1.5 : (i === hover ? 1.5 : 1));
    const rad = Math.max(0.8, (1.0 + w * 1.45) * persp * Math.min(1.9, zoom)) * boost;
    const dimF = (focusSet && !focusSet.has(i)) ? 0.10 : 1;
    // 大光晕
    ctx.globalAlpha = (0.05 * persp + 0.01) * (isNbr || i === sel ? 2.6 : 1) * dimF;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 6.0, 0, 7); ctx.fill();
    // 中光晕
    ctx.globalAlpha = (0.15 * persp + 0.02) * (isNbr || i === sel ? 2.2 : 1) * dimF;
    ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 2.6, 0, 7); ctx.fill();
    // 亮核
    ctx.globalAlpha = (0.55 + persp * 0.45) * dimF;
    ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 0.62, 0, 7); ctx.fill();
    // 中心点白芯
    if (i === 0) {
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 0.5, 0, 7); ctx.fill();
    }
    if (focusTop.length && focusTop.indexOf(i) >= 0) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * 3.4, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 标签：中心常驻，hover 才显示其他
  ctx.font = '11px -apple-system,"Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(235,242,255,.95)';
  ctx.fillText('@@CENTER@@', core.sx, core.sy + 26);
  if (focusTop.length) {
    for (const fi of focusTop) {
      const fq = Q[fi], fnd = fi === 0 ? CN : NODES[fi-1];
      ctx.fillStyle = 'rgba(240,248,255,.95)';
      ctx.fillText(String(fnd.title || '').slice(0, 14), fq.sx, fq.sy - 13);
    }
  }
  if (hover > 0) {
    const q = Q[hover], nd = NODES[hover-1];
    const label = (nd.title || '').slice(0, 22);
    ctx.fillStyle = 'rgba(230,240,255,.9)';
    ctx.fillText(label, q.sx, q.sy - 12);
  }

  requestAnimationFrame(draw);
}

// ---------- 交互 ----------
let drag = false, lx = 0, ly = 0, moved = 0;
cv.addEventListener('mousedown', e => { drag = true; lx = e.clientX; ly = e.clientY; moved = 0; cv.classList.add('drag'); });
window.addEventListener('mouseup', () => { drag = false; cv.classList.remove('drag'); });
cv.addEventListener('mousemove', e => {
  if (drag) {
    const dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.abs(dx)+Math.abs(dy) > 2) moved = 1;
    yaw += dx * 0.006; pitch += dy * 0.004;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
    lx = e.clientX; ly = e.clientY;
  } else {
    hover = pick(e.clientX, e.clientY);
  }
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  zoom *= e.deltaY > 0 ? 0.92 : 1.08;
  zoom = Math.max(0.4, Math.min(7, zoom));
}, { passive: false });
cv.addEventListener('click', e => {
  if (moved) { moved = 0; return; }
  const i = pick(e.clientX, e.clientY);
  if (i >= 0) showPanel(i); else hidePanel();
});

function pick(mx, my){
  let best = -1, bd = 18*18;
  for (let i = 0; i < N; i++) {
    const q = proj(pos[i]);
    const d = (q.sx-mx)*(q.sx-mx) + (q.sy-my)*(q.sy-my);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function showPanel(i){
  sel = i;
  const nd = i === 0 ? CN : NODES[i-1];
  const p = document.getElementById('panel'), pc = document.getElementById('pc');
  pc.innerHTML = `
    <div class="pdate">${nd.date || '—'} · ${nd.theme}</div>
    <h2>${esc(nd.title)}</h2>
    <div class="pmeta">${nd.src || ''} ${nd.weight ? '· 份量：' + nd.weight : ''}</div>
    <div class="pbody">${esc(nd.body || '').slice(0, 1800)}</div>
    <div class="pfoot">${esc(nd.meta || '')}</div>
    ${nbrHtml(i)}`;
  p.classList.add('on');
}
const KIND_ORDER = {ref:0, sim:1, day:2, root:3};
const KIND_NAME = {ref:'引用', sim:'像', day:'同日', root:'中心'};
function nbrHtml(i){
  const list = (NBR.get(i) || []).filter(x => !(x[1] === 'root' && i !== 0));
  if (!list.length) return '';
  list.sort((a,b) => (KIND_ORDER[a[1]]||9) - (KIND_ORDER[b[1]]||9) || b[2] - a[2]);
  const rows = list.slice(0, 14).map(([j, kind, w]) => {
    const t = j === 0 ? '@@CENTER@@' : (NODES[j-1] ? String(NODES[j-1].title || '').slice(0, 26) : '');
    return `<a onclick="showPanel(${j})"><b>${KIND_NAME[kind] || kind}</b>${esc(t)}</a>`;
  }).join('');
  return `<div class="pnbr"><div class="pntitle">连着它的 ${list.length} 条</div>${rows}</div>`;
}
function hidePanel(){ sel = -1; document.getElementById('panel').classList.remove('on'); }
function esc(s){ return String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

document.getElementById('close').onclick = hidePanel;

const qEl = document.getElementById('q');
let qTimer = 0;
qEl.addEventListener('input', () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => runQuery(qEl.value), 150);
});
qEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') { qEl.value = ''; runQuery(''); qEl.blur(); }
});
window.addEventListener('resize', resize);

// ---------- 启动 ----------
const counts = {};
NODES.forEach(n => counts[n.theme] = (counts[n.theme]||0) + 1);
const lg = document.getElementById('legend');
Object.keys(counts).sort((a,b) => counts[b]-counts[a]).forEach(t => {
  const d = document.createElement('span');
  d.innerHTML = `<i style="background:${COLORS[t]||'#6a7d9c'}"></i>${t} ${counts[t]}`;
  lg.appendChild(d);
});
document.getElementById('sub').textContent = `${NODES.length} 个节点　·　${EDGES_DATA.length} 条联想线　·　中心是@@CENTER@@　·　今天在外层`;

resize();
setTimeout(() => {
  simulate(N > 600 ? 120 : 260);
  document.getElementById('loading').classList.add('off');
  document.getElementById('loading').style.display = 'none';
  // 支持 #sel=N 直接打开某个节点（调试/分享用）
  if (location.hash.indexOf('#sel=') === 0) {
    const k = parseInt(location.hash.slice(5), 10);
    if (k >= 0 && k < N) showPanel(k);
  }
  draw();
}, 30);
</script>
</body>
</html>'''


def load_atlas_json(src):
    p = os.path.join(src, "atlas.json")
    if os.path.isfile(p):
        with io.open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def main(argv=None):
    ap = argparse.ArgumentParser(description="把 nodes.json / edges.json 渲染成记忆星图")
    ap.add_argument("--src", default=os.getcwd(), help="节点数据目录（默认当前目录）")
    ap.add_argument("--out", default=None, help="html 输出路径（默认 <src>/index.html）")
    ap.add_argument("--nodes", default=None, help="节点 JSON（默认 <src>/nodes.json）")
    ap.add_argument("--edges", default=None, help="边 JSON（默认 <src>/edges.json，没有就只画中心辐射）")
    ap.add_argument("--center", default=None, help="中心节点名字（默认 我，或 atlas.json 的 center）")
    ap.add_argument("--title", default=None, help="页面标题（默认 <center> · 记忆星图）")
    ap.add_argument("--center-body", default=None, help="点中心时显示的正文")
    ap.add_argument("--center-meta", default=None, help="中心节点的 meta 一行")
    args = ap.parse_args(argv)

    src = os.path.abspath(args.src)
    if not os.path.isdir(src):
        sys.exit("src 不是目录：%s" % src)

    nodes_path = args.nodes or os.path.join(src, "nodes.json")
    edges_path = args.edges or os.path.join(src, "edges.json")
    out_path = args.out or os.path.join(src, "index.html")

    if not os.path.isfile(nodes_path):
        sys.exit("找不到节点数据：%s（先跑 tools/build.py）" % nodes_path)
    with io.open(nodes_path, encoding="utf-8") as f:
        nodes = json.load(f)
    edges_data = []
    if os.path.isfile(edges_path):
        with io.open(edges_path, encoding="utf-8") as f:
            edges_data = json.load(f)

    cfg = load_atlas_json(src)
    center = args.center or cfg.get("center") or "我"
    title = args.title or cfg.get("title") or (center + " · 记忆星图")
    center_body = args.center_body or cfg.get("center_body") or "这些事都经过我。"
    center_meta = args.center_meta or cfg.get("center_meta") or "中心"

    html = HTML
    # 先替换布局占位符，再注入数据（数据里出现 @@ 的概率远小于标题里出现 __DATA__）
    html = (html
            .replace("@@TITLE@@", title)
            .replace("@@CENTER_BODY@@", center_body)
            .replace("@@CENTER_META@@", center_meta)
            .replace("@@CENTER@@", center))
    html = (html
            .replace("__DATA__", json.dumps(nodes, ensure_ascii=False))
            .replace("__EDGES__", json.dumps(edges_data, ensure_ascii=False)))

    out_dir = os.path.dirname(os.path.abspath(out_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with io.open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    print("星图 %s（节点 %d，边 %d，中心「%s」）" % (out_path, len(nodes), len(edges_data), center))


if __name__ == "__main__":
    main()
