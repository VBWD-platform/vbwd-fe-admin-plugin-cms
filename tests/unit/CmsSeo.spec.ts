import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import CmsSeo from '../../src/views/CmsSeo.vue';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// Stub the CodeMirror editor with a plain textarea honouring the same v-model
// contract; the parent's `data-testid` falls through onto the textarea root so
// the Head HTML field stays addressable without the heavy codemirror runtime.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  template:
    '<textarea :value="modelValue" ' +
    '@input="$emit(\'update:modelValue\', $event.target.value)" />',
};

const SETTINGS = {
  robots_txt: 'User-agent: *\nDisallow: /secret',
  global_head_html: '<meta name="msvalidate.01" content="ABC123" />',
  sitemap_include_pages: false,
  sitemap_excluded_slugs: ['draft-one', 'draft-two'],
  sitemap_include_terms: ['news'],
  sitemap_exclude_terms: ['archive'],
};

const CATEGORIES = [
  { id: 'cat-1', slug: 'news', name: 'News' },
  { id: 'cat-2', slug: 'archive', name: 'Archive' },
];

const TAGS = [{ id: 'tag-1', slug: 'featured', name: 'Featured' }];

function primeApi() {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/seo/settings') return Promise.resolve({ ...SETTINGS });
    if (url === '/admin/cms/terms') {
      const type = opts?.params?.type;
      if (type === 'category') return Promise.resolve(CATEGORIES);
      if (type === 'tag') return Promise.resolve(TAGS);
      return Promise.resolve([]);
    }
    return Promise.resolve({});
  });
  (api.put as any).mockResolvedValue({ ...SETTINGS });
}

async function mountSeo() {
  const wrapper = mount(CmsSeo, {
    global: { stubs: { CodeMirrorEditor: CodeMirrorStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('CmsSeo.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    primeApi();
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────

  it('renders 3 tabs and defaults to the Prerendered tab', async () => {
    const wrapper = await mountSeo();
    expect(wrapper.find('[data-testid="tab-prerender"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-robots"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-sitemap"]').exists()).toBe(true);
    // default tab shows the existing prerender actions
    expect(wrapper.find('[data-testid="seo-generate"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="seo-cleanup"]').exists()).toBe(true);
  });

  // ── Head HTML tab ───────────────────────────────────────────────────────────

  it('renders the Head HTML tab and loads global_head_html into the editor', async () => {
    const wrapper = await mountSeo();
    expect(wrapper.find('[data-testid="tab-head-html"]').exists()).toBe(true);

    await wrapper.find('[data-testid="tab-head-html"]').trigger('click');
    const editor = wrapper.find('[data-testid="seo-global-head-html"]');
    expect(editor.exists()).toBe(true);
    expect((editor.element as HTMLTextAreaElement).value).toBe(SETTINGS.global_head_html);
  });

  it('saves global_head_html via PUT settings', async () => {
    const wrapper = await mountSeo();
    await wrapper.find('[data-testid="tab-head-html"]').trigger('click');

    const snippet = '<meta name="msvalidate.01" content="NEWKEY" />';
    await wrapper.find('[data-testid="seo-global-head-html"]').setValue(snippet);
    await wrapper.find('[data-testid="head-html-save"]').trigger('click');
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith('/admin/cms/seo/settings', {
      global_head_html: snippet,
    });
  });

  // ── Prerendered tab (existing behavior, unchanged) ──────────────────────────

  it('cleans up prerendered content and reports the removed count', async () => {
    (api.post as any).mockResolvedValue({ removed: 3 });
    const wrapper = await mountSeo();

    await wrapper.find('[data-testid="seo-cleanup"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/admin/cms/seo/cleanup', {});
    expect(wrapper.find('[data-testid="seo-cleanup-result"]').text()).toContain('Removed 3');
  });

  it('generates prerendered content and reports the written count', async () => {
    (api.post as any).mockResolvedValue({ regenerated: 5 });
    const wrapper = await mountSeo();

    await wrapper.find('[data-testid="seo-generate"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/admin/cms/seo/regenerate', {});
    expect(wrapper.find('[data-testid="seo-generate-result"]').text()).toContain('Generated 5');
  });

  it('surfaces an error when cleanup fails', async () => {
    (api.post as any).mockRejectedValue(new Error('boom'));
    const wrapper = await mountSeo();

    await wrapper.find('[data-testid="seo-cleanup"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="seo-cleanup-error"]').text()).toContain('boom');
    expect(wrapper.find('[data-testid="seo-cleanup-result"]').exists()).toBe(false);
  });

  // ── Robots tab ──────────────────────────────────────────────────────────────

  it('loads robots_txt into the editor from fetchSeoSettings', async () => {
    const wrapper = await mountSeo();
    await wrapper.find('[data-testid="tab-robots"]').trigger('click');

    expect(api.get).toHaveBeenCalledWith('/admin/cms/seo/settings');
    const editor = wrapper.find('[data-testid="robots-editor"]');
    expect((editor.element as HTMLTextAreaElement).value).toBe(SETTINGS.robots_txt);
  });

  it('saves robots_txt via PUT settings', async () => {
    const wrapper = await mountSeo();
    await wrapper.find('[data-testid="tab-robots"]').trigger('click');

    await wrapper.find('[data-testid="robots-editor"]').setValue('User-agent: *\nAllow: /');
    await wrapper.find('[data-testid="robots-save"]').trigger('click');
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith('/admin/cms/seo/settings', {
      robots_txt: 'User-agent: *\nAllow: /',
    });
  });

  // ── Sitemap tab ─────────────────────────────────────────────────────────────

  it('loads the four sitemap keys and populates term pickers', async () => {
    const wrapper = await mountSeo();
    await wrapper.find('[data-testid="tab-sitemap"]').trigger('click');

    const includePages = wrapper.find('[data-testid="sitemap-include-pages"]');
    expect((includePages.element as HTMLInputElement).checked).toBe(false);

    const excluded = wrapper.find('[data-testid="sitemap-excluded-slugs"]');
    expect((excluded.element as HTMLTextAreaElement).value).toContain('draft-one');
    expect((excluded.element as HTMLTextAreaElement).value).toContain('draft-two');

    // term pickers are populated from the category + tag fetch (option value = slug)
    expect(api.get).toHaveBeenCalledWith('/admin/cms/terms', { params: { type: 'category' } });
    expect(api.get).toHaveBeenCalledWith('/admin/cms/terms', { params: { type: 'tag' } });

    const includeTerms = wrapper.find('[data-testid="sitemap-include-terms"]');
    const optionSlugs = includeTerms.findAll('option').map((o) => (o.element as HTMLOptionElement).value);
    expect(optionSlugs).toContain('news');
    expect(optionSlugs).toContain('archive');
    expect(optionSlugs).toContain('featured');
  });

  it('saves the sitemap settings with the right payload', async () => {
    const wrapper = await mountSeo();
    await wrapper.find('[data-testid="tab-sitemap"]').trigger('click');

    await wrapper.find('[data-testid="sitemap-include-pages"]').setValue(true);
    await wrapper.find('[data-testid="sitemap-excluded-slugs"]').setValue('only-this-one');
    await wrapper.find('[data-testid="sitemap-save"]').trigger('click');
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith('/admin/cms/seo/settings', {
      sitemap_include_pages: true,
      sitemap_excluded_slugs: ['only-this-one'],
      sitemap_include_terms: ['news'],
      sitemap_exclude_terms: ['archive'],
    });
  });
});
