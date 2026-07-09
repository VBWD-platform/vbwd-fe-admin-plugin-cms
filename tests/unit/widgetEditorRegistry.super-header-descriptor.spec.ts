import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

// CmsImagePicker hits a Pinia store + axios; stub it with a minimal component
// that lets the test drive its `select` emission.
vi.mock('../../src/components/CmsImagePicker.vue', () => ({
  default: {
    name: 'CmsImagePicker',
    emits: ['select', 'select-many', 'close'],
    template:
      '<div data-test-id="image-picker-stub">' +
      '<button data-test-id="picker-emit-select" ' +
      "@click=\"$emit('select', '/uploads/picked.png', 'alt text')\">emit</button>" +
      '</div>',
  },
}));

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
  'stickable',
  'stickable_offset_px',
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
    expect(config.stickable).toBe(false);
    expect(config.stickable_offset_px).toBe(160);
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

describe('SuperHeaderEditorTab logo image picker', () => {
  const descriptor = () => getWidgetEditor('SuperHeader')!;

  function mountWith(logoImageUrl: string) {
    return mount(descriptor().generalTabComponent as Component, {
      props: { config: { ...descriptor().defaultConfig(), logo_image_url: logoImageUrl } },
    });
  }

  it('replaces the free-text URL input with the picker workflow', () => {
    const wrapper = mountWith('');
    expect(wrapper.find('[data-test-id="super-header-logo-image-url"]').exists()).toBe(false);
  });

  it('shows the Select image button and no thumbnail/picker when empty', () => {
    const wrapper = mountWith('');
    expect(wrapper.find('[data-test-id="super-header-logo-select"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="super-header-logo-thumb"]').exists()).toBe(false);
    expect(wrapper.find('[data-test-id="image-picker-stub"]').exists()).toBe(false);
  });

  it('mounts the picker when Select image is clicked', async () => {
    const wrapper = mountWith('');
    await wrapper.find('[data-test-id="super-header-logo-select"]').trigger('click');
    expect(wrapper.find('[data-test-id="image-picker-stub"]').exists()).toBe(true);
  });

  it('stores the picked url on select and unmounts the picker', async () => {
    const wrapper = mountWith('');
    await wrapper.find('[data-test-id="super-header-logo-select"]').trigger('click');
    await wrapper.find('[data-test-id="picker-emit-select"]').trigger('click');

    const events = wrapper.emitted('update:config')!;
    const emitted = events[events.length - 1][0] as Record<string, unknown>;
    expect(emitted.logo_image_url).toBe('/uploads/picked.png');
    expect(wrapper.find('[data-test-id="image-picker-stub"]').exists()).toBe(false);
  });

  it('shows the thumbnail, Change and Remove buttons when a url is set', () => {
    const wrapper = mountWith('/uploads/logo.png');
    const thumb = wrapper.find('[data-test-id="super-header-logo-thumb"]');
    expect(thumb.exists()).toBe(true);
    expect(thumb.attributes('src')).toBe('/uploads/logo.png');
    expect(wrapper.find('[data-test-id="super-header-logo-change"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="super-header-logo-remove"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="super-header-logo-select"]').exists()).toBe(false);
  });

  it('clears the url when Remove is clicked', async () => {
    const wrapper = mountWith('/uploads/logo.png');
    await wrapper.find('[data-test-id="super-header-logo-remove"]').trigger('click');
    const events = wrapper.emitted('update:config')!;
    const emitted = events[events.length - 1][0] as Record<string, unknown>;
    expect(emitted.logo_image_url).toBe('');
  });
});

describe('SuperHeaderEditorTab behaviour (stickable) section', () => {
  const descriptor = () => getWidgetEditor('SuperHeader')!;

  function mountWith(overrides: Record<string, unknown> = {}) {
    return mount(descriptor().generalTabComponent as Component, {
      props: { config: { ...descriptor().defaultConfig(), ...overrides } },
    });
  }

  it('hides the offset field when stickable is false', () => {
    const wrapper = mountWith({ stickable: false });
    expect(wrapper.find('[data-test-id="super-header-stickable"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="super-header-stickable-offset"]').exists()).toBe(false);
  });

  it('emits stickable=true when the Sticky header checkbox is ticked', async () => {
    const wrapper = mountWith({ stickable: false });
    await wrapper.find('[data-test-id="super-header-stickable"]').setValue(true);
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).stickable).toBe(true);
  });

  it('renders the offset field and emits the parsed number when stickable is on', async () => {
    const wrapper = mountWith({ stickable: true });
    const offset = wrapper.find('[data-test-id="super-header-stickable-offset"]');
    expect(offset.exists()).toBe(true);
    await offset.setValue('240');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).stickable_offset_px).toBe(240);
  });

  it('falls back to 160 when the offset input is non-numeric / empty', async () => {
    const wrapper = mountWith({ stickable: true });
    await wrapper.find('[data-test-id="super-header-stickable-offset"]').setValue('');
    const events = wrapper.emitted('update:config')!;
    expect((events[events.length - 1][0] as Record<string, unknown>).stickable_offset_px).toBe(160);
  });
});
