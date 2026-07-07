// S122 — fe-admin Permalinks config tab: gates fields by mode + persists the
// five keys through the generic plugin-config endpoints.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PermalinkSettings from '../../src/components/PermalinkSettings.vue';
import { api } from '@/api';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const PLUGIN_DETAIL = {
  name: 'cms',
  configSchema: {
    posts_permalink_mode: { default: 'off' },
    posts_root: { default: 'blog' },
    posts_permalink_include_year: { default: false },
    posts_permalink_uncategorized_slug: { default: 'uncategorized' },
    posts_permalink_template: { default: '%root%/%category%/%slug%' },
    // A sibling key that MUST NOT be clobbered on save.
    seo_prerender_enabled: { default: true },
  },
  savedConfig: {},
};

function primeApi(detail: unknown = PLUGIN_DETAIL) {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/plugins/cms') return Promise.resolve(detail);
    return Promise.resolve({});
  });
  (api.put as any).mockResolvedValue({});
}

async function mountSettings(): Promise<VueWrapper> {
  const wrapper = mount(PermalinkSettings);
  await flushPromises();
  return wrapper;
}

describe('PermalinkSettings.vue — S122', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    primeApi();
  });

  it('loads the current permalink config from the plugin-config endpoint', async () => {
    primeApi({
      ...PLUGIN_DETAIL,
      savedConfig: { posts_permalink_mode: 'structured', posts_root: 'news', posts_permalink_include_year: true },
    });
    const wrapper = await mountSettings();
    expect((wrapper.vm as any).mode).toBe('structured');
    expect((wrapper.vm as any).postsRoot).toBe('news');
    expect((wrapper.vm as any).includeYear).toBe(true);
  });

  it('hides all engine fields in off mode', async () => {
    const wrapper = await mountSettings();
    expect((wrapper.vm as any).mode).toBe('off');
    expect(wrapper.find('[data-testid="permalink-root"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="permalink-include-year"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="permalink-template"]').exists()).toBe(false);
  });

  it('gates structured mode to root + uncategorized + year (no template)', async () => {
    const wrapper = await mountSettings();
    await wrapper.find('[data-testid="permalink-mode"]').setValue('structured');
    expect(wrapper.find('[data-testid="permalink-root"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-uncategorized"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-include-year"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-template"]').exists()).toBe(false);
  });

  it('gates template mode to root + uncategorized + template + legend (no year)', async () => {
    const wrapper = await mountSettings();
    await wrapper.find('[data-testid="permalink-mode"]').setValue('template');
    expect(wrapper.find('[data-testid="permalink-root"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-uncategorized"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-template"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-legend"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="permalink-include-year"]').exists()).toBe(false);
  });

  it('persists the five permalink keys without clobbering sibling config', async () => {
    const wrapper = await mountSettings();
    await wrapper.find('[data-testid="permalink-mode"]').setValue('template');
    await wrapper.find('[data-testid="permalink-root"]').setValue('abracadabra');
    await wrapper.find('[data-testid="permalink-template"]').setValue('%root%/%slug%');
    await wrapper.find('[data-testid="permalink-uncategorized"]').setValue('misc');
    await flushPromises();

    await wrapper.find('[data-testid="permalink-save"]').trigger('click');
    await flushPromises();

    const putCall = (api.put as any).mock.calls.find(
      (c: unknown[]) => c[0] === '/admin/plugins/cms/config',
    );
    expect(putCall).toBeTruthy();
    const body = putCall[1];
    expect(body.posts_permalink_mode).toBe('template');
    expect(body.posts_root).toBe('abracadabra');
    expect(body.posts_permalink_template).toBe('%root%/%slug%');
    expect(body.posts_permalink_uncategorized_slug).toBe('misc');
    // The sibling SEO key defaulted from the schema must ride along unchanged.
    expect(body.seo_prerender_enabled).toBe(true);
    expect(wrapper.find('[data-testid="permalink-saved"]').exists()).toBe(true);
  });
});
