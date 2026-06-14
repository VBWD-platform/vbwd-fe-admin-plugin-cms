import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { api } from '@/api';
import { configureAuthStore, useAuthStore } from '@/stores/auth';
import CmsWidgetEditor from '../../src/views/CmsWidgetEditor.vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Lightweight stand-in for the CodeMirror-backed editor: a plain textarea that
// emits `update:modelValue`, so tests can drive the General/CSS tabs without the
// heavy codemirror runtime. Mirrors the real component's v-model contract.
const CodeMirrorStub = {
  name: 'CodeMirrorEditor',
  props: ['modelValue', 'lang', 'minHeight'],
  emits: ['update:modelValue'],
  methods: {
    insertAtCursor(text: string) {
      (this as any).$emit('update:modelValue', ((this as any).modelValue ?? '') + text);
    },
  },
  template:
    '<textarea :data-testid="`cm-${lang}`" :value="modelValue" ' +
    '@input="$emit(\'update:modelValue\', $event.target.value)" />',
};

const CUSTOM_CODE_WIDGET = {
  id: 'wid-cc',
  name: 'Analytics',
  slug: 'custom-code-analytics',
  widget_type: 'vue-component',
  sort_order: 0,
  is_active: true,
  content_json: { component: 'CustomCode' },
  config: { component_name: 'CustomCode', code: '<script>gtag("event","a")</script>' },
};

function primeApi(widgetsById: Record<string, unknown> = {}) {
  (api.get as any).mockImplementation((url: string) => {
    for (const [id, widget] of Object.entries(widgetsById)) {
      if (url === `/admin/cms/widgets/${id}`) return Promise.resolve(widget);
    }
    return Promise.resolve({});
  });
}

async function mountEditor(
  params: Record<string, string> = {},
  widgetsById: Record<string, unknown> = {},
): Promise<{ wrapper: VueWrapper; router: Router }> {
  primeApi(widgetsById);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/cms/widgets', name: 'cms-widgets', component: { template: '<div />' } },
      { path: '/admin/cms/widgets/new', name: 'cms-widget-new', component: CmsWidgetEditor },
      { path: '/admin/cms/widgets/:id/edit', name: 'cms-widget-edit', component: CmsWidgetEditor },
    ],
  });
  router.push(params.id ? { name: 'cms-widget-edit', params } : { name: 'cms-widget-new' });
  await router.isReady();
  const wrapper = mount(CmsWidgetEditor, {
    global: {
      plugins: [router],
      stubs: { CodeMirrorEditor: CodeMirrorStub, CmsImagePicker: true, CmsMenuTreeEditor: true },
    },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('CmsWidgetEditor.vue — CustomCode widget', () => {
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

  it('registers a CustomCode editor descriptor', () => {
    const desc = getWidgetEditor('CustomCode');
    expect(desc).toBeDefined();
    expect(desc!.componentName).toBe('CustomCode');
    expect(desc!.defaultConfig().component_name).toBe('CustomCode');
  });

  it('buildPreview embeds the configured code', () => {
    const desc = getWidgetEditor('CustomCode')!;
    const { html } = desc.buildPreview({ component_name: 'CustomCode', code: '<b>hi-there</b>' });
    expect(html).toContain('<b>hi-there</b>');
  });

  it('renders an editable code field bound to config.code on the General tab', async () => {
    const { wrapper } = await mountEditor({ id: 'wid-cc' }, { 'wid-cc': CUSTOM_CODE_WIDGET });
    const field = wrapper.find('[data-testid="custom-code-input"]');
    expect(field.exists()).toBe(true);
    // The loaded code is shown to the admin for editing.
    expect((wrapper.vm as any).vueComponentConfig.code).toBe('<script>gtag("event","a")</script>');
  });

  it('persists edited config.code in the save payload', async () => {
    (api.put as any).mockResolvedValue({ ...CUSTOM_CODE_WIDGET });
    const { wrapper } = await mountEditor({ id: 'wid-cc' }, { 'wid-cc': CUSTOM_CODE_WIDGET });

    await wrapper.find('[data-testid="custom-code-input"]').setValue('<script>new()</script>');
    await flushPromises();

    await (wrapper.vm as any).save();
    await flushPromises();

    const payload = (api.put as any).mock.calls[0][1];
    expect(payload.config.code).toBe('<script>new()</script>');
    expect(payload.config.component_name).toBe('CustomCode');
  });
});

describe('CmsWidgetEditor.vue — stale editor on route-param change', () => {
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

  it('re-fetches and resets the form when the route id changes', async () => {
    const widgetA = {
      id: 'wid-a', name: 'Widget A', slug: 'widget-a', widget_type: 'html',
      sort_order: 0, is_active: true, content_json: { content: btoa('<p>A body</p>') }, source_css: '',
    };
    const widgetB = {
      id: 'wid-b', name: 'Widget B', slug: 'widget-b', widget_type: 'html',
      sort_order: 0, is_active: true, content_json: { content: btoa('<p>B body</p>') }, source_css: '',
    };
    const { wrapper, router } = await mountEditor(
      { id: 'wid-a' },
      { 'wid-a': widgetA, 'wid-b': widgetB },
    );
    expect((wrapper.vm as any).form.name).toBe('Widget A');

    await router.push({ name: 'cms-widget-edit', params: { id: 'wid-b' } });
    await flushPromises();

    expect((wrapper.vm as any).form.name).toBe('Widget B');
  });
});
