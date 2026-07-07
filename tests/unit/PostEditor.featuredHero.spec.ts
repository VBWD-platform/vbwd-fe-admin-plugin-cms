/**
 * The CMS PostEditor exposes a per-post "Show featured hero (magazine header)"
 * checkbox. It is posts-only, defaults ON (absent flag = enabled), stores its
 * value in `type_data.show_featured_hero`, and rides the save payload's
 * `type_data`.
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

function primeApi() {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/terms') return Promise.resolve([]);
    if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
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

async function mountNew(): Promise<VueWrapper> {
  primeApi();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
      { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
      { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
      { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
    ],
  });
  router.push({ name: 'cms-post-new', query: { type: 'post' } });
  await router.isReady();
  const wrapper = mount(PostEditor, {
    global: { plugins: [i18n, router], stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true } },
  });
  await flushPromises();
  return wrapper;
}

describe('PostEditor — featured hero toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({ user: { id: '1', email: 'a@t.com', role: 'SUPER_ADMIN', permissions: ['*'] }, token: 't' });
    vi.clearAllMocks();
  });

  it('shows the featured-hero checkbox for a post, checked by default (absent flag)', async () => {
    const wrapper = await mountNew();
    const checkbox = wrapper.find('[data-testid="post-show-featured-hero"]');
    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
  });

  it('hides the featured-hero checkbox for a page (posts-only)', async () => {
    const wrapper = await mountNew();
    (wrapper.vm as any).form.type = 'page';
    await flushPromises();
    expect(wrapper.find('[data-testid="post-show-featured-hero"]').exists()).toBe(false);
  });

  it('writes show_featured_hero=false into the save payload type_data when unticked', async () => {
    (api.post as any).mockResolvedValue({ id: 'ph-id', type: 'post', slug: 'hero', title: 'Hero' });
    const wrapper = await mountNew();
    await wrapper.find('[data-testid="post-title"]').setValue('Hero');
    await wrapper.find('[data-testid="post-slug"]').setValue('hero');

    const checkbox = wrapper.find('[data-testid="post-show-featured-hero"]');
    await checkbox.setValue(false);
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.type_data).toBeTruthy();
    expect(payload.type_data.show_featured_hero).toBe(false);
  });
});
