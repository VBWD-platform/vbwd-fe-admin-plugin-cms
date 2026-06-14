/**
 * AddonCatalog widget editor descriptor (cms-admin).
 *
 * The fe-user AddonCatalog vue-component widget needs an admin editor descriptor
 * so an admin can drop it onto a cms page/layout and configure it. This oracle
 * mirrors the Search/Category descriptor tests: the descriptor is registered on
 * importing src/widgets/index, its defaultConfig carries the matching
 * component_name, and buildPreview(defaultConfig()) yields non-empty html.
 *
 * Engineering requirements (binding, restated): TDD-first (RED set); SOLID/OCP
 * (CmsWidgetEditor stays widget-agnostic; we only register a new descriptor);
 * DRY; clean code; no overengineering. Quality guard:
 * ``npm run test`` + ``npm run lint`` + ``vue-tsc``.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('AddonCatalog widget editor descriptor', () => {
  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('AddonCatalog')).toBeDefined();
  });

  it('defaultConfig().component_name matches the descriptor name', () => {
    const descriptor = getWidgetEditor('AddonCatalog')!;
    expect(descriptor.defaultConfig().component_name).toBe('AddonCatalog');
  });

  it('buildPreview(defaultConfig()) returns a non-empty html string', () => {
    const descriptor = getWidgetEditor('AddonCatalog')!;
    const preview = descriptor.buildPreview(descriptor.defaultConfig());
    expect(typeof preview.html).toBe('string');
    expect(preview.html.length).toBeGreaterThan(0);
  });

  it('generalTabComponent emits update:config on a field change', async () => {
    const descriptor = getWidgetEditor('AddonCatalog')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    const firstInput = wrapper.find('input');
    expect(firstInput.exists()).toBe(true);
    await firstInput.setValue('changed value');
    expect(wrapper.emitted('update:config')).toBeTruthy();
  });
});
