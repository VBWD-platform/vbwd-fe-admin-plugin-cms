import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import SeoFieldsPanel, { type SeoFields } from '../../src/components/SeoFieldsPanel.vue';
import en from '../../locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
});

function makeModel(overrides: Partial<SeoFields> = {}): SeoFields {
  return {
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    canonical_url: '',
    robots: 'index,follow',
    schema_json: null,
    seo_excluded: false,
    ...overrides,
  };
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(SeoFieldsPanel, {
    props: { modelValue: makeModel(), ...props },
    global: { plugins: [i18n] },
  });
}

function lastModel(wrapper: ReturnType<typeof mountPanel>): SeoFields {
  const events = wrapper.emitted('update:modelValue');
  expect(events).toBeTruthy();
  return events![events!.length - 1][0] as SeoFields;
}

describe('SeoFieldsPanel', () => {
  it('emits update:modelValue with the edited meta title', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="seo-meta-title"]').setValue('About Us');
    expect(lastModel(wrapper).meta_title).toBe('About Us');
  });

  it('emits update:modelValue with the edited meta description', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="seo-meta-description"]').setValue('A great description');
    expect(lastModel(wrapper).meta_description).toBe('A great description');
  });

  it('emits seo_excluded through the exclude toggle', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="seo-excluded-toggle"]').setValue(true);
    expect(lastModel(wrapper).seo_excluded).toBe(true);
  });

  it('renders the SERP preview from meta_title / preview url', () => {
    const wrapper = mountPanel({
      modelValue: makeModel({ meta_title: 'SEO Title' }),
      previewUrl: 'http://localhost:8080/my-slug',
    });
    const serp = wrapper.find('[data-testid="serp-preview"]');
    expect(serp.text()).toContain('SEO Title');
    expect(serp.text()).toContain('my-slug');
  });

  it('falls back to the title prop when meta_title is empty', () => {
    const wrapper = mountPanel({ modelValue: makeModel(), title: 'Doc Title' });
    expect(wrapper.find('[data-testid="serp-preview"]').text()).toContain('Doc Title');
  });

  it('warns when the SERP title exceeds the recommended length', () => {
    const wrapper = mountPanel({ modelValue: makeModel({ meta_title: 'x'.repeat(100) }) });
    expect(wrapper.find('[data-testid="serp-title-warning"]').exists()).toBe(true);
  });

  it('warns when the SERP description exceeds the recommended length', () => {
    const wrapper = mountPanel({ modelValue: makeModel({ meta_description: 'x'.repeat(200) }) });
    expect(wrapper.find('[data-testid="serp-desc-warning"]').exists()).toBe(true);
  });

  it('does not warn for lengths within the recommended limits', () => {
    const wrapper = mountPanel({
      modelValue: makeModel({ meta_title: 'Short', meta_description: 'Short desc' }),
    });
    expect(wrapper.find('[data-testid="serp-title-warning"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="serp-desc-warning"]').exists()).toBe(false);
  });

  it('parses the schema JSON textarea on blur and emits the parsed object', async () => {
    const wrapper = mountPanel();
    const textarea = wrapper.find('[data-testid="seo-schema-json"]');
    await textarea.setValue('{"@type":"Article"}');
    await textarea.trigger('blur');
    expect(lastModel(wrapper).schema_json).toEqual({ '@type': 'Article' });
    expect(wrapper.find('.field-error').exists()).toBe(false);
  });

  it('surfaces an error for invalid schema JSON without emitting', async () => {
    const wrapper = mountPanel();
    const textarea = wrapper.find('[data-testid="seo-schema-json"]');
    await textarea.setValue('not json');
    await textarea.trigger('blur');
    expect(wrapper.find('.field-error').exists()).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('displays the effective SEO state passed by the parent', () => {
    const wrapper = mountPanel({ effectiveSeoState: 'noindex — inherited from Secret' });
    const effective = wrapper.find('[data-testid="seo-effective-state"]');
    expect(effective.text().toLowerCase()).toContain('inherited');
    expect(effective.text()).toContain('Secret');
  });
});
