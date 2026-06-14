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
        const firstTextInput = wrapper.find('input[type="text"]');
        expect(firstTextInput.exists()).toBe(true);
        await firstTextInput.setValue('changed value');
        expect(wrapper.emitted('update:config')).toBeTruthy();
      });
    });
  }
});
