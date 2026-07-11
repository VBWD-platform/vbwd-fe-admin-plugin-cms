import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { api } from '@/api';
import EntityPageTab from '../../src/components/EntityPageTab.vue';
import en from '../../locales/en.json';

// The entity-page authoring tab talks to the admin API only. Mock the shared
// client so the spec drives GET (seed) and PUT (save) directly.
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

enableAutoUnmount(afterEach);

// Lightweight stand-in for the CodeMirror-backed editor: a plain textarea that
// keeps the v-model + insertAtCursor contract without the codemirror runtime.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  inheritAttrs: false,
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  methods: {
    insertAtCursor(text: string) {
      (this as any).$emit('update:modelValue', ((this as any).modelValue ?? '') + text);
    },
  },
  template:
    '<textarea :data-testid="`cm-`+lang" :value="modelValue" ' +
    "@input=\"$emit('update:modelValue', $event.target.value)\" />",
};

// Stand-in for the TipTap WYSIWYG: preserves v-model / htmlValue / image-insert
// without loading the heavy @tiptap runtime under happy-dom.
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

const PreviewStub = {
  name: 'HtmlPreviewFrame',
  props: ['contentHtml', 'sourceCss'],
  methods: { render() {} },
  template: '<div class="preview-stub" />',
};

const ImagePickerStub = {
  name: 'CmsImagePicker',
  props: ['multiple'],
  emits: ['select', 'select-many', 'close'],
  template: '<div class="picker-stub" />',
};

const EMPTY_SEO = {
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  og_image_url: '',
  canonical_url: '',
  robots: 'index,follow',
  schema_json: null,
  seo_excluded: false,
};

function scaffold(overrides: Record<string, unknown> = {}) {
  return {
    post_id: null,
    content_html: '',
    content_json: {},
    source_css: '',
    content_blocks: [],
    seo: { ...EMPTY_SEO },
    ...overrides,
  };
}

function mountTab(props: Record<string, unknown> = {}) {
  return mount(EntityPageTab, {
    props: { ownerType: 'product', ownerId: 'prod-1', ...props },
    global: {
      plugins: [i18n],
      stubs: {
        CodeMirrorEditor: CodeMirrorStub,
        TipTapEditor: TipTapStub,
        HtmlPreviewFrame: PreviewStub,
        CmsImagePicker: ImagePickerStub,
      },
    },
  });
}

describe('EntityPageTab.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue(scaffold());
    (api.put as any).mockResolvedValue(scaffold());
  });

  it('GETs the entity page on mount and seeds the form fields', async () => {
    (api.get as any).mockResolvedValue(
      scaffold({
        content_html: '<p>seeded body</p>',
        source_css: '.seed{color:blue}',
        content_blocks: [{ area_name: 'hero', content_html: '<p>hero copy</p>' }],
        seo: { ...EMPTY_SEO, meta_title: 'Seed Title' },
      }),
    );

    const wrapper = mountTab();
    await flushPromises();

    // Endpoint uses ownerType / ownerId / slot (slot defaults to "main").
    expect(api.get).toHaveBeenCalledWith('/admin/cms/entity-pages/product/prod-1/main');

    // CSS tab textarea reflects the seeded source_css.
    expect((wrapper.find('[data-testid="cm-css"]').element as HTMLTextAreaElement).value).toBe(
      '.seed{color:blue}',
    );
    // The seeded block appears in the repeater.
    const areaInputs = wrapper.findAll('[data-testid="entity-page-block-area"]');
    expect(areaInputs).toHaveLength(1);
    expect((areaInputs[0].element as HTMLInputElement).value).toBe('hero');
    // The SEO panel is seeded.
    expect((wrapper.find('[data-testid="seo-meta-title"]').element as HTMLInputElement).value).toBe(
      'Seed Title',
    );
    // Root testid present.
    expect(wrapper.find('[data-testid="entity-page-tab"]').exists()).toBe(true);
  });

  it('honours an explicit slot in the endpoint', async () => {
    const wrapper = mountTab({ slot: 'sidebar' });
    await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/admin/cms/entity-pages/product/prod-1/sidebar');
    wrapper.unmount();
  });

  it('renders the four content sub-tabs', async () => {
    const wrapper = mountTab();
    await flushPromises();
    expect(wrapper.find('[data-testid="entity-page-visual"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="entity-page-html"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="entity-page-css"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="entity-page-preview"]').exists()).toBe(true);
  });

  it('inserts a picked image into the visual editor via insertImageUrl', async () => {
    const wrapper = mountTab();
    await flushPromises();

    // Opening the picker from the TipTap toolbar mounts the image picker.
    await wrapper.find('.tiptap-stub').trigger('click');
    const picker = wrapper.findComponent({ name: 'CmsImagePicker' });
    expect(picker.exists()).toBe(true);

    // Selecting an image routes through the TipTap ref's insertImageUrl, which
    // pushes an <img> into content_html.
    picker.vm.$emit('select', 'https://cdn/img.png', 'alt text');
    await flushPromises();

    (api.put as any).mockResolvedValue(scaffold());
    await wrapper.find('[data-testid="entity-page-save"]').trigger('click');
    await flushPromises();

    const putBody = (api.put as any).mock.calls.at(-1)![1];
    expect(putBody.content_html).toContain('<img src="https://cdn/img.png">');
  });

  it('PUTs the full payload with edited content, css, seo and an added block', async () => {
    const wrapper = mountTab();
    await flushPromises();

    // Edit the WYSIWYG content (→ content_html) via the stub.
    wrapper.findComponent({ name: 'TipTapEditor' }).vm.$emit('update:htmlValue', '<p>edited body</p>');
    // Edit the CSS tab.
    await wrapper.find('[data-testid="cm-css"]').setValue('.x{color:red}');
    // Edit a SEO field on the real panel.
    await wrapper.find('[data-testid="seo-meta-title"]').setValue('My SEO Title');
    // Add a stackable block and fill it.
    await wrapper.find('[data-testid="entity-page-add-block"]').trigger('click');
    await wrapper.find('[data-testid="entity-page-block-area"]').setValue('sidebar');
    await wrapper.find('[data-testid="entity-page-block-content"]').setValue('<p>aside</p>');

    (api.put as any).mockResolvedValue(scaffold({ post_id: 'created' }));
    await wrapper.find('[data-testid="entity-page-save"]').trigger('click');
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith(
      '/admin/cms/entity-pages/product/prod-1/main',
      expect.objectContaining({
        content_html: '<p>edited body</p>',
        source_css: '.x{color:red}',
        seo: expect.objectContaining({ meta_title: 'My SEO Title', robots: 'index,follow' }),
        content_blocks: [
          expect.objectContaining({ area_name: 'sidebar', content_html: '<p>aside</p>' }),
        ],
      }),
    );

    // A successful save emits `saved`.
    expect(wrapper.emitted('saved')).toBeTruthy();
  });

  it('surfaces an error state when the save fails', async () => {
    const wrapper = mountTab();
    await flushPromises();

    (api.put as any).mockRejectedValue(new Error('boom'));
    await wrapper.find('[data-testid="entity-page-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="entity-page-error"]').exists()).toBe(true);
    expect(wrapper.emitted('saved')).toBeFalsy();
  });

  it('drops empty (unnamed) blocks from the save payload', async () => {
    const wrapper = mountTab();
    await flushPromises();

    // Add a block but leave the area name blank.
    await wrapper.find('[data-testid="entity-page-add-block"]').trigger('click');

    await wrapper.find('[data-testid="entity-page-save"]').trigger('click');
    await flushPromises();

    const putBody = (api.put as any).mock.calls.at(-1)![1];
    expect(putBody.content_blocks).toEqual([]);
  });
});
