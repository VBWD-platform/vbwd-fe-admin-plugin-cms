import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, ref } from 'vue';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsStyleList from '../../src/views/CmsStyleList.vue';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
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

const STYLES = {
  items: [
    { id: 's-1', slug: 'default', name: 'Default', is_active: true, is_default: true, updated_at: '2026-06-01T00:00:00Z' },
    { id: 's-2', slug: 'dark', name: 'Dark', is_active: true, is_default: false, updated_at: '2026-06-02T00:00:00Z' },
  ],
  total: 2, page: 1, per_page: 20, pages: 1,
};

async function mountList(): Promise<VueWrapper> {
  (api.get as any).mockImplementation((url: string) =>
    url === '/admin/cms/styles' ? Promise.resolve(STYLES) : Promise.resolve({}));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/cms/styles', name: 'cms-styles', component: { template: '<div />' } }],
  });
  router.push({ name: 'cms-styles' });
  await router.isReady();
  const wrapper = mount(CmsStyleList, {
    global: { plugins: [router], stubs: { ImportExportControls: IecStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('CmsStyleList ImportExportControls (cms_styles)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureAuthStore({
      storageKey: 'test_token',
      apiClient: { post: async () => ({}), get: async () => ({}), setToken: () => {}, clearToken: () => {} } as any,
    });
    useAuthStore().$patch({
      user: { id: '1', email: 'admin@test.com', role: 'SUPER_ADMIN', permissions: ['*'] },
      token: 'test-token',
    });
    vi.clearAllMocks();
    caps.value = {};
  });

  it('wires the control with entity-key="cms_styles" and manifest caps', async () => {
    caps.value = { cms_styles: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountList();
    const control = wrapper.findComponent(IecStub);
    expect(control.exists()).toBe(true);
    expect(control.props('entityKey')).toBe('cms_styles');
    expect(control.props('canExport')).toBe(true);
    expect(control.props('canImport')).toBe(true);
  });

  it('hides the control when no cms_styles capabilities are granted', async () => {
    caps.value = { cms_styles: { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountList();
    expect(wrapper.findComponent(IecStub).exists()).toBe(false);
  });

  it('flows the existing selection (selectedStyleIds) into selectedIds', async () => {
    caps.value = { cms_styles: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountList();
    useCmsAdminStore().selectedStyleIds.add('s-2');
    await flushPromises();
    expect(wrapper.findComponent(IecStub).props('selectedIds')).toEqual(['s-2']);
  });

  it('no longer renders the legacy Import button or bulk "Export selected" (unified control only)', async () => {
    caps.value = { cms_styles: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountList();
    useCmsAdminStore().selectedStyleIds.add('s-2');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Export selected');
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
});
