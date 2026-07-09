/**
 * The CMS PostEditor exposes "pinned / sticky" controls (S-archives):
 *   - a per-category pin toggle on each assigned-category chip (writes the
 *     category id into the terms save payload's `pinned_term_ids`);
 *   - a posts-only "Pin to blog index (front page)" checkbox bound to
 *     `form.pinned` (writes `pinned` on the post save payload).
 * Both round-trip: an edit-mode load hydrates the blog-index checkbox from
 * `post.pinned` and the per-category toggles from `post.pinned_term_ids`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import PostEditor from '../../src/views/PostEditor.vue';
import en from '../../locales/en.json';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } });

const POST_TYPES = {
  post_types: [
    { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
    { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
  ],
};
const TERM_TYPES = { term_types: [{ key: 'category', label: 'Category', hierarchical: true }, { key: 'tag', label: 'Tag', hierarchical: false }] };
const EMPTY_LIST = { items: [], total: 0, page: 1, per_page: 100, pages: 1 };

const CAT_ID = 'cat-gadgets';
const CATEGORY = { id: CAT_ID, term_type: 'category', name: 'Gadgets', slug: 'gadgets', parent_id: null };

function fullPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    type: 'post',
    slug: 'my-post',
    title: 'My Post',
    excerpt: null,
    featured_image_url: null,
    content_json: { type: 'doc', content: [] },
    content_html: '',
    source_css: '',
    type_data: {},
    parent_id: null,
    primary_term_id: null,
    status: 'draft',
    preview_token: 'tok',
    published_at: null,
    language: 'en',
    translation_group_id: null,
    sort_order: 0,
    pinned: false,
    meta_title: null,
    meta_description: null,
    meta_keywords: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    robots: 'index,follow',
    schema_json: null,
    seo_excluded: false,
    layout_id: null,
    style_id: null,
    term_ids: [],
    pinned_term_ids: [],
    content_blocks: {},
    page_assignments: [],
    ...overrides,
  };
}

function primeApi(post?: Record<string, unknown>) {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/terms') {
      return Promise.resolve(opts?.params?.type === 'category' ? [CATEGORY] : []);
    }
    if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
    if (post && url === `/admin/cms/posts/${post.id}`) return Promise.resolve(post);
    return Promise.resolve({});
  });
}

const CodeMirrorStub = { name: 'CodeMirrorEditor', props: ['modelValue', 'lang'], emits: ['update:modelValue'], template: '<textarea />' };
const TipTapStub = {
  name: 'TipTapEditor',
  props: ['modelValue', 'htmlValue'],
  emits: ['update:modelValue', 'update:htmlValue', 'open-image-picker'],
  methods: { setFromHtml() {}, insertImageUrl() {} },
  template: '<div />',
};

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
      { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
      { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
      { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
    ],
  });
}

async function mountNew(): Promise<VueWrapper> {
  primeApi();
  const router = makeRouter();
  router.push({ name: 'cms-post-new', query: { type: 'post' } });
  await router.isReady();
  const wrapper = mount(PostEditor, {
    global: { plugins: [i18n, router], stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true } },
  });
  await flushPromises();
  return wrapper;
}

async function mountEdit(post: Record<string, unknown>): Promise<VueWrapper> {
  primeApi(post);
  const router = makeRouter();
  router.push({ name: 'cms-post-edit', params: { id: post.id as string } });
  await router.isReady();
  const wrapper = mount(PostEditor, {
    global: { plugins: [i18n, router], stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true } },
  });
  await flushPromises();
  return wrapper;
}

describe('PostEditor — pinned / sticky controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({ user: { id: '1', email: 'a@t.com', role: 'SUPER_ADMIN', permissions: ['*'] }, token: 't' });
    vi.clearAllMocks();
  });

  it('shows the blog-index pin checkbox for a post, unchecked by default', async () => {
    const wrapper = await mountNew();
    const checkbox = wrapper.find('[data-testid="post-pin-blog-index"]');
    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
  });

  it('hides the blog-index pin checkbox for a page (posts-only)', async () => {
    const wrapper = await mountNew();
    (wrapper.vm as any).form.type = 'page';
    await flushPromises();
    expect(wrapper.find('[data-testid="post-pin-blog-index"]').exists()).toBe(false);
  });

  it('writes pinned=true into the post save payload when checked', async () => {
    (api.post as any).mockResolvedValue({ id: 'p-id', type: 'post', slug: 'x', title: 'X' });
    const wrapper = await mountNew();
    await wrapper.find('[data-testid="post-title"]').setValue('X');
    await wrapper.find('[data-testid="post-slug"]').setValue('x');
    await wrapper.find('[data-testid="post-pin-blog-index"]').setValue(true);

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.pinned).toBe(true);
  });

  it('renders a per-category pin toggle on an assigned-category chip', async () => {
    const wrapper = await mountEdit(fullPost({ term_ids: [CAT_ID] }));
    const toggle = wrapper.find(`[data-testid="pin-category-${CAT_ID}"]`);
    expect(toggle.exists()).toBe(true);
    // Not pinned yet → not active.
    expect(toggle.classes()).not.toContain('term-chip__pin--active');
  });

  it('sends the pinned category in the terms save payload when toggled on', async () => {
    (api.put as any).mockResolvedValue({});
    const wrapper = await mountEdit(fullPost({ term_ids: [CAT_ID] }));

    await wrapper.find(`[data-testid="pin-category-${CAT_ID}"]`).trigger('click');
    await flushPromises();
    expect((wrapper.vm as any).isCategoryPinned(CAT_ID)).toBe(true);

    await (wrapper.vm as any).save();
    await flushPromises();

    const termsCall = (api.put as any).mock.calls.find(
      (call: any[]) => call[0] === '/admin/cms/posts/post-1/terms',
    );
    expect(termsCall).toBeTruthy();
    expect(termsCall[1].term_ids).toContain(CAT_ID);
    expect(termsCall[1].pinned_term_ids).toContain(CAT_ID);
  });

  it('hydrates the blog-index checkbox and per-category toggle on load', async () => {
    const wrapper = await mountEdit(
      fullPost({ pinned: true, term_ids: [CAT_ID], pinned_term_ids: [CAT_ID] }),
    );
    expect((wrapper.vm as any).form.pinned).toBe(true);
    expect((wrapper.vm as any).isCategoryPinned(CAT_ID)).toBe(true);

    const checkbox = wrapper.find('[data-testid="post-pin-blog-index"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
    const toggle = wrapper.find(`[data-testid="pin-category-${CAT_ID}"]`);
    expect(toggle.classes()).toContain('term-chip__pin--active');
  });
});
