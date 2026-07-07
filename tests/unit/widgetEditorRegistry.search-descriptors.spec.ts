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

describe('Search results (SearchResults) descriptor — scope replaces type (S121 T1)', () => {
  const descriptor = () => getWidgetEditor('SearchResults')!;

  it('defaultConfig() carries scope:both and no legacy type', () => {
    const config = descriptor().defaultConfig();
    expect(config.scope).toBe('both');
    expect(config.type).toBeUndefined();
  });

  it('renders the scope select and keeps the category scope fields', () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    expect(wrapper.find('[data-test-id="search-results-scope"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="category"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="news"]').exists()).toBe(true);
  });

  it('emits update:config with the chosen scope', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    await wrapper.find('[data-test-id="search-results-scope"]').setValue('posts');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).scope).toBe('posts');
  });

  it('derives scope from legacy type when scope is absent', () => {
    const casesByType: Array<{ type: string; expected: string }> = [
      { type: 'page', expected: 'pages' },
      { type: 'post', expected: 'posts' },
      { type: 'anything', expected: 'both' },
    ];
    for (const { type, expected } of casesByType) {
      const wrapper = mount(descriptor().generalTabComponent as Component, {
        props: { config: { component_name: 'SearchResults', type } },
      });
      const select = wrapper.find('[data-test-id="search-results-scope"]')
        .element as HTMLSelectElement;
      expect(select.value).toBe(expected);
    }
  });
});
