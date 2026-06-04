<template>
  <div class="cms-view term-manager">
    <div class="term-manager__header">
      <h2>{{ $t('cms.terms') }}</h2>
      <div
        v-if="canManage"
        class="term-manager__actions"
      >
        <button
          type="button"
          class="btn"
          data-testid="term-export"
          @click="exportTerms"
        >
          {{ $t('cms.export') }}
        </button>
        <button
          type="button"
          class="btn"
          data-testid="term-import"
          @click="importInput?.click()"
        >
          {{ $t('cms.import') }}
        </button>
        <input
          ref="importInput"
          type="file"
          accept=".json,application/json"
          style="display: none"
          data-testid="term-import-input"
          @change="onImportFile"
        >
      </div>
    </div>

    <div
      v-if="store.error"
      class="term-manager__error"
    >
      {{ store.error }}
    </div>

    <!-- Term-type tabs (from the term-type registry) -->
    <div class="term-type-tabs">
      <button
        v-for="termType in store.termTypes"
        :key="termType.key"
        type="button"
        class="term-type-tab"
        :class="{ active: activeType === termType.key }"
        data-testid="term-type-tab"
        @click="selectType(termType.key)"
      >
        {{ termType.label }}
      </button>
    </div>

    <div class="term-manager__body">
      <!-- Existing terms -->
      <div class="term-list">
        <input
          v-model="termSearch"
          type="search"
          class="term-search"
          :placeholder="$t('cms.search')"
          data-testid="term-search"
        >
        <div
          v-for="term in visibleTerms"
          :key="term.id"
          class="term-row"
          :class="{ 'term-row--child': isHierarchical && term.parent_id }"
          data-testid="term-row"
          :data-term-id="term.id"
        >
          <span class="term-row__name">{{ term.name }}</span>
          <span class="term-row__slug">{{ term.slug }}</span>
          <button
            type="button"
            class="term-row__excl"
            :class="{ 'is-excluded': term.seo_excluded }"
            :data-testid="`term-toggle-exclude-${term.id}`"
            :title="$t('cms.excludeFromSearch')"
            @click="toggleExclude(term)"
          >
            {{ term.seo_excluded ? $t('cms.noindex') : $t('cms.indexable') }}
          </button>
          <button
            v-if="canManage"
            type="button"
            class="btn btn--xs btn--danger"
            :data-testid="`term-delete-${term.id}`"
            @click="remove(term)"
          >
            ×
          </button>
        </div>
        <p
          v-if="!visibleTerms.length"
          class="term-empty"
        >
          {{ $t('cms.noTerms') }}
        </p>
      </div>

      <!-- Create form -->
      <div
        v-if="canManage"
        class="term-create sidebar-card"
      >
        <h3 class="section-subtitle">
          {{ $t('cms.newTerm') }}
        </h3>
        <div class="field-group">
          <label class="field-label">{{ $t('cms.name') }} *</label>
          <input
            v-model="draft.name"
            class="field-input"
            type="text"
            data-testid="term-name"
            @blur="autoSlug"
          >
        </div>
        <div class="field-group">
          <label class="field-label">{{ $t('cms.slug') }} *</label>
          <input
            v-model="draft.slug"
            class="field-input field-input--mono"
            type="text"
            data-testid="term-slug"
          >
        </div>
        <div
          v-if="isHierarchical"
          class="field-group"
        >
          <label class="field-label">{{ $t('cms.parent') }}</label>
          <select
            v-model="draft.parent_id"
            class="field-input"
            data-testid="term-parent"
          >
            <option :value="null">
              — {{ $t('cms.none') }} —
            </option>
            <option
              v-for="term in store.terms"
              :key="term.id"
              :value="term.id"
            >
              {{ term.name }}
            </option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">
            <input
              v-model="draft.seo_excluded"
              type="checkbox"
              data-testid="term-seo-excluded"
            >
            &nbsp;{{ $t('cms.excludeFromSearch') }}
          </label>
        </div>
        <button
          class="btn btn--primary"
          data-testid="term-save"
          @click="create"
        >
          {{ $t('cms.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCmsContentStore, type CmsTerm } from '../stores/useCmsContentStore';
import { useAuthStore } from '@/stores/auth';

const store = useCmsContentStore();
const authStore = useAuthStore();
const canManage = computed(() => authStore.hasPermission('cms.manage'));

const activeType = ref<string>('');
const termSearch = ref<string>('');

const activeTermType = computed(() => store.termTypes.find((t) => t.key === activeType.value) ?? null);
const isHierarchical = computed(() => activeTermType.value?.hierarchical ?? false);

interface TermDraft {
  name: string;
  slug: string;
  parent_id: string | null;
  seo_excluded: boolean;
}

const draft = ref<TermDraft>({ name: '', slug: '', parent_id: null, seo_excluded: false });

const importInput = ref<HTMLInputElement | null>(null);

// Parents first, then their children (single level of nesting surfaced).
const orderedTerms = computed<CmsTerm[]>(() => {
  if (!isHierarchical.value) return store.terms;
  const roots = store.terms.filter((term) => !term.parent_id);
  const ordered: CmsTerm[] = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(...store.terms.filter((term) => term.parent_id === root.id));
  }
  // Any orphan (parent not in set) still appears.
  for (const term of store.terms) {
    if (!ordered.includes(term)) ordered.push(term);
  }
  return ordered;
});

// Client-side quick-search over the loaded terms (name + slug, case-insensitive).
// Term lists are small and fully loaded per type, so no backend round-trip.
const visibleTerms = computed<CmsTerm[]>(() => {
  const needle = termSearch.value.trim().toLowerCase();
  if (!needle) return orderedTerms.value;
  return orderedTerms.value.filter(
    (term) =>
      term.name.toLowerCase().includes(needle) ||
      term.slug.toLowerCase().includes(needle),
  );
});

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function autoSlug() {
  if (!draft.value.slug && draft.value.name) {
    draft.value.slug = slugify(draft.value.name);
  }
}

async function selectType(key: string) {
  activeType.value = key;
  termSearch.value = '';
  draft.value = { name: '', slug: '', parent_id: null, seo_excluded: false };
  await store.fetchTerms(key);
}

async function create() {
  if (!draft.value.name || !draft.value.slug) return;
  await store.saveTerm({
    term_type: activeType.value,
    name: draft.value.name,
    slug: draft.value.slug,
    parent_id: draft.value.parent_id,
    seo_excluded: draft.value.seo_excluded,
  });
  draft.value = { name: '', slug: '', parent_id: null, seo_excluded: false };
}

async function toggleExclude(term: CmsTerm) {
  await store.saveTerm({
    id: term.id,
    term_type: term.term_type,
    name: term.name,
    slug: term.slug,
    parent_id: term.parent_id,
    seo_excluded: !term.seo_excluded,
  });
}

async function remove(term: CmsTerm) {
  await store.deleteTerm(term.id, term.term_type);
}

// ── Export / Import (VBWD-standard JSON) ────────────────────────────────────
async function exportTerms() {
  if (!activeType.value) return;
  const payload = await store.exportTerms(activeType.value);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cms-terms-${activeType.value}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    await store.importTerms(payload);
    // Refresh the list so imported terms appear immediately.
    if (activeType.value) await store.fetchTerms(activeType.value);
  } catch (error: unknown) {
    store.error = (error as Error)?.message ?? 'Import failed';
  } finally {
    (event.target as HTMLInputElement).value = '';
  }
}

onMounted(async () => {
  await store.fetchTermTypes();
  if (store.termTypes.length) {
    await selectType(store.termTypes[0].key);
  }
});

defineExpose({ activeType, draft });
</script>

<style scoped>
.term-manager__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 0.75rem; flex-wrap: wrap; }
.term-manager__actions { display: flex; gap: 0.5rem; }
.term-manager__error { background: #fee2e2; color: #991b1b; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 1rem; }

.term-type-tabs { display: flex; gap: 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 1rem; }
.term-type-tab { padding: 0.5rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9rem; color: #6b7280; }
.term-type-tab.active { color: #1d4ed8; border-bottom-color: #1d4ed8; font-weight: 600; }

.term-manager__body { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; align-items: start; }
@media (max-width: 900px) { .term-manager__body { grid-template-columns: 1fr; } }

.term-search { width: 100%; padding: 0.45rem 0.75rem; margin-bottom: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.term-search:focus { outline: none; border-color: #3498db; }
.term-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.25rem; border-bottom: 1px solid #f3f4f6; }
.term-row--child { padding-left: 1.5rem; }
.term-row__name { font-weight: 600; font-size: 0.9rem; }
.term-row__slug { font-family: monospace; font-size: 0.8rem; color: #6b7280; flex: 1; }
.term-row__excl { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; border: 1px solid #d1d5db; background: #f3f4f6; cursor: pointer; color: #374151; }
.term-row__excl.is-excluded { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
.term-empty { color: #9ca3af; font-size: 0.85rem; padding: 0.5rem 0; }

.sidebar-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; }
.section-subtitle { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 0 0 8px; }
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #374151; }
.field-input { width: 100%; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.field-input--mono { font-family: monospace; }

.btn { padding: 0.45rem 1rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.875rem; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn--xs { padding: 0.1rem 0.5rem; font-size: 0.8rem; }
.btn--danger { color: #b91c1c; border-color: #fca5a5; }
</style>
