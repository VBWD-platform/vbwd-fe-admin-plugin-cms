/**
 * CookieConsent widget editor descriptor (cms-admin, S87).
 *
 * The fe-user CookieConsent vue-component widget needs an admin editor descriptor
 * so an admin can drop it onto a layout and edit its settings (privacy URL,
 * categories, version, mode). This oracle mirrors the AddonCatalog/Search tests:
 * the descriptor registers on importing src/widgets/index, its defaultConfig
 * carries the matching component_name + the documented shape, buildPreview yields
 * a banner, and the general tab is v-model:config.
 *
 * Engineering requirements (binding): TDD-first (RED set); SOLID/OCP
 * (CmsWidgetEditor stays widget-agnostic); DRY; no overengineering. Quality
 * guard: npm run test + npm run lint + vue-tsc.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('CookieConsent widget editor descriptor', () => {
  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('CookieConsent')).toBeDefined();
  });

  it('defaultConfig() carries the documented shape', () => {
    const config = getWidgetEditor('CookieConsent')!.defaultConfig();
    expect(config.component_name).toBe('CookieConsent');
    expect(config.consent_version).toBe(1);
    expect(config.mode).toBe('modal');
    expect(config.privacy_policy_url).toBe('/privacy');
    expect(config.show_settings_button).toBe(true);
    expect(config.categories).toContain('necessary');
    expect(config.categories).toContain('statistics');
  });

  it('buildPreview(defaultConfig()) returns a non-empty banner html string', () => {
    const descriptor = getWidgetEditor('CookieConsent')!;
    const preview = descriptor.buildPreview(descriptor.defaultConfig());
    expect(typeof preview.html).toBe('string');
    expect(preview.html.length).toBeGreaterThan(0);
    expect(preview.html).toContain('Accept all');
    expect(preview.html).toContain('Reject all');
  });

  it('generalTabComponent emits update:config when the privacy URL changes', async () => {
    const descriptor = getWidgetEditor('CookieConsent')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    const input = wrapper.find('[data-testid="cc-privacy-url"]');
    expect(input.exists()).toBe(true);
    await input.setValue('/datenschutz');
    const emitted = wrapper.emitted('update:config');
    expect(emitted).toBeTruthy();
    const lastPayload = emitted![emitted!.length - 1][0] as Record<string, unknown>;
    expect(lastPayload.privacy_policy_url).toBe('/datenschutz');
  });

  it('toggling an optional category keeps necessary and updates the list', async () => {
    const descriptor = getWidgetEditor('CookieConsent')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: { ...descriptor.defaultConfig(), categories: ['necessary'] } },
    });
    const statistics = wrapper.find('[data-testid="cc-category-statistics"]');
    await statistics.setValue(true);
    const emitted = wrapper.emitted('update:config');
    expect(emitted).toBeTruthy();
    const payload = emitted![emitted!.length - 1][0] as Record<string, unknown>;
    expect(payload.categories).toContain('necessary');
    expect(payload.categories).toContain('statistics');
  });
});
