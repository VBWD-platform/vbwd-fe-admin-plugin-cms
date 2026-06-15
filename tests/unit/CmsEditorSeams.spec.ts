import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import PostEditor from '../../src/views/PostEditor.vue';
import {
  registerCmsEditorHeaderAction,
  registerCmsEditorPanel,
  clearCmsEditorExtensions,
  type CmsEditorContext,
} from '../../src/editor/cmsEditorExtensionRegistry';
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
const EMPTY_LIST = { items: [], total: 0, page: 1, per_page: 100, pages: 1 };

function primeApi(): void {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/cms/post-types') return Promise.resolve(POST_TYPES);
    if (url === '/admin/cms/term-types') return Promise.resolve({ term_types: [] });
    if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
    if (url === '/admin/cms/terms') return Promise.resolve([]);
    if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
    return Promise.resolve({});
  });
}

async function mountEditor(): Promise<VueWrapper> {
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
    global: {
      plugins: [i18n, router],
      stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: TipTapStub, CmsImagePicker: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('PostEditor CMS editor seams', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({
      user: { id: '1', email: 'a@b.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    primeApi();
    clearCmsEditorExtensions();
  });

  afterEach(() => {
    clearCmsEditorExtensions();
  });

  it('renders no extra surfaces when the registry is empty (Liskov null default)', async () => {
    const wrapper = await mountEditor();
    expect(wrapper.find('[data-testid="seam-header-probe"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="seam-panel-probe"]').exists()).toBe(false);
  });

  it('renders a registered header action inside .post-editor__actions before Save', async () => {
    const HeaderProbe = {
      name: 'HeaderProbe',
      props: { context: { type: Object, required: true } },
      template: '<button data-testid="seam-header-probe">AI</button>',
    };
    registerCmsEditorHeaderAction(HeaderProbe);

    const wrapper = await mountEditor();
    const probe = wrapper.find('[data-testid="seam-header-probe"]');
    expect(probe.exists()).toBe(true);
    // Lives inside the header action bar...
    const actionBar = wrapper.find('.post-editor__actions');
    expect(actionBar.find('[data-testid="seam-header-probe"]').exists()).toBe(true);
    // ...and before the Save button (DOM order).
    const html = actionBar.html();
    expect(html.indexOf('seam-header-probe')).toBeLessThan(html.indexOf('post-save'));
  });

  it('renders a registered panel between the header and the body', async () => {
    const PanelProbe = {
      name: 'PanelProbe',
      props: { context: { type: Object, required: true } },
      template: '<div data-testid="seam-panel-probe">panel</div>',
    };
    registerCmsEditorPanel(PanelProbe);

    const wrapper = await mountEditor();
    expect(wrapper.find('[data-testid="seam-panel-probe"]').exists()).toBe(true);

    // Placement: after the header, before the body grid.
    const rootHtml = wrapper.find('.cms-view').html();
    const headerEnd = rootHtml.indexOf('post-editor__header');
    const panelAt = rootHtml.indexOf('seam-panel-probe');
    const bodyAt = rootHtml.indexOf('post-editor__body');
    expect(panelAt).toBeGreaterThan(headerEnd);
    expect(panelAt).toBeLessThan(bodyAt);
  });

  it('passes a CmsEditorContext whose applyPatch writes core keys and getContext reads the form', async () => {
    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() {
        captured = (this as any).context as CmsEditorContext;
      },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    const wrapper = await mountEditor();
    expect(captured).not.toBeNull();

    captured!.applyPatch({ title: 'Generated', content_html: '<p>Body</p>' });
    await flushPromises();
    expect((wrapper.vm as any).form.title).toBe('Generated');
    expect((wrapper.vm as any).form.content_html).toBe('<p>Body</p>');

    const ctx = captured!.getContext({ readExcerpt: false });
    expect(ctx.title).toBe('Generated');
    expect(ctx.content_html).toBe('<p>Body</p>');
    expect(ctx.excerpt).toBe('');
  });

  it('omits the excerpt from getContext unless readExcerpt is true', async () => {
    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() { captured = (this as any).context as CmsEditorContext; },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    const wrapper = await mountEditor();
    (wrapper.vm as any).form.excerpt = 'Lead paragraph';
    await flushPromises();

    expect(captured!.getContext({ readExcerpt: false }).excerpt).toBe('');
    expect(captured!.getContext({ readExcerpt: true }).excerpt).toBe('Lead paragraph');
  });

  it('does not apply null or undefined patch values', async () => {
    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() { captured = (this as any).context as CmsEditorContext; },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    const wrapper = await mountEditor();
    (wrapper.vm as any).form.meta_title = 'Keep me';
    await flushPromises();

    captured!.applyPatch({ meta_title: null, meta_description: undefined, title: 'New' });
    await flushPromises();
    expect((wrapper.vm as any).form.meta_title).toBe('Keep me');
    expect((wrapper.vm as any).form.title).toBe('New');
  });

  it('routes non-core custom-field keys into the context custom_fields (degrade path)', async () => {
    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() { captured = (this as any).context as CmsEditorContext; },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    await mountEditor();
    captured!.applyPatch({ title: 'T', reading_time: 7 });
    await flushPromises();

    const ctx = captured!.getContext({ readExcerpt: false });
    expect(ctx.custom_fields).toEqual({ reading_time: 7 });
  });
});

// S41 Slice 3b — when S77's CustomFieldsEditor is mounted (edit mode), a patch's
// custom-field keys must flow into it via its `setValues` write seam (not just
// the inert bucket). Core keys still route to `form`. With no editor mounted
// (new mode) the Slice-3 bucket degrade still holds (covered above).
describe('PostEditor — applyPatch reaches the S77 custom-fields editor (S41 3b)', () => {
  const setValuesSpy = vi.fn();
  // Stub standing in for the real CustomFieldsEditor: exposes the new write
  // seam so the spec can assert the patch reached the inputs.
  const CustomFieldsEditorStub = {
    name: 'CustomFieldsEditor',
    props: ['entityType', 'entityId'],
    setup() {
      return {};
    },
    expose: ['setValues'],
    methods: {
      setValues(partial: Record<string, unknown>) {
        setValuesSpy(partial);
      },
    },
    template: '<section data-testid="custom-fields-editor-stub" />',
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({
      user: { id: '1', email: 'a@b.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    setValuesSpy.mockClear();
    clearCmsEditorExtensions();
  });

  afterEach(() => {
    clearCmsEditorExtensions();
  });

  async function mountEditExisting(): Promise<{ wrapper: VueWrapper; captured: () => CmsEditorContext | null }> {
    const post = {
      id: 'post-1', type: 'post', slug: 'x', title: 'X', status: 'draft',
      content_json: {}, content_html: '<p>x</p>', parent_id: null, language: 'en',
      translation_group_id: null, sort_order: 0, robots: 'index,follow',
    };
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/cms/post-types') {
        return Promise.resolve({
          post_types: [
            { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
            { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
          ],
        });
      }
      if (url === '/admin/cms/term-types') return Promise.resolve({ term_types: [] });
      if (url === '/admin/cms/layouts') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/styles') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/widgets') return Promise.resolve(EMPTY_LIST);
      if (url === '/admin/cms/terms') return Promise.resolve([]);
      if (url === '/admin/cms/posts') return Promise.resolve(EMPTY_LIST);
      if (url === `/admin/cms/posts/${post.id}`) return Promise.resolve(post);
      return Promise.resolve({});
    });

    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() { captured = (this as any).context as CmsEditorContext; },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
        { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
        { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
        { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
      ],
    });
    router.push({ name: 'cms-post-edit', params: { id: post.id } });
    await router.isReady();
    const wrapper = mount(PostEditor, {
      global: {
        plugins: [i18n, router],
        stubs: {
          CodeMirrorEditor: CodeMirrorStub,
          TipTapEditor: TipTapStub,
          CmsImagePicker: true,
          TagPicker: true,
          CustomFieldsEditor: CustomFieldsEditorStub,
        },
      },
    });
    await flushPromises();
    return { wrapper, captured: () => captured };
  }

  it('pushes custom-field keys into the mounted editor via setValues', async () => {
    const { wrapper, captured } = await mountEditExisting();
    expect(wrapper.find('[data-testid="custom-fields-editor-stub"]').exists()).toBe(true);

    captured()!.applyPatch({ title: 'Generated', reading_time: 7 });
    await flushPromises();

    // Core key landed on the form...
    expect((wrapper.vm as any).form.title).toBe('Generated');
    // ...and the custom-field key reached the S77 editor's write seam.
    expect(setValuesSpy).toHaveBeenCalledTimes(1);
    expect(setValuesSpy).toHaveBeenCalledWith({ reading_time: 7 });
  });

  it('does not call setValues when the patch carries only core keys', async () => {
    const { captured } = await mountEditExisting();

    captured()!.applyPatch({ title: 'Only core', content_html: '<p>b</p>' });
    await flushPromises();

    expect(setValuesSpy).not.toHaveBeenCalled();
  });
});

// S41 Slice 3c — an AI-generated `content_html` (article body) must survive into
// the saved payload. For a POST the visible body editor is the TipTap (Visual)
// editor, two-way-bound to form.content_html via :html-value / @update:html-value.
// The real TipTap, when its htmlValue prop changes while it is still empty,
// re-seeds itself with editor.commands.setContent() whose onUpdate echoes back a
// StarterKit-normalized (degraded → empty for non-representable markup like
// <article>) value, clobbering the AI-injected content_html. applyEditorPatch
// must seed the editor authoritatively so the verbatim AI HTML is what persists.
describe('PostEditor — AI-injected content_html survives the body editor (S41 3c)', () => {
  // A faithful stand-in for the real TipTapEditor's clobber behaviour:
  //  - its htmlValue watch auto-echoes a *degraded* (empty) update:htmlValue
  //    while the editor is still empty (mirrors setContent()->onUpdate->getHTML),
  //  - setFromHtml(html) seeds the editor and echoes the *verbatim* html back,
  //    marking the editor non-empty so the degrade-watch no longer fires.
  // Mirrors the real editor's "is the ProseMirror doc visually empty?" guard:
  // any text content makes it non-empty (so the auto re-seed no longer fires).
  function hasText(html: string): boolean {
    return html.replace(/<[^>]*>/g, '').trim().length > 0;
  }
  // The StarterKit-normalized echo: drops wrapper elements (e.g. <article>) that
  // ProseMirror cannot represent. AI bodies wrapped only in such elements echo
  // back empty — the live-proven content_html='' clobber.
  function degradedEcho(html: string): string {
    return html.replace(/<\/?(?:article|section|aside|figure)\b[^>]*>/gi, '').trim();
  }

  const setFromHtmlSpy = vi.fn();
  const FaithfulTipTapStub = {
    name: 'TipTapEditor',
    props: ['modelValue', 'htmlValue', 'hideTabBar'],
    emits: ['update:modelValue', 'update:htmlValue', 'open-image-picker'],
    data() {
      return { editorEmpty: true };
    },
    watch: {
      htmlValue(this: any, val: string, old: string) {
        // Mirrors TipTapEditor's htmlValue watch: while the editor is still
        // visually empty it re-seeds via setContent(), whose onUpdate echoes the
        // StarterKit-normalized HTML (wrappers stripped) over content_html.
        if (val && !old && this.editorEmpty) {
          this.editorEmpty = !hasText(val);
          this.$emit('update:htmlValue', degradedEcho(val));
        }
      },
    },
    methods: {
      setFromHtml(this: any, html: string) {
        // Mirrors TipTapEditor.setFromHtml: seeds the doc and echoes the
        // *verbatim* html (not the editor's normalized getHTML()), then leaves
        // the doc non-empty so the htmlValue watch no longer re-seeds.
        setFromHtmlSpy(html);
        this.editorEmpty = !hasText(html);
        this.$emit('update:htmlValue', html);
      },
      insertImageUrl() {},
    },
    template: '<div class="tiptap-stub" />',
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({
      user: { id: '1', email: 'a@b.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    setFromHtmlSpy.mockClear();
    primeApi();
    clearCmsEditorExtensions();
  });

  afterEach(() => {
    clearCmsEditorExtensions();
  });

  async function mountPostWithCapturer(): Promise<{
    wrapper: VueWrapper;
    captured: () => CmsEditorContext | null;
  }> {
    let captured: CmsEditorContext | null = null;
    const Capturer = {
      name: 'Capturer',
      props: { context: { type: Object, required: true } },
      mounted() {
        captured = (this as any).context as CmsEditorContext;
      },
      template: '<div data-testid="seam-panel-probe" />',
    };
    registerCmsEditorPanel(Capturer);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/cms/posts', name: 'cms-posts', component: { template: '<div />' } },
        { path: '/admin/cms/pages', name: 'cms-admin-pages', component: { template: '<div />' } },
        { path: '/admin/cms/posts/new', name: 'cms-post-new', component: PostEditor },
        { path: '/admin/cms/posts/:id/edit', name: 'cms-post-edit', component: PostEditor },
      ],
    });
    // ?type=post → the Visual (TipTap) editor is the active body editor.
    router.push({ name: 'cms-post-new', query: { type: 'post' } });
    await router.isReady();
    const wrapper = mount(PostEditor, {
      global: {
        plugins: [i18n, router],
        stubs: { CodeMirrorEditor: CodeMirrorStub, TipTapEditor: FaithfulTipTapStub, CmsImagePicker: true },
      },
    });
    await flushPromises();
    return { wrapper, captured: () => captured };
  }

  const ARTICLE_HTML = '<article class="ai-body"><h2>Heading</h2><p>Generated body text.</p></article>';

  it('keeps the AI content_html on the form and in the save payload for a post', async () => {
    (api.post as any).mockResolvedValue({ id: 'new-id', type: 'post', slug: 'p', title: 'P' });
    const { wrapper, captured } = await mountPostWithCapturer();
    expect((wrapper.vm as any).form.type).toBe('post');
    expect((wrapper.vm as any).activeContentTab).toBe('Visual');

    captured()!.applyPatch({ title: 'Generated', content_html: ARTICLE_HTML });
    await flushPromises();

    // The AI HTML survived the body editor's echo.
    expect((wrapper.vm as any).form.content_html).toBe(ARTICLE_HTML);

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.post as any).mock.calls.find((c: any[]) => c[0] === '/admin/cms/posts')?.[1];
    expect(payload).toBeTruthy();
    expect(payload.content_html).toBe(ARTICLE_HTML);
    // content_json mirrors the same markup as a single richtext block.
    expect(payload.content_json.blocks[0].data.html).toBe(ARTICLE_HTML);
  });

  it('seeds the TipTap (Visual) editor with the AI HTML via setFromHtml', async () => {
    const { captured } = await mountPostWithCapturer();

    captured()!.applyPatch({ content_html: ARTICLE_HTML });
    await flushPromises();

    expect(setFromHtmlSpy).toHaveBeenCalledWith(ARTICLE_HTML);
  });
});
