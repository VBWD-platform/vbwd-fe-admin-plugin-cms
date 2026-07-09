import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { defineComponent, ref } from 'vue';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsContentList from '../../src/views/CmsContentList.vue';
import en from '../../locales/en.json';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const cmsCapabilities = ref<Record<string, { can_export: boolean; can_import: boolean; can_export_pii: boolean; supported_formats: string[] }>>({});
const loadManifest = vi.fn().mockResolvedValue(undefined);

vi.mock('@/composables/useDataExchangeManifest', () => ({
  useDataExchangeManifest: () => ({
    load: loadManifest,
    capabilitiesFor: (key: string) =>
      cmsCapabilities.value[key] ?? { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] },
  }),
}));

const IecStub = defineComponent({
  name: 'ImportExportControls',
  props: ['api', 'entityKey', 'selectedIds', 'filterState', 'canExport', 'canImport', 'canExportPii', 'isSuperadmin', 'supportedFormats', 'allowExportAll', 'allowExportSelected', 'allowExportFiltered', 'allowImport'],
  emits: ['refresh'],
  template: '<div data-testid="iec-stub" />',
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
});

const CATEGORIES = [
  { id: 'cat-1', term_type: 'category', slug: 'news', name: 'News', parent_id: null, seo_excluded: false, sort_order: 0 },
];
const TAGS = [
  { id: 'tag-1', term_type: 'tag', slug: 'hot', name: 'Hot', parent_id: null, seo_excluded: false, sort_order: 0 },
];

const LAYOUTS = {
  items: [
    { id: 'lay-1', slug: 'default', name: 'Default Layout' },
    { id: 'lay-2', slug: 'wide', name: 'Wide Layout' },
  ],
};

const POSTS = {
  items: [
    { id: 'po-1', type: 'post', slug: 'launch', title: 'Launch', status: 'published', language: 'en', updated_at: '2026-06-01T00:00:00Z', term_ids: ['cat-1', 'tag-1'], preview_token: 'tok-1' },
    { id: 'po-2', type: 'post', slug: 'news-2', title: 'Second', status: 'draft', language: 'en', updated_at: '2026-06-02T00:00:00Z', term_ids: [], preview_token: 'tok-2' },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  pages: 1,
};

const PAGES = {
  items: [
    { id: 'pg-1', type: 'page', slug: 'about', title: 'About Us', status: 'published', language: 'en', updated_at: '2026-06-01T00:00:00Z', preview_token: 'tok-pg' },
  ],
  total: 1,
  page: 1,
  per_page: 20,
  pages: 1,
};

function primeApi(list: unknown) {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/posts') return Promise.resolve(list);
    if (url === '/admin/cms/terms') {
      const type = opts?.params?.type;
      if (type === 'category') return Promise.resolve(CATEGORIES);
      if (type === 'tag') return Promise.resolve(TAGS);
      return Promise.resolve([]);
    }
    if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
    return Promise.resolve({});
  });
}

async function mountList(type: 'post' | 'page', list: unknown): Promise<{ wrapper: VueWrapper; router: Router }> {
  primeApi(list);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
      { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
      { path: '/admin/cms/posts/new', name: 'cms-post-new', component: { template: '<div />' } },
      { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: { template: '<div />' } },
    ],
  });
  // Navigate to the list route before isReady(): with createMemoryHistory the
  // initial location ("/") is unmatched, and router.isReady() only resolves
  // once a matched route has been navigated to.
  router.push({ name: type === 'page' ? 'cms-admin-pages' : 'cms-posts' });
  await router.isReady();
  const wrapper = mount(CmsContentList, {
    props: { type },
    global: { plugins: [i18n, router], stubs: { ImportExportControls: IecStub } },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('CmsContentList.vue (shared list)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    const auth = useAuthStore();
    auth.$patch({
      user: { id: '1', email: 'admin@test.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    cmsCapabilities.value = {};
  });

  it('fetches posts filtered to type=post', async () => {
    await mountList('post', POSTS);
    const call = (api.get as any).mock.calls.find((c: unknown[]) => c[0] === '/admin/cms/posts');
    expect(call).toBeTruthy();
    expect((call[1] as { params?: Record<string, unknown> }).params?.type).toBe('post');
  });

  it('fetches posts filtered to type=page', async () => {
    await mountList('page', PAGES);
    const call = (api.get as any).mock.calls.find((c: unknown[]) => c[0] === '/admin/cms/posts');
    expect((call[1] as { params?: Record<string, unknown> }).params?.type).toBe('page');
  });

  it('renders one row per item', async () => {
    const { wrapper } = await mountList('post', POSTS);
    expect(wrapper.findAll('[data-testid="content-row"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Launch');
  });

  it('shows category + tags columns and no type column for posts', async () => {
    const { wrapper } = await mountList('post', POSTS);
    const headers = wrapper.findAll('thead th').map((th) => th.text());
    expect(headers).toContain('Category');
    expect(headers).toContain('Tags');
    expect(headers).not.toContain('Type');
    // The category/tag names resolve from the fetched term lists.
    expect(wrapper.text()).toContain('News');
    expect(wrapper.text()).toContain('Hot');
  });

  it('does not show category/tags columns for pages', async () => {
    const { wrapper } = await mountList('page', PAGES);
    const headers = wrapper.findAll('thead th').map((th) => th.text());
    expect(headers).not.toContain('Category');
    expect(headers).not.toContain('Tags');
    expect(headers).not.toContain('Type');
  });

  it('renders a row-slug-link per row opening the fe-user page', async () => {
    const { wrapper } = await mountList('post', POSTS);
    const links = wrapper.findAll('[data-testid="row-slug-link"]');
    expect(links).toHaveLength(2);
    // Published row → plain public URL (no token).
    expect(links[0].attributes('href')).toContain('/launch');
    expect(links[0].attributes('href')).not.toContain('preview_token');
    expect(links[0].attributes('target')).toBe('_blank');
    // Draft row → preview URL carrying the post's token.
    expect(links[1].attributes('href')).toContain('/news-2?preview_token=tok-2');
  });

  it('the row-slug-link click does not open the editor', async () => {
    const { wrapper, router } = await mountList('post', POSTS);
    const push = vi.spyOn(router, 'push');
    await wrapper.find('[data-testid="row-slug-link"]').trigger('click');
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the row-slug-link on the pages list too', async () => {
    const { wrapper } = await mountList('page', PAGES);
    const link = wrapper.find('[data-testid="row-slug-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toContain('/about');
  });

  it('full-row click navigates to the editor', async () => {
    const { wrapper, router } = await mountList('post', POSTS);
    const push = vi.spyOn(router, 'push');
    await wrapper.find('[data-testid="content-row"]').trigger('click');
    expect(push).toHaveBeenCalledWith({ name: 'cms-post-edit', params: { id: 'po-1' } });
  });

  it('supports bulk selection and a bulk delete via the bulk endpoint', async () => {
    (api.post as any).mockResolvedValue({ deleted: 1 });
    const { wrapper } = await mountList('post', POSTS);
    // No bulk bar until something is selected.
    expect(wrapper.find('[data-testid="bulk-bar"]').exists()).toBe(false);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-bar"]').exists()).toBe(true);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await wrapper.find('[data-testid="bulk-delete"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk', { ids: ['po-1'] });
  });

  it('shows a bulk-copy button only once rows are selected', async () => {
    const { wrapper } = await mountList('post', POSTS);
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(false);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(true);
  });

  it('hides the bulk-copy button for a user without cms.manage', async () => {
    const auth = useAuthStore();
    auth.$patch({ user: { id: '2', email: 'viewer@test.com', role: 'ADMIN', permissions: [] } });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(false);
  });

  it('bulk copy posts to the copy endpoint then clears + reloads', async () => {
    (api.post as any).mockResolvedValue({ items: [], count: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    await wrapper.find('[data-testid="bulk-copy"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/copy', { ids: ['po-1'] });
    // selection cleared after the copy
    expect(wrapper.find('[data-testid="bulk-bar"]').exists()).toBe(false);
  });

  it('bulk copy under the "all matching" scope copies the resolved (fetch-all) ids', async () => {
    (api.post as any).mockResolvedValue({ items: [], count: 2 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="select-all"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="scope-all"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="bulk-copy"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/copy', { ids: ['po-1', 'po-2'] });
  });

  it('select-all opens a scope menu; choosing this-page selects every row', async () => {
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="select-all"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="scope-menu"]').exists()).toBe(true);
    await wrapper.find('[data-testid="scope-page"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-bar"]').text()).toContain('2');
  });

  it('bulk publish posts the status to the bulk endpoint', async () => {
    (api.post as any).mockResolvedValue({ updated: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    await wrapper.find('[data-testid="bulk-publish"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/status', { ids: ['po-1'], status: 'published' });
  });

  it('bulk searchable toggles search visibility', async () => {
    (api.post as any).mockResolvedValue({ updated: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    await wrapper.find('[data-testid="bulk-unsearchable"]').trigger('click');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/searchable', { ids: ['po-1'], searchable: false });
  });

  it('renders the bulk assign-layout select with the fetched layouts (S54)', async () => {
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    const select = wrapper.find('[data-testid="bulk-assign-layout"]');
    expect(select.exists()).toBe(true);
    const optionValues = select.findAll('option').map((o) => o.attributes('value'));
    expect(optionValues).toContain('lay-1');
    expect(optionValues).toContain('lay-2');
  });

  it('choosing a layout assigns it to the selected posts then clears + reloads (S54)', async () => {
    (api.post as any).mockResolvedValue({ updated: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    const select = wrapper.find('[data-testid="bulk-assign-layout"]');
    await select.setValue('lay-2');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/assign-layout', {
      ids: ['po-1'],
      layout_id: 'lay-2',
    });
    // selection cleared after the assign
    expect(wrapper.find('[data-testid="bulk-assign-layout"]').exists()).toBe(false);
  });

  it('choosing the empty bulk-assign-layout option makes no call (S54)', async () => {
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    (api.post as any).mockClear();
    await wrapper.find('[data-testid="bulk-assign-layout"]').setValue('');
    await flushPromises();
    expect(api.post).not.toHaveBeenCalledWith(
      '/admin/cms/posts/bulk/assign-layout',
      expect.anything(),
    );
  });

  it('renders an "Unset" option in both bulk-assign selects', async () => {
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    const layoutValues = wrapper
      .find('[data-testid="bulk-assign-layout"]')
      .findAll('option')
      .map((o) => o.attributes('value'));
    const categoryValues = wrapper
      .find('[data-testid="bulk-assign-category"]')
      .findAll('option')
      .map((o) => o.attributes('value'));
    expect(layoutValues).toContain('__unset__');
    expect(categoryValues).toContain('__unset__');
  });

  it('choosing Unset layout clears the layout on selected posts (null) then reloads', async () => {
    (api.post as any).mockResolvedValue({ updated: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    await wrapper.find('[data-testid="bulk-assign-layout"]').setValue('__unset__');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/assign-layout', {
      ids: ['po-1'],
      layout_id: null,
    });
    expect(wrapper.find('[data-testid="bulk-assign-layout"]').exists()).toBe(false);
  });

  it('choosing Unset category removes categories from selected posts then reloads', async () => {
    (api.post as any).mockResolvedValue({ updated: 1 });
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    await wrapper.find('[data-testid="bulk-assign-category"]').setValue('__unset__');
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/unassign-category', {
      ids: ['po-1'],
    });
    expect(wrapper.find('[data-testid="bulk-assign-category"]').exists()).toBe(false);
  });

  it('renders the language / category / layout / style / date filters', async () => {
    const { wrapper } = await mountList('post', POSTS);
    for (const id of ['filter-status', 'filter-language', 'filter-category', 'filter-layout', 'filter-style', 'filter-date-from', 'filter-date-to']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
    }
  });

  it('a filter change reloads the list with the filter params', async () => {
    const { wrapper } = await mountList('post', POSTS);
    (api.get as any).mockClear();
    await wrapper.find('[data-testid="filter-language"]').setValue('de');
    await flushPromises();
    const call = (api.get as any).mock.calls.find(
      (c: any[]) => c[0] === '/admin/cms/posts' && c[1]?.params?.language === 'de',
    );
    expect(call).toBeTruthy();
  });

  it('every listed column header is sortable with an indicator', async () => {
    const { wrapper } = await mountList('post', POSTS);
    expect(wrapper.find('[data-testid="sort-title"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sort-status"]').exists()).toBe(true);
    await wrapper.find('[data-testid="sort-title"]').trigger('click');
    await flushPromises();
    // re-fetch carries the new sort
    const sorted = (api.get as any).mock.calls.find(
      (c: any[]) => c[0] === '/admin/cms/posts' && c[1]?.params?.sort_by === 'title',
    );
    expect(sorted).toBeTruthy();
  });

  it('no longer renders the legacy export / import buttons (unified control only)', async () => {
    const { wrapper } = await mountList('post', POSTS);
    expect(wrapper.find('[data-testid="export-btn"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-btn"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-input"]').exists()).toBe(false);
    // The bulk bar's "Export selected" action is gone too (unified control handles it).
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-export"]').exists()).toBe(false);
  });

  it('wires ImportExportControls with entity-key="cms_posts" and manifest-derived caps', async () => {
    cmsCapabilities.value = {
      cms_posts: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] },
    };
    const { wrapper } = await mountList('post', POSTS);
    const control = wrapper.findComponent(IecStub);
    expect(control.exists()).toBe(true);
    expect(control.props('entityKey')).toBe('cms_posts');
    expect(control.props('canExport')).toBe(true);
    expect(control.props('canImport')).toBe(true);
  });

  it('hides ImportExportControls when the manifest grants no cms_posts capabilities', async () => {
    cmsCapabilities.value = {
      cms_posts: { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] },
    };
    const { wrapper } = await mountList('post', POSTS);
    expect(wrapper.findComponent(IecStub).exists()).toBe(false);
  });

  it('flows the bulk selection into ImportExportControls selectedIds', async () => {
    cmsCapabilities.value = {
      cms_posts: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] },
    };
    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="row-select-po-1"]').setValue(true);
    await flushPromises();
    expect(wrapper.findComponent(IecStub).props('selectedIds')).toEqual(['po-1']);
  });

  it('uses the cms_posts exchanger for the pages list (shared table)', async () => {
    cmsCapabilities.value = {
      cms_posts: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] },
    };
    const { wrapper } = await mountList('page', PAGES);
    expect(wrapper.findComponent(IecStub).props('entityKey')).toBe('cms_posts');
  });
});
