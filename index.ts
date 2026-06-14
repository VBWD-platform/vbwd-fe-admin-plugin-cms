/**
 * CMS Admin Plugin
 *
 * Provides full CMS management in the admin backoffice:
 * - Pages CRUD with TipTap rich-text editor
 * - Category management
 * - Image gallery with upload/resize
 */

import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { extensionRegistry } from '../../vue/src/plugins/extensionRegistry';
import './src/cms-admin.css';

// Shared widget-editor seam (D9). Re-exported from this stable plugin path so
// another fe-admin plugin (e.g. meinchat-admin) can register its own
// vue-component widget editor through the SAME registry — OCP, no plugin
// strings in cms-admin. Re-export only; no behaviour change.
export {
  registerWidgetEditor,
  getWidgetEditor,
} from './src/widgets/widgetEditorRegistry';
export type { VueWidgetEditorDescriptor } from './src/widgets/widgetEditorRegistry';

import en from './locales/en.json';
import ru from './locales/ru.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import th from './locales/th.json';

const NAV_SECTIONS = [
  {
    id: 'cms',
    label: 'CMS',
    items: [
      { label: 'Posts', to: '/admin/cms/posts', requiredPermission: 'cms.manage' },
      { label: 'Taxonomy', to: '/admin/cms/taxonomy', requiredPermission: 'cms.manage' },
      { label: 'Pages', to: '/admin/cms/pages', requiredPermission: 'cms.pages.view' },
      { label: 'Images', to: '/admin/cms/images', requiredPermission: 'cms.images.view' },
      { label: 'Layouts', to: '/admin/cms/layouts', requiredPermission: 'cms.layouts.manage' },
      { label: 'Widgets', to: '/admin/cms/widgets', requiredPermission: 'cms.widgets.view' },
      { label: 'Styles', to: '/admin/cms/styles', requiredPermission: 'cms.styles.manage' },
      { label: 'Routing Rules', to: '/admin/cms/routing-rules', requiredPermission: 'cms.configure' },
      { label: 'SEO', to: '/admin/cms/seo', requiredPermission: 'cms.manage' },
    ],
  },
];

export const cmsAdminPlugin: IPlugin = {
  name: 'cms-admin',
  version: '1.0.0',
  description: 'CMS Pages, Categories and Image Gallery management',

  install(sdk: IPlatformSDK) {
    // Register translations
    sdk.addTranslations('en', { cms: (en as Record<string, unknown>)['cms'] });
    sdk.addTranslations('ru', { cms: (ru as Record<string, unknown>)['cms'] });
    sdk.addTranslations('de', { cms: (de as Record<string, unknown>)['cms'] });
    sdk.addTranslations('es', { cms: (es as Record<string, unknown>)['cms'] });
    sdk.addTranslations('fr', { cms: (fr as Record<string, unknown>)['cms'] });
    sdk.addTranslations('ja', { cms: (ja as Record<string, unknown>)['cms'] });
    sdk.addTranslations('zh', { cms: (zh as Record<string, unknown>)['cms'] });
    sdk.addTranslations('th', { cms: (th as Record<string, unknown>)['cms'] });

    // Register sidebar nav section (also done in activate for re-activation support)
    extensionRegistry.register('cms-admin', { navSections: NAV_SECTIONS });

    // Register admin routes (added as children of the 'admin' layout route)
    // Unified type-aware authoring (S47.6) — additive alongside the legacy
    // page editor; both coexist during the cutover.
    sdk.addRoute({
      path: 'cms/posts',
      name: 'cms-posts',
      component: () => import('./src/views/PostList.vue'),
      meta: { requiredPermission: 'cms.manage' },
    });
    sdk.addRoute({
      path: 'cms/posts/new',
      name: 'cms-post-new',
      component: () => import('./src/views/PostEditor.vue'),
      meta: { requiredPermission: 'cms.manage' },
    });
    sdk.addRoute({
      path: 'cms/posts/:id/edit',
      name: 'cms-post-edit',
      component: () => import('./src/views/PostEditor.vue'),
      meta: { requiredPermission: 'cms.manage' },
    });
    sdk.addRoute({
      path: 'cms/taxonomy',
      name: 'cms-taxonomy',
      component: () => import('./src/views/TermManager.vue'),
      meta: { requiredPermission: 'cms.manage' },
    });
    // Pages — the list shows unified posts of type=page and opens the unified
    // PostEditor for create/edit (the legacy page editor + categories admin
    // have been retired in favour of the unified content engine + taxonomy).
    sdk.addRoute({
      path: 'cms/pages',
      name: 'cms-admin-pages',
      component: () => import('./src/views/CmsPageList.vue'),
      meta: { requiredPermission: 'cms.pages.view' },
    });
    // Images
    sdk.addRoute({
      path: 'cms/images',
      name: 'cms-images',
      component: () => import('./src/views/CmsImageGallery.vue'),
      meta: { requiredPermission: 'cms.images.view' },
    });
    // Styles
    sdk.addRoute({
      path: 'cms/styles',
      name: 'cms-styles',
      component: () => import('./src/views/CmsStyleList.vue'),
      meta: { requiredPermission: 'cms.styles.manage' },
    });
    sdk.addRoute({
      path: 'cms/styles/new',
      name: 'cms-style-new',
      component: () => import('./src/views/CmsStyleEditor.vue'),
      meta: { requiredPermission: 'cms.styles.manage' },
    });
    sdk.addRoute({
      path: 'cms/styles/:id/edit',
      name: 'cms-style-edit',
      component: () => import('./src/views/CmsStyleEditor.vue'),
      meta: { requiredPermission: 'cms.styles.manage' },
    });
    // Widgets
    sdk.addRoute({
      path: 'cms/widgets',
      name: 'cms-widgets',
      component: () => import('./src/views/CmsWidgetList.vue'),
      meta: { requiredPermission: 'cms.widgets.view' },
    });
    sdk.addRoute({
      path: 'cms/widgets/new',
      name: 'cms-widget-new',
      component: () => import('./src/views/CmsWidgetEditor.vue'),
      meta: { requiredPermission: 'cms.widgets.manage' },
    });
    sdk.addRoute({
      path: 'cms/widgets/:id/edit',
      name: 'cms-widget-edit',
      component: () => import('./src/views/CmsWidgetEditor.vue'),
      meta: { requiredPermission: 'cms.widgets.manage' },
    });
    // SEO maintenance (clean up prerendered content)
    sdk.addRoute({
      path: 'cms/seo',
      name: 'cms-seo',
      component: () => import('./src/views/CmsSeo.vue'),
      meta: { requiredPermission: 'cms.manage' },
    });
    // Layouts
    sdk.addRoute({
      path: 'cms/layouts',
      name: 'cms-layouts',
      component: () => import('./src/views/CmsLayoutList.vue'),
      meta: { requiredPermission: 'cms.layouts.manage' },
    });
    sdk.addRoute({
      path: 'cms/layouts/new',
      name: 'cms-layout-new',
      component: () => import('./src/views/CmsLayoutEditor.vue'),
      meta: { requiredPermission: 'cms.layouts.manage' },
    });
    sdk.addRoute({
      path: 'cms/layouts/:id/edit',
      name: 'cms-layout-edit',
      component: () => import('./src/views/CmsLayoutEditor.vue'),
      meta: { requiredPermission: 'cms.layouts.manage' },
    });
  },

  activate() {
    // Re-register nav sections (supports re-activation after deactivate)
    extensionRegistry.register('cms-admin', { navSections: NAV_SECTIONS });
  },

  deactivate() {
    // Remove nav sections from sidebar when plugin is deactivated
    extensionRegistry.unregister('cms-admin');
  },
};

export default cmsAdminPlugin;
