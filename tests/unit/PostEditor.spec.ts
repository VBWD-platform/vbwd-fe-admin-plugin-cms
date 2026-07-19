import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, enableAutoUnmount, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import PostEditor from '../../src/views/PostEditor.vue';
import en from '../../locales/en.json';
import { registerWidgetEditor } from '../../src/widgets/widgetEditorRegistry';

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

// Auto-unmount each wrapper so the editor's debounced permalink-preview timer
// (S122) is cancelled via onBeforeUnmount and never fires during a later test.
enableAutoUnmount(afterEach);

// Lightweight stand-in for the CodeMirror-backed editor: a plain textarea that
// emits `update:modelValue`, so tests can drive the HTML/CSS tabs without the
// heavy codemirror runtime. Mirrors the real component's v-model contract.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  inheritAttrs: false,
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  computed: {
    // Honour an explicit data-testid passed by the host (e.g. the per-page
    // widget config fields), else fall back to the lang-keyed default.
    testid(): string {
      return ((this as any).$attrs['data-testid'] as string) ?? `cm-${(this as any).lang}`;
    },
  },
  methods: {
    insertAtCursor(text: string) {
      (this as any).$emit('update:modelValue', ((this as any).modelValue ?? '') + text);
    },
  },
  template:
    '<textarea :data-testid="testid" :value="modelValue" ' +
    '@input="$emit(\'update:modelValue\', $event.target.value)" />',
};

// Stand-in for the menu tree editor: a button that appends a fixed item so a
// test can drive an update:modelValue without the full tree-editor runtime.
const MenuTreeStub = {
  name: 'CmsMenuTreeEditor',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<button data-testid="menu-add-item" type="button" ' +
    "@click=\"$emit('update:modelValue', [...(modelValue ?? []), " +
    "{ id: 'mi-new', parent_id: null, label: 'Added', url: '/added', page_slug: null }])\">" +
    'add</button>',
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

// An html widget seeds the per-page editor from its base64 content_json.content
// + source_css — decoded the same way the renderer does.
function encodeWidgetHtml(html: string): string {
  return btoa(unescape(encodeURIComponent(html)));
}

const WIDGETS = {
  items: [
    {
      id: 'wid-1', slug: 'promo', name: 'Promo Widget', widget_type: 'html', sort_order: 0, is_active: true,
      content_json: { content: encodeWidgetHtml('<p>Promo default</p>') }, source_css: '.promo{}',
    },
    { id: 'wid-2', slug: 'newsletter', name: 'Newsletter Widget', widget_type: 'html', sort_order: 1, is_active: true },
  ],
  total: 2, page: 1, per_page: 200, pages: 1,
};

// A menu widget carrying its own items (the single-widget GET supplies them).
const MENU_WIDGET = {
  id: 'wid-menu', slug: 'main-menu', name: 'Main Menu', widget_type: 'menu',
  source_css: '.cms-menu{}',
  menu_items: [{ id: 'mi-1', parent_id: null, label: 'Home', url: '/', page_slug: null }],
  sort_order: 3, is_active: true,
};

const STYLES = {
  items: [
    { id: 'sty-1', slug: 'default', name: 'Default Style', is_default: true, sort_order: 0, is_active: true },
    { id: 'sty-2', slug: 'dark', name: 'Dark Style', is_default: false, sort_order: 1, is_active: true },
  ],
  total: 2, page: 1, per_page: 100, pages: 1,
};

// A vue-component widget whose config editor descriptor is registered below,
// so the PostEditor can offer a per-page config collapsible for it.
const VUE_WIDGET = {
  id: 'wid-vue', slug: 'addon-catalog', name: 'Addon Catalog', widget_type: 'vue-component',
  config: { component_name: 'AddonCatalog', heading: 'Default heading' },
  sort_order: 2, is_active: true,
};

const WIDGETS_WITH_VUE = {
  items: [...WIDGETS.items, VUE_WIDGET, MENU_WIDGET],
  total: 4, page: 1, per_page: 200, pages: 1,
};

// A General-tab editor exposing v-model:config — edits the `heading` field.
const ConfigEditorStub = {
  name: 'ConfigEditorStub',
  props: { config: { type: Object, default: () => ({}) } },
  emits: ['update:config'],
  template:
    '<input data-testid="cfg-heading" :value="config.heading" ' +
    "@input=\"$emit('update:config', { ...config, heading: $event.target.value })\" />",
};

registerWidgetEditor({
  componentName: 'AddonCatalog',
  defaultConfig: () => ({ heading: 'Default heading' }),
  generalTabComponent: ConfigEditorStub,
  buildPreview: () => ({ html: '' }),
});

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
      stubs: {
        CodeMirrorEditor: CodeMirrorStub,
        TipTapEditor: TipTapStub,
        CmsMenuTreeEditor: MenuTreeStub,
        CmsImagePicker: true,
      },
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

  it('populates the category quicksearch from the API', async () => {
    const { wrapper } = await mountEditor();
    // The category picker is a typeahead: typing filters the loaded categories.
    const picker = wrapper.find('[data-testid="term-picker-category"]');
    await picker.find('[data-testid="searchable-term-input"]').setValue('New');
    await flushPromises();
    const options = picker.findAll('[data-testid="searchable-term-option"]');
    expect(options.map((option) => option.text())).toContain('News');
  });

  it('adds a category via quicksearch as a removable chip', async () => {
    const { wrapper } = await mountEditor();
    const picker = wrapper.find('[data-testid="term-picker-category"]');
    await picker.find('[data-testid="searchable-term-input"]').setValue('News');
    await picker.find('[data-testid="searchable-term-option"]').trigger('mousedown');
    await flushPromises();
    expect(wrapper.find('[data-testid="selected-categories"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(true);
    expect((wrapper.vm as any).selectedTermIds).toContain('cat-1');

    await wrapper.find('[data-testid="remove-category-cat-1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(false);
    expect((wrapper.vm as any).selectedTermIds).not.toContain('cat-1');
  });

  it('renders the cms_term tag picker (not the generic TagPicker)', async () => {
    const { wrapper } = await mountEditor();
    // Tags are a cms_term taxonomy again (S77 reversal): the editor uses the
    // SearchableTermSelect tag picker. The generic vbwd_tag TagPicker is gone.
    expect(wrapper.find('[data-testid="term-picker-tag"]').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'TagPicker' }).exists()).toBe(false);
  });

  it('filters loaded tag terms via the tag quicksearch', async () => {
    const { wrapper } = await mountEditor();
    const picker = wrapper.find('[data-testid="term-picker-tag"]');
    await picker.find('[data-testid="searchable-term-input"]').setValue('Ho');
    await flushPromises();
    const options = picker.findAll('[data-testid="searchable-term-option"]');
    expect(options.map((option) => option.text())).toContain('Hot');
  });

  it('adds a tag term via quicksearch as a removable chip', async () => {
    const { wrapper } = await mountEditor();
    const picker = wrapper.find('[data-testid="term-picker-tag"]');
    await picker.find('[data-testid="searchable-term-input"]').setValue('Hot');
    await picker.find('[data-testid="searchable-term-option"]').trigger('mousedown');
    await flushPromises();
    expect(wrapper.find('[data-testid="selected-tags"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-tag-tag-1"]').exists()).toBe(true);
    expect((wrapper.vm as any).selectedTermIds).toContain('tag-1');

    await wrapper.find('[data-testid="remove-tag-tag-1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remove-tag-tag-1"]').exists()).toBe(false);
    expect((wrapper.vm as any).selectedTermIds).not.toContain('tag-1');
  });

  it('inline-creates a new cms_term tag and selects it', async () => {
    // saveTerm POSTs a new cms_term('tag') and returns it; the editor adds the
    // returned id to the selection (and reloads the tag terms so the chip can
    // resolve its name). The mount-time tag list excludes 'Fresh' so the
    // typeahead offers the create option; the post-create reload includes it.
    const NEW_TAG = { id: 'tag-new', term_type: 'tag', slug: 'fresh', name: 'Fresh', parent_id: null, seo_excluded: false, sort_order: 0 };
    let tagCreated = false;
    (api.post as any).mockImplementation((url: string) => {
      if (url === '/admin/cms/terms') {
        tagCreated = true;
        return Promise.resolve(NEW_TAG);
      }
      return Promise.resolve({});
    });
    (api.get as any).mockImplementation((url: string, opts?: any) => {
      if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
      if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
      if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
      if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
      if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS);
      if (url === '/admin/cms/terms') {
        const type = opts?.params?.type;
        if (type === 'category') return Promise.resolve(CATEGORIES);
        if (type === 'tag') return Promise.resolve(tagCreated ? [...TAGS, NEW_TAG] : TAGS);
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });
    const { wrapper } = await mountEditor();
    const picker = wrapper.find('[data-testid="term-picker-tag"]');
    await picker.find('[data-testid="searchable-term-input"]').setValue('Fresh');
    await flushPromises();
    await picker.find('[data-testid="searchable-term-create"]').trigger('mousedown');
    await flushPromises();

    // The create POSTed a cms_term('tag') and the returned id is selected.
    expect(api.post).toHaveBeenCalledWith('/admin/cms/terms', { term_type: 'tag', name: 'Fresh' });
    expect((wrapper.vm as any).selectedTermIds).toContain('tag-new');
    expect(wrapper.find('[data-testid="remove-tag-tag-new"]').exists()).toBe(true);
  });

  it('sends selected tag term ids in the assignTerms PUT on save', async () => {
    (api.post as any).mockResolvedValue({ id: 'p-tg', type: 'post', slug: 'tg', title: 'TG' });
    (api.put as any).mockResolvedValue({ post_id: 'p-tg', term_ids: ['cat-1', 'tag-1'] });
    const { wrapper } = await mountEditor();
    await wrapper.find('[data-testid="post-title"]').setValue('TG');
    await wrapper.find('[data-testid="post-slug"]').setValue('tg');

    // Select a category + a tag via their quicksearch pickers.
    const catPicker = wrapper.find('[data-testid="term-picker-category"]');
    await catPicker.find('[data-testid="searchable-term-input"]').setValue('News');
    await catPicker.find('[data-testid="searchable-term-option"]').trigger('mousedown');
    const tagPicker = wrapper.find('[data-testid="term-picker-tag"]');
    await tagPicker.find('[data-testid="searchable-term-input"]').setValue('Hot');
    await tagPicker.find('[data-testid="searchable-term-option"]').trigger('mousedown');
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const termCall = (api.put as any).mock.calls.find(
      (call: unknown[]) => call[0] === '/admin/cms/posts/p-tg/terms',
    );
    expect(termCall).toBeTruthy();
    expect(termCall[1].term_ids).toContain('tag-1');
    expect(termCall[1].term_ids).toContain('cat-1');
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
    // Both the category chip and the cms_term tag chip render from term_ids.
    expect(wrapper.find('[data-testid="remove-category-cat-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-tag-tag-1"]').exists()).toBe(true);
    expect((wrapper.vm as any).selectedTermIds).toContain('tag-1');
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

    // terms assigned via the dedicated endpoint after save (with the
    // per-category pin payload, empty when nothing is pinned — S-archives)
    expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/new-id/terms', {
      term_ids: ['cat-1'],
      pinned_term_ids: [],
    });
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

  it('hydrates the preview URL (token + server slug) after saving a new draft', async () => {
    // The server (S122 permalink engine) computes the real slug and issues a
    // preview_token in the save response. After a first save the editor must
    // hydrate from that response so the Preview link carries ?preview_token=
    // and the server-computed slug — without waiting for a reload.
    (api.post as any).mockResolvedValue({
      id: 'p-new',
      type: 'post',
      slug: 'blog/2026/uncategorized/new-flow-post',
      title: 'New Flow Post',
      status: 'draft',
      preview_token: 'tok-new',
    });
    (api.put as any).mockResolvedValue({});
    const { wrapper } = await mountEditor('cms-post-new', {}, { type: 'post' });
    await wrapper.find('[data-testid="post-title"]').setValue('New Flow Post');
    await wrapper.find('[data-testid="post-slug"]').setValue('new-flow-post');
    await wrapper.find('[data-testid="post-status"]').setValue('draft');
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    // The slug field's preview link mirrors the postUrl computed and does not
    // depend on isNew — assert the token + server-computed slug landed on it.
    const previewHref = wrapper.find('[data-testid="slug-preview-link"]').attributes('href');
    expect(previewHref).toContain('/blog/2026/uncategorized/new-flow-post');
    expect(previewHref).toContain('?preview_token=tok-new');
    // The editable slug field now reflects the server-computed slug.
    expect((wrapper.vm as any).form.slug).toBe('blog/2026/uncategorized/new-flow-post');
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
      // Chrome areas (header / footer) + content must NOT get a per-page override.
      expect(wrapper.find('[data-testid="page-widget-select-header"]').exists()).toBe(false);
      // Exactly one widget row, for the single page-widget area.
      expect(wrapper.findAll('.page-widget-row')).toHaveLength(1);
      // Options include the loaded widgets.
      const values = selector.findAll('option').map((o) => o.attributes('value'));
      expect(values).toContain('wid-1');
      expect(values).toContain('wid-2');
    });

    it('shows ONLY page-widget areas — vue / vue-component / chrome / content never appear', async () => {
      vi.clearAllMocks();
      primeApi({
        items: [{
          id: 'lay-mixed', slug: 'mixed', name: 'Mixed Areas', sort_order: 0, is_active: true,
          areas: [
            { name: 'header', type: 'header', label: 'Header' },
            { name: 'content', type: 'content', label: 'Main' },
            { name: 'main', type: 'vue-component', label: 'Main Component' },
            { name: 'chat', type: 'vue', label: 'Chat' },
            { name: 'cta', type: 'page-widget', label: 'Call to action' },
          ],
        }],
        total: 1, page: 1, per_page: 100, pages: 1,
      });
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-mixed';
      await flushPromises();
      // Only the page-widget area gets an override selector.
      expect(wrapper.find('[data-testid="page-widget-select-cta"]').exists()).toBe(true);
      // vue / vue-component / chrome / content areas must NOT appear.
      expect(wrapper.find('[data-testid="page-widget-select-main"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="page-widget-select-chat"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="page-widget-select-header"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="page-widget-select-content"]').exists()).toBe(false);
      expect(wrapper.findAll('.page-widget-row')).toHaveLength(1);
    });

    it('renders the per-page config block as a sibling AFTER the row, not inside it', async () => {
      vi.clearAllMocks();
      primeApi(MULTI_AREA_LAYOUTS);
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      (wrapper.vm as any).form.page_widgets = [
        { widget_id: 'wid-vue', area_name: 'cta', sort_order: 0, required_access_level_ids: [] },
      ];
      // make the vue widget resolvable for the config block
      (wrapper.vm as any).store.widgets = { items: WIDGETS_WITH_VUE.items };
      await flushPromises();
      const row = wrapper.find('[data-testid="page-widget-row-cta"]');
      const config = wrapper.find('[data-testid="page-widget-config-cta"]');
      expect(row.exists()).toBe(true);
      expect(config.exists()).toBe(true);
      // The config block must NOT be nested inside the row.
      expect(row.find('[data-testid="page-widget-config-cta"]').exists()).toBe(false);
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

  // ── Per-page widget config override (collapsible in the Page widgets panel) ─
  describe('per-page widget config override', () => {
    function primeApiWithVueWidget() {
      (api.get as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
        if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
        if (url === '/admin/cms/layouts') return Promise.resolve(MULTI_AREA_LAYOUTS);
        if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
        if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS_WITH_VUE);
        if (url === '/admin/cms/terms') {
          const type = opts?.params?.type;
          if (type === 'category') return Promise.resolve(CATEGORIES);
          if (type === 'tag') return Promise.resolve(TAGS);
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });
    }

    beforeEach(() => {
      vi.clearAllMocks();
      primeApiWithVueWidget();
    });

    it('hides the config collapsible when the area is on layout default', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      expect(wrapper.find('[data-testid="page-widget-config-cta"]').exists()).toBe(false);
    });

    it('reveals the config collapsible for ANY selected widget (html, vue, menu)', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();

      // An html widget (wid-1) now reveals the per-page editor (HTML + CSS).
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-1');
      await flushPromises();
      const htmlBlock = wrapper.find('[data-testid="page-widget-config-cta"]');
      expect(htmlBlock.exists()).toBe(true);
      expect(htmlBlock.find('[data-testid="widget-config-html"]').exists()).toBe(true);
      expect(htmlBlock.find('[data-testid="widget-config-css"]').exists()).toBe(true);

      // The vue-component widget (wid-vue) shows its descriptor field + CSS.
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-vue');
      await flushPromises();
      const vueBlock = wrapper.find('[data-testid="page-widget-config-cta"]');
      expect(vueBlock.exists()).toBe(true);
      expect(vueBlock.find('[data-testid="cfg-heading"]').exists()).toBe(true);
      expect(vueBlock.find('[data-testid="widget-config-css"]').exists()).toBe(true);

      // A menu widget shows the tree editor + CSS.
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-menu');
      await flushPromises();
      const menuBlock = wrapper.find('[data-testid="page-widget-config-cta"]');
      expect(menuBlock.exists()).toBe(true);
      expect(menuBlock.find('[data-testid="menu-add-item"]').exists()).toBe(true);
      expect(menuBlock.find('[data-testid="widget-config-css"]').exists()).toBe(true);
    });

    it('writes a vue-component override into config_override.config + source_css and PUTs it', async () => {
      (api.post as any).mockResolvedValue({ id: 'cfg-id', type: 'page', slug: 'multi', title: 'Multi' });
      (api.put as any).mockResolvedValue({});
      const { wrapper } = await mountEditor();
      await wrapper.find('[data-testid="post-title"]').setValue('Multi');
      await wrapper.find('[data-testid="post-slug"]').setValue('multi');
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();

      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-vue');
      await flushPromises();
      // Edit the descriptor field — writes into config_override.config.
      await wrapper.find('[data-testid="cfg-heading"]').setValue('Per-page heading');
      await flushPromises();

      const assignment = (wrapper.vm as any).form.page_widgets.find(
        (w: { area_name: string }) => w.area_name === 'cta',
      );
      // The editor seeds from the widget's own config, so the override.config
      // carries the full config with the edited field on top, plus source_css.
      expect(assignment.config_override).toEqual({
        config: { component_name: 'AddonCatalog', heading: 'Per-page heading' },
        source_css: '',
      });

      await (wrapper.vm as any).save();
      await flushPromises();

      expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/cfg-id/widgets', [
        {
          widget_id: 'wid-vue', area_name: 'cta', sort_order: 0,
          required_access_level_ids: [],
          config_override: {
            config: { component_name: 'AddonCatalog', heading: 'Per-page heading' },
            source_css: '',
          },
        },
      ]);
    });

    it('writes an html override into config_override.content_html + source_css', async () => {
      (api.post as any).mockResolvedValue({ id: 'html-id', type: 'page', slug: 'multi', title: 'Multi' });
      (api.put as any).mockResolvedValue({});
      const { wrapper } = await mountEditor();
      await wrapper.find('[data-testid="post-title"]').setValue('Multi');
      await wrapper.find('[data-testid="post-slug"]').setValue('multi');
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();

      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-1');
      await flushPromises();

      const block = wrapper.find('[data-testid="page-widget-config-cta"]');
      // The HTML editor seeds from the widget's decoded content.
      const htmlEditor = block.find('[data-testid="widget-config-html"]');
      expect((htmlEditor.element as HTMLTextAreaElement).value).toBe('<p>Promo default</p>');

      await htmlEditor.setValue('<p>Per-page HTML</p>');
      await block.find('[data-testid="widget-config-css"]').setValue('.cta { color: blue; }');
      await flushPromises();

      const assignment = (wrapper.vm as any).form.page_widgets.find(
        (w: { area_name: string }) => w.area_name === 'cta',
      );
      expect(assignment.config_override).toEqual({
        content_html: '<p>Per-page HTML</p>',
        source_css: '.cta { color: blue; }',
      });

      await (wrapper.vm as any).save();
      await flushPromises();

      expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/html-id/widgets', [
        {
          widget_id: 'wid-1', area_name: 'cta', sort_order: 0,
          required_access_level_ids: [],
          config_override: {
            content_html: '<p>Per-page HTML</p>',
            source_css: '.cta { color: blue; }',
          },
        },
      ]);
    });

    it('writes a menu override into config_override.menu_items + source_css', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();

      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-menu');
      await flushPromises();

      const block = wrapper.find('[data-testid="page-widget-config-cta"]');
      await block.find('[data-testid="menu-add-item"]').trigger('click');
      await flushPromises();

      const assignment = (wrapper.vm as any).form.page_widgets.find(
        (w: { area_name: string }) => w.area_name === 'cta',
      );
      // Seeds from the widget's own items, then appends the added one.
      expect(assignment.config_override.menu_items).toEqual([
        { id: 'mi-1', parent_id: null, label: 'Home', url: '/', page_slug: null },
        { id: 'mi-new', parent_id: null, label: 'Added', url: '/added', page_slug: null },
      ]);
      expect(assignment.config_override.source_css).toBe('.cms-menu{}');
    });

    it('clears the override when the area is switched back to layout default', async () => {
      const { wrapper } = await mountEditor();
      (wrapper.vm as any).form.layout_id = 'lay-multi';
      await flushPromises();
      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('wid-vue');
      await flushPromises();
      await wrapper.find('[data-testid="cfg-heading"]').setValue('X');
      await flushPromises();

      await wrapper.find('[data-testid="page-widget-select-cta"]').setValue('');
      await flushPromises();
      // Row removed entirely → no override survives.
      expect(
        (wrapper.vm as any).form.page_widgets.find((w: { area_name: string }) => w.area_name === 'cta'),
      ).toBeUndefined();
    });
  });

  // ── Configurable editor languages (driven by the "Languages" settings tab) ─
  describe('configurable editor languages', () => {
    // Re-prime api.get so the base fixtures resolve AND /admin/cms/languages
    // returns the configured subset; unknown routes fall back to {}.
    function primeApiWithLanguages(languages: Array<{ code: string; label: string }>) {
      (api.get as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
        if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
        if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
        if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
        if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS);
        if (url === '/admin/cms/languages') return Promise.resolve({ languages });
        if (url === '/admin/cms/terms') {
          const type = opts?.params?.type;
          if (type === 'category') return Promise.resolve(CATEGORIES);
          if (type === 'tag') return Promise.resolve(TAGS);
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });
    }

    it('renders the language options from the configured list (not the hardcoded en/de/ru)', async () => {
      vi.clearAllMocks();
      primeApiWithLanguages([
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ]);
      const { wrapper } = await mountEditor();
      const options = wrapper.find('[data-testid="post-language"]').findAll('option');
      expect(options.map((option) => option.attributes('value'))).toEqual(['en', 'fr']);
      expect(options.map((option) => option.text())).toEqual(['English', 'Français']);
      // The previously-hardcoded Russian option is gone.
      expect(options.map((option) => option.attributes('value'))).not.toContain('ru');
    });

    it('falls back to en/de/ru when the languages fetch fails', async () => {
      vi.clearAllMocks();
      (api.get as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
        if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
        if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
        if (url === '/admin/cms/styles') return Promise.resolve(STYLES);
        if (url === '/admin/cms/widgets') return Promise.resolve(WIDGETS);
        if (url === '/admin/cms/languages') return Promise.reject(new Error('boom'));
        if (url === '/admin/cms/terms') {
          const type = opts?.params?.type;
          if (type === 'category') return Promise.resolve(CATEGORIES);
          if (type === 'tag') return Promise.resolve(TAGS);
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });
      const { wrapper } = await mountEditor();
      const options = wrapper.find('[data-testid="post-language"]').findAll('option');
      expect(options.map((option) => option.attributes('value'))).toEqual(['en', 'de', 'ru']);
    });
  });
});
