import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
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

const POSTS = {
  items: [
    { id: 'po-1', type: 'post', slug: 'launch', title: 'Launch', status: 'published', language: 'en', updated_at: '2026-06-01T00:00:00Z', term_ids: ['cat-1', 'tag-1'] },
    { id: 'po-2', type: 'post', slug: 'news-2', title: 'Second', status: 'draft', language: 'en', updated_at: '2026-06-02T00:00:00Z', term_ids: [] },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  pages: 1,
};

const PAGES = {
  items: [
    { id: 'pg-1', type: 'page', slug: 'about', title: 'About Us', status: 'published', language: 'en', updated_at: '2026-06-01T00:00:00Z' },
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
    global: { plugins: [i18n, router] },
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

  it('export triggers a GET download scoped to the type', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, blob: () => Promise.resolve(blob) } as unknown as Response,
    );
    // jsdom/happy-dom URL helpers
    (URL as any).createObjectURL = vi.fn(() => 'blob:url');
    (URL as any).revokeObjectURL = vi.fn();

    const { wrapper } = await mountList('post', POSTS);
    await wrapper.find('[data-testid="export-btn"]').trigger('click');
    await flushPromises();

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/admin/cms/posts/export');
    expect(calledUrl).toContain('type=post');
    fetchSpy.mockRestore();
  });

  it('imports an envelope, then refreshes the list', async () => {
    vi.stubGlobal('alert', vi.fn());
    (api.post as any).mockResolvedValue({ created: 1, updated: 0 });
    const { wrapper } = await mountList('post', POSTS);
    (api.get as any).mockClear();

    const envelope = { items: [{ type: 'post', slug: 'x', title: 'X' }] };
    const file = new File([JSON.stringify(envelope)], 'cms-posts.json', { type: 'application/json' });
    await (wrapper.vm as any).onImportFile({ target: { files: [file], value: '' } });
    await flushPromises();

    const [url, payload] = (api.post as any).mock.calls[0];
    expect(url).toBe('/admin/cms/posts/import');
    expect(payload.items[0].type).toBe('post');
    // refresh re-fetches the list afterwards
    expect((api.get as any).mock.calls.some((c: unknown[]) => c[0] === '/admin/cms/posts')).toBe(true);
  });

  it('normalizes a legacy single-page object and stamps the list type', async () => {
    vi.stubGlobal('alert', vi.fn());
    (api.post as any).mockResolvedValue({ created: 1, updated: 0 });
    const { wrapper } = await mountList('page', POSTS);

    // Legacy cms_page export: a bare object with name/slug, no type/items envelope.
    const legacy = { slug: 'about', name: 'About', content_html: '<p>x</p>' };
    const file = new File([JSON.stringify(legacy)], 'about.json', { type: 'application/json' });
    await (wrapper.vm as any).onImportFile({ target: { files: [file], value: '' } });
    await flushPromises();

    const [, payload] = (api.post as any).mock.calls[0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].type).toBe('page');
    expect(payload.items[0].slug).toBe('about');
    expect(payload.items[0].name).toBe('About');
  });

  it('surfaces an import error instead of failing silently', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    (api.post as any).mockRejectedValue({ response: { data: { error: 'boom' } } });
    const { wrapper } = await mountList('page', POSTS);

    const file = new File([JSON.stringify({ items: [{ type: 'page', title: 'X' }] })], 'x.json', { type: 'application/json' });
    await (wrapper.vm as any).onImportFile({ target: { files: [file], value: '' } });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('boom');
  });
});
