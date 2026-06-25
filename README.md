# CMS Admin Plugin (vbwd-fe-admin)

Full CMS management in the admin backoffice.

## Purpose

Provides admin UI for the CMS plugin. Pages and posts are authored through the
unified content engine (`cms_post`) and taxonomy (`cms_term`); the plugin also
manages the image gallery (upload/resize) and widget/layout/style configuration.

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
| `/admin/cms/posts` | `PostList.vue` | List and filter posts (unified `cms_post`, type=post) |
| `/admin/cms/posts/new` | `PostEditor.vue` | Create post |
| `/admin/cms/posts/:id/edit` | `PostEditor.vue` | Edit post |
| `/admin/cms/pages` | `CmsPageList.vue` | List and filter pages (unified `cms_post`, type=page) |
| `/admin/cms/taxonomy` | `TermManager.vue` | Manage taxonomy terms (`cms_term`: categories + tags) |
| `/admin/cms/images` | `CmsImageGallery.vue` | Image gallery + upload |
| `/admin/cms/layouts` | `CmsLayoutList.vue` | Layout list |
| `/admin/cms/widgets` | `CmsWidgetList.vue` | Widget list |
| `/admin/cms/styles` | `CmsStyleList.vue` | Style list |
| `/admin/cms/styles/new` | `CmsStyleEditor.vue` | Create style |
| `/admin/cms/styles/:id/edit` | `CmsStyleEditor.vue` | Edit style |
| `/admin/cms/seo` | `CmsSeo.vue` | SEO maintenance |

Pages and posts are both authored via the unified `PostEditor.vue`
(`useCmsContentStore`); the legacy `CmsPageEditor.vue` and `cms_page`/
`cms_category` admin routes were retired in S105.

## Stores

- `useCmsContentStore` — unified posts/pages (`cms_post`) and taxonomy
  (`cms_term`) CRUD.
- `useCmsAdminStore` — images, layouts, widgets, styles and SEO settings CRUD
  with Pinia.

## Testing

```bash
cd vbwd-fe-admin
./bin/pre-commit-check.sh --unit
```
