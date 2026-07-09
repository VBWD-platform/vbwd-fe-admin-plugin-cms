import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

const EXPECTED_KEYS = [
  'component_name',
  'logo_image_url',
  'logo_text',
  'logo_link',
  'nav_widget_slug',
  'show_search',
  'search_placeholder',
  'search_target_path',
  'search_scope',
  'quicksearch',
  'quicksearch_limit',
  'show_auth_links',
  'login_label',
  'login_path',
  'dashboard_label',
  'dashboard_path',
];

describe('SuperHeader widget editor descriptor', () => {
  const descriptor = () => getWidgetEditor('SuperHeader')!;

  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('SuperHeader')).toBeDefined();
  });

  it('defaultConfig().component_name is SuperHeader and has the full key set', () => {
    const config = descriptor().defaultConfig();
    expect(config.component_name).toBe('SuperHeader');
    for (const key of EXPECTED_KEYS) {
      expect(config).toHaveProperty(key);
    }
    expect(Object.keys(config).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('defaultConfig() carries the documented default values', () => {
    const config = descriptor().defaultConfig();
    expect(config.logo_image_url).toBe('');
    expect(config.logo_text).toBe('VBWD');
    expect(config.logo_link).toBe('/');
    expect(config.nav_widget_slug).toBe('header-nav');
    expect(config.show_search).toBe(true);
    expect(config.search_placeholder).toBe('Search…');
    expect(config.search_target_path).toBe('/search');
    expect(config.search_scope).toBe('both');
    expect(config.quicksearch).toBe(true);
    expect(config.quicksearch_limit).toBe(6);
    expect(config.show_auth_links).toBe(true);
    expect(config.login_label).toBe('Login');
    expect(config.login_path).toBe('/login');
    expect(config.dashboard_label).toBe('Dashboard');
    expect(config.dashboard_path).toBe('/dashboard');
  });

  it('buildPreview shows the logo text, search placeholder and login label by default', () => {
    const preview = descriptor().buildPreview(descriptor().defaultConfig());
    expect(preview.html).toContain('VBWD');
    expect(preview.html).toContain('Search…');
    expect(preview.html).toContain('Login');
  });

  it('buildPreview omits the search markup when show_search is false', () => {
    const preview = descriptor().buildPreview({
      ...descriptor().defaultConfig(),
      show_search: false,
      search_placeholder: 'FindStuffHere',
    });
    expect(preview.html).not.toContain('FindStuffHere');
    expect(preview.html).not.toContain('cms-super-header__search');
  });

  it('buildPreview omits the login label when show_auth_links is false', () => {
    const preview = descriptor().buildPreview({
      ...descriptor().defaultConfig(),
      show_auth_links: false,
    });
    expect(preview.html).not.toContain('cms-super-header__auth');
    expect(preview.html).not.toContain('Login');
  });
});

describe('SuperHeaderEditorTab component', () => {
  const descriptor = () => getWidgetEditor('SuperHeader')!;

  it('emits update:config with the merged object on a field change', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    const logoTextInput = wrapper.find('[data-test-id="super-header-logo-text"]');
    expect(logoTextInput.exists()).toBe(true);
    await logoTextInput.setValue('MyBrand');
    const events = wrapper.emitted('update:config')!;
    expect(events).toBeTruthy();
    const emitted = events[events.length - 1][0] as Record<string, unknown>;
    expect(emitted.logo_text).toBe('MyBrand');
    // merged: untouched keys survive
    expect(emitted.nav_widget_slug).toBe('header-nav');
    expect(emitted.component_name).toBe('SuperHeader');
  });

  it('emits the chosen search scope', async () => {
    const wrapper = mount(descriptor().generalTabComponent as Component, {
      props: { config: descriptor().defaultConfig() },
    });
    await wrapper.find('[data-test-id="super-header-search-scope"]').setValue('posts');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).search_scope).toBe('posts');
  });
});
