# CMS Layouts — Developer Reference

A **CmsLayout** is a named template that defines which **areas** a page has and which
**widgets** fill each area by default. Pages are assigned a layout; the layout controls
the page's structural skeleton.

---

## Concepts

```
CmsLayout
  └── areas[]          ← JSON array of area definitions (name, type, label)
        └── CmsLayoutWidget   ← join table: which widget fills which area
              └── CmsWidget   ← the actual content block
```

A page's `layout_id` → resolves to a `CmsLayout` → its areas → each area's assigned
widget is fetched via `CmsLayoutWidget`.

---

## Area definition schema

Each entry in `CmsLayout.areas` is a JSON object:

```json
{
  "name":  "hero",
  "type":  "hero",
  "label": "Hero Banner"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier within this layout. Used as `area_name` in `CmsLayoutWidget`. |
| `type` | string | Rendering hint for the frontend and admin. Must be in `AREA_TYPES`. |
| `label` | string | Human-readable label shown in the layout editor. |

---

## Area types reference

| Type | Frontend wrapper class | Typical use |
|------|----------------------|-------------|
| `header` | `cms-area--header` | Site header / navigation |
| `footer` | `cms-area--footer` | Site footer |
| `hero` | `cms-area--hero` | Full-width hero banner |
| `slideshow` | `cms-area--slideshow` | Carousel / feature slideshow |
| `content` | `cms-area--content` | Main article content area |
| `three-column` | `cms-area--three-col` | 3-column feature grid |
| `two-column` | `cms-area--two-col` | 2-column section |
| `cta-bar` | `cms-area--cta` | Call-to-action bar |
| `vue-component` | `cms-area--vue` | Renders a `vue-component` widget |

---

## Built-in layouts (seeded by `populate_cms.py`)

| Slug | Areas | Default widget assignments |
|------|-------|---------------------------|
| `home-v1` | header, hero, features, cta, footer | header-nav, hero-home1, features-3col, cta-primary, footer-nav |
| `home-v2` | header, hero, pricing, testimonials, footer | header-nav, hero-home2, pricing-2col, testimonials, footer-nav |
| `landing` | header, hero, features, cta, social-proof, footer | header-nav, hero-home1, features-3col, cta-primary, testimonials, footer-nav |
| `content-page` | header, main, footer | header-nav, (no default for main), footer-nav |
| `native-pricing-page` | header, main (vue-component), footer | header-nav, pricing-native-plans, footer-nav |

---

## Creating a new layout — step by step

### 1. Via the admin UI

1. Navigate to **CMS → Layouts → New Layout**
2. Fill in slug, name, description
3. Add areas using the area builder (click "+ Add Area", fill name/type/label)
4. Save layout
5. Assign default widgets to areas using the widget picker
6. Use the layout on a new or existing page

### 2. Via `populate_cms.py` (idempotent seed script)

```python
# vbwd-backend/plugins/cms/src/bin/populate_cms.py

LAYOUTS.append({
    "slug": "my-custom-page",
    "name": "My Custom Page",
    "description": "Header + custom area + footer.",
    "sort_order": 20,
    "areas": [
        {"name": "header",  "type": "header",       "label": "Header"},
        {"name": "sidebar", "type": "two-column",    "label": "Sidebar Content"},
        {"name": "main",    "type": "content",       "label": "Main Content"},
        {"name": "footer",  "type": "footer",        "label": "Footer"},
    ],
    "widget_assignments": [
        ("header", "header-nav"),
        ("footer", "footer-nav"),
        # sidebar and main left unassigned — page provides content_html directly
    ],
})
```

Run: `docker compose exec api python plugins/cms/src/bin/populate_cms.py`

---

## Layout editor in the admin (`CmsLayoutEditor.vue`)

The layout editor has three sections:

**1. Metadata** — slug, name, description, sort_order

**2. Area builder** — a draggable list of area definitions. Each row:
- `name` input (must be unique within layout, slug-like: `hero`, `main-content`)
- `type` dropdown (values from `AREA_TYPES`)
- `label` input (human readable)
- Delete button

**3. Widget assignments** — for each defined area, a `CmsWidgetPicker` dropdown to choose
the default widget. Assignments are saved as `CmsLayoutWidget` records.

---

## `CmsLayoutWidget` — the assignment join table

```python
class CmsLayoutWidget(BaseModel):
    layout_id  = FK → CmsLayout   (cascade delete)
    widget_id  = FK → CmsWidget   (restrict — cannot delete widget in use)
    area_name  = str               (must match a name in layout.areas)
    sort_order = int               (for multiple widgets per area, future)
```

Deletion behaviour:
- Deleting a **layout** cascades to `CmsLayoutWidget` rows
- Deleting a **widget** that is assigned to a layout is **blocked** (FK restrict)
  — unassign from layouts first

---

## How the frontend renders a layout

```
GET /api/v1/cms/pages/:slug
  → { layout: { slug, areas, widgets: [{ area_name, widget }] } }
    → CmsPage.vue resolves layout
      → CmsLayout.vue iterates areas[]
        → for each area: find matching widget from page.layout.widgets
          → render CmsWidgetRenderer.vue with { widget, area }
            → widget_type dispatcher:
                html           → <div v-html="decoded_content" />
                menu           → <CmsMenuWidget :items="widget.menu_items" />
                slideshow      → <CmsSlideshowWidget :slides="widget.content_json.slides" />
                vue-component  → <CmsVueComponentWidget :config="widget.config" />
```

---

## Layout inheritance and page-level overrides

- A page's `content_html` field is rendered in the `content` area if no widget is assigned
- A page's `content_json` (TipTap document) is rendered in the `content` area if no widget
  and no `content_html` is present
- Widget assignments on the layout are defaults; future: per-page widget overrides

---

## Plugin-specific layouts

Plugins can seed their own layouts using the same `populate_cms.py` pattern or a plugin-specific
populate script. GHRM uses this to create the software catalogue and detail page layouts.

Key rule: **layouts are CMS-owned** — plugins add to the layout catalogue, but never modify
existing layouts. If a plugin needs a custom area, it creates its own layout slug with a
plugin-namespaced prefix (e.g. `ghrm-catalogue`, `ghrm-detail`).
