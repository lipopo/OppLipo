# Launch Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `info.opplipo.cn` with a launch-planning capability — apps get a lifecycle status (idea/in-development/beta/launched/archived), a release history, and a public/private dual view: visitors see status badges + a COMING SOON section + per-app release history; the developer gets a local `roadmap.html` (gitignored) with full private notes, blockers, todos, and timelines.

**Architecture:** Single source of truth `apps.json` gets two new optional top-level fields (`lifecycle` and `private`). `build.mjs` defaults to public-only output (deployable). A `--private` flag also writes `roadmap.html` (gitignored, never deployed). The two views share data; private fields are stripped at public-build time. No npm dependencies added.

**Tech Stack:** Node 20+ standard library only, plain HTML/CSS, vanilla ES modules, GitHub Pages Actions. Same as v1.

**Spec:** `docs/superpowers/specs/2026-06-07-launch-planning-design.md`
**Skill (will be updated in Task 9):** `.claude/skills/managing-apk-info/SKILL.md`

---

## Conventions carried from v1

- **Slug regex (authoritative from v1 fix):** `/^[a-z0-9_][a-z0-9_-]*$/` (accepts underscores; kebab-case for new apps).
- **Entry-point guard:** `node build.mjs` is the CLI; tests import the module without running it.
- **Template engine:** `{{key}}` (escaped), `{{{key}}}` (raw), `{{key.path}}` (dotted), `{{#each array}}...{{/each}}`, `{{#if expr}}...{{/if}}` (where `expr` can be `key`, `key.field`, or `key.length`). No bracket-notation array access — use pre-computed fields if needed.
- **Public writes (index.html, apps/*/index.html):** idempotent via `writeIfChanged`.
- **Commit style:** short, sentence-case subjects. No conventional-commit prefixes. No `Co-Authored-By`.
- **No `CLAUDE.md` in any commit** (still untracked at repo root; user handles separately).

---

## Task 1: Extend `validate()` with lifecycle + private rules (TDD)

**Files:**
- Modify: `tests/build.test.mjs` (add new tests after the existing 14)
- Modify: `build.mjs` (extend `validate()` and add new `validatePrivate*` style logic)

The current `validate()` enforces 5 required fields (`slug`, `name`, `tagline`, `icon`, `platforms`) on every app. The new rules:

- If `lifecycle` exists, `lifecycle.status` is required and must be one of `idea` \| `in-development` \| `beta` \| `launched` \| `archived`.
- If `lifecycle.targetDate` exists, it must be a parseable ISO date string.
- If `lifecycle.releases[]` exists, each entry must have a non-empty string `version` and a parseable ISO date `releasedAt`.
- **`idea` minimum field set override:** when `lifecycle.status === "idea"`, only `slug`, `name`, and `lifecycle.status` are required; all other v1 fields are OPTIONAL.
- All other statuses (including absent `lifecycle`) continue to apply the v1 required set.

- [ ] **Step 1: Add the failing tests**

Append to `tests/build.test.mjs` (the existing imports cover what's needed):

```javascript
// --- Lifecycle + private validation (Task 1) ---

const baseIdea = {
  slug: 'ideaproj',
  name: 'Idea Project',
  tagline: 'just an idea',
  icon: 'apps/ideaproj/icon.png',
  platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
};

test('validate: idea status allows minimal fields (slug + name + lifecycle.status only)', () => {
  const app = { slug: 'min-idea', name: 'Min Idea', lifecycle: { status: 'idea' } };
  assert.doesNotThrow(() => validate([app]));
});

test('validate: idea status with empty platforms is accepted', () => {
  // Idea should not need the v1 required set; platforms optional.
  const app = { slug: 'min-idea2', name: 'Min Idea 2', lifecycle: { status: 'idea' } };
  // No `platforms` key at all — should not throw.
  assert.doesNotThrow(() => validate([app]));
});

test('validate: non-idea statuses still require the v1 set', () => {
  // beta must have platforms
  const app = { slug: 'b1', name: 'B1', tagline: 't', icon: 'apps/b1/i.png', lifecycle: { status: 'beta' } };
  assert.throws(() => validate([app]), /platforms.*at least one/);
});

test('validate: lifecycle.status must be in the enum if lifecycle is present', () => {
  const app = { ...baseIdea, lifecycle: { status: 'sideways' } };
  assert.throws(() => validate([app]), /invalid lifecycle\.status/);
});

test('validate: lifecycle.releases[].version must be a non-empty string', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'launched', releases: [{ version: '', releasedAt: '2026-01-01' }] },
  };
  assert.throws(() => validate([app]), /releases\[0\]\.version/);
});

test('validate: lifecycle.releases[].releasedAt must be a parseable date', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'launched', releases: [{ version: '1.0.0', releasedAt: 'not-a-date' }] },
  };
  assert.throws(() => validate([app]), /releases\[0\]\.releasedAt/);
});

test('validate: lifecycle.targetDate must be a parseable date when present', () => {
  const app = {
    ...baseIdea,
    lifecycle: { status: 'in-development', targetDate: 'not-a-date' },
  };
  assert.throws(() => validate([app]), /targetDate/);
});

test('validate: well-formed lifecycle + private block is accepted', () => {
  const app = {
    ...baseIdea,
    lifecycle: {
      status: 'launched',
      targetDate: '2026-08-15',
      releases: [
        { version: '1.0.0', releasedAt: '2026-06-01', notes: 'Initial release' },
      ],
    },
    private: { notes: 'internal', blockers: ['X'], todo: ['Y'] },
  };
  assert.doesNotThrow(() => validate([app]));
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test`
Expected: the 8 new tests fail (the existing 14 still pass).

- [ ] **Step 3: Implement the new rules in `validate()`**

Edit `build.mjs`. The current `validate()` is the sync function exported. Inside its main `for` loop, AFTER the existing `if (!Array.isArray(app.platforms) || ...)` block, add the lifecycle checks. Then, AFTER the `featuredCount > 1` check at the bottom (which stays in the main flow), add a SECOND pass to apply the idea-status minimum-set override. Also extract a `parseISODate(str)` helper at module scope.

**Add at module scope (near `PLATFORM_TYPES`):**

```javascript
const LIFECYCLE_STATUSES = new Set(['idea', 'in-development', 'beta', 'launched', 'archived']);

function parseISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(str)) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

**Inside `validate()`, after the existing `platforms` check, add:**

```javascript
    // --- Lifecycle (Task 1) ---
    if (app.lifecycle !== undefined) {
      if (typeof app.lifecycle !== 'object' || app.lifecycle === null) {
        throw new Error(`${where}.lifecycle must be an object`);
      }
      if (!LIFECYCLE_STATUSES.has(app.lifecycle.status)) {
        throw new Error(`${where}.lifecycle.status invalid: ${JSON.stringify(app.lifecycle.status)}`);
      }
      if (app.lifecycle.targetDate !== undefined && parseISODate(app.lifecycle.targetDate) === null) {
        throw new Error(`${where}.lifecycle.targetDate is not a valid ISO date: ${JSON.stringify(app.lifecycle.targetDate)}`);
      }
      if (app.lifecycle.releases !== undefined) {
        if (!Array.isArray(app.lifecycle.releases)) {
          throw new Error(`${where}.lifecycle.releases must be an array`);
        }
        for (const [k, r] of app.lifecycle.releases.entries()) {
          if (typeof r.version !== 'string' || !r.version) {
            throw new Error(`${where}.lifecycle.releases[${k}].version must be a non-empty string`);
          }
          if (parseISODate(r.releasedAt) === null) {
            throw new Error(`${where}.lifecycle.releases[${k}].releasedAt is not a valid ISO date: ${JSON.stringify(r.releasedAt)}`);
          }
        }
      }
    }
```

**Replace the existing v1 required-set check (the inner `for (const field of REQUIRED_FIELDS)` loop)** with a conditional one that applies the idea override:

```javascript
    // Required fields depend on status:
    //   - status === "idea" (or no lifecycle at all + we treat as launched): v1 set
    //   - status === "idea": only slug + name + lifecycle.status required
    const status = app.lifecycle?.status;
    const requiredForThisApp = status === 'idea'
      ? ['slug', 'name']  // lifecycle.status already checked above
      : REQUIRED_FIELDS;
    for (const field of requiredForThisApp) {
      if (app[field] === undefined || app[field] === null || app[field] === '') {
        throw new Error(`${where} is missing required field: ${field}`);
      }
    }
```

The `if (typeof app.slug !== 'string' || !/...slug regex.../)` check that follows stays as-is. Same for the duplicate-slug and featured checks. The `if (!Array.isArray(app.platforms) || ...)` check also stays — but is now only reached for non-idea statuses, because idea apps skip the v1 set entirely (which includes `platforms`).

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 22 pass, 0 fail (14 existing + 8 new).

- [ ] **Step 5: Run build against current `apps.json` to confirm no regression**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

If this errors (e.g., because the current `_sample` doesn't have a `lifecycle` block but the new logic still passes it as `launched`): that's fine — no error. But if the build errors: STOP and report, do not amend Task 7 prematurely.

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add lifecycle + private validation rules"
```

---

## Task 2: Add `omitPrivate`, `deriveQuarter`, `--private` flag, double-output (TDD)

**Files:**
- Modify: `tests/build.test.mjs` (add tests)
- Modify: `build.mjs` (add helpers, update `main()`)

The `omitPrivate(app)` function strips:
- The `private` field entirely
- The `lifecycle.targetDate` field (date is private; public will use a derived quarter)

The `deriveQuarter(iso)` function returns `"Q[1-4] YYYY"` (e.g. `"Q3 2026"`) or `null` if the input doesn't parse.

`main()` checks `process.argv` for `--private`. If present, it also writes `roadmap.html`. Default mode (no flag) skips `roadmap.html`.

The new `render.roadmap(apps, scope)` is added in Task 3. For Task 2, only the helpers + flag plumbing are added. The double-output behavior is tested in Task 3 once `render.roadmap` exists. For now, we test `omitPrivate` and `deriveQuarter` as pure functions.

- [ ] **Step 1: Add the failing tests**

Append to `tests/build.test.mjs`:

```javascript
// --- omitPrivate + deriveQuarter (Task 2) ---

import { omitPrivate, deriveQuarter } from '../build.mjs';

test('omitPrivate: removes the private field', () => {
  const app = { slug: 'a', name: 'A', private: { notes: 'secret' } };
  const out = omitPrivate(app);
  assert.equal(out.private, undefined);
  assert.equal(out.slug, 'a');
});

test('omitPrivate: removes lifecycle.targetDate (private)', () => {
  const app = {
    slug: 'a',
    name: 'A',
    lifecycle: { status: 'in-development', targetDate: '2026-08-15', releases: [] },
  };
  const out = omitPrivate(app);
  assert.equal(out.lifecycle.targetDate, undefined);
  assert.equal(out.lifecycle.status, 'in-development');
});

test('omitPrivate: preserves lifecycle.releases[] (public)', () => {
  const app = {
    slug: 'a',
    name: 'A',
    lifecycle: { status: 'launched', releases: [{ version: '1.0', releasedAt: '2026-06-01' }] },
  };
  const out = omitPrivate(app);
  assert.equal(out.lifecycle.releases.length, 1);
  assert.equal(out.lifecycle.releases[0].version, '1.0');
});

test('omitPrivate: does not mutate the input', () => {
  const app = { slug: 'a', private: { x: 1 } };
  const out = omitPrivate(app);
  assert.equal(app.private.x, 1, 'input should not be mutated');
  assert.notEqual(out, app, 'should return a new object');
});

test('omitPrivate: handles app with no private and no lifecycle', () => {
  const app = { slug: 'a', name: 'A' };
  const out = omitPrivate(app);
  assert.deepEqual(out, { slug: 'a', name: 'A' });
});

test('deriveQuarter: standard mapping', () => {
  assert.equal(deriveQuarter('2026-01-15'), 'Q1 2026');
  assert.equal(deriveQuarter('2026-04-01'), 'Q2 2026');
  assert.equal(deriveQuarter('2026-07-31'), 'Q3 2026');
  assert.equal(deriveQuarter('2026-10-15'), 'Q4 2026');
  assert.equal(deriveQuarter('2026-12-31'), 'Q4 2026');
});

test('deriveQuarter: returns null for unparseable input', () => {
  assert.equal(deriveQuarter('not-a-date'), null);
  assert.equal(deriveQuarter(''), null);
  assert.equal(deriveQuarter(null), null);
  assert.equal(deriveQuarter(undefined), null);
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test`
Expected: 7 new tests fail. Existing 22 still pass.

- [ ] **Step 3: Implement the helpers and CLI flag**

In `build.mjs`:

**Add exports near the top of the file (right after `export const ROOT`):**

```javascript
export function omitPrivate(app) {
  const out = { ...app };
  if (out.private !== undefined) {
    delete out.private;
  }
  if (out.lifecycle && typeof out.lifecycle === 'object') {
    const { targetDate, ...lifecycleRest } = out.lifecycle;
    out.lifecycle = lifecycleRest;
  }
  return out;
}

export function deriveQuarter(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getUTCMonth() + 1; // 1-12
  const q = Math.floor((month - 1) / 3) + 1; // 1-4
  return `Q${q} ${d.getUTCFullYear()}`;
}
```

**Update `main()` to:**

```javascript
async function main() {
  const appsPath = join(ROOT, 'apps.json');
  const apps = JSON.parse(await readFile(appsPath, 'utf8'));
  validate(apps);
  await validateFileExistence(apps);

  // Public build: strip private + lifecycle.targetDate, then derive public quarter.
  const publicApps = apps.map((app) => {
    const sanitized = omitPrivate(app);
    if (sanitized.lifecycle && app.lifecycle?.targetDate) {
      const q = deriveQuarter(app.lifecycle.targetDate);
      if (q) sanitized.lifecycle = { ...sanitized.lifecycle, targetQuarter: q };
    }
    return sanitized;
  });

  await writeOutputs(publicApps);

  if (process.argv.includes('--private')) {
    const html = await render.roadmap(apps);
    await writeFile(join(ROOT, 'roadmap.html'), html, 'utf8');
    console.log(`✓ wrote roadmap.html (private)`);
  }

  console.log(`✓ built ${apps.length} app page(s)`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 29 pass, 0 fail (22 from before + 7 new).

- [ ] **Step 5: Run build to confirm no regression**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)` (no `roadmap.html` written since no `--private`).

Run: `ls roadmap.html 2>&1 || echo "no roadmap.html (expected)"`
Expected: `no roadmap.html (expected)`.

Run: `node build.mjs --private`
Expected: `✓ wrote roadmap.html (private)` then `✓ built 1 app page(s)`.

Run: `ls -la roadmap.html`
Expected: file exists.

Run: `head -5 roadmap.html`
Expected: HTML starting with `<!doctype html>` (Task 3's template will fill the body; for now the file may be empty or contain template engine errors — see Task 3).

- [ ] **Step 6: Clean up the test artifact**

Run: `rm -f roadmap.html`

This file would otherwise be untracked. Task 8 will add it to `.gitignore`.

- [ ] **Step 7: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Add omitPrivate, deriveQuarter, --private flag for roadmap output"
```

---

## Task 3: Add `render.roadmap` and `templates/roadmap.html`

**Files:**
- Create: `templates/roadmap.html`
- Modify: `build.mjs` (add `render.roadmap`)
- Modify: `tests/build.test.mjs` (add 1-2 tests)

`render.roadmap(apps)` returns a string of HTML for a single-page private report. Layout (per spec §6.3): top summary, NOW section (in-development + beta), PLANNED section (idea, sorted by targetDate), SHIPPED section (launched + archived, sorted by latest release date), cross-app summary (all blockers + all todos).

- [ ] **Step 1: Create `templates/roadmap.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Roadmap · info.opplipo.cn</title>
  <style>
    body { font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 920px; margin: 0 auto; padding: 24px 20px 64px; color: #1f2937; line-height: 1.55; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
    .meta a { color: #2563eb; }
    h2 { font-size: 16px; margin: 32px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .counts { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
    .app { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin: 8px 0; }
    .app .head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 999px; color: #fff; }
    .badge.idea { background: #94a3b8; }
    .badge.in-development { background: #6366f1; }
    .badge.beta { background: #f97316; }
    .badge.launched { background: #10b981; }
    .badge.archived { background: #475569; }
    .name { font-weight: 600; }
    .sub { color: #6b7280; font-size: 12px; }
    .notes { margin: 8px 0 0; font-size: 13px; color: #374151; white-space: pre-wrap; }
    .list { margin: 6px 0 0 0; padding: 0 0 0 18px; font-size: 13px; }
    .release { font-size: 13px; padding: 4px 0; }
    .release .v { font-weight: 600; }
    .release .d { color: #6b7280; font-size: 12px; margin-left: 6px; }
    .summary { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 14px; margin: 6px 0; }
    .summary .label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #92400e; }
  </style>
</head>
<body>
  <h1>Roadmap</h1>
  <p class="meta">Last updated: {{today}} · <a href="apps.json">← back to apps.json</a></p>
  <p class="counts">{{counts}}</p>

  {{#if now}}
  <h2>NOW</h2>
  {{#each now}}
  <div class="app">
    <div class="head">
      <span class="badge {{lifecycle.status}}">{{lifecycle.status}}</span>
      <span class="name">{{name}}</span>
      <span class="sub">v{{topVersion}} · target {{lifecycle.targetDate}}</span>
    </div>
    {{#if private.notes}}<div class="notes">{{private.notes}}</div>{{/if}}
    {{#if private.blockers.length}}
      <ul class="list">
        {{#each private.blockers}}<li>🚧 {{.}}</li>{{/each}}
      </ul>
    {{/if}}
    {{#if private.todo.length}}
      <ul class="list">
        {{#each private.todo}}<li>☐ {{.}}</li>{{/each}}
      </ul>
    {{/if}}
  </div>
  {{/each}}
  {{/if}}

  {{#if planned}}
  <h2>PLANNED</h2>
  {{#each planned}}
  <div class="app">
    <div class="head">
      <span class="badge {{lifecycle.status}}">{{lifecycle.status}}</span>
      <span class="name">{{name}}</span>
      {{#if lifecycle.targetDate}}<span class="sub">target {{lifecycle.targetDate}}</span>{{/if}}
    </div>
    {{#if tagline}}<div class="sub" style="margin-top:4px;">{{tagline}}</div>{{/if}}
    {{#if private.notes}}<div class="notes">{{private.notes}}</div>{{/if}}
  </div>
  {{/each}}
  {{/if}}

  {{#if shipped}}
  <h2>SHIPPED</h2>
  {{#each shipped}}
  <div class="app">
    <div class="head">
      <span class="badge {{lifecycle.status}}">{{lifecycle.status}}</span>
      <span class="name">{{name}}</span>
      <span class="sub">v{{topVersion}} · {{topReleasedAt}}</span>
    </div>
    {{#if lifecycle.releases.length}}
      {{#each lifecycle.releases}}
      <div class="release"><span class="v">v{{version}}</span><span class="d">{{releasedAt}}</span>{{#if notes}} — {{notes}}{{/if}}</div>
      {{/each}}
    {{/if}}
  </div>
  {{/each}}
  {{/if}}

  {{#if allBlockers}}
  <h2>Blockers (across all apps)</h2>
  {{#each allBlockers}}<div class="summary"><span class="label">[{{appName}}]</span> {{.}}</div>{{/each}}
  {{/if}}

  {{#if allTodos}}
  <h2>Todos (across all apps)</h2>
  {{#each allTodos}}<div class="summary"><span class="label">[{{appName}}]</span> {{.}}</div>{{/each}}
  {{/if}}

</body>
</html>
```

- [ ] **Step 2: Add `render.roadmap` in `build.mjs`**

In `build.mjs`, after the existing `render.app` definition, add:

```javascript
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function roadmapScope(apps) {
  const statusOf = (a) => a.lifecycle?.status ?? 'launched';
  const now = apps.filter((a) => ['in-development', 'beta'].includes(statusOf(a)));
  const planned = apps
    .filter((a) => statusOf(a) === 'idea')
    .sort((a, b) => (a.lifecycle?.targetDate ?? 'zz').localeCompare(b.lifecycle?.targetDate ?? 'zz'));
  const shipped = apps
    .filter((a) => ['launched', 'archived'].includes(statusOf(a)))
    .sort((a, b) => (b.lifecycle?.releases?.[0]?.releasedAt ?? '').localeCompare(a.lifecycle?.releases?.[0]?.releasedAt ?? ''));

  const counts = (() => {
    const c = { idea: 0, 'in-development': 0, beta: 0, launched: 0, archived: 0 };
    for (const a of apps) c[statusOf(a)]++;
    return `idea ${c.idea} · in-development ${c['in-development']} · beta ${c.beta} · launched ${c.launched} · archived ${c.archived}`;
  })();

  const allBlockers = [];
  const allTodos = [];
  for (const a of apps) {
    for (const b of a.private?.blockers ?? []) allBlockers.push({ appName: a.name, blocker: b });
    for (const t of a.private?.todo ?? []) allTodos.push({ appName: a.name, todo: t });
  }

  // Enrich each app with topVersion / topReleasedAt for the template
  const enrich = (a) => ({
    ...a,
    topVersion: a.lifecycle?.releases?.[0]?.version ?? a.version ?? '?',
    topReleasedAt: a.lifecycle?.releases?.[0]?.releasedAt ?? a.releasedAt ?? '',
  });
  const nowE = now.map(enrich);
  const plannedE = planned.map(enrich);
  const shippedE = shipped.map(enrich);

  // Flatten the cross-app lists for {{#each}} in template
  const flatten = (items, key) => items.map((x) => ({ appName: x.appName, [key]: x[key] }));
  const flatBlockers = flatten(allBlockers, 'blocker').map((x) => ({ appName: x.appName, '.': x.blocker }));
  const flatTodos = flatten(allTodos, 'todo').map((x) => ({ appName: x.appName, '.': x.todo }));

  return {
    today: todayISO(),
    counts,
    now: nowE,
    planned: plannedE,
    shipped: shippedE,
    allBlockers: flatBlockers,
    allTodos: flatTodos,
  };
}

render.roadmap = async function (apps) {
  const tpl = await readFile(join(ROOT, 'templates', 'roadmap.html'), 'utf8');
  return renderTemplate(tpl, roadmapScope(apps));
};
```

- [ ] **Step 3: Add the failing test**

Append to `tests/build.test.mjs`:

```javascript
// --- render.roadmap (Task 3) ---

test('render.roadmap: produces a valid HTML page with the expected structure', async () => {
  const apps = [
    {
      slug: 'ship', name: 'Shipped App', tagline: 't', icon: 'apps/ship/icon.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      version: '1.0.0', releasedAt: '2026-06-01',
      lifecycle: { status: 'launched', releases: [{ version: '1.0.0', releasedAt: '2026-06-01', notes: 'GA' }] },
    },
    {
      slug: 'idea1', name: 'Idea One',
      lifecycle: { status: 'idea', targetDate: '2026-09-01' },
      private: { notes: 'thinking' },
    },
    {
      slug: 'beta1', name: 'Beta One', tagline: 'beta tagline', icon: 'apps/beta1/icon.png',
      platforms: [{ type: 'android', label: 'L', url: 'https://x' }],
      lifecycle: { status: 'beta' },
      private: { blockers: ['waiting on review'], todo: ['add crashlytics'] },
    },
  ];
  const html = await render.roadmap(apps);
  // Top-level structure
  assert.match(html, /<title>Roadmap/);
  assert.match(html, /Last updated: \d{4}-\d{2}-\d{2}/);
  assert.match(html, /counts.*idea.*in-development.*beta/);
  // Sections present
  assert.match(html, /<h2>NOW<\/h2>/);
  assert.match(html, /<h2>PLANNED<\/h2>/);
  assert.match(html, /<h2>SHIPPED<\/h2>/);
  assert.match(html, /<h2>Blockers/);
  assert.match(html, /<h2>Todos/);
  // App names
  assert.match(html, /Shipped App/);
  assert.match(html, /Idea One/);
  assert.match(html, /Beta One/);
  // Status badges use the lifecycle.status class
  assert.match(html, /class="badge launched"/);
  assert.match(html, /class="badge idea"/);
  assert.match(html, /class="badge beta"/);
  // Private content visible
  assert.match(html, /waiting on review/);
  assert.match(html, /add crashlytics/);
  assert.match(html, /thinking/);
  // No {{...}} placeholders left
  assert.equal(html.match(/\{\{/g), null);
});

test('render.roadmap: handles empty apps array', async () => {
  const html = await render.roadmap([]);
  assert.match(html, /counts.*idea 0.*launched 0/);
  // No section headers for empty sections
  assert.doesNotMatch(html, /<h2>NOW<\/h2>/);
  assert.doesNotMatch(html, /<h2>PLANNED<\/h2>/);
  assert.doesNotMatch(html, /<h2>SHIPPED<\/h2>/);
});
```

- [ ] **Step 4: Run tests, see them fail**

Run: `npm test`
Expected: the 2 new tests fail. (The test imports `render` and `render.roadmap` from `build.mjs`; the test file's existing import already covers `render`. The first test calls `render.roadmap` which doesn't exist yet, so it fails with `render.roadmap is not a function`.)

- [ ] **Step 5: Run build to confirm `render.roadmap` works end-to-end**

Run: `node build.mjs --private && head -50 roadmap.html`
Expected: real HTML, with `<title>Roadmap`, top-level counts line, and (because the current `_sample` has no `lifecycle` block, so it's treated as `launched`) at least the SHIPPED section with `_sample`.

Run: `grep -c "{{" roadmap.html`
Expected: `0`.

Run: `rm -f roadmap.html`

- [ ] **Step 6: Run tests again**

Run: `npm test`
Expected: 31 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add build.mjs tests/build.test.mjs templates/roadmap.html
git commit -m "Add render.roadmap and templates/roadmap.html for private view"
```

---

## Task 4: Update `templates/home.html` — COMING SOON + status filter + status badges

**Files:**
- Modify: `templates/home.html`

The current home template iterates `{{#each apps}}` and renders every app as either a featured big card or a small card. The new template:
- Only shows `status: launched` and `status: beta` in the existing sections (the small-card grid and the featured slot).
- Adds a "COMING SOON" section (rendered only if any app has `status: in-development` or `status: idea`) listing those apps as smaller cards with `lifecycle.targetQuarter` (or "目标 TBD" if no `targetDate`).
- Adds a `status` badge to the featured big card and to the small cards, rendered as `<span class="status-badge status-badge--{status}">{status}</span>` next to the category.

The CSS for `.status-badge` and the COMING SOON section is added in Task 6.

- [ ] **Step 1: Read the current `templates/home.html`**

Run: `cat templates/home.html`
Note: the file is 54 lines.

- [ ] **Step 2: Replace `templates/home.html` entirely**

The new content keeps the existing structure (header, featured big card slot, grid of small cards, footer) and adds the COMING SOON section. Use this content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>info.opplipo.cn</title>
  <meta name="description" content="{{site.tagline}}">
  <meta property="og:title" content="info.opplipo.cn">
  <meta property="og:description" content="{{site.tagline}}">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <header class="site-header">
      <h1 class="site-title">我的 APP</h1>
      <p class="site-tagline">独立开发，持续更新。</p>
    </header>

    {{#each apps}}
      {{#if featured}}
        {{#if statusLaunchedOrBeta}}
          <a class="card card--featured" href="{{url}}" style="--c1:{{color.0}}; --c2:{{color.1}};">
            <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
            <div class="card__body">
              <div class="card__category">{{category}}</div>
              <div class="card__name">{{name}}</div>
              <p class="card__tagline">{{tagline}}</p>
              {{#if statusBadge}}<span class="status-badge status-badge--{{statusBadge}}">{{statusBadge}}</span>{{/if}}
              <span class="card__cta" data-platform-label="{{primaryPlatform.label}}">{{primaryPlatform.label}} →</span>
            </div>
          </a>
        {{/if}}
      {{/if}}
    {{/each}}

    <section class="grid">
      {{#each apps}}
        {{#if statusLaunchedOrBeta}}
          {{#unless featured}}
            <a class="card card--small" href="{{url}}" style="--c1:{{color.0}}; --c2:{{color.1}};">
              <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
              <div class="card__body">
                <div class="card__name">{{name}}</div>
                <div class="card__category">{{category}}{{#if statusBadge}} · <span class="status-badge status-badge--{{statusBadge}}">{{statusBadge}}</span>{{/if}}</div>
              </div>
            </a>
          {{/unless}}
        {{/if}}
      {{/each}}
    </section>

    {{#if hasComingSoon}}
    <section class="coming-soon">
      <div class="block__label">即将上线 · COMING SOON</div>
      <div class="coming-soon__grid">
        {{#each apps}}
          {{#if statusIsInDevOrIdea}}
            <a class="card card--small" href="{{url}}">
              <div class="card__icon"><img src="{{icon}}" alt="{{name}}"></div>
              <div class="card__body">
                <div class="card__name">{{name}}</div>
                <div class="card__category">{{category}}</div>
                <div class="coming-soon__when">目标 {{#if targetQuarter}}{{targetQuarter}}{{/if}}{{#unless targetQuarter}}TBD{{/unless}}</div>
                <p class="card__tagline">{{tagline}}</p>
              </div>
            </a>
          {{/if}}
        {{/each}}
      </div>
    </section>
    {{/if}}

    <footer class="site-footer">
      <p>© lipo · 站点部署于 GitHub Pages</p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 3: Update `appsContext` in `build.mjs` to compute the new fields**

In `build.mjs`, find the `appsContext(apps)` function. Update the `enriched` map to include:

```javascript
function appsContext(apps) {
  const enriched = apps.map((a) => {
    const primary = a.platforms.find((p) => p.primary) || a.platforms[0];
    const others = a.platforms.filter((p) => p !== primary);
    const status = a.lifecycle?.status ?? 'launched';
    const statusLaunchedOrBeta = status === 'launched' || status === 'beta';
    const statusIsInDevOrIdea = status === 'in-development' || status === 'idea';
    const statusBadge = status === 'beta' ? 'Beta' : null;  // 'launched' has no badge
    return {
      ...a,
      primaryPlatform: primary,
      otherPlatforms: others,
      url: `/apps/${a.slug}/`,
      status,
      statusLaunchedOrBeta,
      statusIsInDevOrIdea,
      statusBadge,
      targetQuarter: a.lifecycle?.targetQuarter ?? null,
    };
  });
  const hasComingSoon = enriched.some((a) => a.statusIsInDevOrIdea);
  return {
    apps: enriched,
    hasComingSoon,
    'site.tagline': SITE_TAGLINE,
    'assets.styles': '/assets/styles.css',
    'assets.app': '/assets/app.js',
  };
}
```

- [ ] **Step 4: Run the build to verify the new template works**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

Run: `head -40 index.html`
Expected: real HTML, with the sample app's big card unchanged (still has "示例 APP", "下载 APK →" etc). The new `{{#if hasComingSoon}}` block is `false` for the current data (no in-dev/idea apps), so no COMING SOON section.

Run: `grep -c "{{" index.html`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add templates/home.html build.mjs
git commit -m "Filter home by status, add COMING SOON section and status badges"
```

---

## Task 5: Update `templates/app.html` — RELEASES + hero CTA + status badge

**Files:**
- Modify: `templates/app.html`
- Modify: `build.mjs` (extend the `render.app` scope to include `lifecycle` + status-derived fields)

The current app template has 5 sections (hero, FEATURES, ABOUT, SCREENSHOTS, OTHER DOWNLOADS). The new template:
- Adds a status badge in the hero meta line (after the existing category/version/releasedAt spans).
- Adjusts the primary CTA button: if `status` is `in-development` / `idea` and `lifecycle.betaSignupUrl` exists, show "加入内测" linking to that URL; otherwise hide the primary CTA. If `status` is `launched` or `beta`, behavior unchanged (primaryPlatform.url).
- Adds a RELEASES section between FEATURES and ABOUT, only if `lifecycle.releases.length > 0`.

- [ ] **Step 1: Read the current `templates/app.html`**

Run: `cat templates/app.html`

- [ ] **Step 2: Replace the file with the updated version**

The new content keeps the existing structure and adds (1) a status badge in the hero meta, (2) a conditional primary CTA, (3) a RELEASES section.

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{name}} | info.opplipo.cn</title>
  <meta name="description" content="{{tagline}}">
  <meta property="og:title" content="{{name}} | info.opplipo.cn">
  <meta property="og:description" content="{{tagline}}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{{ogImage}}">
  <link rel="canonical" href="{{canonical}}">
  <link rel="stylesheet" href="{{assets.styles}}">
</head>
<body>
  <main class="page">
    <a class="back-link" href="/">← 返回首页</a>

    <section class="hero" style="--c1:{{color.0}}; --c2:{{color.1}};">
      <div class="hero__icon"><img src="{{icon}}" alt="{{name}}"></div>
      <div class="hero__body">
        <h1 class="hero__name">{{name}}</h1>
        <div class="hero__meta">
          {{#if category}}<span>{{category}}</span>{{/if}}
          {{#if version}}<span>· v{{version}}</span>{{/if}}
          {{#if releasedAt}}<span>· {{releasedAt}}</span>{{/if}}
          {{#if statusBadge}}<span>· <span class="status-badge status-badge--{{statusBadgeKey}}">{{statusBadge}}</span></span>{{/if}}
        </div>
        <p class="hero__tagline">{{tagline}}</p>
        {{#if primaryCtaUrl}}
          <a class="cta cta--primary" href="{{primaryCtaUrl}}">{{primaryCtaLabel}}</a>
        {{/if}}
      </div>
    </section>

    {{#if highlights.length}}
      <section class="block">
        <div class="block__label">FEATURES</div>
        <ul class="highlights">
          {{#each highlights}}<li>{{.}}</li>{{/each}}
        </ul>
      </section>
    {{/if}}

    {{#if lifecycle.releases.length}}
      <section class="block">
        <div class="block__label">更新日志 · RELEASES</div>
        <ol class="releases">
          {{#each lifecycle.releases}}
            <li class="releases__item">
              <span class="releases__v">v{{version}}</span>
              <span class="releases__d">{{releasedAt}}</span>
              {{#if notes}}<span class="releases__n">{{notes}}</span>{{/if}}
            </li>
          {{/each}}
        </ol>
      </section>
    {{/if}}

    {{#if description}}
      <section class="block">
        <div class="block__label">ABOUT</div>
        <div class="prose">{{{descriptionHtml}}}</div>
      </section>
    {{/if}}

    {{#if screenshots.length}}
      <section class="block">
        <div class="block__label">SCREENSHOTS</div>
        <div class="carousel" data-carousel>
          {{#each screenshots}}
            <button class="carousel__item" data-lightbox-src="{{.}}" data-lightbox-alt="{{../name}}">
              <img src="{{.}}" alt="{{../name}} 截图" loading="lazy">
            </button>
          {{/each}}
        </div>
        <div class="carousel__hint">← 左右滑动 / 点击放大 →</div>
      </section>
    {{/if}}

    {{#if otherPlatforms.length}}
      <section class="block">
        <div class="block__label">OTHER DOWNLOADS</div>
        <div class="other-downloads">
          {{#each otherPlatforms}}
            <a class="cta cta--secondary" href="{{url}}">
              <img class="platform-icon" src="/assets/platforms/{{type}}.svg" alt="" width="16" height="16">
              {{label}}
            </a>
          {{/each}}
        </div>
      </section>
    {{/if}}

    <footer class="site-footer">
      <p>© lipo · 站点部署于 GitHub Pages</p>
    </footer>
  </main>
  <script type="module" src="{{assets.app}}"></script>
</body>
</html>
```

- [ ] **Step 3: Update `render.app` scope in `build.mjs`**

Find the existing `render.app(app)` function. Replace its body with:

```javascript
render.app = async function (app) {
  const tpl = await readFile(join(ROOT, 'templates', 'app.html'), 'utf8');
  const status = app.lifecycle?.status ?? 'launched';
  // Decide primary CTA: for in-development/idea, prefer betaSignupUrl; for launched/beta, use primaryPlatform.
  let primaryCtaUrl = null;
  let primaryCtaLabel = null;
  if (status === 'in-development' || status === 'idea') {
    if (app.lifecycle?.betaSignupUrl) {
      primaryCtaUrl = app.lifecycle.betaSignupUrl;
      primaryCtaLabel = '加入内测';
    }
  } else {
    const primary = app.platforms.find((p) => p.primary) || app.platforms[0];
    if (primary) {
      primaryCtaUrl = primary.url;
      primaryCtaLabel = primary.label;
    }
  }
  // Status badge in hero meta: 'launched' has no badge, others get a text + class key.
  let statusBadge = null;
  let statusBadgeKey = null;
  if (status === 'beta') { statusBadge = 'Beta'; statusBadgeKey = 'beta'; }
  else if (status === 'in-development' || status === 'idea') { statusBadge = 'In development'; statusBadgeKey = 'in-development'; }
  else if (status === 'archived') { statusBadge = '已归档'; statusBadgeKey = 'archived'; }

  const enriched = {
    ...app,
    status,
    statusBadge,
    statusBadgeKey,
    primaryCtaUrl,
    primaryCtaLabel,
    primaryPlatform: app.platforms.find((p) => p.primary) || app.platforms[0],
    otherPlatforms: app.platforms.filter((p) => p.primary !== true),
    descriptionHtml: app.description ? renderMarkdownLite(app.description) : '',
    ogImage: app.screenshots?.[0] ? `/${app.screenshots[0]}` : `/${app.icon}`,
    canonical: `https://info.opplipo.cn/apps/${app.slug}/`,
  };
  const scope = {
    ...enriched,
    assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
  };
  return renderTemplate(tpl, scope);
};
```

- [ ] **Step 4: Run the build**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

Run: `head -50 apps/_sample/index.html`
Expected: real HTML, with the existing hero / FEATURES / SCREENSHOTS / OTHER DOWNLOADS sections, and (since the current `_sample` has no `lifecycle` block, defaulting to `launched`):
- No status badge in hero meta (since `launched` has no badge).
- Primary CTA = "下载 APK" linking to the Play Store URL.
- No RELEASES section (no `lifecycle.releases[]`).

Run: `grep -c "{{" apps/_sample/index.html`
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add templates/app.html build.mjs
git commit -m "Add hero status badge, conditional CTA, and RELEASES section to detail page"
```

---

## Task 6: Append CSS for status badges, COMING SOON, RELEASES

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Append the new CSS to `assets/styles.css`**

```css
/* Status badges */
.status-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  vertical-align: middle;
  text-transform: uppercase;
}
.status-badge--beta { background: #f97316; }
.status-badge--in-development { background: #6366f1; }
.status-badge--archived { background: #475569; }

/* Coming soon section (homepage) */
.coming-soon {
  margin-top: 28px;
}
.coming-soon__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 12px;
}
.coming-soon__when {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* Releases section (detail page) */
.releases {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  counter-reset: release;
}
.releases__item {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 10px;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 14px;
}
.releases__item:last-child { border-bottom: 0; }
.releases__v {
  font-weight: 700;
  color: #1f2937;
}
.releases__d {
  color: #6b7280;
  font-size: 12px;
}
.releases__n {
  color: #374151;
}

@media (max-width: 640px) {
  .coming-soon__grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Verify the build still works**

Run: `node build.mjs`
Expected: no errors.

Run: `wc -l assets/styles.css`
Expected: 343 + 52 = 395 lines.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "Style status badges, COMING SOON section, and releases list"
```

---

## Task 7: Migrate sample data — `_sample` demonstrates the new fields

**Files:**
- Modify: `apps.json`

The current `_sample` has no `lifecycle` or `private` block. To exercise the new visual blocks, change it to a non-launched state with a target date and a `private` block. This also unblocks the COMING SOON section on the homepage.

- [ ] **Step 1: Update `_sample` in `apps.json`**

Replace the entire `_sample` object in `apps.json` with:

```json
{
  "slug": "_sample",
  "name": "示例 APP",
  "tagline": "这是一个示例 APP，部署后会替换为你的真实作品",
  "description": "## 关于这个示例\n\n这是占位 APP，用于验证站点骨架工作正常。\n\n部署成功后，编辑 `apps.json` 把它换成你的真实 APP 即可。",
  "highlights": [
    "这是第一条特性",
    "这是第二条特性",
    "这是第三条特性",
    "这是第四条特性"
  ],
  "icon": "apps/_sample/icon.svg",
  "screenshots": [
    "apps/_sample/screenshots/1.svg",
    "apps/_sample/screenshots/2.svg",
    "apps/_sample/screenshots/3.svg"
  ],
  "color": ["#fbbf24", "#f472b6"],
  "category": "示例",
  "platforms": [
    {
      "type": "android",
      "label": "下载 APK",
      "url": "https://github.com/lipopo",
      "primary": true
    },
    {
      "type": "web",
      "label": "在线访问",
      "url": "https://info.opplipo.cn"
    }
  ],
  "version": "0.0.1",
  "releasedAt": "2026-06-07",
  "lifecycle": {
    "status": "in-development",
    "targetDate": "2026-09-15",
    "betaSignupUrl": "https://github.com/lipopo"
  },
  "private": {
    "notes": "本条目用作占位；新功能上线后由用户替换为真实 APP。",
    "blockers": ["等用户提供真实数据"],
    "todo": ["替换为真实 APP", "加截图"]
  }
}
```

- [ ] **Step 2: Run the build and verify the new state is rendered**

Run: `node build.mjs`
Expected: `✓ built 1 app page(s)`.

Run: `head -25 index.html`
Expected: the COMING SOON section is now present (since `_sample` has `status: in-development`):
```html
<section class="coming-soon">
  <div class="block__label">即将上线 · COMING SOON</div>
  <div class="coming-soon__grid">
    <a class="card card--small" href="/apps/_sample/">
      <div class="card__icon"><img src="apps/_sample/icon.svg" alt="示例 APP"></div>
      <div class="card__body">
        <div class="card__name">示例 APP</div>
        <div class="card__category">示例</div>
        <div class="coming-soon__when">目标 Q3 2026</div>
```

(The card body has `目标 Q3 2026` — derived from `2026-09-15` via `deriveQuarter`.)

Run: `head -45 apps/_sample/index.html`
Expected: the hero has the `In development` status badge, the primary CTA is "加入内测" (since `lifecycle.betaSignupUrl` is set), and there is no RELEASES section (releases array is empty).

Run: `grep -c "{{" index.html apps/_sample/index.html`
Expected: both `0`.

Run: `grep "private\." index.html apps/_sample/index.html || echo "clean (no private content in public output)"`
Expected: `clean (no private content in public output)`. The public build must not leak any `private.*` values.

- [ ] **Step 3: Verify the private build (Task 3's render.roadmap still works)**

Run: `node build.mjs --private && grep "本条目用作占位" roadmap.html`
Expected: a match (the private notes ARE in the private build).

Run: `grep "目标 Q3 2026" roadmap.html || echo "no quarter in private output"`
Expected: the private output uses full date `2026-09-15`, not the quarter.

Run: `rm -f roadmap.html`

- [ ] **Step 4: Commit**

```bash
git add apps.json
git commit -m "Migrate _sample to demonstrate lifecycle and private fields"
```

---

## Task 8: `package.json` and `.gitignore`

**Files:**
- Modify: `package.json` (add `build:private` script)
- Modify: `.gitignore` (add `roadmap.html`)

- [ ] **Step 1: Update `package.json`**

Add `build:private` to the `scripts` block. Final file:

```json
{
  "name": "info-opplipo-cn",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Data-driven APP showcase for info.opplipo.cn",
  "scripts": {
    "build": "node build.mjs",
    "build:private": "node build.mjs --private",
    "test": "node --test tests/",
    "serve": "python3 -m http.server 4000"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:

```
# Local private roadmap (only generated by `npm run build:private`; never deployed)
roadmap.html
```

(The current `.gitignore` already includes `.superpowers/`, `node_modules/`, etc.)

- [ ] **Step 3: Run `node build.mjs --private` and verify `roadmap.html` is now git-ignored**

Run: `node build.mjs --private && git status --short`
Expected: only `roadmap.html` shows as untracked would normally appear, but with the new `.gitignore` entry, it should NOT appear in `git status`. If it does appear, the `.gitignore` line is wrong.

Run: `git check-ignore -v roadmap.html`
Expected: prints the matching `.gitignore` line (e.g., `.gitignore:6:roadmap.html	roadmap.html`).

Run: `rm -f roadmap.html`

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "Add build:private script and gitignore roadmap.html"
```

---

## Task 9: Update the `managing-apk-info` skill

**Files:**
- Modify: `.claude/skills/managing-apk-info/SKILL.md`

The skill should be extended with a "Lifecycle planning" section that covers the 6 operations (A: idea, B: in-development, C: beta, D: launched v1.0, E: subsequent version, F: archived) and the `npm run build:private` workflow.

- [ ] **Step 1: Add a "Lifecycle planning" section after "Decisions the spec doesn't make for you"**

Find the section "## Decisions the spec doesn't make for you" and insert the following immediately AFTER it (before "## Markdown limits in `description`"):

````markdown
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
````

- [ ] **Step 2: Update the top of the skill to mention the new capability**

Find the line:
```markdown
A data-driven static showcase at `https://info.opplipo.cn`. **Single source of truth**: `apps.json` (array of app objects). `build.mjs` (Node 20+, no npm deps) validates it and renders `index.html` + per-app detail pages. GitHub Actions deploys on push to `main`.
```

Replace with:
```markdown
A data-driven static showcase at `https://info.opplipo.cn`. **Single source of truth**: `apps.json` (array of app objects). `build.mjs` (Node 20+, no npm deps) validates it and renders public `index.html` + per-app detail pages. A `--private` flag also writes `roadmap.html` (gitignored) for a developer-only roadmap view. GitHub Actions deploys on push to `main`.
```

- [ ] **Step 3: Update the "60-second workflow" step 5 to mention the private view**

Find step 5 of "The 60-second workflow":
```markdown
5. **Push**: `git push origin main`. Actions deploys in ~30s. Smoke test: `curl -sI https://info.opplipo.cn/`.
```

Replace with:
```markdown
5. **Push**: `git push origin main`. Actions deploys in ~30s. Smoke test: `curl -sI https://info.opplipo.cn/`.
6. **Optional — view private roadmap locally**: `npm run build:private && open roadmap.html`. This file is gitignored, never deployed, only for your own eyes (NOW / PLANNED / SHIPPED + cross-app blockers/todos).
```

- [ ] **Step 4: Verify the file is well-formed**

Run: `head -20 .claude/skills/managing-apk-info/SKILL.md`
Expected: the new opening paragraph (with "private roadmap view" mention).

Run: `wc -w .claude/skills/managing-apk-info/SKILL.md`
Expected: ~1700 words (up from 1391).

Run: `grep -n "## Lifecycle planning" .claude/skills/managing-apk-info/SKILL.md`
Expected: a line number (the new section is present).

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/managing-apk-info/SKILL.md
git commit -m "Add Lifecycle planning section to managing-apk-info skill"
```

---

## Task 10: Local smoke test

**Files:** none (verification only)

- [ ] **Step 1: Clean + rebuild from scratch**

Run:
```bash
rm -f index.html
rm -rf apps/_sample/index.html
node build.mjs
node build.mjs --private
```

Expected: both runs print success lines; `index.html` and `apps/_sample/index.html` exist; `roadmap.html` exists.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: 31 pass, 0 fail.

- [ ] **Step 3: Verify the public output has no private content**

Run:
```bash
grep -rE "(private\.|本条目|等用户提供|等真实数据)" index.html apps/_sample/index.html || echo "clean"
```

Expected: prints `clean` (or shows only innocuous matches; the critical check is that none of the private notes / blockers / todos are present in the public output).

Run:
```bash
grep -E "目标 Q[1-4] 20[0-9][0-9]" index.html
```

Expected: a line containing the quarter (e.g., "目标 Q3 2026") — confirms `deriveQuarter` works in the public build.

Run:
```bash
grep -E "2026-09-15" index.html || echo "no full date in public output"
```

Expected: prints `no full date in public output` — confirms `lifecycle.targetDate` is stripped from public.

- [ ] **Step 4: Verify the private output has full data**

Run:
```bash
grep "本条目用作占位" roadmap.html
grep "2026-09-15" roadmap.html
grep "等用户提供真实数据" roadmap.html
```

Expected: all three match (private notes, full targetDate, blockers all present in private build).

- [ ] **Step 5: Verify the static server serves both the homepage and the detail page**

Run: `python3 -m http.server 4000 &` (note the trailing `&` to background)
Save the PID: `echo $!`
sleep 1

Run: `curl -sI http://localhost:4000/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Run: `curl -s http://localhost:4000/ | grep "目标 Q3 2026"`
Expected: a line containing the quarter.

Run: `curl -sI http://localhost:4000/apps/_sample/ | head -1`
Expected: `HTTP/1.0 200 OK`.

Run: `curl -sI http://localhost:4000/roadmap.html | head -1`
Expected: `HTTP/1.0 200 OK` (the file IS served, but it's gitignored and never deployed; this just confirms the local file exists).

Stop the server: `kill <PID>` (substitute the saved PID)

- [ ] **Step 6: Visual spot-checks via curl (manual)**

Run: `curl -s http://localhost:4000/ | grep -E "(status-badge|coming-soon|示例 APP)" | head -5`
Expected: at least 3 matches (the COMING SOON section's title, the sample app name, the card with target quarter).

Run: `curl -s http://localhost:4000/apps/_sample/ | grep -E "(status-badge|加入内测|In development|RELEASES|目标 Q3 2026)" | head -5`
Expected: at least 1 match for "加入内测" (the primary CTA on the sample app's detail page).

- [ ] **Step 7: Clean up**

Run: `rm -f roadmap.html index.html && rm -rf apps/_sample/index.html && node build.mjs`
Expected: rebuilds the public files (so the repo state is clean for the deploy step).

- [ ] **Step 8: No commit — verification only**

If anything is broken, fix and commit. Otherwise, proceed to Task 11.

---

## Task 11: Deploy — push, watch Actions, verify live

**Files:** none (deployment only)

- [ ] **Step 1: Push to origin**

Run: `git push origin main`

Expected: all commits land on `origin/main`. The local branch is now in sync.

- [ ] **Step 2: Watch the Actions run**

Use the GitHub public REST API to poll the workflow status:

```bash
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  STATUS=$(curl -s https://api.github.com/repos/lipopo/OppLipo/actions/runs?per_page=1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['workflow_runs'][0]['status'] + '/' + d['workflow_runs'][0]['conclusion'] or 'pending')" 2>/dev/null)
  echo "[$i] $STATUS"
  if [[ "$STATUS" == completed/* ]]; then break; fi
  sleep 10
done
```

(Or visit `https://github.com/lipopo/OppLipo/actions` in a browser.)

Wait up to ~3 minutes for the build+deploy to complete.

- [ ] **Step 3: Verify the live site shows the new COMING SOON section**

Run: `curl -sI https://info.opplipo.cn/ | head -1`
Expected: `HTTP/2 200` (or `HTTP/1.1 200`).

Run: `curl -s https://info.opplipo.cn/ | grep -E "(coming-soon|目标 Q[1-4] 20[0-9][0-9])"`
Expected: at least one match — the new COMING SOON section is live.

Run: `curl -s https://info.opplipo.cn/ | grep -E "(本条目|等用户提供|等真实数据)" || echo "no private content leaked"`
Expected: prints `no private content leaked`.

- [ ] **Step 4: Verify HTTPS is still enforced**

Run: `curl -sI http://info.opplipo.cn/ | head -3`
Expected: response starts with `HTTP/1.1 301` (or `308`) redirecting to `https://`.

- [ ] **Step 5: Done**

The v1+ launch planning feature is live at `https://info.opplipo.cn/`. The `_sample` app is now in the COMING SOON section with a public quarter (`Q3 2026`) and a "加入内测" CTA. Real apps can be added with lifecycle + private fields following the workflow in Task 9's skill.

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
|---|---|
| §3 Site structure | Tasks 4, 5, 8 (new files: roadmap.html, .gitignore) |
| §4.1 Dual output flow | Task 2 (omitPrivate + --private flag in main()) |
| §4.2 omitPrivate rules | Task 2 (export + test) |
| §4.3 Entry-point split | Task 2 (process.argv check) |
| §4.4 No new deps | All tasks (zero deps added) |
| §5 Data schema | Task 1 (validate extensions) |
| §5.4 Idea minimum fields | Task 1 (validate override) |
| §6.1 Public homepage | Task 4 (template + status filter + COMING SOON + badges) |
| §6.2 Public detail page | Task 5 (template + status badge + CTA + RELEASES) |
| §6.3 Private roadmap | Task 3 (template + render.roadmap + 5 sections) |
| §7 CI/deployment | Task 11 (push + watch + verify) |
| §8 Workflow (A-F operations) | Task 9 (skill documentation) |
| §9 Skill update | Task 9 |
| §10 Acceptance criteria | Tasks 1, 2, 3, 4, 5, 6, 7, 8, 10, 11 (each AC verified end-to-end) |

**Placeholder scan:** No `TBD` / `TODO` / `FIXME` / `XXX` used as placeholders. (The string "TBD" appears once in the home template — it is the literal text the page renders when an in-development app has no `targetDate`, not a placeholder for missing content.) Every code block is complete. Every command has expected output.

**Type/name consistency:**

- `omitPrivate(app)` exported from `build.mjs` — used in Task 2 main() and tested.
- `deriveQuarter(iso)` exported from `build.mjs` — used in Task 4 (appsContext) and tested.
- `render.roadmap(apps)` defined as `render.roadmap = async function (apps)` (mutating the existing `render` object) — used in Task 2 main() and tested.
- `LIFECYCLE_STATUSES` set module-scoped — used in Task 1 validate.
- `parseISODate(str)` module-scoped helper — used in Task 1 validate.
- `roadmapScope(apps)` function-scoped helper — used in Task 3 render.roadmap.
- Template field names (`statusLaunchedOrBeta`, `statusIsInDevOrIdea`, `statusBadge`, `statusBadgeKey`, `targetQuarter`, `hasComingSoon`, `primaryCtaUrl`, `primaryCtaLabel`, `topVersion`, `topReleasedAt`, `now`, `planned`, `shipped`, `allBlockers`, `allTodos`, `today`, `counts`) match between the appsContext / render.app / roadmapScope definitions and the template references.

**Test count after plan:** 14 (v1) + 8 (Task 1) + 7 (Task 2) + 2 (Task 3) = **31 tests, all expected to pass**.
