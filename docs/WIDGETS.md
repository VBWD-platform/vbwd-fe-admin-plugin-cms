# CMS Widgets — Developer Reference

A **CmsWidget** is a self-contained, reusable content block that can be placed into a
layout area. Every widget has a `widget_type` that determines how it is rendered on the
frontend (`vbwd-fe-user`) and how it is edited in the admin.

---

## Current widget types

| Type | Rendered by | Admin editor | Use case |
|------|-------------|--------------|----------|
| `html` | Decoded base64 HTML injected as `v-html` | TipTap + CSS textarea | Hero, CTA, feature sections |
| `menu` | `CmsMenuWidget.vue` — nav links from `CmsMenuItem` rows | `CmsMenuTreeEditor.vue` | Header nav, footer nav |
| `slideshow` | `CmsSlideshowWidget.vue` | Slides list editor | Feature carousels, galleries |
| `vue-component` | `CmsVueComponentWidget.vue` — dynamically resolves component from registry | JSON config editor | Pricing tables, embedded plugins |

---

## Backend: adding a new widget type

### Step 1 — Add to `WIDGET_TYPES` frozenset

```python
# vbwd-backend/plugins/cms/src/models/cms_widget.py
WIDGET_TYPES = frozenset({"html", "menu", "slideshow", "vue-component", "my-new-type"})
```

The frozenset is used for validation only — the DB column is a plain `VARCHAR(32)`, so no
migration is needed when adding a new type.

### Step 2 — No migration needed

`widget_type` is stored as a string. The frozenset is a Python-level guard, not a DB enum.

### Step 3 — Add validation in routes

```python
# plugins/cms/src/routes.py — in the create/update widget endpoint
ALLOWED_WIDGET_TYPES = {"html", "menu", "slideshow", "vue-component", "my-new-type"}
if data.get("widget_type") not in ALLOWED_WIDGET_TYPES:
    return jsonify({"error": "Invalid widget_type"}), 422
```

---

## Frontend: adding a new widget type to the admin editor

### Step 1 — Add to TypeScript union type

```typescript
// vbwd-fe-admin/plugins/cms-admin/src/stores/useCmsAdminStore.ts
export interface CmsWidget {
  // ...
  widget_type: 'html' | 'menu' | 'slideshow' | 'vue-component' | 'my-new-type';
}
```

### Step 2 — Add to the type selector in `CmsWidgetEditor.vue`

```vue
<!-- CmsWidgetEditor.vue — widget_type <select> options -->
<option value="html">HTML / Rich Content</option>
<option value="menu">Navigation Menu</option>
<option value="slideshow">Slideshow</option>
<option value="vue-component">Vue Component</option>
<option value="my-new-type">My New Type</option>
```

### Step 3 — Add the editor panel for the new type

Inside `CmsWidgetEditor.vue`, use `v-if` to show a type-specific editor:

```vue
<template>
  <!-- ...existing type panels... -->

  <div v-if="widget.widget_type === 'my-new-type'" class="widget-editor--my-type">
    <MyNewTypeEditor v-model="widget.config" />
  </div>
</template>
```

### Step 4 — Render on the frontend (`vbwd-fe-user`)

Register a renderer in the CMS page component:

```typescript
// vbwd-fe-user/plugins/cms/src/components/CmsPage.vue (or widget renderer)
const WIDGET_RENDERERS: Record<string, Component> = {
  html:           CmsHtmlWidget,
  menu:           CmsMenuWidget,
  slideshow:      CmsSlideshowWidget,
  'vue-component': CmsVueComponentWidget,
  'my-new-type':  MyNewTypeWidget,   // ← add here
}
```

---

## The `vue-component` widget type

`vue-component` is special: instead of storing HTML content, it stores a **config JSON**
that names a Vue component and passes props to it. The component itself lives in a plugin
(e.g. GHRM), not in the CMS.

### Config schema

```json
{
  "component": "NativePricingPlans",
  "props": {
    "category": "root",
    "plan_count": 3,
    "show_billing_toggle": true,
    "default_billing_period": "monthly"
  }
}
```

### Widget.config field

Stored in `CmsWidget.config` (JSON column, nullable). For all other widget types, `config`
is ignored. For `vue-component`, `content_json` and `source_css` are typically null.

### Admin editor for `vue-component`

`CmsWidgetEditor.vue` shows a JSON editor (CodeMirror in JSON mode) for `config` when
`widget_type === 'vue-component'`. A schema reference panel on the right shows available
registered components and their prop definitions.

### Frontend resolution — `CmsVueComponentWidget.vue`

```typescript
// vbwd-fe-user/plugins/cms/src/components/CmsVueComponentWidget.vue
import { vueComponentRegistry } from '@/registries/vueComponentRegistry'

const resolvedComponent = computed(() =>
  vueComponentRegistry.get(props.config.component) ?? null
)
```

The `vueComponentRegistry` is a singleton that other plugins (GHRM, checkout, etc.) populate
during their `install()` lifecycle hook:

```typescript
// vbwd-fe-user/plugins/ghrm/index.ts — install()
import('./src/views/GhrmCatalogueContent.vue').then(({ GhrmCatalogueContent }) => {
  vueComponentRegistry.register('GhrmCatalogueContent', GhrmCatalogueContent)
})
```

---

## Adding a new area type for widgets

Area types are defined in the backend and in the frontend layout editor:

### Backend

```python
# vbwd-backend/plugins/cms/src/models/cms_layout.py
AREA_TYPES = frozenset({
    "header", "footer", "hero", "slideshow",
    "content", "three-column", "two-column", "cta-bar",
    "vue-component",
    "my-new-area",   # ← add here
})
```

Like `WIDGET_TYPES`, this is a validation frozenset only — no migration needed.

### Frontend layout editor

```typescript
// vbwd-fe-admin/plugins/cms-admin/src/views/CmsLayoutEditor.vue
const AREA_TYPE_OPTIONS = [
  { value: 'header',        label: 'Header' },
  { value: 'footer',        label: 'Footer' },
  { value: 'hero',          label: 'Hero Banner' },
  { value: 'content',       label: 'Content Area' },
  { value: 'three-column',  label: 'Three Columns' },
  { value: 'two-column',    label: 'Two Columns' },
  { value: 'cta-bar',       label: 'CTA Bar' },
  { value: 'vue-component', label: 'Vue Component' },
  { value: 'my-new-area',   label: 'My New Area' },  // ← add
]
```

### Frontend renderer

In `vbwd-fe-user`, the layout renderer maps area type → CSS class / wrapper component:

```typescript
// vbwd-fe-user/plugins/cms/src/components/CmsLayout.vue
const AREA_WRAPPERS: Record<string, string> = {
  header:          'cms-area--header',
  footer:          'cms-area--footer',
  hero:            'cms-area--hero',
  content:         'cms-area--content',
  'three-column':  'cms-area--three-col',
  'two-column':    'cms-area--two-col',
  'cta-bar':       'cms-area--cta',
  'vue-component': 'cms-area--vue',
  'my-new-area':   'cms-area--my-new',  // ← add
}
```

---

## Widget lifecycle in the admin

```
CmsWidgetList.vue
  → user clicks "New Widget"
    → CmsWidgetEditor.vue (create mode)
      → user selects widget_type
        → type-specific editor panel appears
          → user fills config / content
            → "Save" → useCmsAdminStore.saveWidget()
              → POST /api/v1/admin/cms/widgets
                → widget stored in DB
                  → widget available in CmsWidgetPicker (used in layout editor)
                    → assigned to a layout area in CmsLayoutEditor.vue
                      → layout used on a CmsPage
                        → fe-user renders the page with the widget
```

---

## Menu widget — nested items

Menu widgets use `CmsMenuItem` rows (separate DB table) with a `parent_id` self-reference
for one level of nesting (dropdown menus).

The `CmsMenuTreeEditor.vue` component renders a drag-and-drop tree. Children are created
by dragging an item under another. The tree depth limit is **2** (root + one level of children).

Stored structure example:

```
CmsMenuItem(label="Pricing",  parent_id=null,    sort_order=2)
  CmsMenuItem(label="Embedded", parent_id=<above>, sort_order=0)
  CmsMenuItem(label="Native",   parent_id=<above>, sort_order=1)
```

Each item has either a `url` (absolute/relative URL) or a `page_slug` (CMS page slug).
`page_slug` is resolved to a URL by the frontend at render time.
