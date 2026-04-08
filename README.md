# Chronolines

多轨道历史时间线网页，支持 1700 年至今。每个国家一条轨道，涵盖中国、英国、法国、美国、俄国、德国、日本七条轨道。

**在线访问：** https://handsomevictor.github.io/chronolines

## 功能

- 七国并列时间轴，1700–2000 年
- 三级事件分级（Level 1 重大事件 / Level 2 重要事件 / Level 3 细节事件）
- 鼠标滚轮缩放、拖拽平移
- 缩放联动事件显示（>50年/格仅显示 Level 1，10-50年 Level 1+2，<10年全显）
- 事件悬停 Tooltip，点击展开详情面板
- 按 Tags 筛选（战争/条约外交/革命政变/改革运动/经济贸易/科技发明/文化思想/王朝更迭/殖民扩张）
- 事件群合并（同轨道相近事件自动聚合）

## 技术栈

- 纯静态：HTML + CSS + SVG + Vanilla JavaScript（无框架）
- 数据：YAML 源文件 → Python 编译脚本 → `js/data.json`
- 部署：GitHub Pages（main 分支根目录）

## 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/handsomevictor/chronolines.git
cd chronolines

# 2. 安装依赖
pip install pyyaml

# 3. 编译数据
python scripts/build.py

# 4. 验证数据
python scripts/validate.py

# 5. 启动本地服务器（不可直接打开 index.html 文件）
python -m http.server 8000
# 访问 http://localhost:8000
```

## 目录结构

```
chronolines/
├── index.html          # 页面入口
├── style.css           # 样式
├── CLAUDE.md           # 项目规范（给 AI agent 读）
├── README.md
├── PROGRESS.md
├── .gitignore
├── scripts/
│   ├── build.py        # YAML → data.json 编译脚本
│   └── validate.py     # 数据格式校验
├── data/
│   ├── tracks.yaml     # 轨道定义
│   ├── events/         # 各国历史事件（按时段分文件）
│   └── figures/        # 各国代表性历史人物
└── js/
    ├── data.json       # 编译产物（需提交到 git）
    ├── main.js         # 入口模块
    ├── canvas.js       # SVG 渲染引擎
    ├── layout.js       # 布局计算
    ├── controls.js     # 交互控制
    └── tooltip.js      # Tooltip 逻辑
```

## 数据修改流程

修改 `data/` 目录下的 YAML 文件后，运行：

```bash
python scripts/build.py
python scripts/validate.py
git add -A
git commit -m "data: 描述修改内容"
git push origin main
```

push 后约 1-2 分钟，GitHub Pages 自动更新。

## 数据规范

- 事件 summary 字段上限 50 字，只陈述事实，不做定性评判
- tags 只能从预设列表选取（见 CLAUDE.md）
- 争议事件只写无争议部分
