#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""记忆星图 · 节点拆解

把一份 Markdown 记忆档案拆成节点，输出 nodes.json 和 edges.json。
不绑定任何路径：来源全由 --src 决定。

    python tools/build.py --src ../my-memory
    python tools/build.py --src D:\\yan --out D:\\yan\\_atlas

读   <src>/<档案>.md         自动发现，可用 --archive 指定
读   <src>/<收件箱>/*.md     自动发现，可用 --inbox 指定
写   <out>/nodes.json <out>/edges.json     --out 默认 = --src

档案格式见 docs/03-protocol.md。收件箱条目格式见 templates/inbox.md。
"""
import argparse
import hashlib
import io
import json
import math
import os
import re
import sys
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

ARCHIVE_NAMES = ["我的记忆档案.md", "记忆档案.md", "memory.md", "archive.md"]
INBOX_NAMES = ["记忆收件箱", "收件箱", "inbox", "Inbox"]

DEFAULTS = {
    "other_theme": "其他",
    "log_section": "## 14.",
}


# ---------------------------------------------------------------- 发现源文件
def _abs(src, p):
    return p if os.path.isabs(p) else os.path.join(src, p)


def find_archive(src, explicit):
    """档案正文：显式参数 → 常见名字 → src 顶层最大的那个 .md。"""
    if explicit:
        p = _abs(src, explicit)
        if not os.path.isfile(p):
            sys.exit("找不到档案：%s" % p)
        return p

    for name in ARCHIVE_NAMES:
        p = os.path.join(src, name)
        if os.path.isfile(p):
            return p

    skip = {"readme.md", "license", "license.md", "notice.md", "changelog.md"}
    cands = [
        os.path.join(src, f)
        for f in os.listdir(src)
        if f.lower().endswith(".md")
        and os.path.isfile(os.path.join(src, f))
        and f.lower() not in skip
    ]
    if not cands:
        sys.exit("在 %s 里没找到任何 .md 档案，用 --archive 指定。" % src)
    return max(cands, key=os.path.getsize)


def find_inbox(src, explicit):
    """收件箱目录：显式参数 → 常见名字 → 没有就没有（收件箱是可选来源）。"""
    if explicit:
        p = _abs(src, explicit)
        if not os.path.isdir(p):
            sys.exit("找不到收件箱目录：%s" % p)
        return p
    for name in INBOX_NAMES:
        p = os.path.join(src, name)
        if os.path.isdir(p):
            return p
    return None


def load_themes(src, explicit):
    """主题表：--themes → <src>/themes.json → <工具目录>/themes.json。"""
    cands = []
    if explicit:
        cands.append(_abs(src, explicit))
    cands.append(os.path.join(src, "themes.json"))
    cands.append(os.path.join(SCRIPT_DIR, "themes.json"))

    for path in cands:
        if path and os.path.isfile(path):
            with io.open(path, encoding="utf-8") as f:
                data = json.load(f)
            themes = data["themes"] if isinstance(data, dict) else data
            pairs = [(t["name"], [str(k) for k in t["keywords"]]) for t in themes]
            return path, pairs, (data.get("default") if isinstance(data, dict) else None)
    return None, [], None


def load_atlas_json(src):
    """可选：<src>/atlas.json 放中心名、标题这类只影响展示的默认值。"""
    p = os.path.join(src, "atlas.json")
    if os.path.isfile(p):
        with io.open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


# ---------------------------------------------------------------- 工具
def nid(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:10]


def make_theme_of(themes, other):
    def theme_of(text):
        t = (text or "").lower()
        for name, kws in themes:
            if any(k.lower() in t for k in kws):
                return name
        return other
    return theme_of


def base_year(texts):
    """档案里出现最多的年份，用来给「3月4日」这种没写年份的日期补全。"""
    years = Counter()
    for t in texts:
        for m in re.finditer(r"(20\d{2})-\d{2}-\d{2}", t or ""):
            years[m.group(1)] += 1
    return int(max(years)) if years else None


# ---------------------------------------------------------------- 拆节点
def split_nodes(archive_text, inbox_dir, theme_of, log_section, year, archive_name="archive"):
    nodes = []

    # 更新日志条目的来源标签：从 "## 14." 里取章节号，取不到就用 log
    log_tag = "log"
    if log_section:
        m_num = re.search(r"(\d+)", log_section)
        if m_num:
            log_tag = "§" + m_num.group(1)

    # ---------- 1. 收件箱条目 ----------
    if inbox_dir:
        for fn in sorted(os.listdir(inbox_dir)):
            if not re.match(r"^\d{4}-\d{2}-\d{2}", fn) or not fn.endswith(".md"):
                continue
            path = os.path.join(inbox_dir, fn)
            with io.open(path, encoding="utf-8") as f:
                body = f.read()
            for ch in re.split(r"(?m)^## \[", body)[1:]:
                head = ch.splitlines()[0]
                m = re.match(r"([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$", head)
                if not m:
                    continue
                ts, src_tag, rest = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
                date = ts[:10]
                time = ts[11:16] if len(ts) >= 16 else ""
                section = rest.split("/")[0].strip() if "/" in rest else ""
                title = rest.split("/")[-1].strip() if "/" in rest else rest
                w = re.search(r"份量：\s*(重|中|轻)", ch)
                content = ch[len(head):].strip()[:1500]
                nodes.append({
                    "id": nid("inbox" + fn + head),
                    "date": date, "time": time,
                    "kind": "inbox", "src": src_tag, "section": section,
                    "title": title[:60], "weight": w.group(1) if w else "",
                    "theme": theme_of(section + " " + title + " " + content),
                    "body": content, "file": fn,
                })

    # ---------- 2. 更新日志（按天一行） ----------
    if log_section:
        i = archive_text.find(log_section)
        tail = archive_text[i:] if i >= 0 else ""
        for ln in tail.splitlines():
            m = re.match(r"\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*$", ln)
            if not m:
                continue
            d, content = m.group(1), m.group(2)
            title = re.sub(r"\*\*", "", content)[:70]
            nodes.append({
                "id": nid("daily" + ln), "date": d, "time": "",
                "kind": "daily", "src": "archive", "section": log_tag,
                "title": title, "weight": "", "theme": theme_of(content),
                "body": content, "file": archive_name,
            })

    # ---------- 3. 正文里带日期的叙述段 ----------
    for p in re.split(r"\n\s*\n", archive_text):
        p = p.strip()
        if not (20 < len(p) < 1200) or p[:1] in ("|", ">", "#"):
            continue
        m = re.search(r"(20\d{2}-\d{2}-\d{2})|((\d{1,2})月(\d{1,2})日)", p)
        if not m:
            continue
        if m.group(1):
            d = m.group(1)
        else:
            if not year:
                continue
            d = "%04d-%02d-%02d" % (year, int(m.group(3)), int(m.group(4)))
        first = re.split(r"[。！？\n]", p)[0]
        first = re.sub(r"^[#>\-\*\s]+", "", first).replace("**", "")[:60]
        if len(first) < 4:
            continue
        nodes.append({
            "id": nid("para" + p[:40]), "date": d, "time": "",
            "kind": "archive", "src": "archive", "section": "",
            "title": first, "weight": "", "theme": theme_of(p),
            "body": p[:1500], "file": archive_name,
        })

    return nodes


# ---------------------------------------------------------------- 造边
def _grams(text):
    t = re.sub(r"[^\w\u4e00-\u9fff]", "", (text or "").lower())
    return Counter(t[i:i + 2] for i in range(max(0, len(t) - 1)))


def _cos(a, b):
    if len(a) > len(b):
        a, b = b, a
    s = 0.0
    for k, x in a.items():
        y = b.get(k)
        if y:
            s += x * y
    return s


def build_edges(ns, log=print):
    n = len(ns)
    if n < 2:
        return []
    docs = [_grams((x.get("title") or "") + " " + (x.get("body") or "")) for x in ns]
    df = Counter()
    for g in docs:
        for k in g:
            df[k] += 1
    idf = {k: math.log((n + 1.0) / (d + 1.0)) + 1.0 for k, d in df.items()}
    vecs = []
    for g in docs:
        v = {k: (1.0 + math.log(c)) * idf[k] for k, c in g.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({k: x / norm for k, x in v.items()})

    edges, seen = [], set()

    def add(a, b, kind, w):
        if a == b:
            return
        key = (a, b) if a < b else (b, a)
        if key in seen:
            return
        seen.add(key)
        edges.append([a + 1, b + 1, kind, round(w, 3)])  # +1：0 留给中心

    # 相似边：倒排索引，每点只连最像的 K 个
    inv = {}
    for i, v in enumerate(vecs):
        for k in v:
            inv.setdefault(k, []).append(i)
    K, TH = 8, 0.05
    for i in range(n):
        acc = {}
        for k, w in vecs[i].items():
            for j in inv.get(k, ()):
                if j != i:
                    acc[j] = acc.get(j, 0.0) + w * vecs[j][k]
        for j, s in sorted(acc.items(), key=lambda kv: -kv[1])[:K]:
            if s >= TH:
                add(i, j, "sim", s)

    # 引用边：正文里点名的日期，连到那天最像的两条
    day_map = {}
    for i, x in enumerate(ns):
        d = x.get("date") or ""
        if d:
            day_map.setdefault(d, []).append(i)
    year_hint = base_year([x.get("date") or "" for x in ns]) or 0
    for i, x in enumerate(ns):
        txt = (x.get("title") or "") + " " + (x.get("body") or "")
        refs = set(m.group(0) for m in re.finditer(r"\d{4}-\d{2}-\d{2}", txt))
        for m in re.finditer(r"(?<![\d-])(\d{1,2})-(\d{1,2})(?![\d-])", txt):
            refs.add("%04d-%02d-%02d" % (year_hint, int(m.group(1)), int(m.group(2))))
        for m in re.finditer(r"(\d{1,2})月(\d{1,2})日", txt):
            refs.add("%04d-%02d-%02d" % (year_hint, int(m.group(1)), int(m.group(2))))
        own = x.get("date") or ""
        for d in sorted(refs):  # 排序：set 迭代顺序随进程变，不排就对不出稳定 diff
            if not d or d == own:
                continue
            scored = sorted(
                ((_cos(vecs[i], vecs[j]), j) for j in day_map.get(d, []) if j != i),
                reverse=True,
            )
            for s, j in scored[:2]:
                add(i, j, "ref", max(0.5, s))

    # 同日边：同一天相邻事件
    for d, idxs in day_map.items():
        idxs.sort()
        for a, b in zip(idxs, idxs[1:]):
            add(a, b, "day", 0.3)

    return edges


# ---------------------------------------------------------------- 主流程
def main(argv=None):
    ap = argparse.ArgumentParser(
        description="把一份 Markdown 记忆档案拆成 nodes.json / edges.json")
    ap.add_argument("--src", default=os.getcwd(),
                    help="档案目录（默认当前目录）")
    ap.add_argument("--out", default=None,
                    help="产物目录（默认 = --src）")
    ap.add_argument("--archive", default=None,
                    help="档案正文文件；默认在 src 里自动发现")
    ap.add_argument("--inbox", default=None,
                    help="收件箱目录；默认在 src 里自动发现，没有就跳过")
    ap.add_argument("--themes", default=None,
                    help="主题表 JSON；默认 <src>/themes.json 或工具自带的 themes.json")
    ap.add_argument("--log-section", default=DEFAULTS["log_section"],
                    help="更新日志表格所在章节标题（默认 '## 14.'，传空串跳过）")
    args = ap.parse_args(argv)

    src = os.path.abspath(args.src)
    if not os.path.isdir(src):
        sys.exit("src 不是目录：%s" % src)
    out_dir = os.path.abspath(args.out or src)
    os.makedirs(out_dir, exist_ok=True)

    archive_path = find_archive(src, args.archive)
    inbox_dir = find_inbox(src, args.inbox)
    themes_path, themes, themes_default = load_themes(src, args.themes)
    atlas = load_atlas_json(src)
    other = themes_default or atlas.get("other_theme") or DEFAULTS["other_theme"]
    theme_of = make_theme_of(themes, other)

    with io.open(archive_path, encoding="utf-8") as f:
        archive_text = f.read()

    texts = [archive_text]
    if inbox_dir:
        for fn in sorted(os.listdir(inbox_dir)):
            if fn.endswith(".md") and re.match(r"^\d{4}-\d{2}-\d{2}", fn):
                with io.open(os.path.join(inbox_dir, fn), encoding="utf-8") as f:
                    texts.append(f.read())
    year = base_year(texts)

    nodes = split_nodes(archive_text, inbox_dir, theme_of, args.log_section, year,
                        os.path.basename(archive_path))

    # 去重（同 id）
    seen, uniq = set(), []
    for n in nodes:
        if n["id"] in seen:
            continue
        seen.add(n["id"])
        uniq.append(n)
    uniq.sort(key=lambda x: (x["date"], x["time"]))

    nodes_out = os.path.join(out_dir, "nodes.json")
    edges_out = os.path.join(out_dir, "edges.json")
    with io.open(nodes_out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(uniq, f, ensure_ascii=False, indent=1)
    print("节点 %d → %s" % (len(uniq), nodes_out))

    edges = build_edges(uniq)
    with io.open(edges_out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(edges, f, ensure_ascii=False)
    print("边 %d 条（sim %d / ref %d / day %d）→ %s" % (
        len(edges),
        sum(1 for e in edges if e[2] == "sim"),
        sum(1 for e in edges if e[2] == "ref"),
        sum(1 for e in edges if e[2] == "day"),
        edges_out))

    print("档案  %s" % archive_path)
    print("收件箱 %s" % (inbox_dir or "（无）"))
    print("主题表 %s（%d 类，兜底「%s」）" % (themes_path or "（无）", len(themes), other))
    if uniq:
        print("来源 %s" % dict(Counter(n["kind"] for n in uniq)))
        print("主题 %s" % dict(Counter(n["theme"] for n in uniq).most_common()))
        print("日期 %s → %s" % (uniq[0]["date"], uniq[-1]["date"]))


if __name__ == "__main__":
    main()
