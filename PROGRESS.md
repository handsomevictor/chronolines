# Chronolines — 进度记录

## 2026-04-09 第三次迭代：交互功能完善 + UI深度打磨

### 已完成任务

#### Task 15：Level 选择器修复
- 顶栏 L1 / L2 / L3 / 全部 按钮逻辑修正
- `App.state.userMaxLevel` 与 `Layout.getZoomMaxLevel(ppy)` 取最小值，确保手动限制生效
- 按钮激活态样式正确切换

#### Task 16：缩放边界限制
- 最小缩放：不超过全时间跨度（325年）填满视口
- 最大缩放：不超过每年 200px（约 5 年可见）
- 超出边界时 `panX` 自动修正，防止画面空白

#### Task 17：事件群自动展开
- 点击聚合气泡时自动放大至 ppy > 20，禁用聚合
- 缩放动画以点击位置为中心，保持视觉连续性

#### Task 18：Level 平滑淡入淡出
- `Layout.getEventOpacity(level, ppy)` 实现缓动：
  - L2：ppy 在 40–60 之间线性淡入
  - L3：ppy 在 10–20 之间线性淡入
- 所有事件圆点和标签同步 opacity

#### Task 19：人物泳道（Figure Swim Lanes）
- 顶栏人物分类按钮激活后在轨道内渲染生平色条
- `Layout.assignFigureLanes(figures)` 贪心算法分配不重叠泳道
- 最多 6 条泳道（`MAX_FIGURE_LANES = 6`），宽度 8px，间距 3px
- 每条泳道 hover 显示：姓名、生卒年、领域分类、简介

#### Task 20：轨道拖拽排序
- 新增 `js/drag-sort.js`（Pointer Events API，非 HTML5 DnD）
- 左侧 sidebar 每个国家卡片全高可拖拽，带六点拖拽手柄（CSS box-shadow 绘制）
- 动画：被挤开的行 `transform: translateY(±TRACK_HEIGHT)` + `200ms cubic-bezier`
- 拖拽结束后更新 `App.state.trackOrder`，持久化至 `localStorage`
- 调用 `Canvas.rebuildAfterReorder()` 重新渲染

#### Task 21：轨道默认顺序调整
- `DEFAULT_TRACK_ORDER` 改为：`['china', 'uk', 'france', 'usa', 'germany', 'russia', 'japan']`（德国与俄国互换）

#### Task 22：Sidebar 重设计——全高卡片
- sidebar-label 从 18px 小标签改为 `TRACK_HEIGHT`（160px）全高卡片
- 每张卡片左侧 3px 国家主题色竖条（CSS `::after`）
- 卡片背景带 6% 主题色透明 tint（CSS `::before`）
- 拖拽手柄：全高条形区域，CSS 六点 grip 图案
- `--track-color` CSS 自定义属性传递颜色，ghost 拖拽时继承

#### Task 23：固定 favicon
- 新增 `favicon.svg`：深色圆角背景 + 三条轨道线 + 7个彩色圆点（3种大小对应三级事件）
- `index.html` 添加 `<link rel="icon" type="image/svg+xml" href="favicon.svg">`

#### Task 24：Year Bar 设计迭代（多轮）

**轮次 1 — 在 filter 下方添加年份行**
- 新增 `.year-bar` 固定横条（32px），显示当前鼠标悬停年份 + 可见范围

**轮次 2 — 移除 SVG 浮动年份 badge，改为 DOM 元素**
- 原 SVG layer-hover 内的蓝色矩形年份 badge 移除
- 改为更新 `#year-bar-hover` span 的文字内容
- header center 新增"可见年份 1700—2025"（随 zoom/pan 更新）

**轮次 3 — Year bar 精简 + pill 随鼠标水平浮动**
- Year bar 只保留悬停年份，删除重复的"可见范围"块
- `.year-bar-hover-pill` 绝对定位，`left = rect.left + xSnap`，随鼠标 X 实时移动
- 样式：蓝色半透明背景 + 蓝色边框，与垂直跟随线顶端对齐

#### Task 25：顶部留白增大（防止事件被遮挡）
- `PAD_TOP` 从 24px 逐步增至 52px，再至 96px
- 确保最顶部轨道的事件标签不被固定顶栏遮住

#### Task 26：提示文字布局优化
- "滚轮缩放 · 拖拽平移" 从 year bar 右侧移至 header 左侧
- 紧跟副标题"1700–2025 · 多国历史时间轴"，10px 极小字，60% 不透明度，不喧宾夺主

#### Task 27：缓存刷新
- CSS/JS 引用版本号从 `?v=5` → `?v=6` → `?v=7`，强制 CDN 刷新

#### Task 28：README 专业化重写
- 新增：功能列表、技术栈表格、架构说明（渲染层级、坐标系、缩放规则）
- 新增：YAML 格式完整文档 + 自定义扩展指南（添加国家、调整时间范围、修改轨道高度）
- 新增：编辑方针说明
- 适合公开开源项目，他人可直接 fork 使用

---

## 2026-04-08 第二次迭代：大规模数据扩充 + UI全面重构

### 已完成任务

#### Task 1-7：7国历史数据大规模扩充
| 国家 | 事件数 | 人物数 |
|------|--------|--------|
| 中国 | 316 | 45 |
| 英国 | 423 | 78 |
| 法国 | 254 | 46 |
| 美国 | 259 | 43 |
| 俄国 | 260 | 45 |
| 德国 | 300 | 49 |
| 日本 | 426 | 47 |
| **合计** | **2238** | **353** |

- Level 1/2/3 三级分类完整
- 每国每时段（1700-1800/1800-1900/1900-1950/1950-2000）均覆盖
- 各国人物涵盖：政治/军事/科学/文学/音乐/艺术/经济金融/哲学思想各领域
- figures 新增 category 字段用于分类筛选

#### Task 8：统治者数据（rulers）
- 7国共 151 位统治者写入 tracks.yaml
- 含姓名、头衔、在位起止年

#### Task 9：数据编译验证
- build.py：2238 事件 / 353 人物，编译成功
- validate.py：0 errors，126 warnings（均为跨轨道引用，正常）

#### Task 10：UI对齐修复 + 碰撞检测
- 左侧 sidebar 标签改为 HTML div，与 SVG 轨道精确对齐
- 实现标签碰撞检测（greedy lane-stacking 算法，CJK字符宽度感知）
- Level 2/3 事件聚合气泡（< 8px 合并，Level 1 永不合并）
- 连接线将标签与对应圆点相连

#### Task 11：UI现代化重构
- 固定顶栏（56px）：标题 + Tag筛选 + 人物分类筛选 + 搜索框 + Zoom按钮
- 固定底部时间轴（Canvas 2D，主/次/细刻度，随 zoom 联动）
- 轨道交替背景，国家名使用主题色
- hover 高亮竖线 + 年份实时显示
- 跨国关联事件弧线（点击触发，贝塞尔曲线）
- 右侧详情面板 drawer（slide-in 动画）

#### Task 12：Ruler Bar 统治者时段条
- 每轨道顶部 8px 色条，按统治者在位时段着色
- 宽度足够时显示缩略名称
- hover tooltip：姓名、头衔、在位年份

#### Task 13：人物分类筛选
- 顶栏人物分类按钮：政治/军事/科学/文学/音乐/艺术/经济金融/哲学思想
- 激活后在轨道上渲染生平色条（6px，按 category 着色）
- hover 显示人物 tooltip

#### Task 14：Tooltip 升级
- 三段式布局：元信息行 / 标题 / 正文
- 智能边缘避让（右→左，下→上）
- 淡入动画 150ms
- 聚合气泡 tooltip、Ruler tooltip、Figure tooltip

---

## 2026-04-08 第一次迭代：项目初始化

- 创建完整目录结构和基础文件
- 7国初始数据（已在第二次迭代大幅扩充）
- 基础 SVG 时间轴渲染
- build.py + validate.py 脚本

---

## 下一步计划
- 移动端响应式适配
- 跨国事件弧线常驻显示模式
- 导出/分享功能（截图、URL 分享当前视图）
- 更多国家轨道（印度、奥斯曼帝国等）
- 事件详情多语言支持（英文版）
- 搜索功能完善（目前 UI 已有输入框，逻辑待接入）
