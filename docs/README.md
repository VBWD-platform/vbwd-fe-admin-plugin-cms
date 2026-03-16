# CMS Admin Plugin — Developer Reference

The `cms-admin` plugin is the backoffice UI for the VBWD CMS system. It provides full CRUD
management for every CMS entity: Pages, Categories, Images, Layouts, Widgets, and Styles.

---

## Plugin identity

```typescript
// vbwd-fe-admin/plugins/cms-admin/index.ts
export const cmsAdminPlugin: IPlugin
```

Plugin ID: `cms-admin`
Backend counterpart: `vbwd-backend/plugins/cms/`

---

## What this plugin manages

| Entity | Admin route | Backend API prefix |
|--------|-------------|-------------------|
| Pages | `/admin/cms/pages` | `/api/v1/admin/cms/pages` |
| Categories | `/admin/cms/categories` | `/api/v1/admin/cms/categories` |
| Images | `/admin/cms/images` | `/api/v1/admin/cms/images` |
| Layouts | `/admin/cms/layouts` | `/api/v1/admin/cms/layouts` |
| Widgets | `/admin/cms/widgets` | `/api/v1/admin/cms/widgets` |
| Styles | `/admin/cms/styles` | `/api/v1/admin/cms/styles` |

---

## Architecture

```
vbwd-fe-admin/plugins/cms-admin/
├── index.ts                        ← plugin entry: routes, nav, translations
├── config.json                     ← fe-admin runtime config
├── admin-config.json               ← editable config exposed in admin settings
├── locales/                        ← i18n (en, de, es, fr, ja, ru, th, zh)
├── src/
│   ├── views/                      ← page-level components (one per route)
│   │   ├── CmsPageList.vue
│   │   ├── CmsPageEditor.vue       ← TipTap rich-text + layout/style picker
│   │   ├── CmsCategoryList.vue
│   │   ├── CmsImageGallery.vue
│   │   ├── CmsLayoutList.vue
│   │   ├── CmsLayoutEditor.vue     ← area builder + widget assignment
│   │   ├── CmsWidgetList.vue
│   │   ├── CmsWidgetEditor.vue     ← type-aware editor (html/menu/vue-component)
│   │   ├── CmsStyleList.vue
│   │   └── CmsStyleEditor.vue     ← CSS source editor (CodeMirror)
│   ├── components/
│   │   ├── CmsImagePicker.vue      ← reusable image selection modal
│   │   ├── CmsMenuTreeEditor.vue   ← drag-and-drop nested menu builder
│   │   ├── CmsWidgetPicker.vue     ← widget selection modal (used in layout editor)
│   │   ├── CodeMirrorEditor.vue    ← generic CodeMirror wrapper (CSS/HTML/JSON modes)
│   │   └── TipTapEditor.vue        ← rich-text editor for page content_json
│   └── stores/
│       └── useCmsAdminStore.ts     ← Pinia store: all CMS entity CRUD + types
└── docs/                           ← this directory
```

---

## Data flow

```
CmsWidgetEditor.vue
  └─► useCmsAdminStore.saveWidget()
        └─► PUT /api/v1/admin/cms/widgets/:id
              └─► CmsWidget model (vbwd-backend)
                    └─► CmsLayoutWidget join table (assigned in CmsLayoutEditor)
                          └─► CmsPage.layout_id → rendered by fe-user CmsPage.vue
```

---

## Adding new entity types — checklist

When adding a new CMS concept (e.g. `CmsTemplate`):

1. **Backend model** — extend `BaseModel`, add `to_dict()`, register in `plugins/cms/src/models/`
2. **Backend repo** — implement `ICmsTemplateRepository`
3. **Backend routes** — add admin CRUD routes to `plugins/cms/src/routes.py`
4. **Backend migration** — `alembic/versions/<date>_create_cms_templates.py`
5. **Frontend store** — add TypeScript interface + actions to `useCmsAdminStore.ts`
6. **Frontend views** — `CmsTemplateList.vue` + `CmsTemplateEditor.vue`
7. **Plugin routes** — register in `cms-admin/index.ts` via `sdk.addRoute()`
8. **Nav entry** — add to nav section in `cms-admin/index.ts`
9. **Translations** — add keys to `locales/en.json` (other locales auto-fallback)

---

## Further reading

- [WIDGETS.md](./WIDGETS.md) — widget types, vue-component widgets, how to add new types
- [LAYOUT.md](./LAYOUT.md) — layout areas, area types, widget assignments
- [PAGES.md](./PAGES.md) — page routing, multilingual slugs, SEO fields
- [VUE-COMPONENT-PLUGINS.md](./VUE-COMPONENT-PLUGINS.md) — extending CMS with custom Vue components
- [PROMPTS.md](./PROMPTS.md) — AI agent prompts for building on top of CMS
