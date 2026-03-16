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
      { label: 'Pages', to: '/admin/cms/pages' },
      { label: 'Categories', to: '/admin/cms/categories' },
      { label: 'Images', to: '/admin/cms/images' },
      { label: 'Layouts', to: '/admin/cms/layouts' },
      { label: 'Widgets', to: '/admin/cms/widgets' },
      { label: 'Styles', to: '/admin/cms/styles' },
      { label: 'Routing Rules', to: '/admin/cms/routing-rules' },
      { label: 'Import / Export', to: '/admin/cms/import-export' },
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
    sdk.addRoute({
      path: 'cms/pages',
      name: 'cms-admin-pages',
      component: () => import('./src/views/CmsPageList.vue'),
    });
    sdk.addRoute({
      path: 'cms/pages/new',
      name: 'cms-page-new',
      component: () => import('./src/views/CmsPageEditor.vue'),
    });
    sdk.addRoute({
      path: 'cms/pages/:id/edit',
      name: 'cms-page-edit',
      component: () => import('./src/views/CmsPageEditor.vue'),
    });
    sdk.addRoute({
      path: 'cms/categories',
      name: 'cms-categories',
      component: () => import('./src/views/CmsCategoryList.vue'),
    });
    sdk.addRoute({
      path: 'cms/images',
      name: 'cms-images',
      component: () => import('./src/views/CmsImageGallery.vue'),
    });
    // Styles
    sdk.addRoute({
      path: 'cms/styles',
      name: 'cms-styles',
      component: () => import('./src/views/CmsStyleList.vue'),
    });
    sdk.addRoute({
      path: 'cms/styles/new',
      name: 'cms-style-new',
      component: () => import('./src/views/CmsStyleEditor.vue'),
    });
    sdk.addRoute({
      path: 'cms/styles/:id/edit',
      name: 'cms-style-edit',
      component: () => import('./src/views/CmsStyleEditor.vue'),
    });
    // Widgets
    sdk.addRoute({
      path: 'cms/widgets',
      name: 'cms-widgets',
      component: () => import('./src/views/CmsWidgetList.vue'),
    });
    sdk.addRoute({
      path: 'cms/widgets/new',
      name: 'cms-widget-new',
      component: () => import('./src/views/CmsWidgetEditor.vue'),
    });
    sdk.addRoute({
      path: 'cms/widgets/:id/edit',
      name: 'cms-widget-edit',
      component: () => import('./src/views/CmsWidgetEditor.vue'),
    });
    // Import / Export
    sdk.addRoute({
      path: 'cms/import-export',
      name: 'cms-import-export',
      component: () => import('./src/views/CmsImportExport.vue'),
    });
    // Layouts
    sdk.addRoute({
      path: 'cms/layouts',
      name: 'cms-layouts',
      component: () => import('./src/views/CmsLayoutList.vue'),
    });
    sdk.addRoute({
      path: 'cms/layouts/new',
      name: 'cms-layout-new',
      component: () => import('./src/views/CmsLayoutEditor.vue'),
    });
    sdk.addRoute({
      path: 'cms/layouts/:id/edit',
      name: 'cms-layout-edit',
      component: () => import('./src/views/CmsLayoutEditor.vue'),
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
