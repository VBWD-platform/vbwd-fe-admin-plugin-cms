import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsLayoutList from '../../src/views/CmsLayoutList.vue';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const LAYOUTS = {
  items: [
    { id: 'lay-1', slug: 'default', name: 'Default Layout', is_active: true, is_default: true, areas: [], updated_at: '2026-06-01T00:00:00Z' },
    { id: 'lay-2', slug: 'wide', name: 'Wide Layout', is_active: true, is_default: false, areas: [], updated_at: '2026-06-02T00:00:00Z' },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  pages: 1,
};

function primeApi() {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/cms/layouts') return Promise.resolve(LAYOUTS);
    return Promise.resolve({});
  });
  (api.post as any).mockResolvedValue({});
}

async function mountList() {
  primeApi();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/layouts', name: 'cms-layouts', component: { template: '<div />' } },
      { path: '/admin/cms/layouts/new', name: 'cms-layout-new', component: { template: '<div />' } },
      { path: '/admin/cms/layouts/:id/edit', name: 'cms-layout-edit', component: { template: '<div />' } },
    ],
  });
  router.push({ name: 'cms-layouts' });
  await router.isReady();
  const wrapper = mount(CmsLayoutList, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('CmsLayoutList default-layout column', () => {
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
  });

  it('renders the default badge on the default layout', async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-testid="layout-default-badge"]').exists()).toBe(true);
  });

  it('renders a make-default button on non-default layouts', async () => {
    const wrapper = await mountList();
    expect(wrapper.find('[data-testid="layout-make-default-btn"]').exists()).toBe(true);
  });

  it('clicking make-default calls store.setDefaultLayout', async () => {
    const wrapper = await mountList();
    const store = useCmsAdminStore();
    const spy = vi.spyOn(store, 'setDefaultLayout').mockResolvedValue(undefined as any);
    await wrapper.find('[data-testid="layout-make-default-btn"]').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledWith('lay-2');
  });
});

describe('useCmsAdminStore.setDefaultLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('posts to the layout default endpoint and refetches', async () => {
    (api.post as any).mockResolvedValue({});
    (api.get as any).mockResolvedValue(LAYOUTS);
    const store = useCmsAdminStore();
    await store.setDefaultLayout('lay-2');
    expect((api.post as any)).toHaveBeenCalledWith('/admin/cms/layouts/lay-2/default');
    expect((api.get as any)).toHaveBeenCalledWith('/admin/cms/layouts', expect.anything());
  });
});
