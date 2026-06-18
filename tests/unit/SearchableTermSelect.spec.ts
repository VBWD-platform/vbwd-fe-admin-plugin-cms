/**
 * SearchableTermSelect — a typeahead that filters a provided term list by name
 * (case-insensitive) into a dropdown of matches; click-to-select emits the term.
 * With `allowCreate`, an unmatched query offers a "create" option that emits the
 * typed name. Reused for the category picker (allowCreate=false) in PostEditor.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchableTermSelect from '../../src/components/SearchableTermSelect.vue';

const TERMS = [
  { id: 'c1', term_type: 'category', slug: 'news', name: 'News', parent_id: null, seo_excluded: false, sort_order: 0 },
  { id: 'c2', term_type: 'category', slug: 'events', name: 'Events', parent_id: null, seo_excluded: false, sort_order: 0 },
  { id: 'c3', term_type: 'category', slug: 'announce', name: 'Announcements', parent_id: null, seo_excluded: false, sort_order: 0 },
];

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(SearchableTermSelect, {
    props: { terms: TERMS, placeholder: 'Add category…', ...props },
    global: { mocks: { $t: (key: string, fallback?: string) => fallback ?? key } },
  });
}

describe('SearchableTermSelect', () => {
  it('filters the term list by the typed text (case-insensitive)', async () => {
    const wrapper = mountSelect();
    await wrapper.find('[data-testid="searchable-term-input"]').setValue('an');
    const options = wrapper.findAll('[data-testid="searchable-term-option"]');
    // "Announcements" matches; "News" / "Events" do not.
    const names = options.map((option) => option.text());
    expect(names).toContain('Announcements');
    expect(names).not.toContain('News');
    expect(names).not.toContain('Events');
  });

  it('emits select with the chosen term on click', async () => {
    const wrapper = mountSelect();
    await wrapper.find('[data-testid="searchable-term-input"]').setValue('news');
    await wrapper.find('[data-testid="searchable-term-option"]').trigger('mousedown');
    const events = wrapper.emitted('select');
    expect(events).toBeTruthy();
    expect((events![0][0] as { id: string }).id).toBe('c1');
  });

  it('does not offer a create option when allowCreate is false', async () => {
    const wrapper = mountSelect({ allowCreate: false });
    await wrapper.find('[data-testid="searchable-term-input"]').setValue('brand-new');
    expect(wrapper.find('[data-testid="searchable-term-create"]').exists()).toBe(false);
  });

  it('offers a create option for an unmatched query and emits create with the typed name', async () => {
    const wrapper = mountSelect({ allowCreate: true, createLabel: 'Create' });
    await wrapper.find('[data-testid="searchable-term-input"]').setValue('Brand New Tag');
    const createOption = wrapper.find('[data-testid="searchable-term-create"]');
    expect(createOption.exists()).toBe(true);
    expect(createOption.text()).toContain('Brand New Tag');
    await createOption.trigger('mousedown');
    const events = wrapper.emitted('create');
    expect(events).toBeTruthy();
    expect(events![0][0]).toBe('Brand New Tag');
  });

  it('does not offer create when the query exactly matches an existing term name', async () => {
    const wrapper = mountSelect({ allowCreate: true });
    await wrapper.find('[data-testid="searchable-term-input"]').setValue('News');
    expect(wrapper.find('[data-testid="searchable-term-create"]').exists()).toBe(false);
  });
});
