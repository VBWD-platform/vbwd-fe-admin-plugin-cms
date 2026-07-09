/**
 * Archive display toggles — shared widget-editor control (CMS archives Inc 2).
 *
 * Every post-archive widget editor (PostArchive, TermArchive, Category,
 * SearchResults) gains three per-widget display switches — `show_categories`,
 * `show_tags`, `show_article_size` — rendered by ONE shared component
 * (ArchiveDisplayToggles.vue) so they appear identically on each widget's
 * standalone `/admin/cms/widgets/<id>/edit`. Each defaults ON; toggling writes
 * the snake_case key into the widget config the fe-user card reads.
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set);
 * SOLID/OCP (CmsWidgetEditor stays widget-agnostic; the shared control is
 * dropped into each existing editor tab — no new mechanism); DRY (one control,
 * four editors); clean code; no overengineering. Quality guard: `npm run test`
 * + `npm run lint`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { Component } from 'vue';
import { api } from '@/api';
import ArchiveDisplayToggles from '../../src/widgets/ArchiveDisplayToggles.vue';
import { getWidgetEditor } from '../../src/widgets/widgetEditorRegistry';
import '../../src/widgets/index';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const TOGGLE_KEYS = ['show_categories', 'show_tags', 'show_article_size'] as const;
const TOGGLE_TESTIDS = [
  'toggle-show-categories',
  'toggle-show-tags',
  'toggle-show-article-size',
] as const;

const ARCHIVE_EDITORS = ['PostArchive', 'TermArchive', 'Category', 'SearchResults'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ post_types: [] });
});

describe('ArchiveDisplayToggles (shared control)', () => {
  it('renders all three checkboxes, checked by default when config omits the keys', () => {
    const wrapper = mount(ArchiveDisplayToggles, { props: { config: {} } });
    for (const testid of TOGGLE_TESTIDS) {
      const box = wrapper.find(`[data-test-id="${testid}"]`);
      expect(box.exists()).toBe(true);
      expect((box.element as HTMLInputElement).checked).toBe(true);
    }
  });

  it('reflects an explicit false in the config as an unchecked box', () => {
    const wrapper = mount(ArchiveDisplayToggles, {
      props: { config: { show_tags: false } },
    });
    expect(
      (wrapper.find('[data-test-id="toggle-show-tags"]').element as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (wrapper.find('[data-test-id="toggle-show-categories"]').element as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('emits update:config with the toggled key set to false, preserving other keys', async () => {
    const wrapper = mount(ArchiveDisplayToggles, {
      props: { config: { component_name: 'PostArchive', show_tags: true } },
    });
    await wrapper.find('[data-test-id="toggle-show-tags"]').setValue(false);
    const events = wrapper.emitted('update:config')!;
    const last = events[events.length - 1][0] as Record<string, unknown>;
    expect(last.show_tags).toBe(false);
    expect(last.component_name).toBe('PostArchive');
  });
});

describe.each(ARCHIVE_EDITORS)('archive editor %s — display toggles', (name) => {
  function mountEditor(config: Record<string, unknown>) {
    const descriptor = getWidgetEditor(name)!;
    return mount(descriptor.generalTabComponent as Component, { props: { config } });
  }

  it('defaultConfig() includes the three toggles defaulting to true', () => {
    const config = getWidgetEditor(name)!.defaultConfig();
    for (const key of TOGGLE_KEYS) {
      expect(config[key]).toBe(true);
    }
  });

  it('renders the three display-toggle checkboxes', async () => {
    const wrapper = mountEditor(getWidgetEditor(name)!.defaultConfig());
    await flushPromises();
    for (const testid of TOGGLE_TESTIDS) {
      expect(wrapper.find(`[data-test-id="${testid}"]`).exists()).toBe(true);
    }
  });

  it('toggling show_article_size off writes show_article_size:false into config', async () => {
    const wrapper = mountEditor(getWidgetEditor(name)!.defaultConfig());
    await flushPromises();
    await wrapper.find('[data-test-id="toggle-show-article-size"]').setValue(false);
    const events = wrapper.emitted('update:config')!;
    const last = events[events.length - 1][0] as Record<string, unknown>;
    expect(last.show_article_size).toBe(false);
  });
});
