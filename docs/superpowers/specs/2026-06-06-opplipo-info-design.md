# `info.opplipo.cn` 设计规格

**Date**: 2026-06-06
**Status**: Approved (待用户复审)
**Owner**: lipo

## 1. 目的

为独立 APP 开发者 lipo 搭建一个多 APP 介绍与下载聚合站，部署在已有的
GitHub Pages 自定义域 `https://info.opplipo.cn/`。站点内容是数据驱动的，
加一款新 APP 只需要修改一个 JSON 文件并补上图标/截图，CI 自动构建发布。

## 2. 站点定位与受众

- **内容性质**：个人作品集性质的多产品介绍页。
- **目标受众**：中文用户，独立 APP 下载者。
- **目标平台**：当前 Android 为主；架构上为多平台扩展预留。
- **更新频率**：低-中（每加一款 APP 一次发布）。

## 3. 站点结构

- **首页** (`/`)：1 张主推 APP 大卡 + 其它 APP 小卡网格。
- **APP 详情页** (`/apps/<slug>/`)：每款 APP 一份独立页面。
- **404 页** (`/404.html`)：站点根找不到资源时显示。

## 4. 技术架构

### 4.1 选型

**静态 + 小型 Node 构建脚本 + GitHub Actions**：

```
apps.json  ──build.mjs──▶  index.html
                  │  │
                  │  └──▶  apps/<slug>/index.html  (每个 slug 一份)
                  │
                  ▼
            .github/workflows/pages.yml  ──▶  GitHub Pages
```

### 4.2 仓库布局

```
/
├── CNAME                                    保留：info.opplipo.cn
├── README.md                                重写为 UTF-8（当前是 UTF-16 BOM）
├── apps.json                                ★ 数据源（日常唯一编辑点）
├── package.json                             Node 项目声明（"type": "module"）
├── build.mjs                                ★ 构建脚本，纯 Node 标准库，无第三方依赖
├── .nojekyll                                跳过 Jekyll
├── .github/
│   └── workflows/
│       └── pages.yml                        ★ CI：build → upload → deploy
├── templates/
│   ├── home.html                            首页 HTML 模板
│   └── app.html                             详情页 HTML 模板
├── assets/
│   ├── styles.css                           共享样式（C 风格 + 玻璃感）
│   ├── app.js                               截图轮播、弹层、IntersectionObserver 等
│   └── platforms/                           平台 logo SVG
│       ├── android.svg
│       ├── ios.svg
│       ├── macos.svg
│       ├── windows.svg
│       ├── linux.svg
│       └── web.svg
└── apps/                                    每款 APP 的资源
    └── <slug>/
        ├── icon.png
        └── screenshots/
            ├── 1.png
            ├── 2.png
            └── ...
```

### 4.3 依赖

- **运行时**（构建产物）：无第三方依赖，仅浏览器原生 API。
- **构建时**：`build.mjs` 走 Node 18+ 标准库（`fs/promises`、`path`），不安装
  npm 包。`package.json` 仅用于声明 `"type": "module"`。
- **CI**：`actions/checkout@v6` + `actions/setup-node@v4`（`node-version: '20'`）
  + `actions/configure-pages@v5` + `actions/upload-pages-artifact@v4` +
  `actions/deploy-pages@v4`。

## 5. 数据 schema (`apps.json`)

### 5.1 APP 对象

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `slug` | ✅ | string | URL 标识；小写字母+数字+连字符；全局唯一 |
| `name` | ✅ | string | 显示名 |
| `tagline` | ✅ | string | 一句话简介（首页小卡用） |
| `description` | ❌ | string | 详情页长描述，支持 markdown |
| `highlights` | ❌ | string[] | 详情页 bullet 列表 |
| `icon` | ✅ | string | 相对路径（如 `apps/<slug>/icon.png`） |
| `screenshots` | ❌ | string[] | 相对路径数组；空则不渲染轮播 |
| `color` | ❌ | [string, string] | 渐变双色 hex，如 `["#fbbf24", "#f472b6"]`；缺省走站点默认 |
| `category` | ❌ | string | 分类标签，纯展示 |
| `featured` | ❌ | boolean | `true` 的成为首页大卡；全数组**至多 1 个** |
| `platforms` | ✅ | Platform[] | 下载入口（至少 1 项） |
| `version` | ❌ | string | 当前版本号 |
| `releasedAt` | ❌ | string (ISO date) | 版本发布日期 |

### 5.2 Platform 对象

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `type` | ✅ | enum | `android` \| `ios` \| `macos` \| `windows` \| `linux` \| `web` |
| `label` | ✅ | string | 按钮文字，如 "Google Play"、"下载 APK" |
| `url` | ✅ | string | 站内或外站链接 |
| `primary` | ❌ | boolean | 多平台时，`primary: true` 的按钮高亮 |

### 5.3 `build.mjs` 启动校验（不通过则 exit 1）

1. `slug` 全局唯一。
2. 每个 `icon` 路径对应真实存在的文件。
3. 每个 `screenshots[i]` 路径对应真实存在的文件。
4. `featured: true` 至多出现 1 次。
5. 每个 APP 的 `name`、`tagline`、`icon`、`platforms` 都不为空。
6. 每个 `platforms[i].type` 在已知枚举内。
7. 至少存在 1 个 APP。

## 6. 视觉与交互

### 6.1 风格基调：C · 渐变彩色 + 玻璃感

- 配色：浅色基底，APP 卡片采用柔和渐变（`#fef3c7` / `#fce7f3` / `#dbeafe`
  等）和半透明白底（`rgba(255,255,255,0.6~0.8)` + `backdrop-filter: blur`）。
- 圆角：18–20px。
- 字体：`system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`，
  不引外部字体。
- 暗色模式：v1 不实现（YAGNI）；所有颜色走 CSS 变量便于未来扩展。

### 6.2 首页布局：D · 主推大卡 + 其他小卡

- 第一块：featured APP 的大卡（hero 形态：左图标 + 右标题/副标题/下载 CTA）。
- 第二块：其它 APP 的小卡网格。
  - 桌面 (≥ 1024px)：3 列。
  - 平板 (640–1023px)：2 列。
  - 移动 (< 640px)：1 列。
- 小卡只显示：图标、name、tagline、category。点击进入详情页。

### 6.3 详情页布局

自上而下 5 块：

1. **Hero**：渐变背景 + 大图标 + 名称 + 版本/日期 + 主下载按钮（`primary: true`
   的 platform）。
2. **FEATURES**：`highlights` 渲染为 bullet 列表。
3. **ABOUT**：`description` 渲染为 markdown。
4. **SCREENSHOTS**：`screenshots` 渲染为横向滚动画廊，CSS `scroll-snap`；
   点击用原生 `<dialog>` 弹层放大。
5. **OTHER DOWNLOADS**：非 primary 的 platform 项作为备选下载入口。

### 6.4 响应式

- 单一断点策略：`@media (max-width: 640px)` 退化。
- Hero 在移动端 padding 收紧、按钮 100% 宽。
- 截图卡固定 9:19.5 比例，宽度自适应。

### 6.5 性能 & SEO

- 截图使用现代格式（PNG / WebP，PNG 是最低要求）。
- 详情页 `<head>` 含：
  - `<title>` = `name` + " | info.opplipo.cn"
  - `<meta name="description">` = `tagline`
  - Open Graph (`og:title` / `og:description` / `og:image` / `og:type=website`)
  - `og:image` 优先取 `screenshots[0]`
  - `<link rel="canonical">` 指向当前 canonical URL
- 不引第三方 analytics、不引 Google Fonts。
- 构建产物目标：CSS/JS 合计未压缩 < 30KB；不含截图整站 < 200KB。

### 6.6 可访问性

- 所有图片有 `alt`（alt 取 `name`）。
- 按钮使用 `<button>` 或 `<a>`，不点 div。
- 弹层 `<dialog>` 用原生 + `aria-label`。
- 文字与背景对比度满足 WCAG AA。

## 7. CI / 部署

### 7.1 Workflow：`.github/workflows/pages.yml`

- **Trigger**：`push` 到 `main`；以及 `workflow_dispatch` 手动触发。
- **Permissions**：`pages: write`、`id-token: write`、`contents: read`。
- **Concurrency**：`group: pages`、`cancel-in-progress: false`（避免并发部署）。
- **Job**：
  1. checkout
  2. setup-node (20.x)
  3. `node build.mjs` （生成 `index.html` 和 `apps/<slug>/index.html`）
  4. `actions/configure-pages@v5`
  5. `actions/upload-pages-artifact@v4`（path: 仓库根）
  6. `actions/deploy-pages@v4`（环境 `github-pages`）

### 7.2 部署产物

- 仓库根就是发布根（`CNAME` 在根）。
- `build.mjs` 不动 `CNAME`、`apps/`、`assets/`、`templates/`、`apps.json`、
  `package.json` 等源文件；只生成 `index.html` 和 `apps/<slug>/index.html`。
- 注意：`build.mjs` 不修改 `CNAME`，避免 SSG 强推覆盖 CNAME 文件的踩坑。

## 8. 加新 APP 的工作流

1. 在 `apps.json` 数组里追加一段对象。
2. 创建 `apps/<slug>/` 目录，放入 `icon.png` 和 `screenshots/*.png`。
3. `git add . && git commit -m "Add <name>" && git push origin main`。
4. Actions 自动 build & deploy，几分钟后上线。

## 9. 未来考虑（非 v1 范围）

- 多 featured APP 优先级（把 `featured` 改为 number priority）。
- 暗色模式（`prefers-color-scheme`）。
- i18n（每 APP 自己的多语言描述）。
- 访客统计（自建、无第三方）。
- 文章/博客（与 APP 平级的内容类型，复用同一数据模式）。
- 用户搜索/筛选（如果 APP 数量超过 15）。
- RSS feed / JSON Feed。

## 10. 开放问题（待实施时确认）

- **截图格式与尺寸**：未在规格里硬性规定；建议 9:19.5 比例、最长边 1080px，
  优先 WebP，缺图则 PNG。
- **404 页内容**：v1 提供极简单页（站点名 + 返回首页链接），不强制。
- **README.md 重写时机**：v1 实施时一并把 UTF-16 BOM 改成 UTF-8，简要写明
  "这是 `info.opplipo.cn` 的源码仓，新增 APP 请参考 docs/..."。
- **构建是否需要 `npm install` 步骤**：因为 `build.mjs` 走标准库，理论上
  workflow 里 `npm ci` 可省；为未来灵活性保留 `package.json` 但不安装。

## 11. 验收标准

v1 完成的定义：

- [ ] 站点部署到 `https://info.opplipo.cn/` 且 HTTPS 正常。
- [ ] 至少 1 款 APP 数据 + 图标 + 1 张截图就完整可访问。
- [ ] `apps.json` 校验：故意写错 slug/路径会被构建拒绝。
- [ ] 移动端 (≤ 640px) 视觉无破损。
- [ ] Lighthouse 移动端分数 ≥ 90（Performance / Accessibility / Best Practices /
      SEO 各项）。
- [ ] 加一款新 APP 全流程 ≤ 5 分钟（含 push 等 CI 完成）。
