# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository identity

- **Repository**: `lipopo/OppLipo` on GitHub (`git@github.com:lipopo/OppLipo.git`)
- **Type**: GitHub **project site** (the repo is *not* named `lipopo.github.io`, so without the
  CNAME it would be served from `https://lipopo.github.io/OppLipo/`).
- **Custom domain**: `info.opplipo.cn` — set by the `CNAME` file at the repo root. Because of
  the CNAME, content is served from the **repo root**, not from a subpath. Treat root paths
  (no leading `/OppLipo/`) as the public URL base.
- **Default branch**: `main`. Currently the site is empty (only `CNAME` and `README.md` exist),
  so any new content added to `main` is what will go live.

If you ever rename the repo to `lipopo.github.io`, this becomes the **user site** and the
CNAME / root-path assumption above still holds (CNAME rules do not change), but DNS for the
custom domain must be re-verified in the repo's Pages settings.

## Local preview

GitHub Pages serves static files, so any static-file HTTP server works. Pick one based on
what's installed in this environment (Ruby 3.3.8, Python 3.13.5, and Node 20 are all
available):

```bash
# Python (always present, zero deps)
python3 -m http.server 4000

# Ruby (built-in)
ruby -run -e httpd . -p 4000

# Node (npx, no global install)
npx --yes http-server -p 4000 .
```

Open `http://localhost:4000/`. There is no build step required for plain HTML/CSS/JS.

If/when a static site generator (SSG) is added, use its dev server instead — see
**Adding an SSG later** below.

## Deployment

This repo is expected to use **Deploy from a branch** (the simplest Pages source) —
that's still fully supported, even though GitHub's own docs now call **GitHub Actions
the recommended approach** for new Pages sites that need a build process.

- **Source branch**: `main`
- **Source folder**: `/` (repo root) — do **not** move content into `/docs` unless the
  Pages source setting is changed to match.
- **Trigger**: every push to `main` triggers a Pages build (typically < 1 min for plain
  static content).
- **Build timeout**: Pages deployments abort after **10 minutes** — non-issue for plain
  HTML, but a hard cap if an SSG is added later.

To deploy, just `git push origin main` — no separate publish step, no CI workflow required.
Verify a successful build under the repo's **Actions → "pages build and deployment"** tab
and on the live site at `https://info.opplipo.cn/`.

If a build fails because of a missing `_config.yml` and the user wants Jekyll out of the
way, the simplest fix is to add an empty `.nojekyll` file at the repo root — this tells
GitHub Pages to skip Jekyll processing and serve files verbatim.

**Quirk to remember if an SSG is added later:** if the build output is force-pushed to
the repo, the `CNAME` file can be silently overwritten/lost. Always `git pull` after
any Pages-managed commit and ensure the SSG's output pipeline does not delete files
outside its build directory. The official advice is to either (a) keep build output in
`/docs` so the root is untouched, or (b) switch to the Actions workflow which handles
the CNAME for you.

**Public-visibility warning:** GitHub Pages sites are **publicly accessible on the
internet even when the repository is private**. Do not commit anything to the
publishing branch that you wouldn't want the world to see — secrets, drafts,
unreleased content, internal docs.

## Custom domain: `info.opplipo.cn`

The `CNAME` file content must be exactly one line — the bare hostname, **no protocol, no
path, no trailing slash, no port**:

```
info.opplipo.cn
```

This matches the current file. Do not "fix" it by adding `https://` or a trailing `/`.
Additional rules from GitHub's troubleshooting guide that are easy to break:

- The filename must be **`CNAME`** (all uppercase).
- The file can contain **only one domain** — to point multiple domains at the site, set
  up the redirect at the DNS provider instead.
- The full domain must be **unique across all GitHub Pages sites**.
- The full domain name must be **< 64 characters** (RFC 3280) so Let's Encrypt can issue
  a cert. `info.opplipo.cn` is well under that limit; just keep it in mind for any
  future change.

DNS requirements (one-time setup at the DNS provider, not in this repo):

- **`info.opplipo.cn` is a subdomain** of `opplipo.cn`, so a `CNAME` record pointing to
  `lipopo.github.io.` is the correct form. The CNAME should *exclude* the repository
  name — just point at the user/org domain. (If the user later switches to the apex
  `opplipo.cn`, it needs an `A` record pointing to GitHub's four Pages IPs **plus** an
  `AAAA` record for IPv6. The IPv4 IPs have been stable since 2024: `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. The IPv6 set is
  `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
  `2606:50c0:8003::153`.)
- GitHub recommends **verifying the domain first** (TXT record at
  `_github-pages-challenge-USERNAME.example.com`) before assigning it to a repo, so that
  no other user can claim the same custom domain if the repo is later deleted or the
  plan downgrades.
- Do **not** use wildcard DNS records (`*.example.com`) — GitHub explicitly warns that
  they make subdomain takeover possible even on a verified domain.
- If the DNS provider injects a default record (e.g. a parking A record), remove it
  before pointing at GitHub.

HTTPS:

- Tick **Enforce HTTPS** in **Settings → Pages** once DNS is live and the Let's Encrypt
  cert has been issued. This can take **up to 24 hours** for a new custom domain
  (15 min for an already-verified repo); a first-time custom domain sometimes needs the
  domain to be removed and re-added in the UI to retrigger provisioning.
- If using CAA records at the DNS provider, **at least one must have the value
  `letsencrypt.org`** or cert issuance will silently fail.
- `Enforce HTTPS` is only available once the repo has a valid cert; do not assume the
  toggle is broken just because it appears missing on day one.

If a future change moves to a different domain, the `CNAME` file must be updated in the
**same commit** as the content that assumes the new domain — GitHub will reject the build
if the served CNAME does not match the configured custom domain.

## Content & structure conventions

- **`index.html` is the homepage.** It must live at the top level of the publishing
  source (repo root for branch deploy, or `/docs` if that is the configured source).
  The filename is **case-sensitive** — `Index.html` or `index.HTML` will not be picked
  up. A missing `index.html` produces a 404 (not a directory listing) on GitHub Pages.
- **`404.html` (or `404.md` with front matter `permalink: /404.html`)** at the source
  root is served for any missing path. Keep it light — a single styled page that links
  back home is enough.
- **Asset paths must be root-relative, not absolute host paths.** Because the site is
  served from `https://info.opplipo.cn/` (not `…/OppLipo/`), `/style.css` resolves
  correctly. Avoid `https://lipopo.github.io/OppLipo/...` literals — they will break
  the moment the CNAME or repo name changes.
- **Avoid Jekyll-excluded paths** unless `.nojekyll` is added at the root. By default
  GitHub Pages runs Jekyll, which skips files or folders that:
  - Start with `_`, `.`, or `#` (e.g. `/_drafts/`, `/.git/`, `/#cache/`)
  - End with `~` (editor backups)
  - Live under `/node_modules` or `/vendor`
  - Are listed in the `exclude:` key of `_config.yml`
  This matters for: hidden folders like `/.github` are **not** served, so CI config,
  issue templates, etc. are safe; but asset folders that legitimately start with `_`
  (e.g. `/_img/`) or with `#` will be silently missing from the build.
- **Symbolic links are not supported** with branch-deploy: if the repo contains any
  symlinks, GitHub Pages will refuse to publish and you'll need to switch to a custom
  GitHub Actions workflow.

## File & size limits (GitHub Pages)

From the official "GitHub Pages limits" doc. These are soft / recommended caps — Pages
is not designed as a general web host.

- **Repo source size**: recommended cap **1 GB** (Git's general large-file warnings apply
  on top of this; LFS files are not served by Pages).
- **Published site size**: **1 GB** soft cap.
- **Build timeout**: **10 minutes** per deployment.
- **Bandwidth**: **100 GB / month** soft cap.
- **Builds**: **10 / hour** soft cap — does **not** apply if the site is built and
  published by a custom GitHub Actions workflow.
- **Rate limits**: HTTP 429 may be returned under heavy load; legitimate use is not
  expected to hit these.
- **One site per account** for the user/org site; **one site per repo** for project
  sites (so this repo can have at most one Pages site).
- **TOS**: not for e-commerce, SaaS, or "primarily commercial" use; not for sensitive
  transactions (passwords, payment data). Educational reimplementations of existing
  sites are allowed as long as the code is original, no user data is collected, and a
  prominent disclaimer is shown.

In short: keep the site small and static. For media-heavy assets, link to external
storage (release assets, an object store) rather than committing them.

## Git workflow

- **GitHub API operations** (PRs, issues, labels, milestones, releases, reviews): use
  the `tea` CLI, **not** `gh` (per the global `~/.claude/CLAUDE.md` rule). Basic git
  operations (`clone`, `add`, `commit`, `push`, `branch`, `fetch`) still use plain `git`.
- **Default branch is `main`**, and the live site is built from it. There are currently
  no `gh-pages` branch, no `docs/` folder, and no GitHub Actions workflow — keep it that
  way unless the user asks for a different source.
- **Observed commit style** (from `git log`):
  - Short, sentence-case subject line (`Setup Project`, `Update CNAME`, `Create CNAME`,
    `first commit`).
  - Single-purpose commits that touch one or two files.
  - No `Co-Authored-By` trailers, no conventional-commit prefixes.

  Follow the same style for new commits on this repo.

## Known quirks of the current tree

- **`README.md` is encoded as UTF-16 LE with a BOM** (`ff fe …`). GitHub renders it, but
  every other tool (editors, `cat`, Jekyll) may misread it. If you rewrite it, save as
  **UTF-8 without BOM** — that's the convention for Markdown on GitHub.
- **`CNAME` is the only thing keeping the site on `info.opplipo.cn`.** Deleting or
  renaming it will cause GitHub to fall back to `lipopo.github.io/OppLipo/` and may break
  inbound links to the custom domain.
- **No `.nojekyll` file yet.** If content uses Jekyll-excluded paths (anything starting
  with `_` or `.`), or non-HTML files that you want served verbatim (e.g. raw `.json`,
  `.xml`), add a one-line empty `.nojekyll` at the root.

## Adding an SSG later

If the user later asks for Jekyll, Hugo, or another generator:

- **Jekyll**: built-in, no CI needed. Pin versions in a `Gemfile` to avoid surprise
  builds (GitHub periodically bumps the supported Jekyll version). Plugins must be on
  GitHub's [whitelisted plugins list](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll#plugins); anything else requires a custom Actions workflow. Some Jekyll
  settings are pinned by GitHub and cannot be overridden: `safe: true`,
  `lsi: false`, `incremental: false`, `highlighter: rouge`,
  `kramdown.syntax_highlighter: rouge`, `kramdown.math_engine: mathjax`. Note that
  GitHub's docs now treat **Actions as the recommended path** even for Jekyll, so a
  Jekyll build that needs flexibility should be moved off the implicit build.
- **Hugo / Astro / Next.js / Eleventy / etc.**: GitHub Pages does **not** build them
  natively with branch-deploy. Add a custom GitHub Actions workflow under
  `.github/workflows/` using the official Pages actions
  (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`,
  `actions/deploy-pages@v4`, and `actions/jekyll-build-pages@v1` if Jekyll). The
  artifact must be a single `.tar.gz` under 10 GB, **with no symlinks**; `index.html`
  must be at the top level of the artifact. Required job permissions are
  `pages: write` and `id-token: write`. Update this CLAUDE.md's **Deployment** section
  when the workflow lands.
- **Local dev**: each SSG has its own dev server — `bundle exec jekyll serve`,
  `hugo server`, `npm run dev`. Replace the `python3 -m http.server` command in
  **Local preview** with the SSG's command once added.
