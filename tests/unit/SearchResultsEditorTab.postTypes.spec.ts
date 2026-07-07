/**
 * SearchResults widget editor — post-type multi-select (S121 T1 follow-up).
 *
 * The SearchResults editor replaces the legacy `scope` <select> (pages/posts/
 * both) with a multi-select of the registered post types fetched from
 * `GET /admin/cms/post-types`. Selections bind to `config.types: string[]`;
 * an empty selection means "all types". A config carrying only a legacy
 * `scope` (or free-text `type`) pre-checks the derived types, and any emit
 * migrates the config to `types` (dropping the legacy keys).
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set);
 * SOLID (OCP — the editor consumes the post-type registry endpoint, no core
 * change; ISP — narrow {key,label} view); DRY (one post-type source of truth,
 * the registry endpoint); DI (fetch through the shared api client, mocked
 * here); no overengineering (replace one control, keep the rest).
 * Quality guard: `npm run test` + `npm run lint`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { Component } from 'vue';
import { api } from '@/api';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const POST_TYPES = {
  post_types: [
    { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
    { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
    { key: 'ghrm_software', label: 'GHRM Software', routable: true, hierarchical: false, default_template: null },
  ],
};

function mountEditor(config: Record<string, unknown>) {
  const descriptor = getWidgetEditor('SearchResults')!;
  return mount(descriptor.generalTabComponent as Component, { props: { config } });
}

describe('SearchResults editor — post-type multi-select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(POST_TYPES);
  });

  it('renders a checkbox per fetched post type and pre-checks from config.types', async () => {
    const wrapper = mountEditor({ component_name: 'SearchResults', types: ['page', 'ghrm_software'] });
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith('/admin/cms/post-types');
    const container = wrapper.find('[data-test-id="search-results-types"]');
    expect(container.exists()).toBe(true);

    const postBox = wrapper.find('[data-test-id="search-results-type-post"]');
    const pageBox = wrapper.find('[data-test-id="search-results-type-page"]');
    const softwareBox = wrapper.find('[data-test-id="search-results-type-ghrm_software"]');
    expect(postBox.exists()).toBe(true);
    expect(pageBox.exists()).toBe(true);
    expect(softwareBox.exists()).toBe(true);

    expect((postBox.element as HTMLInputElement).checked).toBe(false);
    expect((pageBox.element as HTMLInputElement).checked).toBe(true);
    expect((softwareBox.element as HTMLInputElement).checked).toBe(true);
  });

  it('toggling a type emits update:config with the updated types array', async () => {
    const wrapper = mountEditor({ component_name: 'SearchResults', types: ['page'] });
    await flushPromises();

    await wrapper.find('[data-test-id="search-results-type-post"]').setValue(true);
    const added = wrapper.emitted('update:config')!;
    const afterAdd = added[added.length - 1][0] as Record<string, unknown>;
    expect(afterAdd.types).toEqual(['page', 'post']);

    // Parent v-model would feed the emitted config back in before the next edit.
    await wrapper.setProps({ config: afterAdd });
    await wrapper.find('[data-test-id="search-results-type-page"]').setValue(false);
    const removed = wrapper.emitted('update:config')!;
    expect((removed[removed.length - 1][0] as Record<string, unknown>).types).toEqual(['post']);
  });

  it('empty selection is preserved as an empty types array (all types)', async () => {
    const wrapper = mountEditor({ component_name: 'SearchResults', types: ['post'] });
    await flushPromises();

    await wrapper.find('[data-test-id="search-results-type-post"]').setValue(false);
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).types).toEqual([]);
  });

  it('legacy scope:pages (no types) pre-checks the page box and saving writes types:[page]', async () => {
    const wrapper = mountEditor({ component_name: 'SearchResults', scope: 'pages', per_page: 10 });
    await flushPromises();

    expect((wrapper.find('[data-test-id="search-results-type-page"]').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('[data-test-id="search-results-type-post"]').element as HTMLInputElement).checked).toBe(false);

    // Any edit migrates the config: types is materialised, legacy scope dropped.
    await wrapper.find('input[type="number"]').setValue('5');
    const events = wrapper.emitted('update:config')!;
    const last = events[events.length - 1][0] as Record<string, unknown>;
    expect(last.types).toEqual(['page']);
    expect(last.scope).toBeUndefined();
    expect(last.per_page).toBe(5);
  });

  it('legacy scope:both (no types) pre-checks nothing (all types)', async () => {
    const wrapper = mountEditor({ component_name: 'SearchResults', scope: 'both' });
    await flushPromises();

    expect((wrapper.find('[data-test-id="search-results-type-post"]').element as HTMLInputElement).checked).toBe(false);
    expect((wrapper.find('[data-test-id="search-results-type-page"]').element as HTMLInputElement).checked).toBe(false);
  });

  it('defaultConfig() includes types:[post,page] and no legacy scope', () => {
    const config = getWidgetEditor('SearchResults')!.defaultConfig();
    expect(config.types).toEqual(['post', 'page']);
    expect(config.scope).toBeUndefined();
  });
});
