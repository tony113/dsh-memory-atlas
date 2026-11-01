# examples/demo · 假数据

这里是一份**编的**记忆档案，用来验证两个工具跑得通、看清星图长什么样。
里面的人、项目、日期全是假的，跟任何人无关。

## 跑

在仓库根目录：

```bash
python tools/build.py --src examples/demo
python tools/gen.py   --src examples/demo
```

第二条会生成 `examples/demo/index.html`，用浏览器直接打开就能看。

不需要装任何依赖，Python 3.8+ 就够（只用标准库）。

## 该看到什么

```
节点 22 → examples/demo/nodes.json
边 63 条（sim 61 / ref 1 / day 1）→ examples/demo/edges.json
档案  examples/demo/记忆档案.md
收件箱 examples/demo/记忆收件箱
主题表 examples/demo/themes.json（7 类，兜底「其他」）
来源 {'daily': 8, 'archive': 9, 'inbox': 5}
主题 {'手机': 5, '健康': 5, '关系': 4, '日常': 3, '工作': 2, '工具': 2, '其他': 1}
日期 2026-03-02 → 2026-03-20
```

三种边都出现了一条以上：相似（sim）、点名日期（ref）、同日（day）。
数字不用对上——它是从二十来条假记录里长出来的，不是固定基线。

## 它在演示什么

| 文件 | 演示的东西 |
|------|-----------|
| `记忆档案.md` | 正文：带日期的叙述段 + `## 14. 更新日志` 表格（表格一行一个节点） |
| `记忆收件箱/` | 按天追加的条目，文件名 `YYYY-MM-DD_*.md`，条目头 `## [时间] [来源] §章节 / 标题` |
| `themes.json` | **主题表可以自己换**：`<src>/themes.json` 会覆盖 `tools/themes.json` |
| `atlas.json` | 中心节点的名字与标题。不写就是「我 · 记忆星图」 |

不带 `--src` 就默认当前目录，所以也可以把自己的记忆目录直接当 src：

```bash
cd ~/memory
python /path/to/yan-memory/tools/build.py
python /path/to/yan-memory/tools/gen.py
```

`build.py` 会自动找档案（`我的记忆档案.md` / `记忆档案.md` / `memory.md` / `archive.md`，
都没有就取目录里最大的那个 `.md`）和收件箱（`记忆收件箱` / `收件箱` / `inbox`）。
找不到就明说，不会瞎猜。
