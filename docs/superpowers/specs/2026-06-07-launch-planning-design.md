# `info.opplipo.cn` 启动规划能力 — 设计规格

**Date**: 2026-06-07
**Status**: Approved (待用户复审)
**Owner**: lipo
**Related**:
- v1 base spec: `docs/superpowers/specs/2026-06-06-opplipo-info-design.md`
- v1 base plan (implemented): `docs/superpowers/plans/2026-06-07-info-opplipo-cn-v1.md`
- Skill: `.claude/skills/managing-apk-info/SKILL.md`

## 1. 目的

为 v1 已上线的 `https://info.opplipo.cn` 增加**"启动规划"能力**：让独立 APP 开发者既能在站点上向访客**展示 APP 生命周期（即将上线 / Beta / 已上线 / 归档）**，又能**私下记录自己的开发进度、计划、阻塞、私人笔记**——共享同一份 `apps.json` 数据源，公开输出和私有输出由 build 脚本分流。

## 2. 目标用户

- **公开访客**：访问 `https://info.opplipo.cn` 的潜在用户。想知道"现在能用哪些"、"接下来要发什么"、"最近更新了啥"。
- **开发者本人**（lipo）：本地查看"我现在该推进哪个"、"哪些被卡住"、"完整发布历史"。

## 3. 站点结构变化

**新增**：
- `roadmap.html`（仓库根，gitignored，仅本地 build 输出）

**修改**：
- `apps.json` 字段扩展（不破坏现有 schema）
- `templates/home.html`：新增 "COMING SOON" 区块 + 状态徽章
- `templates/app.html`：新增 "RELEASES" 区块 + 状态徽章
- `templates/roadmap.html`（新文件，私有模板）
- `assets/styles.css`：状态徽章 / COMING SOON / RELEASES 区块的样式
- `build.mjs`：数据清洗（剔除 private 块）、双输出、`render.roadmap`、新校验
- `package.json`：`build:private` 脚本
- `.gitignore`：`roadmap.html` 条目
- `.claude/skills/managing-apk-info/SKILL.md`：扩展 "Lifecycle planning" 章节

**不变**：
- 公开 build 部署流程（Actions 跑默认 `node build.mjs`）
- `CNAME`、`.nojekyll`、`index.html` 的发布根
- 顶层 `version` / `releasedAt` 字段（保留向后兼容）

## 4. 技术架构

### 4.1 双输出流程

```
apps.json (含 private.*)
  │
  ├── build.mjs (默认模式 = 公开)
  │     │
  │     ├── 公开 build: 剔除 private 块 → index.html + apps/*/index.html → 部署到 Pages
  │     └── roadmap.html: 不生成
  │
  └── build.mjs --private (私有模式)
        │
        ├── 公开输出: 同上
        └── 私有输出: roadmap.html (gitignored)
```

### 4.2 公开 build 的数据清洗

`build.mjs` 在写文件前对每个 app 做一次 `omitPrivate(app)`：
- 移除 `app.private` 整个子对象
- 移除 `app.lifecycle.targetDate`（精确日期是私有的；公开仅显示季度，从 `targetDate` 推导）
- 保留 `lifecycle.status`、`lifecycle.releases[]`（含 `notes`，因为 release notes 是公开内容）
- 其他字段原样保留

私有 build 不做清洗，原始数据全量进入 `roadmap.html`。

### 4.3 渲染入口分流

`build.mjs` 入口检测：
```javascript
const isPrivate = process.argv.includes('--private');
```

`main()` 流程：
1. 读 `apps.json` → 校验
2. 始终生成公开 `index.html` + `apps/*/index.html`（基于 `omitPrivate` 后的数据）
3. 若 `isPrivate`：额外生成 `roadmap.html`（基于原始数据，全量）

`render.home(apps)` 和 `render.app(app)` 接受的 apps/app 已经是 `omitPrivate` 清洗后的（公开 build 的数据源）。私有 `render.roadmap(apps)` 接受原始数据。

### 4.4 不引入新依赖

- 季度从日期推导的逻辑内联在 `build.mjs`（约 10 行）
- `roadmap.html` 用现有模板引擎 + 单文件 CSS 扩展
- `omitPrivate` 是纯函数，~20 行

## 5. 数据 schema

### 5.1 APP 对象扩展

保留 v1 所有字段（向后兼容）。新增 2 个可选顶层字段：

```json
{
  "slug": "minimal-notes",
  "name": "极简笔记",
  "tagline": "...",
  "icon": "apps/minimal-notes/icon.png",
  "platforms": [...],
  "version": "2.3.1",
  "releasedAt": "2026-04-15",
  "description": "...",
  "highlights": [...],
  "color": ["#3b82f6", "#06b6d4"],
  "category": "工具",

  "lifecycle": {
    "status": "launched",
    "targetDate": "2026-08-15",
    "releases": [
      { "version": "2.3.1", "releasedAt": "2026-04-15", "notes": "性能优化 + 修 bug" },
      { "version": "2.2.0", "releasedAt": "2026-01-10", "notes": "新增夜间模式" }
    ]
  },

  "private": {
    "notes": "内部：v3 正在重写存储层",
    "blockers": ["等 Play Store 审核"],
    "todo": ["加平板布局", "测 Android 14"]
  }
}
```

### 5.2 字段详细定义

| 字段 | 必填 | 类型 | 公开可见？ | 说明 |
|---|---|---|---|---|
| `lifecycle` | 否 | object | 部分 | 生命周期容器。缺失时按 `status: launched` 推断。 |
| `lifecycle.status` | lifecycle 存在时必填 | enum: `idea` \| `in-development` \| `beta` \| `launched` \| `archived` | ✅ | APP 当前状态。 |
| `lifecycle.targetDate` | 否 | ISO date string | ❌（仅季度公开） | 计划上线日期。私有 build 显示完整日期，公开 build 推导为 `YYYY Q[1-4]` 字符串。 |
| `lifecycle.betaSignupUrl` | 否 | string (URL) | ✅ | 内测/尝鲜申请链接。在 hero 主按钮位置渲染为 "加入内测" 按钮。适用于 `status: in-development` / `idea` / `beta`。 |
| `lifecycle.releases` | 否 | Release[] | ✅ | 完整发布历史，按 `releasedAt` 倒序。`releases[0]` 应当 = 顶层 `version` + `releasedAt`（最新版本）。 |
| `lifecycle.releases[].version` | 必填 | string | ✅ | 版本号字符串。 |
| `lifecycle.releases[].releasedAt` | 必填 | ISO date string | ✅ | 发布日期。 |
| `lifecycle.releases[].notes` | 否 | string | ✅ | Release notes，公开给访客看。Markdown 子集生效。 |
| `private` | 否 | object | ❌（整块剔除） | 私有笔记容器。子字段自由（`notes` / `blockers` / `todo` / 任意 key）。 |
| `private.notes` | 否 | string | ❌ | 自由文本，开发者私记。 |
| `private.blockers` | 否 | string[] | ❌ | 阻塞事项列表。 |
| `private.todo` | 否 | string[] | ❌ | 待办列表。 |

### 5.3 `validate()` 新增校验

- `lifecycle.status`（如果 `lifecycle` 存在）必须是 5 个枚举值之一
- `lifecycle.targetDate`（如果存在）必须是合法 ISO date（用 `Date.parse` 或正则）
- `lifecycle.releases[].version` 必填字符串
- `lifecycle.releases[].releasedAt` 必填合法日期

### 5.4 `status: "idea"` 字段特赦

`validate()` 对 `status: "idea"` 的 APP 应用最小必填集：
- `slug`（必填）
- `name`（必填）
- `lifecycle.status`（必填，且 == `"idea"`）
- 其他字段（`tagline` / `icon` / `platforms` / `description` / `highlights`）在 idea 状态下**允许缺失**

理由：idea 阶段的 APP 还没开发完成，没有 icon/screenshots/平台是合理的。

其他所有 status（`in-development` / `beta` / `launched` / `archived`）继续应用 v1 必填集：`slug` / `name` / `tagline` / `icon` / `platforms`。

## 6. 视觉与交互

### 6.1 公开首页（`templates/home.html`）

**保留 v1**：featured big card + 小卡 grid（继续只渲染 `status: "launched"` 和 `status: "beta"` 的 APP）。

**新增 "COMING SOON" 区块**（仅当存在 `status: "in-development"` 或 `status: "idea"` 的 APP 时渲染）：
- 位置：grid 下方
- 标题："即将上线"（`COMING SOON` 小 label 风格，沿用 v1 的 `.block__label` 模式）
- 内容：每款 APP 一张小卡：图标（若缺失显示占位）+ 名称 + 目标季度（`Q3 2026`）+ tagline
- 链接：详情页（即使未上线也渲染）

**状态徽章**（在 card 的 category 旁）：
- `beta` → 橙色 "Beta" 角标
- 其他公开可见的状态（`launched`）→ 不显示徽章

### 6.2 公开详情页（`templates/app.html`）

**保留 v1 5 块**：hero / FEATURES / ABOUT / SCREENSHOTS / OTHER DOWNLOADS

**新增 "RELEASES" 区块**（仅当 `lifecycle.releases.length > 0` 时渲染）：
- 位置：FEATURES 之后、ABOUT 之前
- 标题："更新日志"（`RELEASES` 小 label 风格）
- 内容：每条发布一行：版本号（加粗）+ 日期 + notes（Markdown 子集）

**Hero 状态徽章**（在 `hero__meta` 中，与 `category`/`version`/`releasedAt` 同列）：
- `beta` → "Beta" 角标
- `in-development` / `idea` → "In development" 角标
- `launched` → 不显示
- `archived` → "已归档" 角标

**Hero 主下载按钮**：
- `beta`：保持"主下载按钮"（指向 `primaryPlatform.url`）
- `launched`：保持"主下载按钮"
- `in-development` / `idea`：如果存在 `lifecycle.betaSignupUrl`，显示 "加入内测" CTA；否则 hero 隐藏主下载按钮
- `archived`：主按钮改为 "查看历史"（无操作）或者直接隐藏

### 6.3 私有 roadmap（`templates/roadmap.html`）

**风格**：极简自用报告——白底、系统字体、无 C-风格装饰、`<style>` 内联在 `<head>`。

**5 段结构**（某段无内容则省略）：

1. **顶部摘要**：
   - "Roadmap · {今日 ISO 日期}"
   - 状态计数：`计划中 {N} · Beta {N} · 已上线 {N} · 归档 {N}`
   - 下一个 target date 预告（如有）

2. **NOW**（`status: in-development` 或 `beta`）：
   - 每款 APP 一段：状态色块 + 名称 + 当前版本 + target 日期 + `private.notes` 全文 + `private.blockers`（如有）+ `private.todo`（如有）

3. **PLANNED**（`status: idea`，按 `lifecycle.targetDate` 升序，无 targetDate 排最后）：
   - 紧凑格式：状态色块 + 名称 + target 日期 + tagline（如有）+ `private.notes`（如有）

4. **SHIPPED**（`status: launched` + `archived`，按 `lifecycle.releases[0].releasedAt` 倒序）：
   - 每款 APP：名称 + 当前版本 + 上线日期 + release notes 最近 3 条

5. **跨 APP 汇总**：
   - **所有 blockers**：从所有 APP 的 `private.blockers` 收集，每条标 `[{app.name}] {blocker}`
   - **所有 todos**：从所有 APP 的 `private.todo` 收集，每条标 `[{app.name}] {todo}`

**导航**：
- 顶部 "← back to data" 链接：`apps.json`（`file://` 或相对路径，编辑器里打开）
- 顶部 "Last updated" 显示今日日期

## 7. CI / 部署

**Actions workflow 不变**：
- 触发：push to main / workflow_dispatch
- Build：`node build.mjs`（默认公开模式）
- Deploy：上传 artifact 到 Pages

**`roadmap.html` 永远不进部署**：
- 不在 Actions 跑（默认 mode 不生成）
- 即便本地误生成，也在 `.gitignore` 里被 `roadmap.html` 排除

**`package.json` 新增脚本**：
```json
{
  "scripts": {
    "build": "node build.mjs",
    "build:private": "node build.mjs --private",
    "test": "node --test tests/",
    "serve": "python3 -m http.server 4000"
  }
}
```

**`.gitignore` 新增**：
```
roadmap.html
```

## 8. 工作流

5 个日常操作（developer 视角）：

| 操作 | 改什么 | 后续 |
|---|---|---|
| **A. 加新 idea** | 新增条目，`status: "idea"`，只填 `slug` + `name` + `lifecycle.status`，加 `private.notes` 描述想做什么 | build+test+commit+push |
| **B. 启动开发** | `status: "in-development"`，加 `lifecycle.targetDate`，加 `private.todo` | 同上 |
| **C. 进 Beta** | `status: "beta"`，补 `icon` + 至少 1 张 `screenshots` + 至少 1 个 `platforms`，可加 `lifecycle.betaSignupUrl` | 同上 |
| **D. 发布 v1.0** | `status: "launched"`，填顶层 `version` + `releasedAt`，在 `lifecycle.releases[]` 头插入 v1.0 条目 | 同上 |
| **E. 后续版本** | 顶层 `version`/`releasedAt` 更新；`lifecycle.releases[]` 头插新条目 | 同上 |
| **F. 归档** | `status: "archived"` | 同上 |

**回顾"接下来干啥"**：
```bash
npm run build:private && open roadmap.html   # macOS
npm run build:private && xdg-open roadmap.html  # Linux
```

## 9. Skill 更新

`.claude/skills/managing-apk-info/SKILL.md` 扩展：
- 新增 "Lifecycle planning" 章节：讲 A-F 6 种操作 + 字段含义
- 在"60-second workflow"加 `npm run build:private` 用法
- 顶部 cheat sheet 表格加 `lifecycle.*` 和 `private.*` 字段

## 10. 验收标准

- [ ] `apps.json` 中加入 `lifecycle.status: "idea"` 的 APP，build 通过（idea 特赦生效）
- [ ] `apps.json` 中加入 `lifecycle.status: "launched"` + `lifecycle.releases[]` 的 APP，公开首页显示该 APP，详情页 RELEASES 区块按倒序列出
- [ ] `apps.json` 中加入 `lifecycle.status: "in-development"` + `lifecycle.targetDate` 的 APP，公开首页"COMING SOON"区块显示季度（如 `Q3 2026`）而非精确日期
- [ ] 公开 `index.html` 和 `apps/*/index.html` 中**没有任何 `private.*` 字段值**（`grep -r "private" apps/` 应该 0 命中）
- [ ] 公开 build 后 `roadmap.html` 不存在（默认 mode 不生成）
- [ ] `npm run build:private` 后 `roadmap.html` 存在，包含 5 段（NOW / PLANNED / SHIPPED / 汇总），**未**被 git tracked
- [ ] 14/14 现有 tests 仍通过；新功能加新 tests
- [ ] `git push origin main` 后 Actions 跑通，部署到 `https://info.opplipo.cn/`，新首页带"COMING SOON"区块
- [ ] `.claude/skills/managing-apk-info/SKILL.md` 包含 Lifecycle planning 章节
- [ ] 顶部 ROADMAP（roadmap.html）生成后无 `{{...}}` 占位符残留

## 11. 范围与未来

**v1+ 范围**（本次规格）：
- 双视图（公开 + 私有）launch planning
- 5 状态 enum（idea/in-development/beta/launched/archived）
- Release history（`lifecycle.releases[]`）
- 公开 COMING SOON 区块 + 详情页 RELEASES 区块
- 私有 roadmap.html 报告

**v2+ 暂不做**（按 YAGNI）：
- i18n（公开 release notes 多语言）
- 自动化发布工作流（CI 监听 git tag 自动生成 release 条目）
- 公开 changelog 聚合页（/changelog）
- Roadmap 订阅（RSS / email）
- 拖拽式时间线（roadmap.html 当前是文字列表；不动）

## 12. 开放问题

1. **`archived` APP 详情页**：仍可访问 + "已归档"徽章？还是 404？倾向：仍可访问（外部链接能进），hero 角标显式标注。
2. **顶层 `version` 与 `lifecycle.releases[0]` 不一致时**：build 报错 vs 警告 vs 静默用前者？倾向：build 警告（`console.warn`，不阻塞），信息给开发者，模板渲染以 `lifecycle.releases[0]` 为准。
3. **公开 release notes 长度上限**：无限 vs 截断？倾向：无限（开发者自己控）。
4. **`lifecycle.betaSignupUrl` vs `private.betaSignupUrl`**：v0.1 设计是后者，但访客点"加入内测"是公开行为，应该在公开字段。已在 v1 设计文档里修正为前者。
5. **空 `lifecycle.releases[]` 时 RELEASES 区块**：不渲染（条件 `{{#if lifecycle.releases.length}}`）。确认。
