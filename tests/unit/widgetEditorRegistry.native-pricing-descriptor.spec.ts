/**
 * NativePricingPlans widget editor descriptor (cms-admin).
 *
 * The fe-user NativePricingPlans widget (a Landing1View wrapper) grew richer
 * presentation config — heading/subtitle/cta text, a card theme, a per-card
 * image, an emphasized "popular" plan, and a feature checklist. This oracle
 * mirrors the AddonCatalog/Search descriptor tests: the descriptor is
 * registered on importing src/widgets/index, its defaultConfig carries the
 * matching component_name plus the new keys, and buildPreview reflects the
 * emphasized plan + features so the admin preview matches what fe-user renders.
 *
 * Engineering requirements (binding, restated): TDD-first; SOLID/OCP
 * (CmsWidgetEditor stays widget-agnostic); DRY; clean; no overengineering.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

describe('NativePricingPlans widget editor descriptor', () => {
  it('is registered after importing src/widgets/index', () => {
    expect(getWidgetEditor('NativePricingPlans')).toBeDefined();
  });

  it('defaultConfig carries component_name and the new presentation keys', () => {
    const descriptor = getWidgetEditor('NativePricingPlans')!;
    const cfg = descriptor.defaultConfig();
    expect(cfg.component_name).toBe('NativePricingPlans');
    for (const key of ['theme', 'image_url', 'highlight_slug', 'highlight_badge', 'features', 'heading', 'subtitle', 'cta_label']) {
      expect(cfg).toHaveProperty(key);
    }
    expect(Array.isArray(cfg.features)).toBe(true);
  });

  it('buildPreview(defaultConfig()) returns non-empty html and baseStyles', () => {
    const descriptor = getWidgetEditor('NativePricingPlans')!;
    const preview = descriptor.buildPreview(descriptor.defaultConfig());
    expect(typeof preview.html).toBe('string');
    expect(preview.html.length).toBeGreaterThan(0);
    expect(typeof preview.baseStyles).toBe('string');
  });

  it('buildPreview marks the emphasized plan and renders configured features', () => {
    const descriptor = getWidgetEditor('NativePricingPlans')!;
    const preview = descriptor.buildPreview({
      ...descriptor.defaultConfig(),
      highlight_slug: 'pro',
      highlight_badge: 'Best Value',
      features: ['2000 MB Bandwidth', '5 GB Space'],
    });
    expect(preview.html).toContain('plan-card--featured');
    expect(preview.html).toContain('Best Value');
    expect(preview.html).toContain('2000 MB Bandwidth');
  });

  it('generalTabComponent emits update:config on a field change', async () => {
    const descriptor = getWidgetEditor('NativePricingPlans')!;
    const wrapper = mount(descriptor.generalTabComponent as Component, {
      props: { config: descriptor.defaultConfig() },
    });
    const headingInput = wrapper.find('input[type="text"]');
    expect(headingInput.exists()).toBe(true);
    await headingInput.setValue('Our Pricing');
    expect(wrapper.emitted('update:config')).toBeTruthy();
  });
});
