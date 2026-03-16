# CMS Admin Plugin (vbwd-fe-admin)

Full CMS management in the admin backoffice.

## Purpose

Provides admin UI for the CMS plugin: pages CRUD with TipTap rich-text editor, category management, image gallery with upload/resize, widget/layout/style management.

---

## Related

| | Repository |
|-|------------|
| 🖥 Backend | [vbwd-plugin-cms](https://github.com/VBWD-platform/vbwd-plugin-cms) |
| 👤 Frontend (user) | [vbwd-fe-user-plugin-cms](https://github.com/VBWD-platform/vbwd-fe-user-plugin-cms) |

**Core:** [vbwd-fe-admin](https://github.com/VBWD-platform/vbwd-fe-admin) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)

## Routes / Views

| Path | View | Description |
|------|------|-------------|
| `/admin/cms/pages` | `CmsPageList.vue` | List and filter pages |
| `/admin/cms/pages/new` | `CmsPageEditor.vue` | Create page |
| `/admin/cms/pages/:id/edit` | `CmsPageEditor.vue` | Edit page |
| `/admin/cms/categories` | `CmsCategoryList.vue` | Manage categories |
| `/admin/cms/images` | `CmsImageGallery.vue` | Image gallery + upload |
| `/admin/cms/styles` | `CmsStyleList.vue` | Style list |
| `/admin/cms/styles/new` | `CmsStyleEditor.vue` | Create style |
| `/admin/cms/styles/:id/edit` | `CmsStyleEditor.vue` | Edit style |

## Stores

`useCmsAdminStore` — pages, categories, images CRUD with Pinia.

## Testing

```bash
cd vbwd-fe-admin
./bin/pre-commit-check.sh --unit
```
