import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('Search / SearchResults / Category widget editor descriptors', () => {
  const cases: Array<{ componentName: string }> = [
    { componentName: 'Search' },
    { componentName: 'SearchResults' },
    { componentName: 'Category' },
  ];

  for (const { componentName } of cases) {
    describe(componentName, () => {
      it('is registered after importing src/widgets/index', () => {
        expect(getWidgetEditor(componentName)).toBeDefined();
      });

      it('defaultConfig().component_name matches the descriptor name', () => {
        const descriptor = getWidgetEditor(componentName)!;
        expect(descriptor.defaultConfig().component_name).toBe(componentName);
      });

      it('buildPreview(defaultConfig()) returns a non-empty html string', () => {
        const descriptor = getWidgetEditor(componentName)!;
        const preview = descriptor.buildPreview(descriptor.defaultConfig());
        expect(typeof preview.html).toBe('string');
        expect(preview.html.length).toBeGreaterThan(0);
      });

      it('generalTabComponent emits update:config on a field change', async () => {
        const descriptor = getWidgetEditor(componentName)!;
        const wrapper = mount(descriptor.generalTabComponent as Component, {
          props: { config: descriptor.defaultConfig() },
        });
        const firstSelect = wrapper.find('select');
        const firstTextInput = wrapper.find('input[type="text"]');
        const target = firstTextInput.exists() ? firstTextInput : firstSelect;
        expect(target.exists()).toBe(true);
        await target.setValue(target.element.tagName === 'SELECT' ? 'pages' : 'changed value');
        expect(wrapper.emitted('update:config')).toBeTruthy();
      });
    });
  }
});

describe('Search box (Search) descriptor — scope + quicksearch (S121 T1)', () => {
  const descriptor = () => getWidgetEditor('Search')!;

  it('defaultConfig() carries scope:both, quicksearch:false, quicksearch_limit:6', () => {
    const config = descriptor().defaultConfig();
    expect(config.scope).toBe('both');
    expect(config.quicksearch).toBe(false);
    expect(config.quicksearch_limit).toBe(6);
  });

  it('renders the scope select and quicksearch checkbox', () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    expect(wrapper.find('[data-test-id="search-scope"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="search-quicksearch"]').exists()).toBe(true);
  });

  it('hides quicksearch_limit until quicksearch is on', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    expect(wrapper.find('[data-test-id="search-quicksearch-limit"]').exists()).toBe(false);
    await wrapper.setProps({
      config: { ...descriptor().defaultConfig(), quicksearch: true },
    });
    expect(wrapper.find('[data-test-id="search-quicksearch-limit"]').exists()).toBe(true);
  });

  it('emits update:config with the chosen scope', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    await wrapper.find('[data-test-id="search-scope"]').setValue('pages');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).scope).toBe('pages');
  });

  it('emits update:config with quicksearch boolean', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    await wrapper.find('[data-test-id="search-quicksearch"]').setValue(true);
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).quicksearch).toBe(true);
  });

  it('clamps quicksearch_limit to 1..20 on emit', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: { ...descriptor().defaultConfig(), quicksearch: true } },
    });
    const limitInput = wrapper.find('[data-test-id="search-quicksearch-limit"]');
    await limitInput.setValue('99');
    let events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).quicksearch_limit).toBe(20);
    await limitInput.setValue('0');
    events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).quicksearch_limit).toBe(1);
  });
});

describe('Search results (SearchResults) descriptor — post-type multi-select (S121 T1)', () => {
  const descriptor = () => getWidgetEditor('SearchResults')!;

  it('defaultConfig() carries types:[post,page] and no legacy scope', () => {
    const config = descriptor().defaultConfig();
    expect(config.types).toEqual(['post', 'page']);
    expect(config.scope).toBeUndefined();
  });

  it('renders the post-type multi-select container and keeps the category scope fields', () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    expect(wrapper.find('[data-test-id="search-results-types"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="category"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="news"]').exists()).toBe(true);
  });
});
