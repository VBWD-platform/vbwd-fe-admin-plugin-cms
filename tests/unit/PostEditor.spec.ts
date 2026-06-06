import { readFileSync } from 'fs';
import { resolve } from 'path';
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

// Lightweight stand-in for the CodeMirror-backed editor: a plain textarea that
// emits `update:modelValue`, so tests can drive the HTML/CSS tabs without the
// heavy codemirror runtime. Mirrors the real component's v-model contract.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  methods: {
    insertAtCursor(text: string) {
      (this as any).$emit('update:modelValue', ((this as any).modelValue ?? '') + text);
    },
  },
  template:
    '<textarea :data-testid="`cm-${lang}`" :value="modelValue" ' +
    '@input="$emit(\'update:modelValue\', $event.target.value)" />',
};

// Stand-in for the TipTap-backed WYSIWYG editor: avoids loading the heavy
// @tiptap runtime under jsdom while preserving the v-model / htmlValue contract.
const TipTapStub = {
  name: 'TipTapEditor',
  props: ['modelValue', 'htmlValue', 'hideTabBar'],
  emits: ['update:modelValue', 'update:htmlValue', 'open-image-picker'],
  methods: {
    setFromHtml() {},
    insertImageUrl(url: string) {
      (this as any).$emit('update:htmlValue', ((this as any).htmlValue ?? '') + `<img src="${url}">`);
    },
  },
  template: '<div class="tiptap-stub" @click="$emit(\'open-image-picker\')" />',
};

const POST_TYPES = {
  post_types: [
    { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
    { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
    {
      key: 'event',
      label: 'Event',
      routable: true,
      hierarchical: false,
      default_template: null,
      // type-specific schema surfaced by the registry
      type_data: { fields: [{ key: 'venue', label: 'Venue', type: 'text' }] },
    },
  ],
};

const TERM_TYPES = {
  term_types: [
    { key: 'category', label: 'Category', hierarchical: true },
    { key: 'tag', label: 'Tag', hierarchical: false },
  ],
};

const CATEGORIES = [
  { id: 'cat-1', term_type: 'category', slug: 'news', name: 'News', parent_id: null, seo_excluded: false, sort_order: 0 },
  { id: 'cat-2', term_type: 'category', slug: 'secret', name: 'Secret', parent_id: null, seo_excluded: true, sort_order: 0 },
];

const TAGS = [
  { id: 'tag-1', term_type: 'tag', slug: 'hot', name: 'Hot', parent_id: null, seo_excluded: false, sort_order: 0 },
];

const LAYOUTS = {
  items: [
    { id: 'lay-1', slug: 'home', name: 'Home Layout', areas: [], sort_order: 0, is_active: true },
  ],
  total: 1, page: 1, per_page: 100, pages: 1,
};

// A layout with one primary content area plus an extra content area and a
// page-widget slot — exercises the S55.2 multi-area editor + widget panel.
const MULTI_AREA_LAYOUTS = {
  items: [
    {
      id: 'lay-multi', slug: 'multi', name: 'Multi Area Layout', sort_order: 0, is_active: true,
      areas: [
        { name: 'header', type: 'header', label: 'Header' },
        { name: 'content', type: 'content', label: 'Main' },
        { name: 'sidebar-content', type: 'content', label: 'Sidebar' },
        { name: 'cta', type: 'page-widget', label: 'Call to action' },
      ],
    },
  ],
  total: 1, page: 1, per_page: 100, pages: 1,
};

const WIDGETS = {
  items: [
    { id: 'wid-1', slug: 'promo', name: 'Promo Widget', widget_type: 'html', sort_order: 0, is_active: true },
    { id: 'wid-2', slug: 'newsletter', name: 'Newsletter Widget', widget_type: 'html', sort_order: 1, is_active: true },
  ],
  total: 2, page: 1, per_page: 200, pages: 1,
};

const STYLES = {
  items: [
    { id: 'sty-1', slug: 'default', name: 'Default Style', is_default: true, sort_order: 0, is_active: true },
    { id: 'sty-2', slug: 'dark', name: 'Dark Style', is_default: false, sort_order: 1, is_active: true },
  ],
  total: 2, page: 1, per_page: 100, pages: 1,
};

function primeApi(layouts: unknown = LAYOUTS) {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/layouts') return Promise.resolve(layouts);
    if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
    if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS);
    if (url === '/admin/cms/terms') {
      const type = opts?.params?.type;
      if (type === 'category') return Promise.resolve(CATEGORIES);
      if (type === 'tag') return Promise.resolve(TAGS);
      return Promise.resolve([]);
    }
    return Promise.resolve({});
  });
}

async function mountEditor(routeName = 'cms-post-new', params: Record<string, string> = {}, query: Record<string, string> = {}): Promise<{ wrapper: VueWrapper; router: Router }> {
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

describe('PostEditor.vue', () => {
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
    primeApi();
  });

  it('renders common fields bound to the form (title, slug, excerpt)', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="post-title"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="post-slug"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="post-excerpt"]').exists()).toBe(true);

    await wrapper.find('[data-testid="post-title"]').setValue('Hello World');
    expect((wrapper.vm as any).form.title).toBe('Hello World');
  });

  it('populates the type selector from the post-type registry', async () => {
    const { wrapper } = await mountEditor();
    const options = wrapper.find('[data-testid="post-type"]').findAll('option');
    expect(options.map((o) => o.attributes('value'))).toEqual(['page', 'post', 'event']);
  });

  it('renders type-specific fields driven by the selected type schema', async () => {
    const { wrapper } = await mountEditor();
    // default first type 'page' has no type_data fields
    expect(wrapper.find('[data-testid="typefield-venue"]').exists()).toBe(false);
    await wrapper.find('[data-testid="post-type"]').setValue('event');
    await flushPromises();
    expect(wrapper.find('[data-testid="typefield-venue"]').exists()).toBe(true);
    await wrapper.find('[data-testid="typefield-venue"]').setValue('Berlin Hall');
    expect((wrapper.vm as any).form.type_data.venue).toBe('Berlin Hall');
  });

  it('populates the category term picker from the API', async () => {
    const { wrapper } = await mountEditor();
    const catOptions = wrapper.find('[data-testid="term-picker-category"]').findAll('option');
    // includes the two categories
    const values = catOptions.map((o) => o.attributes('value'));
    expect(values).toContain('cat-1');
    expect(values).toContain('cat-2');
  });

  it('adds a category as a removable chip above the selector', async () => {
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="term-picker-category"]').setValue('cat-1');
    await flushPromises();
    expect(wrapper.find('[data-testid="selected-categories"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(true);
    expect((wrapper.vm as any).selectedTermIds).toContain('cat-1');

    await wrapper.find('[data-testid="remove-category-cat-1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(false);
    expect((wrapper.vm as any).selectedTermIds).not.toContain('cat-1');
  });

  it('shows selected tags as a removable cloud', async () => {
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="term-picker-tag"]').setValue('tag-1');
    await flushPromises();
    expect(wrapper.find('[data-testid="tags-cloud"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-tag-tag-1"]').exists()).toBe(true);
  });

  it('loads existing term_ids as chips when editing', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
      if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-t') {
        return Promise.resolve({
          id: 'p-t', type: 'post', slug: 't', title: 'T', status: 'draft',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          term_ids: ['cat-1', 'tag-1'],
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-t' });
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-tag-tag-1"]').exists()).toBe(true);
  });

  it('shows the parent picker only for hierarchical types', async () => {
    const { wrapper } = await mountEditor();
    // default type 'page' is hierarchical → parent picker visible
    expect(wrapper.find('[data-testid="parent-picker"]').exists()).toBe(true);
    await wrapper.find('[data-testid="post-type"]').setValue('post');
    await flushPromises();
    // 'post' is not hierarchical → hidden
    expect(wrapper.find('[data-testid="parent-picker"]').exists()).toBe(false);
  });

  it('exposes the full status control set and shows published_at only when scheduled', async () => {
    const { wrapper } = await mountEditor();
    const statusValues = wrapper.find('[data-testid="post-status"]').findAll('option').map((o) => o.attributes('value'));
    expect(statusValues).toEqual(['draft', 'pending', 'scheduled', 'published', 'private', 'trash']);

    expect(wrapper.find('[data-testid="published-at"]').exists()).toBe(false);
    await wrapper.find('[data-testid="post-status"]').setValue('scheduled');
    await flushPromises();
    expect(wrapper.find('[data-testid="published-at"]').exists()).toBe(true);
  });

  it('renders a live SERP preview reflecting field values', async () => {
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-title"]').setValue('My Page Title');
    await wrapper.find('[data-testid="post-slug"]').setValue('my-page');
    await flushPromises();
    const serp = wrapper.find('[data-testid="serp-preview"]');
    expect(serp.text()).toContain('My Page Title');
    expect(serp.text()).toContain('my-page');
  });

  it('warns when meta description exceeds the recommended length', async () => {
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="seo-meta-description"]').setValue('x'.repeat(200));
    await flushPromises();
    expect(wrapper.find('[data-testid="serp-desc-warning"]').exists()).toBe(true);
  });

  it('writes seo_excluded through the exclude toggle', async () => {
    const { wrapper } = await mountEditor();
    expect((wrapper.vm as any).form.seo_excluded).toBe(false);
    await wrapper.find('[data-testid="seo-excluded-toggle"]').setValue(true);
    expect((wrapper.vm as any).form.seo_excluded).toBe(true);
  });

  it('surfaces inherited noindex when a selected term is seo_excluded', async () => {
    const { wrapper } = await mountEditor();
    // select the excluded category (cat-2)
    (wrapper.vm as any).selectedTermIds = ['cat-2'];
    await flushPromises();
    const effective = wrapper.find('[data-testid="seo-effective-state"]');
    expect(effective.text().toLowerCase()).toContain('inherited');
    expect(effective.text()).toContain('Secret');
  });

  it('builds a save payload with content_json, SEO, status, published_at, parent_id and translation_group_id', async () => {
    (api.post as any).mockResolvedValue({ id: 'new-id', type: 'page', slug: 'about', title: 'About' });
    (api.put as any).mockResolvedValue({ post_id: 'new-id', term_ids: ['cat-1'] });
    const { wrapper } = await mountEditor();

    await wrapper.find('[data-testid="post-title"]').setValue('About');
    await wrapper.find('[data-testid="post-slug"]').setValue('about');
    await wrapper.find('[data-testid="seo-meta-title"]').setValue('About Us');
    await wrapper.find('[data-testid="seo-excluded-toggle"]').setValue(true);
    (wrapper.vm as any).form.translation_group_id = 'grp-1';
    (wrapper.vm as any).selectedTermIds = ['cat-1'];
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.type).toBe('page');
    expect(payload.slug).toBe('about');
    expect(payload.title).toBe('About');
    expect(payload.meta_title).toBe('About Us');
    expect(payload.seo_excluded).toBe(true);
    expect(payload.status).toBe('draft');
    expect(payload.translation_group_id).toBe('grp-1');
    expect(payload).toHaveProperty('content_json');
    expect(payload).toHaveProperty('parent_id');

    // terms assigned via the dedicated endpoint after save
    expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/new-id/terms', { term_ids: ['cat-1'] });
  });

  // ── Content editing: Visual (WYSIWYG) is post-only; HTML/CSS/Preview always ─
  it('renders Visual / HTML / CSS / Preview content tabs for a post', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    const tabLabels = wrapper.findAll('[data-testid="content-tab"]').map((t) => t.text());
    expect(tabLabels).toEqual(['Visual', 'HTML', 'CSS', 'Preview']);
  });

  it('hides the Visual tab for pages — only HTML / CSS / Preview', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'page' });
    const tabLabels = wrapper.findAll('[data-testid="content-tab"]').map((t) => t.text());
    expect(tabLabels).toEqual(['HTML', 'CSS', 'Preview']);
    expect(wrapper.find('[data-testid="post-visual-editor"]').exists()).toBe(false);
  });

  it('drops the Visual tab when the type is switched from post to page', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    expect(wrapper.findAll('[data-testid="content-tab"]').map((t) => t.text())).toContain('Visual');
    await wrapper.find('[data-testid="post-type"]').setValue('page');
    await flushPromises();
    const tabLabels = wrapper.findAll('[data-testid="content-tab"]').map((t) => t.text());
    expect(tabLabels).not.toContain('Visual');
    expect((wrapper.vm as any).activeContentTab).not.toBe('Visual');
  });

  it('defaults a new post to the Visual (WYSIWYG) tab and renders the TipTap editor', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    expect((wrapper.vm as any).activeContentTab).toBe('Visual');
    expect(wrapper.find('[data-testid="post-visual-editor"]').exists()).toBe(true);
  });

  it('defaults a new page to the HTML tab (no WYSIWYG)', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'page' });
    expect((wrapper.vm as any).activeContentTab).toBe('HTML');
  });

  it('imports the TipTap visual editor', async () => {
    const source = readFileSync(
      resolve(process.cwd(), 'plugins/cms-admin/src/views/PostEditor.vue'),
      'utf-8',
    );
    expect(source).toContain('TipTapEditor');
  });

  it('writes content_html from the Visual editor (post)', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    wrapper.findComponent({ name: 'TipTapEditor' }).vm.$emit('update:htmlValue', '<p>visual body</p>');
    await flushPromises();
    expect((wrapper.vm as any).form.content_html).toBe('<p>visual body</p>');
  });

  it('edits content_html through the HTML tab', async () => {
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="cm-html"]').setValue('<h1>Hello</h1>');
    await flushPromises();
    expect((wrapper.vm as any).form.content_html).toBe('<h1>Hello</h1>');
  });

  it('persists content_html and wraps it in a single richtext content_json block', async () => {
    (api.post as any).mockResolvedValue({ id: 'html-id', type: 'page', slug: 'about', title: 'About' });
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-title"]').setValue('About');
    await wrapper.find('[data-testid="post-slug"]').setValue('about');
    await wrapper.find('[data-testid="cm-html"]').setValue('<p>Body copy</p>');
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.content_html).toBe('<p>Body copy</p>');
    expect(payload.content_json).toEqual({
      blocks: [{ type: 'richtext', data: { html: '<p>Body copy</p>' }, position: 0 }],
    });
  });

  // ── View Page button (mirrors CmsPageEditor) ────────────────────────────
  it('shows a View Page link to the fe-user URL for an existing post', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-1') {
        return Promise.resolve({
          id: 'p-1', type: 'page', slug: 'about-us', title: 'About', status: 'published',
          content_json: {}, content_html: '<p>x</p>', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-1' });
    const link = wrapper.find('[data-testid="post-view-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toContain('/about-us');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('hides the View Page link for a new (unsaved) post', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="post-view-link"]').exists()).toBe(false);
  });

  // ── Cancel returns to the list matching the content type ────────────────
  it('Cancel returns to the pages list when editing a page', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'page' });
    expect((wrapper.vm as any).form.type).toBe('page');
    expect(wrapper.find('[data-testid="post-cancel"]').attributes('href')).toBe('/admin/cms/pages');
  });

  it('Cancel returns to the posts list when editing a post', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    expect((wrapper.vm as any).form.type).toBe('post');
    expect(wrapper.find('[data-testid="post-cancel"]').attributes('href')).toBe('/admin/cms/posts');
  });

  it('builds a preview URL (with token) for an unpublished post', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-2') {
        return Promise.resolve({
          id: 'p-2', type: 'page', slug: 'draft-page', title: 'Draft', status: 'draft',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          preview_token: 'tok-abc',
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-2' });

    const viewLink = wrapper.find('[data-testid="post-view-link"]');
    expect(viewLink.text()).toContain('Preview');
    expect(viewLink.attributes('href')).toContain('/draft-page?preview_token=tok-abc');

    // The slug field shows the preview icon + a base-URL prefix ending in '/'.
    expect(wrapper.find('[data-testid="slug-preview-link"]').attributes('href'))
      .toContain('preview_token=tok-abc');
    expect(wrapper.find('.slug-prefix').exists()).toBe(true);
    expect(wrapper.find('.slug-prefix').text()).toMatch(/\/$/);
  });

  it('uses the plain public URL (no token) for a published post', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-3') {
        return Promise.resolve({
          id: 'p-3', type: 'page', slug: 'live', title: 'Live', status: 'published',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          preview_token: 'tok-xyz',
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-3' });
    const href = wrapper.find('[data-testid="post-view-link"]').attributes('href');
    expect(href).toContain('/live');
    expect(href).not.toContain('preview_token');
  });

  it('includes published_at in the payload when scheduling', async () => {
    (api.post as any).mockResolvedValue({ id: 'sched-id', type: 'post', slug: 'launch', title: 'Launch' });
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-type"]').setValue('post');
    await wrapper.find('[data-testid="post-title"]').setValue('Launch');
    await wrapper.find('[data-testid="post-slug"]').setValue('launch');
    await wrapper.find('[data-testid="post-status"]').setValue('scheduled');
    await flushPromises();
    await wrapper.find('[data-testid="published-at"]').setValue('2026-07-01T10:00');
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();
    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.status).toBe('scheduled');
    expect(payload.published_at).toContain('2026-07-01');
  });

  // ── Layout / Style / theme-switcher (parity with CmsPageEditor) ─────────
  it('populates the layout selector from /admin/cms/layouts', async () => {
    const { wrapper } = await mountEditor();
    const opts = wrapper.find('[data-testid="post-layout"]').findAll('option');
    expect(opts.map((o) => o.text())).toContain('Home Layout');
  });

  it('populates the style selector from /admin/cms/styles', async () => {
    const { wrapper } = await mountEditor();
    const opts = wrapper.find('[data-testid="post-style"]').findAll('option');
    const labels = opts.map((o) => o.text());
    expect(labels.some((l) => l.includes('Default Style'))).toBe(true);
    expect(labels.some((l) => l.includes('Dark Style'))).toBe(true);
  });

  it('has no theme-switcher toggle (legacy feature removed)', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="post-use-theme-switcher"]').exists()).toBe(false);
  });

  it('includes layout_id and style_id in the save payload (no theme-switcher flag)', async () => {
    (api.post as any).mockResolvedValue({ id: 'themed-id', type: 'page', slug: 'about', title: 'About' });
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-title"]').setValue('About');
    await wrapper.find('[data-testid="post-slug"]').setValue('about');
    (wrapper.vm as any).form.layout_id = 'lay-1';
    (wrapper.vm as any).form.style_id = 'sty-2';
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls[0][1];
    expect(payload.layout_id).toBe('lay-1');
    expect(payload.style_id).toBe('sty-2');
    expect(payload).not.toHaveProperty('use_theme_switcher_styles');
  });

  // ── Featured image ───────────────────────────────────────────────────────
  it('collapses the settings sidebar to free editor width (persisted)', async () => {
    localStorage.removeItem('post_editor_sidebar_collapsed');
    const { wrapper } = await mountEditor();
    // Expanded by default — body not full-width.
    expect((wrapper.vm as any).sidebarCollapsed).toBe(false);
    expect(wrapper.find('.post-editor__body--full').exists()).toBe(false);

    await wrapper.find('[data-testid="editor-sidebar-toggle"]').trigger('click');
    await flushPromises();

    expect((wrapper.vm as any).sidebarCollapsed).toBe(true);
    expect(wrapper.find('.post-editor__body--full').exists()).toBe(true);
    expect(localStorage.getItem('post_editor_sidebar_collapsed')).toBe('1');
    localStorage.removeItem('post_editor_sidebar_collapsed');
  });

  it('shows a featured-image select button when none is set', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="featured-image-select"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="featured-image-preview"]').exists()).toBe(false);
  });

  it('includes featured_image_url in the save payload', async () => {
    (api.post as any).mockResolvedValue({ id: 'fi-id', type: 'page', slug: 'about', title: 'About' });
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-title"]').setValue('About');
    await wrapper.find('[data-testid="post-slug"]').setValue('about');
    (wrapper.vm as any).form.featured_image_url = '/uploads/hero.jpg';
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    expect((api.post as any).mock.calls[0][1].featured_image_url).toBe('/uploads/hero.jpg');
  });

  it('loads featured_image_url and shows a preview when editing', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
      if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-7') {
        return Promise.resolve({
          id: 'p-7', type: 'post', slug: 'fi', title: 'FI', status: 'draft',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          featured_image_url: '/uploads/cover.png',
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-7' });
    expect((wrapper.vm as any).form.featured_image_url).toBe('/uploads/cover.png');
    expect(wrapper.find('[data-testid="featured-image-preview"]').exists()).toBe(true);
  });

  // ── Insert image from the library ────────────────────────────────────────
  it('shows an Insert image button on the HTML tab', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="html-insert-image"]').exists()).toBe(true);
  });

  it('inserts an <img> into content_html from the HTML tab picker', async () => {
    const { wrapper } = await mountEditor();
    (wrapper.vm as any).openPicker('html');
    (wrapper.vm as any).onImageSelect('/uploads/pic.jpg', 'A cat');
    await flushPromises();
    expect((wrapper.vm as any).form.content_html).toContain('<img src="/uploads/pic.jpg"');
    expect((wrapper.vm as any).form.content_html).toContain('alt="A cat"');
  });

  it('inserts an image into the Visual editor for a post', async () => {
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    (wrapper.vm as any).openPicker('visual');
    (wrapper.vm as any).onImageSelect('/uploads/v.jpg', '');
    await flushPromises();
    expect((wrapper.vm as any).form.content_html).toContain('<img src="/uploads/v.jpg">');
  });

  it('shows an Insert gallery button on the HTML tab', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.find('[data-testid="html-insert-gallery"]').exists()).toBe(true);
  });

  it('inserts a scroll-snap gallery into content_html from multiple images', async () => {
    const { wrapper } = await mountEditor();
    (wrapper.vm as any).openPicker('gallery');
    (wrapper.vm as any).onGallerySelect([
      { url: '/uploads/1.jpg', alt: 'One' },
      { url: '/uploads/2.jpg', alt: 'Two' },
    ]);
    await flushPromises();
    const html = (wrapper.vm as any).form.content_html;
    expect(html).toContain('class="cms-gallery"');
    expect(html).toContain('scroll-snap-type:x mandatory');
    expect(html).toContain('/uploads/1.jpg');
    expect(html).toContain('/uploads/2.jpg');
    expect(html).toContain('alt="One"');
  });

  it('routes the picker to the featured image when opened in featured mode', async () => {
    const { wrapper } = await mountEditor();
    (wrapper.vm as any).openPicker('featured');
    (wrapper.vm as any).onImageSelect('/uploads/cover.jpg', '');
    await flushPromises();
    expect((wrapper.vm as any).form.featured_image_url).toBe('/uploads/cover.jpg');
  });

  it('loads layout_id / style_id when editing', async () => {
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
      if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(TAGS);
        return Promise.resolve([]);
      }
      if (url === '/admin/cms/posts/p-9') {
        return Promise.resolve({
          id: 'p-9', type: 'page', slug: 'themed', title: 'Themed', status: 'draft',
          content_json: {}, content_html: '', parent_id: null, language: 'en',
          translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
          layout_id: 'lay-1', style_id: 'sty-2',
        });
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-9' });
    expect((wrapper.vm as any).form.layout_id).toBe('lay-1');
    expect((wrapper.vm as any).form.style_id).toBe('sty-2');
  });

  // ── S55.2: layout-area-driven content blocks + page-widgets panel ─────────
  describe('per-layout-area content blocks + page widgets', () => {
    beforeEach(() => {
      // Re-prime with the multi-area layout so the editor surfaces the extra
      // content area + page-widget slot once the layout is selected.
      vi.clearAllMocks();
      primeApi(MULTI_AREA_LAYOUTS);
    });

    it('renders only the primary content editor when no layout is selected', async () => {
      const { wrapper } = await mountEditor();
      // No layout → no additional content-block editors, no widget panel.
      expect(wrapper.findAll('.content-block-extra')).toHaveLength(0);
      expect(wrapper.find('[data-testid="page-widgets-panel"]').exists()).toBe(false);
    });

    it('renders one extra content editor for each additional content area', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      // 'content' is the primary (existing editor) — only 'sidebar-content' is extra.
      const blocks = wrapper.findAll('.content-block-extra');
      expect(blocks).toHaveLength(1);
      expect(wrapper.find('[data-testid="content-block-editor-sidebar-content"]').exists()).toBe(true);
      // The primary single content editor remains untouched.
      expect(wrapper.find('[data-testid="cm-html"]').exists()).toBe(true);
    });

    it('renders a single content editor (no blocks) for a one-content-area layout', async () => {
      vi.clearAllMocks();
      primeApi({
        items: [{
          id: 'lay-solo', slug: 'solo', name: 'Solo', sort_order: 0, is_active: true,
          areas: [{ name: 'content', type: 'content', label: 'Main' }],
        }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-solo';
      await flushPromises();
      expect(wrapper.findAll('.content-block-extra')).toHaveLength(0);
    });

    it('binds an extra content block editor to form.content_blocks', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      await wrapper
        .find('[data-testid="content-block-editor-sidebar-content"] [data-testid="cm-html"]')
        .setValue('<p>sidebar body</p>');
      await flushPromises();
      expect((wrapper.vm as any).form.content_blocks['sidebar-content'].content_html)
        .toBe('<p>sidebar body</p>');
    });

    it('renders a page-widgets panel with a row only per page-widget area', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      expect(wrapper.find('[data-testid="page-widgets-panel"]').exists()).toBe(true);
      // Only the 'cta' page-widget area gets a selector.
      const selector = wrapper.find('[data-testid="page-widget-select-cta"]');
      expect(selector.exists()).toBe(true);
      // Chrome areas (header / footer / vue) must NOT get a per-page override.
      expect(wrapper.find('[data-testid="page-widget-select-header"]').exists()).toBe(false);
      // Exactly one widget row, for the single page-widget area.
      expect(wrapper.findAll('.page-widget-row')).toHaveLength(1);
      // Options include the loaded widgets.
      const values = selector.findAll('option').map((o) => o.attributes('value'));
      expect(values).toContain('wid-1');
      expect(values).toContain('wid-2');
    });

    it('hides the page-widgets panel when the layout has no page-widget area', async () => {
      vi.clearAllMocks();
      primeApi({
        items: [{
          id: 'lay-nowidget', slug: 'nowidget', name: 'No Widget', sort_order: 0, is_active: true,
          areas: [
            { name: 'header', type: 'header', label: 'Header' },
            { name: 'content', type: 'content', label: 'Main' },
            { name: 'footer', type: 'footer', label: 'Footer' },
          ],
        }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-nowidget';
      await flushPromises();
      expect(wrapper.find('[data-testid="page-widgets-panel"]').exists()).toBe(false);
    });

    it('labels each extra content-block editor with the layout area name', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      // The extra content area (sidebar-content) carries its area label as a heading.
      const block = wrapper.find('[data-testid="content-block-editor-sidebar-content"]');
      expect(block.exists()).toBe(true);
      expect(block.text()).toContain('Sidebar');
    });

    it('binds the widget selection to form.page_widgets', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-2');
      await flushPromises();
      const assignment = (wrapper.vm as any).form.page_widgets.find(
        (w: { area_name: string }) => w.area_name === 'cta',
      );
      expect(assignment.widget_id).toBe('wid-2');
      // Clearing the selection removes the override (layout default applies).
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('');
      await flushPromises();
      expect(
        (wrapper.vm as any).form.page_widgets.find((w: { area_name: string }) => w.area_name === 'cta'),
      ).toBeUndefined();
    });

    it('saves content_blocks in the payload and PUTs the page widgets after the post', async () => {
      (api.post as any).mockResolvedValue({ id: 'mp-id', type: 'page', slug: 'multi', title: 'Multi' });
      (api.put as any).mockResolvedValue({});
      const { wrapper } = await mountEditor();
      await wrapper.find('[data-testid="post-title"]').setValue('Multi');
      await wrapper.find('[data-testid="post-slug"]').setValue('multi');
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      await wrapper
        .find('[data-testid="content-block-editor-sidebar-content"] [data-testid="cm-html"]')
        .setValue('<p>aside</p>');
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-1');
      await flushPromises();

      await (wrapper.vm as any).save();
      await flushPromises();

      // content_blocks ride the post payload as an array, excluding the primary area.
      const payload = (api.post as any).mock.calls[0][1];
      expect(payload.content_blocks).toEqual([
        { area_name: 'sidebar-content', content_html: '<p>aside</p>', source_css: null, sort_order: 0 },
      ]);

      // Page widgets are saved through a separate PUT after the post is created.
      expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/mp-id/widgets', [
        { widget_id: 'wid-1', area_name: 'cta', sort_order: 0, required_access_level_ids: [] },
      ]);
    });

    it('loads content_blocks + page_assignments from the admin post response', async () => {
      vi.clearAllMocks();
      (api.get as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
        if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
        if (url === '/admin/cms/layouts') return Promise.resolve(MULTI_AREA_LAYOUTS);
        if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
        if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS);
        if (url === '/admin/cms/terms') {
          const type = opts?.params?.type;
          if (type === 'category') return Promise.resolve(CATEGORIES);
          if (type === 'tag') return Promise.resolve(TAGS);
          return Promise.resolve([]);
        }
        if (url === '/admin/cms/posts/p-multi') {
          return Promise.resolve({
            id: 'p-multi', type: 'page', slug: 'multi', title: 'Multi', status: 'draft',
            content_json: {}, content_html: '<p>main</p>', parent_id: null, language: 'en',
            translation_group_id: null, sort_order: 0, robots: 'index,follow', seo_excluded: false,
            layout_id: 'lay-multi',
            content_blocks: {
              'sidebar-content': {
                id: 'cb-1', area_name: 'sidebar-content', content_html: '<p>aside</p>',
                source_css: '.x{}', sort_order: 0, content_json: {},
              },
            },
            page_assignments: [
              {
                id: 'pa-1', widget_id: 'wid-2', area_name: 'cta', sort_order: 0,
                required_access_level_ids: ['lvl-1'], widget: { id: 'wid-2', name: 'Newsletter Widget' },
              },
            ],
          });
        }
        return Promise.resolve({});
      });
      const { wrapper } = await mountEditor('cms-post-edit', { id: 'p-multi' });
      await flushPromises();

      expect((wrapper.vm as any).form.content_blocks['sidebar-content'].content_html).toBe('<p>aside</p>');
      expect((wrapper.vm as any).form.content_blocks['sidebar-content'].source_css).toBe('.x{}');

      const widgets = (wrapper.vm as any).form.page_widgets;
      expect(widgets).toHaveLength(1);
      expect(widgets[0]).toMatchObject({
        widget_id: 'wid-2', area_name: 'cta', required_access_level_ids: ['lvl-1'],
      });
      // The selector reflects the loaded assignment.
      expect((wrapper.find('[data-testid="page-widget-select-cta"]').element as HTMLSelectElement).value)
        .toBe('wid-2');
    });
  });
});
