import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, ref } from 'vue';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsImageGallery from '../../src/views/CmsImageGallery.vue';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';
import en from '../../locales/en.json';

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

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } });

const IMAGES = {
  items: [
    { id: 'img-1', slug: 'hero', url_path: '/u/hero.png', alt_text: 'Hero', width_px: 800, height_px: 600, file_size_bytes: 1024 },
    { id: 'img-2', slug: 'logo', url_path: '/u/logo.png', alt_text: 'Logo', width_px: 200, height_px: 200, file_size_bytes: 512 },
  ],
  total: 2, page: 1, per_page: 30, pages: 1,
};

async function mountList(): Promise<VueWrapper> {
  (api.get as any).mockImplementation((url: string) =>
    url === '/admin/cms/images' ? Promise.resolve(IMAGES) : Promise.resolve({}));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/cms/images', name: 'cms-images', component: { template: '<div />' } }],
  });
  router.push({ name: 'cms-images' });
  await router.isReady();
  const wrapper = mount(CmsImageGallery, {
    global: { plugins: [i18n, router], stubs: { ImportExportControls: IecStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('CmsImageGallery ImportExportControls (cms_images)', () => {
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

  it('wires the control with entity-key="cms_images" and manifest caps (incl. zip format)', async () => {
    caps.value = { cms_images: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json', 'zip'] } };
    const wrapper = await mountList();
    const control = wrapper.findComponent(IecStub);
    expect(control.exists()).toBe(true);
    expect(control.props('entityKey')).toBe('cms_images');
    expect(control.props('canExport')).toBe(true);
    expect(control.props('supportedFormats')).toEqual(['json', 'zip']);
  });

  it('hides the control when no cms_images capabilities are granted', async () => {
    caps.value = { cms_images: { can_export: false, can_import: false, can_export_pii: false, supported_formats: ['json'] } };
    const wrapper = await mountList();
    expect(wrapper.findComponent(IecStub).exists()).toBe(false);
  });

  it('flows the existing selection (selectedImageIds) into selectedIds', async () => {
    caps.value = { cms_images: { can_export: true, can_import: true, can_export_pii: false, supported_formats: ['json', 'zip'] } };
    const wrapper = await mountList();
    useCmsAdminStore().selectedImageIds.add('img-2');
    await flushPromises();
    expect(wrapper.findComponent(IecStub).props('selectedIds')).toEqual(['img-2']);
  });
});
