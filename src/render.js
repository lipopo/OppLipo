import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate } from './template.js';
import { extractText, extractHeadings } from './extract.js';
import { escHtml, computeRelated, computeReadingMinutes } from './util.js';
import { aggregateRecentReleases, buildSearchIndex, buildAtomFeed, buildSitemap, renderAtomXml, renderSitemap, walkThoughts, renderMarkdown, renderMarkdownLite, SITE_TAGLINE } from './data.js';
import { ogMetaTags } from './og.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const render = {
  async home(apps, site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'home.html'), 'utf8');
    const featuredApps = apps.filter((a) => a.featured);

    // Enrich featured apps with status badges and CTA fields (same logic as appsContext + render.app)
    const enrichedFeaturedApps = featuredApps.map((a, idx) => {
      const status = a.lifecycle?.status ?? 'launched';
      const statusBadge = status === 'beta' ? 'Beta' : null;
      const statusBadgeKey = status === 'beta' ? 'beta' : null;
      // CTA: for in-development/idea, prefer betaSignupUrl; for launched/beta, use primaryPlatform
      let primaryCtaUrl = null;
      let primaryCtaLabel = null;
      if (status === 'in-development' || status === 'idea') {
        if (a.lifecycle?.betaSignupUrl) {
          primaryCtaUrl = a.lifecycle.betaSignupUrl;
          primaryCtaLabel = '加入内测';
        }
      } else {
        const primary = a.platforms.find((p) => p.primary) || a.platforms[0];
        if (primary) {
          primaryCtaUrl = primary.url;
          primaryCtaLabel = primary.label;
        }
      }
      return {
        ...a,
        statusBadge,
        statusBadgeKey,
        primaryCtaUrl,
        primaryCtaLabel,
        targetQuarter: a.lifecycle?.targetQuarter ?? null,
        firstDotActive: idx === 0,
      };
    });

    const recentReleases = aggregateRecentReleases(apps);
    const scope = {
      ...appsContext(apps),
      site: { tagline: SITE_TAGLINE },
      featuredApps: enrichedFeaturedApps,
      recentReleases,
      hasFeaturedApps: enrichedFeaturedApps.length > 0,
      hasRecentReleases: recentReleases.length > 0,
      ogMetaTags: ogMetaTags({ title: '我的 APP | info.opplipo.cn', description: SITE_TAGLINE, url: 'https://info.opplipo.cn/', type: 'website' }),
      thoughtCount: (thoughts ?? []).length,
      collectionCount: (site?.collections ?? []).length,
      nowUpdatedAt: site?.now?.text ? new Date().toISOString().slice(0, 10) : '—',
      usesItemCount: (site?.uses?.categories ?? []).reduce(
        (sum, c) => sum + (c.items?.length ?? 0), 0),
      changelogCount: aggregateRecentReleases(apps, Infinity).length,
    };
    scope['site.tagline'] = SITE_TAGLINE;
    return renderTemplate(tpl, scope);
  },

  async app(app, thoughts) {
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

    const relatedThoughts = (thoughts ?? []).filter((t) => {
      const refs = t.appSlugs ?? [];
      return refs.includes(app.slug) || (app.thoughtSlugs ?? []).includes(t.slug);
    });

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
      relatedThoughts,
      ogMetaTags: ogMetaTags({
        title: `${app.name} | info.opplipo.cn`,
        description: app.tagline,
        url: `https://info.opplipo.cn/apps/${app.slug}/`,
      }),
    };
    const scope = {
      ...enriched,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
    };
    return renderTemplate(tpl, scope);
  },

  async roadmap(apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'roadmap.html'), 'utf8');
    return renderTemplate(tpl, roadmapScope(apps));
  },

  async about(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'about.html'), 'utf8');
    const scope = {
      ...site,
      author: {
        ...site.author,
        bioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
      },
      authorBioHtml: site.author.bio ? renderMarkdown(site.author.bio) : '',
      ogMetaTags: ogMetaTags({
        title: `${site.author.name} | info.opplipo.cn`,
        description: site.author.tagline,
        url: 'https://info.opplipo.cn/about/',
        type: 'profile',
      }),
      social: site.author.social ?? [],
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
    };
    return renderTemplate(tpl, scope);
  },

  async thoughtsIndex(site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'thoughts-index.html'), 'utf8');
    // Build tree structure for template (preserves folder grouping).
    const tree = site.thoughts?.tree ?? [];
    const treeForTemplate = tree.map((item) => {
      if (item.type === 'folder') {
        return {
          isFolder: true,
          name: item.name,
          children: item.children.map((c) => {
            const t = thoughts.find((x) => x.path === c.path);
            return { slug: t ? t.slug : slugify(c.path), title: c.title };
          }),
        };
      } else {
        const t = thoughts.find((x) => x.path === item.path);
        return { isFile: true, slug: t ? t.slug : slugify(item.path), title: item.title };
      }
    });
    // Recent 10 thoughts, sorted by date desc
    const recentThoughts = [...thoughts]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((t) => ({ slug: t.slug, title: t.title, date: t.date }));
    const scope = {
      ...site,
      treeForTemplate,
      recentThoughts,
      thoughtCount: thoughts.length,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '想法 | info.opplipo.cn',
        description: '开发笔记与思考',
        url: 'https://info.opplipo.cn/thoughts/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async collectionsIndex(site, apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'collections-index.html'), 'utf8');
    const scope = {
      ...site,
      apps,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '精选 | info.opplipo.cn',
        description: '按主题/质量分组的应用合集',
        url: 'https://info.opplipo.cn/collections/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async collectionPage(collection, apps, site) {
    const tpl = await readFile(join(ROOT, 'templates', 'collection.html'), 'utf8');
    const filteredApps = apps.filter((a) => collection.appSlugs.includes(a.slug));
    const scope = {
      ...collection,
      apps: filteredApps,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: `${collection.title} | info.opplipo.cn`,
        description: collection.description,
        url: `https://info.opplipo.cn/collections/${collection.slug}/`,
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async now(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'now.html'), 'utf8');
    const scope = {
      ...site,
      now: { ...site.now, html: site.now?.text ? renderMarkdown(site.now.text) : '' },
      updatedAt: new Date().toISOString().slice(0, 10),
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '现在 | info.opplipo.cn',
        description: site.now?.lastModified ? `现在 · ${site.now.lastModified}` : '现在',
        url: 'https://info.opplipo.cn/now/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async uses(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'uses.html'), 'utf8');
    const categories = (site.uses?.categories ?? []).map((cat) => ({
      ...cat,
      items: (cat.items ?? []).map((it) => ({
        ...it,
        notesHtml: it.notes ? renderMarkdown(it.notes) : '',
      })),
    }));
    const scope = {
      ...site,
      uses: { ...site.uses, categories },
      // Hoist categories to top-level so the engine's applyEach picks it up
      // (engine only iterates top-level array keys).
      categories,
      itemCount: categories.reduce((sum, c) => sum + c.items.length, 0),
      categoryCount: categories.length,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '使用 | info.opplipo.cn',
        description: `${categories.reduce((s, c) => s + c.items.length, 0)} 件装备`,
        url: 'https://info.opplipo.cn/uses/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async search(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'search.html'), 'utf8');
    const scope = {
      ...site,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '搜索 | info.opplipo.cn',
        description: '站内搜索',
        url: 'https://info.opplipo.cn/search/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async notFound(requestedPath = '/') {
    const tpl = await readFile(join(ROOT, 'templates', '404.html'), 'utf8');
    const scope = {
      requestedPath,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: '404 | info.opplipo.cn',
        description: '',
        url: 'https://info.opplipo.cn/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async changelog(site, apps) {
    const tpl = await readFile(join(ROOT, 'templates', 'changelog.html'), 'utf8');
    const allReleases = aggregateRecentReleases(apps, Infinity);
    const scope = {
      ...site,
      releases: allReleases,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: 'changelog | info.opplipo.cn',
        description: `${allReleases.length} 条发布`,
        url: 'https://info.opplipo.cn/changelog/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async archive(site, thoughts) {
    const tpl = await readFile(join(ROOT, 'templates', 'archive.html'), 'utf8');
    const sorted = [...(thoughts ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const scope = {
      ...site,
      items: sorted,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: 'archive | info.opplipo.cn',
        description: '所有 thoughts 的扁平时间线',
        url: 'https://info.opplipo.cn/archive/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async colophon(site) {
    const tpl = await readFile(join(ROOT, 'templates', 'colophon.html'), 'utf8');
    const c = site.colophon ?? {};
    const scope = {
      ...site,
      colophon: {
        ...c,
        philosophyHtml: c.philosophy ? renderMarkdown(c.philosophy) : '',
        structureHtml: c.structure ? renderMarkdown(c.structure) : '',
      },
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: 'colophon | info.opplipo.cn',
        description: '本站是如何构建的',
        url: 'https://info.opplipo.cn/colophon/',
      }),
    };
    return renderTemplate(tpl, scope);
  },

  async thoughtPage(thought, allThoughts, site) {
    const tpl = await readFile(join(ROOT, 'templates', 'thought.html'), 'utf8');
    // Build the file tree in the same order as the index page.
    // If the tree is empty (e.g. in tests), fall back to a flat list of
    // all thoughts so the sidebar is still meaningful.
    const tree = site.thoughts?.tree ?? [];
    let treeForTemplate;
    if (tree.length > 0) {
      treeForTemplate = tree.map((item) => {
        if (item.type === 'folder') {
          return {
            isFolder: true,
            name: item.name,
            children: item.children.map((c) => {
              const t = allThoughts.find((x) => x.path === c.path);
              return {
                slug: t ? t.slug : slugify(c.path),
                title: c.title,
                isActive: t && t.slug === thought.slug,
              };
            }),
          };
        } else {
          const t = allThoughts.find((x) => x.path === item.path);
          return {
            isFile: true,
            slug: t ? t.slug : slugify(item.path),
            title: item.title,
            isActive: t && t.slug === thought.slug,
          };
        }
      });
    } else {
      // Flat-list fallback: bucket thoughts by folder, preserving the order
      // they appear in `allThoughts` (top-level files first, then folders
      // grouped by first occurrence).
      const folders = new Map();
      const topFiles = [];
      for (const t of allThoughts) {
        if (t.folder) {
          if (!folders.has(t.folder)) folders.set(t.folder, []);
          folders.get(t.folder).push(t);
        } else {
          topFiles.push(t);
        }
      }
      treeForTemplate = [
        ...topFiles.map((t) => ({
          isFile: true,
          slug: t.slug,
          title: t.title,
          isActive: t.slug === thought.slug,
        })),
        ...[...folders.entries()].map(([name, items]) => ({
          isFolder: true,
          name,
          children: items.map((t) => ({
            slug: t.slug,
            title: t.title,
            isActive: t.slug === thought.slug,
          })),
        })),
      ];
    }
    // Prev/next: top-down order. When the tree is non-empty, follow the
    // tree's order; otherwise follow the order of `allThoughts` itself.
    const flat = [];
    if (tree.length > 0) {
      for (const item of tree) {
        if (item.type === 'file') flat.push(item.path);
        else if (item.type === 'folder') for (const c of item.children) flat.push(c.path);
      }
    } else {
      for (const t of allThoughts) flat.push(t);
    }
    const idx = tree.length > 0
      ? flat.indexOf(thought.path)
      : flat.findIndex((t) => t.slug === thought.slug);
    const prevEntry = idx > 0 ? flat[idx - 1] : null;
    const nextEntry = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
    const prev = prevEntry
      ? (tree.length > 0
          ? allThoughts.find((x) => x.path === prevEntry)
          : prevEntry)
      : null;
    const next = nextEntry
      ? (tree.length > 0
          ? allThoughts.find((x) => x.path === nextEntry)
          : nextEntry)
      : null;
    const headings = extractHeadings(thought.body);
    const contentHtml = renderMarkdown(thought.body).replace(
      /<h2>([^<]+)<\/h2>/g,
      (_, text) => {
        const idx = headings.findIndex((h) => h.text === text);
        return idx >= 0
          ? `<h2 id="toc-${idx + 1}">${text}</h2>`
          : `<h2>${text}</h2>`;
      }
    );
    // Only emit toc when there are ≥ 2 headings (avoids {{#if toc.length}} matching
    // toc.length=1, since the engine treats the number 1 as truthy).
    const toc = headings.length >= 2 ? headings : null;
    const scope = {
      ...thought,
      contentHtml,
      treeForTemplate,
      prev: prev ? { slug: prev.slug, title: prev.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
      related: computeRelated(thought, allThoughts),
      readingMinutes: computeReadingMinutes(thought.body),
      toc: headings.length >= 2 ? headings : null,
      assets: { styles: '/assets/styles.css', app: '/assets/app.js' },
      year: String(new Date().getFullYear()),
      ogMetaTags: ogMetaTags({
        title: `${thought.title} | info.opplipo.cn`,
        description: thought.excerpt,
        url: `https://info.opplipo.cn/thoughts/${thought.slug}/`,
        type: 'article',
      }),
    };
    return renderTemplate(tpl, scope);
  },
};
