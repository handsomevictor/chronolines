# Chronolines — Project Master Guide

## 项目简介
多轨道历史时间线网页，支持 1700 年至今。每个国家一条轨道，事件分三级，支持 Zoom/Pan、Tag 筛选、人物关联、跨轨道事件弧线。纯静态页面（HTML + SVG + JS），YAML 数据源 + Python 编译脚本。

**GitHub**: https://github.com/handsomevictor/chronolines  
**部署**: GitHub Pages（静态）

---

## 技术栈
- 前端：原生 HTML / CSS / SVG / Vanilla JS（无框架）
- 数据：YAML（源文件）→ `python scripts/build.py` → `js/data.json`（前端读取）
- 构建：Python 3.13+，依赖 `pyyaml`
- 版本控制：Git + GitHub

---

## 目录结构
```
chronolines/
├── index.html
├── style.css
├── CLAUDE.md
├── README.md
├── PROGRESS.md
├── .gitignore
├── scripts/
│   ├── build.py          # YAML → data.json 编译脚本
│   └── validate.py       # 数据格式校验脚本
├── data/
│   ├── tracks.yaml
│   ├── events/
│   │   ├── china/
│   │   │   ├── 1700-1800.yaml
│   │   │   ├── 1800-1900.yaml
│   │   │   ├── 1900-1950.yaml
│   │   │   └── 1950-2000.yaml
│   │   ├── uk/
│   │   ├── france/
│   │   ├── usa/
│   │   ├── russia/
│   │   ├── germany/
│   │   └── japan/
│   └── figures/
│       ├── china.yaml
│       ├── uk.yaml
│       ├── france.yaml
│       ├── usa.yaml
│       ├── russia.yaml
│       ├── germany.yaml
│       └── japan.yaml
└── js/
    ├── data.json         # 编译产物，不手动编辑
    ├── main.js
    ├── canvas.js
    ├── layout.js
    ├── controls.js
    └── tooltip.js
```

---

## Git 工作流（每次任务完成后必须执行）

### 配置 remote（首次或重置时）
```bash
git remote set-url origin https://${GITHUB_TOKEN_HISTORY_WEBSITE}@github.com/handsomevictor/chronolines.git
```

### 每次任务完成后的标准流程
```bash
git add -A
git commit -m "<type>: <简短描述>"
git push origin main
```

commit 类型约定：
- `feat`: 新功能
- `data`: 添加/修改历史数据
- `fix`: bug 修复
- `style`: 视觉样式调整
- `docs`: README / PROGRESS.md 更新
- `build`: 构建脚本修改

**这一步不可跳过。doc-agent 在更新完 PROGRESS.md 后负责触发 commit + push。**

### 开始任何开发任务前，必须先测试 git 权限
```bash
git remote set-url origin https://${GITHUB_TOKEN_HISTORY_WEBSITE}@github.com/handsomevictor/chronolines.git
git push origin main --dry-run
```
看到 `Everything up-to-date` 或无报错即为通过，再开始正式开发。

---

## 历史数据写作原则（data-agent 必须严格遵守）

1. **只陈述事实，不做定性评判**
   - ✅ "1840年英国对华宣战，清军战败，签订《南京条约》"
   - ❌ "英国侵略中国" / "英国打开了中国大门"

2. **争议事件只写无争议部分**
   - 数字有争议的（如伤亡人数），写"各方记载存在差异"
   - 起因有争议的，呈现多方说法，不作裁判

3. **避免单一叙事中心**
   - 同一事件涉及多国时，summary 不以任何单方视角为主

4. **人物描述不做道德评判**
   - ✅ "林则徐主导虎门销烟，触发鸦片战争"
   - ❌ "林则徐是民族英雄"

5. **summary 字段上限 50 字**，只陈述最核心的事实

---

## YAML 数据格式规范

### events YAML
```yaml
- id: opium_war_1          # 全局唯一，snake_case
  year: 1840               # 开始年份，必填
  endYear: 1842            # 结束年份，可选（持续性事件）
  level: 1                 # 1/2/3，必填
  title: 第一次鸦片战争      # 必填
  summary: 英国对华宣战，清军战败，签订《南京条约》割让香港岛   # 必填，≤50字
  detail: |                # 可选，长文
    ...
  tags: [战争, 外交, 贸易]   # 从预设列表选取
  related: [uk_industrial_peak, treaty_nanking]  # 关联事件 id
  figures: [linzexu, daoguang]                   # 关联人物 id
```

### 预设 tags（只能从这里选）
战争 / 条约外交 / 革命政变 / 改革运动 / 经济贸易 / 科技发明 / 文化思想 / 王朝更迭 / 殖民扩张 / 人物

### figures YAML
```yaml
- id: linzexu
  name: 林则徐
  birthYear: 1785
  deathYear: 1850
  level: 2
  summary: 主导虎门销烟，是清末最早主张了解西方的官员之一
  events: [opium_war_1, canton_system]
```

---

## 视觉风格规范（ux-agent / frontend-agent 遵守）
- 背景：深灰 `#1a1a2e`，非纯黑
- 字体：标题衬线体，正文无衬线体
- 国家颜色：中等饱和度，避免荧光
- Level 1 事件：圆点直径 12px，标题 14px bold
- Level 2 事件：圆点直径 8px，标题 12px
- Level 3 事件：圆点直径 5px，标题 11px
- 所有交互动画 transition duration：150-250ms
- 参考风格：NYT / Guardian 数据新闻，克制不花哨

---

## Zoom 级别与事件显示规则
| 每格年数 | 显示级别 |
|---|---|
| > 50 年 | Level 1 only |
| 10–50 年 | Level 1 + 2 |
| < 10 年 | 全部三级 |

事件群合并规则：同轨道内相距 < 5px 的同级事件合并为气泡，显示事件数量，Level 1 永不合并。

---

## Agent 分工速查
| Agent | 负责范围 |
|---|---|
| orchestrator | 任务拆解、调度、合并结果、强制触发 doc-agent |
| data-agent | `data/` 目录所有 YAML 文件，运行 build.py 和 validate.py |
| frontend-agent | `js/`、`index.html`、`style.css`，只读 `js/data.json` |
| ux-agent | 视觉细节、动画、响应式 |
| doc-agent | `README.md`、`PROGRESS.md`，每次必须 commit + push |
| test-agent | 代码 review + 浏览器验证，向 orchestrator 报告 |

---

## GitHub Pages 部署说明

**无需任何额外配置**，repo 已开启 Pages（从 main branch 根目录部署）。

规则：
- `index.html` 必须在 repo **根目录**，这是 Pages 的入口
- `js/data.json` 是编译产物，但**必须 commit 进 repo**，Pages 没有构建环境，无法在云端跑 build.py
- 因此 `.gitignore` 里**不得**忽略 `js/data.json`

每次 CC 修改数据后的标准流程：
```bash
python scripts/build.py       # 编译 YAML → js/data.json
python scripts/validate.py    # 校验
git add -A                    # 包含 js/data.json 一起提交
git commit -m "data: ..."
git push origin main
```

push 后约 1-2 分钟，`https://handsomevictor.github.io/chronolines` 自动更新，无需手动触发。
