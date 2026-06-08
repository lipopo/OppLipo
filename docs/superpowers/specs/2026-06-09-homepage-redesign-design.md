# `info.opplipo.cn` 首页改版 — 设计规格

**Date**: 2026-06-09
**Status**: Approved (待用户复审)
**Owner**: lipo
**Related**:
- v1 base spec: `docs/superpowers/specs/2026-06-06-opplipo-info-design.md`
- v2 launch planning spec: `docs/superpowers/specs/2026-06-07-launch-planning-design.md`
- Skill: `.claude/skills/managing-apk-info/SKILL.md`

## 1. 目的

替换 v1+ 现有的"featured 大卡 + 主网格 + COMING SOON"三区结构，引入：
1. **推荐轮播**（多 APP 轮播、一屏一张、自动 + 手动切换）
2. **最近更新**（自动汇总所有 APP 的 `lifecycle.releases[]`、按 `releasedAt` 倒序、取前 5）
3. **COMING SOON**（保留 v2 现有行为）

把主网格砍掉——它跟轮播 + 最近更新语义重叠，留着是冗余。

## 2. 目标用户

跟 v1+ 一致：独立 Android 开发者本人 + 站点的访客（潜在用户）。首页是"门面"，3 区的目的是：
- **轮播**给"今天值得看什么"留一个口子（最多 1 张大卡 + 多张轮换）
- **最近更新**给"这里在持续迭代"的可信度信号
- **COMING SOON**给"未来在做什么"的好奇点

## 3. 站点结构变化

**新增**：无
**修改**：
- `templates/home.html` —— 完全重写（保留 header / footer，新增 3 区、删主网格）
- `assets/styles.css` —— 追加 ~120 行（轮播、recent-updates 网格、移动端 @media）
- `assets/app.js` —— 新增 `initFeaturedCarousel()`（不改现有 `initCarousels` 和 `initLightbox`）
- `build.mjs` —— `validate()` 删 `only one app can be featured` 块；`render.home` 加 1 个 `aggregateRecentReleases()` 函数 + 4 个 scope 字段
- `.claude/skills/managing-apk-info/SKILL.md` —— 更新 featured 字段说明、删"Adding a second featured"误区、加"首页三区"小节

**不变**：CNAME、.nojekyll、package.json、.github/workflows/pages.yml、apps.json schema、模板引擎

## 4. 技术架构

### 4.1 新 scope 字段（`render.home`）

```js
{
  // ... 已有 ...
  featuredApps: App[],        // apps.filter(a => a.featured)，按 apps.json 顺序
  recentReleases: RecentRelease[],  // 跨所有 APP 聚合 lifecycle.releases[]，按 releasedAt 倒序，前 5
  hasFeaturedApps: boolean,   // featuredApps.length > 0
  hasRecentReleases: boolean, // recentReleases.length > 0
}
```

`RecentRelease` shape：
```js
{
  appSlug, appName, appColor, appIcon,
  version, releasedAt, notes,
  status,        // 父 APP 的 lifecycle.status（用于角标）
}
```

### 4.2 内部函数

```js
function aggregateRecentReleases(apps, limit = 5) {
  const items = [];
  for (const app of apps) {
    const releases = app.lifecycle?.releases;
    if (!releases || releases.length === 0) continue;
    for (const r of releases) {
      items.push({
        appSlug: app.slug,
        appName: app.name,
        appColor: app.color ?? ['#94a3b8', '#94a3b8'],
        appIcon: app.icon,
        version: r.version,
        releasedAt: r.releasedAt,
        notes: r.notes ?? '',
        status: app.lifecycle?.status ?? 'launched',
      });
    }
  }
  items.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  return items.slice(0, limit);
}
```

### 4.3 模板引擎要求（已被 v1+Task 4 引擎支持）

- `{{#if X}}`（嵌套 ok）
- `{{#each X}}`（嵌套 ok）
- `{{key.path}}`（点路径）
- `{{#if X.length}}`
- `{{#unless X}}`

无需新引擎能力。

### 4.4 零新依赖

- 轮播 JS 全 vanilla ES module
- CSS 用现有 token
- 零 npm 包

## 5. 数据 schema

**不变**：`apps.json` 字段全集。**唯一改动**是 `validate()` 删 1 个校验。

`featured: true` 的语义从"最多 1 个"扩展为"任意数量"。多 APP 可同时 featured。轮播里按 `apps.json` 数组顺序。

## 6. 视觉与交互

### 6.1 首页结构（垂直堆叠）

```
[Header]
[推荐轮播]              ← 新（有 featured=true 时）
[最近更新]              ← 新（有 lifecycle.releases[] 时）
[COMING SOON]           ← 保留 v2 行为
[Footer]
```

### 6.2 推荐轮播（C 分割式）

**桌面端**（≥ 640px）：
- 一屏一张大卡：左 60% 文字（icon 48px + category 角标 + name + tagline + 主 CTA），右 40% 媒体（9:19.5 手机比例容器，内放 screenshots[0] 或 icon）
- 左右箭头按钮（玻璃感，hover 高亮）
- 底部 dots 导航（active 填充）
- 7s 自动切换
- 暂停条件：hover / focus 在轮播内 / `document.hidden === true`
- 键盘 ←/→ 在轮播 focus 时切换
- 触屏滑动（左/右 50px 阈值）
- 循环：末尾→开头
- 过渡：opacity 200ms

**移动端**（< 640px）：
- 同结构但堆叠（媒体在下、文字在上）
- 箭头隐藏（dots + swipe 足够）
- 媒体容器 max-height 缩小

**无截图回退**：
- 优先 `screenshots[0]`
- 如果 `screenshots.length === 0`，用 `icon`（方形居中）
- CSS 自动适配（`object-fit: cover` vs `object-fit: contain`）

**可达性**：
- `tabindex="0"` 让轮播可键盘聚焦
- 箭头 `aria-label="上一张"` / `aria-label="下一张"`
- dots `aria-current="page"` 标记 active

**`prefers-reduced-motion: reduce`**：
- 停掉自动切换
- 停掉过渡
- 用户仍可手动切换

### 6.3 最近更新（B 2 列网格）

**每张卡**（`<a>` 链接到 `/apps/<slug>/`）：
- 上：flex 排 icon（24px 圆角，渐变 `--c1/--c2`）+ APP 名 + version（monospace 小灰字）
- 中：notes（最多 1 行 truncate，超长显示 "..."）
- 下：releasedAt（右对齐，小灰字）

**桌面端**（≥ 640px）：2 列网格，gap 10px
**移动端**：1 列堆叠
**0 条时不渲染区块**（v2 COMING SOON 同款 `{{#if hasRecentReleases}}` 门控）
**1–4 条也展示**（不会"看起来很空"）
**5 条+ 截断到 5**

**"查看完整更新日志"链接**：v1+ 暂不渲染（YAGNI / 暂无 `/changelog/` 页面）

### 6.4 COMING SOON

完全沿用 v2 行为，不变。

### 6.5 全部为空的极端情况

如果 `apps.json` 是空数组（罕见但可能）：
- header + footer 显示
- 三个新区都不渲染（`{{#if hasX}}` 门控 false）
- "我的 APP"标题 + tagline 是唯一的页面内容

## 7. CI / 部署

Actions workflow 不变。push 到 main 后跑默认 `node build.mjs`（公开模式），不上 roadmap.html。

新增的 `initFeaturedCarousel()` JS 是公开 build 的一部分（被 `app.js` 引用），自动部署。

## 8. 工作流

5 个操作对应 5 种"动一下"：

| Op | Edit | 后续 |
|---|---|---|
| **A. 把一款 APP 加入轮播** | `apps.json` 里那一项加 `"featured": true` | 重新 build + push |
| **B. 调整轮播顺序** | 重排 `apps.json` 数组里 featured=true 那几项的顺序 | 同上 |
| **C. 从轮播移除** | 改 `featured: true` 为 `featured: false`（或删掉字段） | 同上 |
| **D. 新增 release 进"最近更新"** | 头插一条到 `lifecycle.releases[]`（v2 已有 op E） | 同上 |
| **E. 调整"最近更新"显示** | 改 `lifecycle.releases[]` 顺序、删旧 release、改 notes | 同上 |

注：A/B/C 是新增；D/E 是 v2 op E 的复用。

## 9. Skill 更新

`.claude/skills/managing-apk-info/SKILL.md` 改动：
- "Field reference" 表里 `featured` 一行说明更新
- "Common mistakes" 删"Adding a second `featured: true`"那条
- "What this skill does NOT cover" 不变
- 新增"Homepage carousel"小节（在 "Lifecycle planning" 章节后）：
  - 解释 3 个区的工作原理
  - 解释怎么 featured 一款 APP
  - 解释轮播顺序靠 `apps.json` 数组顺序

## 10. 验收标准

- [ ] 改 `_sample.featured = true` 后，首页轮播区出现且显示该 APP
- [ ] 改两款的 `featured = true` 后，轮播 7s 自动切换（手动 / dots / 箭头也切）
- [ ] 轮播卡无截图时，用 icon 替代（不破图）
- [ ] 加 1 条 `lifecycle.releases` 后，"最近更新"区出现新条目
- [ ] 加 5+ 条 release 后，"最近更新"区只显示前 5（按 releasedAt 倒序）
- [ ] "最近更新" 每张卡点击跳到对应详情页
- [ ] 移动端（< 640px）：轮播单卡全宽、swipe 工作、箭头隐藏；"最近更新" 1 列堆叠
- [ ] 桌面端 ← / → 在轮播 focus 时切换幻灯片
- [ ] `prefers-reduced-motion: reduce` 时轮播停掉自动切换
- [ ] `archived` featured APP 仍在轮播中（如果有 `featured: true`）
- [ ] 31/31 现有 tests 仍过；新功能加新 tests
- [ ] Lighthouse Performance ≥ 90（移动端）
- [ ] `git push origin main` 后 Actions 跑通，部署到 `https://info.opplipo.cn/`

## 11. 范围与未来

**v1+ 范围**（本次规格）：
- 3 区首页（轮播 / 最近更新 / COMING SOON）
- 删主网格
- featured 多 APP 允许
- 轮播 7s 自动 + dots + 箭头 + 触屏 + 键盘
- "最近更新" 前 5 条
- skill 更新

**v2+ 暂不做**（按 YAGNI）：
- 单独 `/changelog/` 页面
- "本周推荐" 时间窗口
- 按 category 过滤 / 搜索
- "复制链接到这条 release" 分享按钮
- i18n（公开 release notes 多语言）
- 暗色模式

## 12. 开放问题

1. **`recentReleases` 的 limit** → 硬编码 5，未来是否可配置？答：v1+ 不配置
2. **轮播 7s 间隔** → 硬编码，未来是否可配置？答：v1+ 不配置
3. **"查看完整更新日志"链接** → 暂不实现（YAGNI / 暂无页面）
4. **轮播 + 最近更新在同一个 featured APP 上同时显示**？答：是。合理：用户既被推送也能看到最近更新历史
5. **archived featured APP** → 仍进轮播（featured 不限制 status），不进最近更新（archived 无新发布）
6. **桌面端是否需要轮播 + 最近更新并排**？答：否。按 A 布局（垂直 3 区堆叠）
