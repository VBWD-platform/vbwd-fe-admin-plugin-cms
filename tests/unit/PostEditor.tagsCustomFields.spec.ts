/**
 * S77 reversal — the CMS PostEditor keeps the generic Custom-fields editor but
 * NO LONGER mounts the generic vbwd_tag TagPicker.
 *
 * Tags are a cms_term taxonomy again (edited via the SearchableTermSelect tag
 * picker, covered in PostEditor.spec.ts). Custom fields stay a separate, legit
 * concern: the host passes `entity_type` keyed by the post's kind (a page edits
 * `cms_page`, any other type `cms_post`), only in edit mode (an id is needed to
 * address values).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import PostEditor from '../../src/views/PostEditor.vue';
import TagPicker from '@/components/TagPicker.vue';
import CustomFieldsEditor from '@/components/CustomFieldsEditor.vue';
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

function primeApi(post: Record<string, unknown> | null) {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/terms') return Promise.resolve([]);
    if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
    if (post && url === `/admin/cms/posts/${post.id}`) return Promise.resolve(post);
    // Generic value endpoints used by the custom-fields editor.
    if (url.includes('/custom-fields') || url.includes('/field-defs')) {
      return Promise.resolve({});
    }
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

async function mountEdit(post: Record<string, unknown>): Promise<VueWrapper> {
  primeApi(post);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
      { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
      { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
      { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
    ],
  });
  router.push({ name: 'cms-post-edit', params: { id: post.id as string } });
  await router.isReady();
  const wrapper = mount(PostEditor, {
    global: { plugins: [i18n, router], stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true } },
  });
  await flushPromises();
  return wrapper;
}

const baseEditPost = {
  slug: 'x', title: 'X', status: 'draft', content_json: {}, content_html: '<p>x</p>',
  parent_id: null, language: 'en', translation_group_id: null, sort_order: 0, robots: 'index,follow',
};

describe('PostEditor — custom fields editor (S77 tag reversal)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({ user: { id: '1', email: 'a@t.com', role: 'SUPER_ADMIN', permissions: ['*'] }, token: 't' });
    vi.clearAllMocks();
  });

  it('mounts the custom-fields editor with entity_type=cms_page when editing a page', async () => {
    const wrapper = await mountEdit({ ...baseEditPost, id: 'page-1', type: 'page' });

    expect(wrapper.find('[data-testid="post-custom-fields"]').exists()).toBe(true);
    expect(wrapper.findComponent(CustomFieldsEditor).props('entityType')).toBe('cms_page');
    expect(wrapper.findComponent(CustomFieldsEditor).props('entityId')).toBe('page-1');
  });

  it('mounts the custom-fields editor with entity_type=cms_post when editing a post', async () => {
    const wrapper = await mountEdit({ ...baseEditPost, id: 'post-1', type: 'post' });

    expect(wrapper.findComponent(CustomFieldsEditor).props('entityType')).toBe('cms_post');
    expect(wrapper.findComponent(CustomFieldsEditor).props('entityId')).toBe('post-1');
  });

  it('does not mount the generic vbwd_tag TagPicker in the CMS editor', async () => {
    const wrapper = await mountEdit({ ...baseEditPost, id: 'post-1', type: 'post' });
    expect(wrapper.findComponent(TagPicker).exists()).toBe(false);
  });

  it('does not show the custom-fields block in create (new) mode', async () => {
    primeApi(null);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
        { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
        { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
      ],
    });
    router.push({ name: 'cms-post-new' });
    await router.isReady();
    const wrapper = mount(PostEditor, {
      global: { plugins: [i18n, router], stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="post-custom-fields"]').exists()).toBe(false);
  });
});
