import { ref, computed, type Ref, type ComputedRef } from 'vue';

/**
 * Shared bulk-selection logic for every CMS list.
 *
 * Supports two "select all" scopes:
 *   - page: every row on the current page (the resolved ids are the checked set);
 *   - all : "totally all entries" matching the current filter — ids are fetched
 *           lazily via `fetchAllIds()` only when an action runs, so a 1000-row
 *           table doesn't pull every id up front just to show the bar.
 */
export interface BulkSelectionOptions {
  /** ids of the rows currently visible on the page. */
  pageIds: () => string[];
  /** total number of rows matching the active filter (across all pages). */
  totalCount: () => number;
  /** fetch EVERY matching id (used for the "totally all" scope). */
  fetchAllIds: () => Promise<string[]>;
}

export interface CmsBulkSelection {
  selected: Ref<Set<string>>;
  allMatching: Ref<boolean>;
  showScopeMenu: Ref<boolean>;
  selectedCount: ComputedRef<number>;
  hasSelection: ComputedRef<boolean>;
  allPageSelected: ComputedRef<boolean>;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string) => void;
  selectPage: () => void;
  selectAllMatching: () => void;
  clear: () => void;
  onHeaderToggle: () => void;
  resolveIds: () => Promise<string[]>;
}

export function useCmsBulkSelection(opts: BulkSelectionOptions): CmsBulkSelection {
  const selected = ref<Set<string>>(new Set());
  const allMatching = ref(false);
  const showScopeMenu = ref(false);

  const selectedCount = computed(() =>
    allMatching.value ? opts.totalCount() : selected.value.size);
  const hasSelection = computed(() => selectedCount.value > 0);

  const allPageSelected = computed(() => {
    const ids = opts.pageIds();
    return ids.length > 0 && ids.every((id) => selected.value.has(id));
  });

  function isSelected(id: string): boolean {
    return selected.value.has(id);
  }

  function toggleOne(id: string): void {
    allMatching.value = false;
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  }

  function selectPage(): void {
    allMatching.value = false;
    selected.value = new Set(opts.pageIds());
    showScopeMenu.value = false;
  }

  function selectAllMatching(): void {
    allMatching.value = true;
    // Visually check the page's rows; the real id set is resolved on action.
    selected.value = new Set(opts.pageIds());
    showScopeMenu.value = false;
  }

  function clear(): void {
    allMatching.value = false;
    selected.value = new Set();
    showScopeMenu.value = false;
  }

  // Header checkbox: clears if something is selected, else opens the scope menu
  // ("all on this page" vs "totally all entries").
  function onHeaderToggle(): void {
    if (hasSelection.value) clear();
    else showScopeMenu.value = !showScopeMenu.value;
  }

  async function resolveIds(): Promise<string[]> {
    if (allMatching.value) return opts.fetchAllIds();
    return [...selected.value];
  }

  return {
    selected,
    allMatching,
    showScopeMenu,
    selectedCount,
    hasSelection,
    allPageSelected,
    isSelected,
    toggleOne,
    selectPage,
    selectAllMatching,
    clear,
    onHeaderToggle,
    resolveIds,
  };
}
