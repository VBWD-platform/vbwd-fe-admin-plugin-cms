import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsLayoutEditor from '../../src/views/CmsLayoutEditor.vue';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// Stub the CodeMirror editor with a plain textarea that honours the same
// v-model contract, so the head-html block is unit-testable without the heavy
// codemirror runtime. Exposes the same `data-testid` the real editor carries.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  template:
    '<textarea data-testid="layout-head-html" :value="modelValue" ' +
    '@input="$emit(\'update:modelValue\', $event.target.value)" />',
};

const LAYOUT = {
  id: 'lay-1',
  slug: 'default',
  name: 'Default Layout',
  description: '',
  areas: [{ name: 'header', type: 'header', label: 'Header' }],
  assignments: [],
  sort_order: 0,
  is_active: true,
  is_default: true,
  head_html: '<script>window.tracked=1;</script>',
  updated_at: '2026-06-01T00:00:00Z',
};

async function mountEditor(): Promise<VueWrapper> {
  (api.get as any).mockImplementation((url: string) => {
    if (url === '/admin/cms/layouts/lay-1') return Promise.resolve(LAYOUT);
    if (url === '/admin/cms/layouts') return Promise.resolve({ items: [], total: 0, page: 1, per_page: 20, pages: 1 });
    if (url === '/admin/access/user-levels') return Promise.resolve({ levels: [] });
    return Promise.resolve({});
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/layouts', name: 'cms-layouts', component: { template: '<div />' } },
      { path: '/admin/cms/layouts/:id/edit', name: 'cms-layout-edit', component: { template: '<div />' } },
    ],
  });
  router.push('/admin/cms/layouts/lay-1/edit');
  await router.isReady();
  const wrapper = mount(CmsLayoutEditor, {
    global: { plugins: [router], stubs: { CodeMirrorEditor: CodeMirrorStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('CmsLayoutEditor <head> HTML block', () => {
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

  it('renders the head-html textarea populated from the loaded layout', async () => {
    const wrapper = await mountEditor();
    const textarea = wrapper.find('[data-testid="layout-head-html"]');
    expect(textarea.exists()).toBe(true);
    expect((textarea.element as HTMLTextAreaElement).value).toBe('<script>window.tracked=1;</script>');
  });

  it('includes edited head_html in the saved payload', async () => {
    const wrapper = await mountEditor();
    const store = useCmsAdminStore();
    const spy = vi.spyOn(store, 'saveLayout').mockResolvedValue(LAYOUT as any);

    const textarea = wrapper.find('[data-testid="layout-head-html"]');
    await textarea.setValue('<meta name="robots" content="noindex">');
    await wrapper.find('.btn--primary').trigger('click');
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.head_html).toBe('<meta name="robots" content="noindex">');
  });
});
