/**
 * TermArchive widget editor descriptor (cms-admin).
 *
 * The fe-user TermArchive (shared, route-driven archive) vue-component widget
 * needs an admin editor descriptor so an admin can configure the single instance
 * on the terms-archive layout. This oracle mirrors the PostArchive descriptor
 * test: the descriptor is registered on importing src/widgets/index, its
 * defaultConfig carries the matching component_name (and NO term_slug — the term
 * comes from the URL), and its editor tab renders + writes the mode /
 * posts_per_page fields into the config.
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set);
 * SOLID/OCP (CmsWidgetEditor stays widget-agnostic; we only register a new
 * descriptor); DRY (shared mode options); clean code; no overengineering.
 * Quality guard: ``npm run test`` + ``npm run lint``.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('TermArchive widget editor descriptor', () => {
  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('TermArchive')).toBeDefined();
  });

  it('defaultConfig() carries the component_name and NO term_slug', () => {
    const descriptor = getWidgetEditor('TermArchive')!;
    const config = descriptor.defaultConfig();
    expect(config.component_name).toBe('TermArchive');
    expect(config.type).toBe('post');
    expect(config.mode).toBe('category');
    expect(config.posts_per_page).toBe(20);
    expect(config.term_slug).toBeUndefined();
  });

  it('buildPreview(defaultConfig()) returns a non-empty html string', () => {
    const descriptor = getWidgetEditor('TermArchive')!;
    const preview = descriptor.buildPreview(descriptor.defaultConfig());
    expect(typeof preview.html).toBe('string');
    expect(preview.html.length).toBeGreaterThan(0);
  });

  it('editor tab renders a mode select and a posts_per_page number field', () => {
    const descriptor = getWidgetEditor('TermArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
  });

  it('changing mode emits update:config with the new mode', async () => {
    const descriptor = getWidgetEditor('TermArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    await wrapper.find('select').setValue('titles');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).mode).toBe('titles');
  });

  it('changing posts_per_page emits update:config with the new number', async () => {
    const descriptor = getWidgetEditor('TermArchive')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    await wrapper.find('input[type="number"]').setValue('8');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).posts_per_page).toBe(8);
  });
});
