import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent } from 'vue';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsStyleList from '../../src/views/CmsStyleList.vue';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/composables/useDataExchangeManifest', () => ({
  useDataExchangeManifest: () => ({
    load: vi.fn().mockResolvedValue(undefined),
    capabilitiesFor: () => ({ can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] }),
  }),
}));

const IecStub = defineComponent({ name: 'ImportExportControls', template: '<div />' });

const STYLES = {
  items: [
    { id: 'sty-1', slug: 'default', name: 'Default Style', is_active: true, is_default: true, updated_at: '2026-06-01T00:00:00Z' },
    { id: 'sty-2', slug: 'dark', name: 'Dark Style', is_active: true, is_default: false, updated_at: '2026-06-02T00:00:00Z' },
  ],
  total: 2, page: 1, per_page: 20, pages: 1,
};

async function mountList(): Promise<VueWrapper> {
  (api.get as any).mockImplementation((url: string) =>
    url === '/admin/cms/styles' ? Promise.resolve(STYLES) : Promise.resolve({}));
  (api.post as any).mockResolvedValue({ items: [], count: 0 });
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

describe('CmsStyleList bulk copy', () => {
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
  });

  it('shows a bulk-copy button only when styles are selected', async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(false);
    useCmsAdminStore().selectedStyleIds.add('sty-2');
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(true);
  });

  it('hides the bulk-copy button for a user without cms.styles.manage', async () => {
    useAuthStore().$patch({ user: { id: '2', email: 'viewer@test.com', role: 'ADMIN', permissions: [] } });
    const wrapper = await mountList();
    useCmsAdminStore().selectedStyleIds.add('sty-2');
    await flushPromises();
    expect(wrapper.find('[data-testid="bulk-copy"]').exists()).toBe(false);
  });

  it('clicking bulk-copy calls the store action with the selected ids', async () => {
    const wrapper = await mountList();
    const store = useCmsAdminStore();
    const spy = vi.spyOn(store, 'bulkCopyStyles').mockResolvedValue(undefined as any);
    store.selectedStyleIds.add('sty-2');
    await flushPromises();
    await wrapper.find('[data-testid="bulk-copy"]').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledWith(['sty-2']);
  });
});
