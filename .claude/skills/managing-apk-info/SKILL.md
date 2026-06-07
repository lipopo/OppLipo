---
name: managing-apk-info
description: Use when adding, updating, or removing an Android app entry in info.opplipo.cn's apps.json — new releases, version bumps, download-URL changes, replacing the sample placeholder, or switching which app is featured. Triggers on phrases like "add a new app", "publish a new version", "update the Play Store link", "remove the sample app", "set this as the featured app". Does NOT apply to visual design, CI workflow, or build pipeline changes.
---

# Managing APK Info in info.opplipo.cn

## What this site is

A data-driven static showcase at `https://info.opplipo.cn`. **Single source of truth**: `apps.json` (array of app objects). `build.mjs` (Node 20+, no npm deps) validates it and renders public `index.html` + per-app detail pages. A `--private` flag also writes `roadmap.html` (gitignored) for a developer-only roadmap view. GitHub Actions deploys on push to `main`.

The authoritative schema lives in `docs/superpowers/specs/2026-06-06-opplipo-info-design.md` §5 — read that for the canonical contract. **The build script is the source of truth where the spec and code disagree.**

## The 60-second workflow

1. **Edit `apps.json`** — append a new object, or modify an existing entry. Required: `slug`, `name`, `tagline`, `icon`, `platforms`. Strongly recommended: `description`, `highlights`, `color`, `category`, `version`, `releasedAt`.
2. **Add assets** under `apps/<slug>/` — `icon.{png,svg}` and `screenshots/{1,2,3,...}.{png,svg,webp}`. The build checks existence only; it does NOT check image dimensions or file content.
3. **Verify locally**:
   ```bash
   node build.mjs && npm test
   ```
   Build must print `✓ built N app page(s)`. Tests must report 14/0.
4. **Commit** with a short sentence-case subject (e.g. `Add 极简笔记 v2.3.1 as featured app`).
5. **Push**: `git push origin main`. Actions deploys in ~30s. Smoke test: `curl -sI https://info.opplipo.cn/`.
6. **Optional — view private roadmap locally**: `npm run build:private && open roadmap.html`. This file is gitignored, never deployed, only for your own eyes (NOW / PLANNED / SHIPPED + cross-app blockers/todos).

## Field reference (cheat sheet)

| Field | Type | Notes |
|---|---|---|
| `slug` | string | URL identifier. **Code regex** (authoritative): `/^[a-z0-9_][a-z0-9_-]*$/`. Use `kebab-case` for real apps; the spec accepts underscores but recommends against them. **Must be unique.** |
| `name` | string | Display name |
| `tagline` | string | One line. Shown on the homepage small card AND in the detail page hero. |
| `description` | string? | Markdown — see [Markdown limits] below. |
| `highlights` | string[]? | Bullet list on the detail page. 3-6 items. |
| `icon` | string | Path relative to repo root, e.g. `apps/minimal-notes/icon.png` |
| `screenshots` | string[]? | Paths relative to repo root. Empty = no carousel rendered. |
| `color` | [string, string]? | Two hex colors for the gradient card background. **Pick from the per-category palette below** — consistent palette across apps in the same category looks better. |
| `category` | string? | Free-form label (e.g. `工具`, `效率`, `学习`). |
| `featured` | boolean? | `true` = the big hero card on the homepage. **At most one** app at a time. |
| `platforms` | Platform[] | At least one entry. See below. |
| `version` | string? | E.g. `"2.3.1"`. Rendered as `· v2.3.1` in the hero meta. |
| `releasedAt` | string? | ISO date `"2026-06-07"`. Rendered in hero meta. |

### Platform object

| Field | Type | Notes |
|---|---|---|
| `type` | enum | One of: `android`, `ios`, `macos`, `windows`, `linux`, `web`. Adding a new type requires both a new SVG in `assets/platforms/` AND updating `PLATFORM_TYPES` in `build.mjs`. |
| `label` | string | Button text. Conventional labels below. |
| `url` | string | Full URL. |
| `primary` | boolean? | If multiple platforms, exactly one (or zero) should be `true`. The primary gets the larger button on the detail page. |

Conventional `label` values by type:
- `android` on Play Store → `"Google Play"`
- `android` direct APK → `"下载 APK"`
- `ios` → `"在 App Store 查看"`
- `web` → `"在线访问"` or `"打开网站"`

## Decisions the spec doesn't make for you

Use these defaults. Override only when the user says otherwise.

- **Featured transition**: when adding a new featured app, **demote** (set `featured: false`) the previously-featured app. Do not delete it without explicit confirmation. Even placeholder apps are user-visible on the small-card grid.
- **`_sample` placeholder**: keep it as a non-featured small card. Only remove (`rm -rf apps/_sample/` + remove from `apps.json`) when the user explicitly asks.
- **`color` per category** — no formal palette, but use these consistent pairings:
  - `工具` / `效率` (tools / productivity) → blue → cyan (`#3b82f6` → `#06b6d4`)
  - `学习` (learning) → green → teal (`#10b981` → `#14b8a6`)
  - `社交` (social) → purple → pink (`#a855f7` → `#ec4899`)
  - `娱乐` (entertainment) → orange → red (`#f97316` → `#ef4444`)
  - `系统` / utility → slate → gray (`#475569` → `#94a3b8`)
  - Default cheerful (the sample app): gold → pink (`#fbbf24` → `#f472b6`)
- **`description` content**: 2-4 short paragraphs. First paragraph = what the app does. Subsequent = what makes it different. **No marketing fluff** ("best in class", "revolutionary"). The user will replace this; keep the placeholder factual.
- **`highlights` content**: 3-6 short bullets. Each describes a concrete feature, not a vague benefit.

## Lifecycle planning

Each app can carry a `lifecycle` block (5-state status enum + optional target date + release history) and a `private` block (developer-only notes that get stripped at public build time).

### Lifecycle field cheat sheet

| Field | Type | Public? | Notes |
|---|---|---|---|
| `lifecycle.status` | `idea` \| `in-development` \| `beta` \| `launched` \| `archived` | ✅ | Absent `lifecycle` block = treated as `launched`. |
| `lifecycle.targetDate` | ISO date | ❌ (only quarter is public) | Private roadmap shows full date. |
| `lifecycle.targetQuarter` | `"Q[1-4] YYYY"` | ✅ | Auto-derived from `targetDate` at public build time. |
| `lifecycle.betaSignupUrl` | URL | ✅ | Hero CTA "加入内测" uses this when status is in-development/idea. |
| `lifecycle.releases[]` | `[{ version, releasedAt, notes? }]` | ✅ | Full history. `releases[0]` is the latest. |
| `private.notes` | string | ❌ | Free-form dev notes. |
| `private.blockers` | string[] | ❌ | Blockers across all apps show in the private roadmap. |
| `private.todo` | string[] | ❌ | Todos across all apps show in the private roadmap. |

### The 6 operations (workflow)

| Op | Edit | Notes |
|---|---|---|
| **A. Add a new idea** | New entry; `lifecycle.status: "idea"`; only `slug` + `name` + `lifecycle.status` required. Add `private.notes` describing intent. | Idea status has the minimum-field-set override — no icon/platforms/screenshots needed. |
| **B. Start dev** | Change `lifecycle.status` to `"in-development"`. Add `lifecycle.targetDate` (private). Add `private.todo` items. | |
| **C. Go to beta** | `"beta"`. Add `icon`, at least 1 `screenshots` entry, at least 1 `platforms` entry. Optionally add `lifecycle.betaSignupUrl`. | Beta apps show in the main homepage grid with a "Beta" badge. |
| **D. Ship v1.0** | `"launched"`. Set top-level `version` and `releasedAt` (kept for hero display). Insert `{ version, releasedAt, notes }` as `lifecycle.releases[0]`. | The hero shows the top-level `version`; the RELEASES section on the detail page iterates the array. |
| **E. Subsequent version** | Bump top-level `version` / `releasedAt`. Prepend new entry to `lifecycle.releases[]`. | Releases are sorted by `releasedAt` desc; new versions go to the head. |
| **F. Archive** | `"archived"`. | Hidden from main homepage grid; detail page still accessible with "已归档" badge. |

### The local private view (your roadmap)

```bash
npm run build:private    # writes roadmap.html at repo root (gitignored)
open roadmap.html        # macOS; xdg-open on Linux
```

`roadmap.html` is your full state: NOW (in-dev + beta), PLANNED (idea, sorted by targetDate), SHIPPED (launched + archived, sorted by latest release), and a cross-app summary of all blockers + todos. Public visitors never see this file — it's never deployed.

### Idea-status minimum field set

When `lifecycle.status === "idea"`, only `slug` + `name` + `lifecycle.status` are required. The `validate()` function explicitly applies this override. So an app can be added as a pure "I'll build this someday" entry with no icon or platforms.

For all other statuses (including absent `lifecycle`), the v1 required set applies: `slug` + `name` + `tagline` + `icon` + `platforms`.

## Markdown limits in `description`

The engine (`build.mjs:renderMarkdownLite`) supports only:
- `## ` headings (h2)
- Blank-line-separated paragraphs

**Not supported**: bullet lists, bold, italic, inline code, links, images, code blocks. If you need more, edit `renderMarkdownLite` first.

## Build-time checks (and what's NOT checked)

The build validates:
- Field presence (required fields are non-empty)
- Slug format and uniqueness
- At most one `featured: true`
- `platforms[].type` is in the known enum
- The `icon` and `screenshots[]` files exist on disk

The build does **NOT** check:
- File content (a 1×1 transparent PNG passes)
- Screenshot aspect ratio (spec §10 suggests 9:19.5, max edge 1080px, but it's a recommendation, not enforced)
- `icon` aspect ratio
- Whether URLs resolve
- Whether `description` text is meaningful

These are the user's responsibility.

## What "the build re-wrote only some files" means

`build.mjs:writeIfChanged` is idempotent — it only writes an output file when its content actually changes. Re-running the build on no input changes is a no-op (no git diff). This is intentional, not a bug.

A side effect: a per-app detail page only contains the fields the **detail** template reads. Changing the home-only `featured` flag does NOT regenerate the detail page (the detail page doesn't reference `featured`).

## Common mistakes

- **Adding a second `featured: true`** — build fails with `only one app can be featured, found 2`. Either demote the existing one or omit `featured` from the new one.
- **Wrong `icon` path** — build fails with `icon not found: apps/<slug>/icon.png`. The path is relative to the repo root, not to the app object.
- **Missing `apps/<slug>/` directory** — create it before running the build. The build does not create the directory for you.
- **Uppercase or spaces in `slug`** — rejected by the regex. Use `kebab-case` (`my-cool-app`).
- **Editing `apps.json` without rebuilding** — the published site is whatever was last built and committed. Edits alone don't go live.
- **Pushing to a non-`main` branch** — Actions only runs on `main`. The site won't update.
- **Adding a platform `type` without the matching SVG** — the build will pass, but the detail page will render a broken `<img>` for that download button. Add to `assets/platforms/` first.

## Things you may see in the filesystem that you should NOT touch

- **`apps/a/icon.png` and `apps/a/1.png`** — 0-byte PNG fixtures committed for `tests/build.test.mjs`. They exist because the test's `baseApp.icon` references `apps/a/icon.png` and the build's `validate()` checks file existence. **They are not in `apps.json` and the build will not include them in any rendered page.** They will, however, be served verbatim by GitHub Pages (visiting `/apps/a/icon.png` returns a 0-byte image). Harmless but messy.
  - **Don't delete them** without first updating the test to not require them, or moving the fixtures under `tests/fixtures/`.
  - **Don't add a real app with slug `a`** — the test would then have two apps with conflicting icons.
- **`apps/_sample/`** — placeholder app's icon and screenshots. Safe to leave alone unless the user asks to remove the sample entirely (see "Decisions" above).
- **`tests/build.test.mjs` and the test fixture `apps/a/`** — these are part of the v1 build, not user content. Don't edit them to "fix" validation behavior.

## What this skill does NOT cover

- Visual design changes (the C-风格 / D 布局 are baked into the templates and CSS — see spec §6)
- Adding new platform icons (requires both `assets/platforms/<type>.svg` and `PLATFORM_TYPES` in `build.mjs`)
- Frontend framework / build pipeline changes
- CI workflow changes (`.github/workflows/pages.yml`)
- Replacing the entire site
