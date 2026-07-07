/**
 * PostArchive widget editor descriptor (cms-admin).
 *
 * The fe-user PostArchive (blog index) vue-component widget needs an admin
 * editor descriptor so an admin can drop it onto the posts-archive page/layout
 * and configure it. This oracle mirrors the Category/AddonCatalog descriptor
 * tests: the descriptor is registered on importing src/widgets/index, its
 * defaultConfig carries the matching component_name (and NO term_slug), and its
 * editor tab renders + writes the mode / posts_per_page fields into the config.
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set);
 * SOLID/OCP (CmsWidgetEditor stays widget-agnostic; we only register a new
 * descriptor); DRY (shared POST_LIST_MODE_OPTIONS); clean code; no
 * overengineering. Quality guard: ``npm run test`` + ``npm run lint``.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('PostArchive widget editor descriptor', () => {
  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('PostArchive')).toBeDefined();
  });

  it('defaultConfig() carries the component_name and NO term_slug', () => {
    const descriptor = getWidgetEditor('PostArchive')!;
    const config = descriptor.defaultConfig();
    expect(config.component_name).toBe('PostArchive');
    expect(config.type).toBe('post');
    expect(config.mode).toBe('category');
    expect(config.posts_per_page).toBe(20);
    expect(config.term_slug).toBeUndefined();
  });

  it('buildPreview(defaultConfig()) returns a non-empty html string', () => {
    const descriptor = getWidgetEditor('PostArchive')!;
    const preview = descriptor.buildPreview(descriptor.defaultConfig());
    expect(typeof preview.html).toBe('string');
    expect(preview.html.length).toBeGreaterThan(0);
  });

  it('editor tab renders a mode select and a posts_per_page number field', () => {
    const descriptor = getWidgetEditor('PostArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
  });

  it('changing mode emits update:config with the new mode', async () => {
    const descriptor = getWidgetEditor('PostArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    await wrapper.find('select').setValue('titles');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).mode).toBe('titles');
  });

  it('changing posts_per_page emits update:config with the new number', async () => {
    const descriptor = getWidgetEditor('PostArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    await wrapper.find('input[type="number"]').setValue('8');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).posts_per_page).toBe(8);
  });
});
