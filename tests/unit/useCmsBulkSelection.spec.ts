import { describe, it, expect } from 'vitest';
import { useCmsBulkSelection } from '../../src/composables/useCmsBulkSelection';

function make(pageIds: string[] = ['a', 'b', 'c'], total = 50, allIds: string[] = []) {
  return useCmsBulkSelection({
    pageIds: () => pageIds,
    totalCount: () => total,
    fetchAllIds: async () => (allIds.length ? allIds : Array.from({ length: total }, (_, i) => `id-${i}`)),
  });
}

describe('useCmsBulkSelection', () => {
  it('toggles a single id', () => {
    const s = make();
    s.toggleOne('a');
    expect(s.isSelected('a')).toBe(true);
    expect(s.selectedCount.value).toBe(1);
    s.toggleOne('a');
    expect(s.isSelected('a')).toBe(false);
  });

  it('selects the whole page', () => {
    const s = make(['a', 'b', 'c']);
    s.selectPage();
    expect(s.selectedCount.value).toBe(3);
    expect(s.allPageSelected.value).toBe(true);
    expect(s.allMatching.value).toBe(false);
  });

  it('select-all-matching counts the total and resolves all ids on action', async () => {
    const s = make(['a', 'b', 'c'], 50);
    s.selectAllMatching();
    expect(s.allMatching.value).toBe(true);
    expect(s.selectedCount.value).toBe(50);
    const ids = await s.resolveIds();
    expect(ids).toHaveLength(50);
  });

  it('page scope resolves only the checked ids', async () => {
    const s = make();
    s.toggleOne('a');
    s.toggleOne('b');
    const ids = await s.resolveIds();
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('header toggle opens the scope menu when nothing is selected, clears otherwise', () => {
    const s = make();
    s.onHeaderToggle();
    expect(s.showScopeMenu.value).toBe(true);
    s.selectPage();
    expect(s.showScopeMenu.value).toBe(false);
    s.onHeaderToggle(); // now something is selected → clears
    expect(s.selectedCount.value).toBe(0);
  });

  it('toggling a single id cancels the all-matching scope', () => {
    const s = make(['a', 'b', 'c'], 50);
    s.selectAllMatching();
    expect(s.allMatching.value).toBe(true);
    s.toggleOne('a');
    expect(s.allMatching.value).toBe(false);
  });
});
