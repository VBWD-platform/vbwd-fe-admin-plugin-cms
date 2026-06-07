import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { defineComponent, ref } from 'vue';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import TermManager from '../../src/views/TermManager.vue';
import en from '../../locales/en.json';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const caps = ref<Record<string, { can_export: boolean; can_import: boolean; can_export_pii: boolean; supported_formats: string[] }>>({});
const loadManifest = vi.fn().mockResolvedValue(undefined);

vi.mock('@/composables/useDataExchangeManifest', () => ({
  useDataExchangeManifest: () => ({
    load: loadManifest,
    capabilitiesFor: (key: string) =>
      caps.value[key] ?? { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] },
  }),
}));

const IecStub = defineComponent({
  name: 'ImportExportControls',
  props: ['api', 'entityKey', 'selectedIds', 'canExport', 'canImport', 'canExportPii', 'isSuperadmin', 'supportedFormats'],
  emits: ['refresh'],
  template: '<div data-testid="iec-stub" />',
});

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
});

const TERM_TYPES = {
  term_types: [
    { key: 'category', label: 'Category', hierarchical: true },
    { key: 'tag', label: 'Tag', hierarchical: false },
  ],
};

const CATEGORIES = [
  { id: 'cat-1', term_type: 'category', slug: 'news', name: 'News', parent_id: null, seo_excluded: false, sort_order: 0 },
  { id: 'cat-2', term_type: 'category', slug: 'world', name: 'World', parent_id: 'cat-1', seo_excluded: true, sort_order: 0 },
];

function primeApi() {
  (api.get as any).mockImplementation((url: string, opts?: any) => {
    if (url === '/admin/cms/term-types') return Promise.resolve(TERM_TYPES);
    if (url === '/admin/cms/terms') {
      const type = opts?.params?.type;
      if (type === 'category') return Promise.resolve(CATEGORIES);
      return Promise.resolve([]);
    }
    return Promise.resolve({});
  });
}

async function mountManager(): Promise<VueWrapper> {
  const wrapper = mount(TermManager, {
    global: { plugins: [i18n], stubs: { ImportExportControls: IecStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('TermManager.vue', () => {
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
    caps.value = {};
    primeApi();
  });

  it('lists term-type groups from the registry', async () => {
    const wrapper = await mountManager();
    const tabs = wrapper.findAll('[data-testid="term-type-tab"]');
    expect(tabs.map((t) => t.text())).toContain('Category');
    expect(tabs.map((t) => t.text())).toContain('Tag');
  });

  it('renders terms of the active type, with hierarchy depth for hierarchical types', async () => {
    const wrapper = await mountManager();
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="term-row"]');
    expect(rows).toHaveLength(2);
    // child cat-2 carries a depth marker (parent_id set) for the hierarchical category type
    const childRow = wrapper.find('[data-term-id="cat-2"]');
    expect(childRow.classes()).toContain('term-row--child');
  });

  it('quick-search filters terms by name (case-insensitive)', async () => {
    const wrapper = await mountManager();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="term-row"]')).toHaveLength(2);

    await wrapper.find('[data-testid="term-search"]').setValue('WORLD');
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="term-row"]');
    expect(rows).toHaveLength(1);
    expect(wrapper.find('[data-term-id="cat-2"]').exists()).toBe(true);
  });

  it('quick-search also matches the slug', async () => {
    const wrapper = await mountManager();
    await flushPromises();
    await wrapper.find('[data-testid="term-search"]').setValue('news');
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="term-row"]');
    expect(rows).toHaveLength(1);
    expect(wrapper.find('[data-term-id="cat-1"]').exists()).toBe(true);
  });

  it('clearing the quick-search restores all terms', async () => {
    const wrapper = await mountManager();
    await flushPromises();
    await wrapper.find('[data-testid="term-search"]').setValue('world');
    await flushPromises();
    await wrapper.find('[data-testid="term-search"]').setValue('');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="term-row"]')).toHaveLength(2);
  });

  it('resets the quick-search when switching term types', async () => {
    const wrapper = await mountManager();
    await flushPromises();
    await wrapper.find('[data-testid="term-search"]').setValue('world');
    await flushPromises();
    // switch to the Tag tab
    const tabs = wrapper.findAll('[data-testid="term-type-tab"]');
    await tabs[1].trigger('click');
    await flushPromises();
    expect((wrapper.find('[data-testid="term-search"]').element as HTMLInputElement).value).toBe('');
  });

  it('creates a term via the store/save with seo_excluded honored', async () => {
    (api.post as any).mockResolvedValue({ id: 'cat-3' });
    const wrapper = await mountManager();

    await wrapper.find('[data-testid="term-name"]').setValue('Sports');
    await wrapper.find('[data-testid="term-slug"]').setValue('sports');
    await wrapper.find('[data-testid="term-seo-excluded"]').setValue(true);
    await wrapper.find('[data-testid="term-save"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith(
      '/admin/cms/terms',
      expect.objectContaining({ term_type: 'category', name: 'Sports', slug: 'sports', seo_excluded: true }),
    );
  });

  it('toggles per-term seo_excluded and persists via update', async () => {
    (api.put as any).mockResolvedValue({ id: 'cat-1' });
    const wrapper = await mountManager();
    await wrapper.find('[data-testid="term-toggle-exclude-cat-1"]').trigger('click');
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith(
      '/admin/cms/terms/cat-1',
      expect.objectContaining({ seo_excluded: true }),
    );
  });

  it('deletes a term', async () => {
    (api.delete as any).mockResolvedValue({ deleted: 'cat-1' });
    const wrapper = await mountManager();
    await wrapper.find('[data-testid="term-delete-cat-1"]').trigger('click');
    await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/admin/cms/terms/cat-1');
  });

  // ── Unified import/export only (legacy term export/import buttons retired) ──
  it('renders the unified ImportExportControls wired to entity-key="cms_terms"', async () => {
    caps.value = { cms_terms: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountManager();
    const control = wrapper.findComponent(IecStub);
    expect(control.exists()).toBe(true);
    expect(control.props('entityKey')).toBe('cms_terms');
    expect(control.props('canExport')).toBe(true);
    expect(control.props('canImport')).toBe(true);
  });

  it('hides the unified control when no cms_terms capabilities are granted', async () => {
    caps.value = { cms_terms: { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountManager();
    expect(wrapper.findComponent(IecStub).exists()).toBe(false);
  });

  it('no longer renders the legacy term export / import buttons', async () => {
    caps.value = { cms_terms: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountManager();
    expect(wrapper.find('[data-testid="term-export"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="term-import"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="term-import-input"]').exists()).toBe(false);
  });
});
