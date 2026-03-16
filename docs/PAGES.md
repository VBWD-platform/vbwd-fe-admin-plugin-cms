# CMS Pages — Developer Reference

A **CmsPage** is a publicly accessible URL with its own slug, layout, style, and content.
Pages are the top-level publishing unit in the CMS.

---

## Page fields reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | yes | URL path (e.g. `about`, `de/home`, `pricing-embedded`). Unique. |
| `name` | string | yes | Admin display name. Not shown to users. |
| `language` | string | yes | ISO 639-1 code (e.g. `en`, `de`, `fr`). Default: `en`. |
| `layout_id` | FK | yes | Which `CmsLayout` defines the page structure. |
| `style_id` | FK | no | Which `CmsStyle` applies the theme CSS. |
| `content_json` | JSON | no | TipTap rich-text document. Rendered in `content` area if no widget assigned. |
| `content_html` | Text | no | Raw HTML fallback for `content` area. Takes precedence over `content_json`. |
| `source_css` | Text | no | Page-specific CSS injected into the page's `<style>` tag. |
| `is_published` | bool | yes | Only published pages are accessible via the public API. |
| `meta_title` | string | no | `<title>` tag. Defaults to `name`. |
| `meta_description` | string | no | `<meta name="description">` |
| `meta_keywords` | string | no | `<meta name="keywords">` (legacy, still used by some crawlers) |
| `og_title` | string | no | Open Graph title |
| `og_description` | string | no | Open Graph description |
| `og_image_url` | string | no | Open Graph image |
| `canonical_url` | string | no | Canonical URL override |
| `robots` | string | no | Robots directive. Default: `index,follow` |
| `schema_json` | JSON | no | Structured data (JSON-LD) injected in `<script type="application/ld+json">` |
| `use_theme_switcher_styles` | bool | yes | Whether the frontend theme-switcher applies styles to this page. Default: `true`. |
| `sort_order` | int | no | Admin list ordering. |

---

## Page routing

The `vbwd-fe-user` CMS plugin registers a catch-all route:

```typescript
// vbwd-fe-user/plugins/cms/index.ts
sdk.addRoute({ path: '/:slug(.+)', name: 'CmsPage', component: () => import('./src/views/CmsPage.vue') })
```

The route regex `(.+)` matches any path including slashes, so `/de/home`, `/pricing/embedded`,
and `/about` all resolve to `CmsPage.vue`. The component calls:

```
GET /api/v1/cms/pages/:slug
```

where `:slug` is the full URL path (e.g. `de/home`).

**Plugin routes take priority.** Routes registered before the CMS catch-all (e.g. GHRM's
`/category/:cat/:pkg`) are matched first. The CMS catch-all only fires if no other route matches.

---

## Multilingual pages — slug convention

VBWD uses a **path-prefix slug convention** for multilingual content:

```
/home           ← English (default)
/de/home        ← German
/fr/home        ← French
/de/pricing     ← German pricing page
```

`CmsPage.slug` stores the full path including the language prefix: `"de/home"`.
`CmsPage.language` stores the ISO code: `"de"`.

These are **independent pages** — there is no explicit translation link between `home` and
`de/home`. They are managed separately by the admin. This keeps translation decoupled from
the routing system.

**Routing rules** (Sprint 08) can redirect `/` to `/de/home` based on Accept-Language
header, GeoIP, or cookie — see `docs/dev_log/20260314/sprints/08-cms-routing-rules.md`.

---

## Publishing workflow

| State | `is_published` | Accessible via public API | Accessible in admin |
|-------|---------------|--------------------------|---------------------|
| Draft | `false` | No (404) | Yes |
| Published | `true` | Yes | Yes |

Bulk operations available via admin API:
- `POST /api/v1/admin/cms/pages/bulk/publish` — publish selected pages
- `POST /api/v1/admin/cms/pages/bulk/unpublish` — unpublish selected pages

---

## Page editor in the admin (`CmsPageEditor.vue`)

The editor is divided into two panels:

**Left panel — Content:**
- TipTap rich-text editor for `content_json` (WYSIWYG)
- "HTML mode" toggle to edit `content_html` directly (CodeMirror HTML mode)
- `source_css` textarea (CodeMirror CSS mode)

**Right panel — Settings:**
- Slug input (with live URL preview)
- Language selector
- Layout picker (dropdown of available `CmsLayout` slugs)
- Style picker (dropdown of available `CmsStyle` slugs)
- Published toggle
- SEO fields accordion: meta_title, meta_description, keywords, og_*, canonical_url, robots
- Schema JSON textarea (CodeMirror JSON mode)

---

## Seeding pages via `populate_cms.py`

```python
# vbwd-backend/plugins/cms/src/bin/populate_cms.py

_get_or_create_page(
    "de/home",                      # slug
    "Startseite",                   # name (admin display)
    layout_map["home-v1"],          # layout
    style_map["light-clean"],       # style
    content_html="<h1>Willkommen</h1>",
    meta_description="Willkommen auf unserer Plattform.",
    sort_order=15,
)
```

`_get_or_create_page()` is idempotent: if the slug exists, fields are updated; if not, created.

---

## Content rendering priority

When the frontend renders a page's `content` area, the priority is:

1. **Widget assigned to the `content` area** in the layout's `CmsLayoutWidget` table
2. **`content_html`** (raw HTML) if no widget is assigned
3. **`content_json`** (TipTap document) if neither widget nor `content_html` is present
4. Empty — no output

For `vue-component` area types, only a widget of type `vue-component` is rendered — the
page's own `content_html`/`content_json` is ignored for that area.

---

## Plugin-specific pages

Plugins seed their own CMS pages using `populate_cms.py` or a plugin-specific populate script.

**Rule:** plugin pages must use namespaced slugs:
- GHRM: `ghrm/catalogue`, `ghrm/detail` ← rendered by GHRM Vue views via layout
- Email unsubscribe: `email/unsubscribe`

Do not use bare slugs like `catalogue` or `detail` for plugin-specific pages — they would
conflict with CMS pages and other plugins.

---

## Import / export

The admin API supports JSON export/import of pages:

```
GET  /api/v1/admin/cms/pages/export     → JSON array of all page dicts
POST /api/v1/admin/cms/pages/import     → accepts JSON array, idempotent upsert by slug
```

Useful for migrating CMS content between environments.
