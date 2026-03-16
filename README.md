# CMS Admin Plugin (vbwd-fe-admin)

Full CMS management in the admin backoffice.

## Purpose

Provides admin UI for the CMS plugin: pages CRUD with TipTap rich-text editor, category management, image gallery with upload/resize, widget/layout/style management.

## Backend Counterpart

`vbwd-backend/plugins/cms/`

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
