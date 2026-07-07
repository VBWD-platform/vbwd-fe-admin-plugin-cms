// S122 — fe-admin PostEditor: primary-category picker + live permalink preview.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import PostEditor from '../../src/views/PostEditor.vue';
import en from '../../locales/en.json';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } });

const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
const TipTapStub = {
  name: 'TipTapEditor',
  props: ['modelValue', 'htmlValue', 'hideTabBar'],
  emits: ['update:modelValue', 'update:htmlValue', 'open-image-picker'],
  methods: { setFromHtml() {}, insertImageUrl() {} },
  template: '<div class="tiptap-stub" />',
};

const POST_TYPES = {
  post_types: [
    { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
    { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
  ],
};
const TERM_TYPES = { term_types: [{ key: 'category', label: 'Category', hierarchical: true }] };

// A nested category tree: Electronics > Phones. Only assigned categories may be
// picked as primary.
const CATEGORIES = [
  { id: 'cat-elec', term_type: 'category', slug: 'electronics', name: 'Electronics', parent_id: null, seo_excluded: false, sort_order: 0 },
  { id: 'cat-phone', term_type: 'category', slug: 'phones', name: 'Phones', parent_id: 'cat-elec', seo_excluded: false, sort_order: 0 },
  { id: 'cat-books', term_type: 'category', slug: 'books', name: 'Books', parent_id: null, seo_excluded: false, sort_order: 0 },
];
const EMPTY_LIST = { items: [], total: 0, page: 1, per_page: 100, pages: 1 };

function primeApi() {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/terms') {
      const type = opts?.params?.type;
      if (type === 'category') return Promise.resolve(CATEGORIES);
      return Promise.resolve([]);
    }
    if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
    return Promise.resolve({});
  });
}

async function mountEditor(
  routeName = 'cms-post-new',
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
      { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
      { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
      { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
    ],
  });
  router.push({ name: routeName, params, query });
  await router.isReady();
  const wrapper = mount(PostEditor, {
    global: {
      plugins: [i18n, router],
      stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true },
    },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('PostEditor.vue — S122 permalink primary category + preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({
      user: { id: '1', email: 'admin@test.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    primeApi();
  });

  it('disables the primary-category picker with no options until a category is assigned', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    const picker = wrapper.find('[data-testid="primary-category-picker"]');
    expect(picker.exists()).toBe(true);
    expect(picker.attributes('disabled')).toBeDefined();
    // Only the "none" placeholder option is present.
    expect(picker.findAll('option')).toHaveLength(1);
  });

  it('populates the primary-category picker ONLY from assigned categories', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    // Assign two of the three categories via the internal selection ref.
    (wrapper.vm as any).selectedTermIds = ['cat-phone', 'cat-books'];
    await flushPromises();
    const picker = wrapper.find('[data-testid="primary-category-picker"]');
    expect(picker.attributes('disabled')).toBeUndefined();
    const values = picker.findAll('option').map((o) => o.attributes('value'));
    // The bound null placeholder + the two assigned categories — NOT cat-elec.
    const labels = picker.findAll('option').map((o) => o.text());
    expect(labels).toContain('Phones');
    expect(labels).toContain('Books');
    expect(labels).not.toContain('Electronics');
    expect(values).not.toContain('cat-elec');
  });

  it('clears a primary category when it is removed from the assigned set', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    (wrapper.vm as any).selectedTermIds = ['cat-phone'];
    (wrapper.vm as any).form.primary_term_id = 'cat-phone';
    await flushPromises();
    // Unassign the category → primary must reset to null.
    (wrapper.vm as any).selectedTermIds = [];
    await flushPromises();
    expect((wrapper.vm as any).form.primary_term_id).toBeNull();
  });

  it('calls the permalink-preview endpoint and renders the returned path + url', async () => {
    (api.post as any).mockResolvedValue({ path: 'blog/2026/electronics/phones/hello', url: 'https://x.test/blog/2026/electronics/phones/hello' });
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    await wrapper.find('[data-testid="post-title"]').setValue('Hello');
    await wrapper.find('[data-testid="post-slug"]').setValue('hello');
    (wrapper.vm as any).selectedTermIds = ['cat-phone'];
    (wrapper.vm as any).form.primary_term_id = 'cat-phone';
    await flushPromises();

    await (wrapper.vm as any).refreshPermalinkPreview();
    await flushPromises();

    const call = (api.post as any).mock.calls.find(
      (c: unknown[]) => c[0] === '/admin/cms/posts/permalink-preview',
    );
    expect(call).toBeTruthy();
    expect(call[1]).toMatchObject({
      type: 'post', title: 'Hello', slug: 'hello', primary_term_id: 'cat-phone',
    });
    expect(call[1].term_ids).toContain('cat-phone');

    const path = wrapper.find('[data-testid="permalink-preview-path"]');
    expect(path.text()).toContain('blog/2026/electronics/phones/hello');
    const url = wrapper.find('[data-testid="permalink-preview-url"]');
    expect(url.attributes('href')).toBe('https://x.test/blog/2026/electronics/phones/hello');
  });

  it('surfaces a mismatch when a canonical_url override differs from the computed url', async () => {
    (api.post as any).mockResolvedValue({ path: 'blog/hello', url: 'https://x.test/blog/hello' });
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    (wrapper.vm as any).form.canonical_url = 'https://x.test/old/hello';
    await (wrapper.vm as any).refreshPermalinkPreview();
    await flushPromises();
    expect(wrapper.find('[data-testid="permalink-canonical-mismatch"]').exists()).toBe(true);

    // Aligning the override with the computed url clears the warning.
    (wrapper.vm as any).form.canonical_url = 'https://x.test/blog/hello';
    await flushPromises();
    expect(wrapper.find('[data-testid="permalink-canonical-mismatch"]').exists()).toBe(false);
  });

  it('includes primary_term_id in the save payload', async () => {
    (api.post as any).mockImplementation((url: string) => {
      if (url === '/admin/cms/posts/permalink-preview') return Promise.resolve({ path: 'p', url: 'u' });
      return Promise.resolve({ id: 'p-new', type: 'post', slug: 'hello', title: 'Hello' });
    });
    (api.put as any).mockResolvedValue({});
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    await wrapper.find('[data-testid="post-title"]').setValue('Hello');
    await wrapper.find('[data-testid="post-slug"]').setValue('hello');
    (wrapper.vm as any).selectedTermIds = ['cat-phone'];
    (wrapper.vm as any).form.primary_term_id = 'cat-phone';
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const saveCall = (api.post as any).mock.calls.find(
      (c: unknown[]) => c[0] === '/admin/cms/posts',
    );
    expect(saveCall).toBeTruthy();
    expect(saveCall[1].primary_term_id).toBe('cat-phone');
  });

  it('loads an existing post primary_term_id into the form', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/terms') {
        return Promise.resolve(opts?.params?.type === 'category' ? CATEGORIES : []);
      }
      if (url === '/admin/cms/posts/p-load') {
        return Promise.resolve({
          id: 'p-load', type: 'post', slug: 'blog/electronics/phones/x', title: 'X', status: 'published',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          term_ids: ['cat-phone'], primary_term_id: 'cat-phone', slug_base: 'x',
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-load' });
    expect((wrapper.vm as any).form.primary_term_id).toBe('cat-phone');
  });
});
