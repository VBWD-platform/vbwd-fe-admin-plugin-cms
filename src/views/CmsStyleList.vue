<template>
  <div class="cms-view cms-list">
    <div class="cms-list__header">
      <h1>Styles</h1>
      <div class="cms-list__actions">
        <input
          v-model="query"
          type="search"
          placeholder="Search styles…"
          class="cms-list__search"
          @input="fetchDebounced"
        >
        <button
          class="btn"
          @click="importInput?.click()"
        >
          Import
        </button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display:none"
          @change="onImport"
        >
        <button
          class="btn btn--primary"
          @click="$router.push('/admin/cms/styles/new')"
        >
          + New Style
        </button>
      </div>
    </div>

    <div
      v-if="store.selectedStyleIds.size > 0"
      class="cms-list__bulk-bar"
    >
      <span>{{ store.selectedStyleIds.size }} selected</span>
      <button
        class="btn"
        @click="exportSelected"
      >
        Export selected
      </button>
      <button
        class="btn btn--danger"
        @click="bulkDelete"
      >
        Delete selected
      </button>
    </div>

    <table class="cms-table">
      <thead>
        <tr>
          <th class="cms-table__check">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleAll"
            >
          </th>
          <th
            class="sortable"
            @click="sort('name')"
          >
            Name <span v-if="sortBy==='name'">{{ sortDir==='asc'?'▲':'▼' }}</span>
          </th>
          <th
            class="sortable"
            @click="sort('slug')"
          >
            Slug
          </th>
          <th
            class="sortable"
            @click="sort('is_active')"
          >
            Active
          </th>
          <th
            class="sortable"
            @click="sort('updated_at')"
          >
            Updated
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="style in items"
          :key="style.id"
          class="cms-table__row"
          @click.self="$router.push(`/admin/cms/styles/${style.id}/edit`)"
        >
          <td @click.stop>
            <input
              type="checkbox"
              :checked="store.selectedStyleIds.has(style.id)"
              @change="toggleOne(style.id)"
            >
          </td>
          <td @click="$router.push(`/admin/cms/styles/${style.id}/edit`)">
            {{ style.name }}
          </td>
          <td>{{ style.slug }}</td>
          <td>{{ style.is_active ? 'Yes' : 'No' }}</td>
          <td>{{ fmtDate(style.updated_at) }}</td>
        </tr>
        <tr v-if="!items.length && !store.loading">
          <td
            colspan="5"
            class="cms-table__empty"
          >
            No styles yet.
          </td>
        </tr>
      </tbody>
    </table>

    <div class="cms-list__pagination">
      <button
        :disabled="page <= 1"
        @click="page--; fetch()"
      >
        &lsaquo; Prev
      </button>
      <span>Page {{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        @click="page++; fetch()"
      >
        Next &rsaquo;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';

const importInput = ref<HTMLInputElement | null>(null);

const store = useCmsAdminStore();
const query = ref('');
const page = ref(1);
const sortBy = ref('sort_order');
const sortDir = ref<'asc' | 'desc'>('asc');

const items = computed(() => store.styles?.items ?? []);
const totalPages = computed(() => store.styles?.pages ?? 1);
const allSelected = computed(() =>
  items.value.length > 0 && items.value.every(s => store.selectedStyleIds.has(s.id))
);

let debounceTimer: ReturnType<typeof setTimeout>;
function fetchDebounced() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { page.value = 1; fetch(); }, 300);
}

function fetch() {
  store.fetchStyles({ page: page.value, query: query.value, sort_by: sortBy.value, sort_dir: sortDir.value });
}

function sort(col: string) {
  if (sortBy.value === col) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = col; sortDir.value = 'asc'; }
  fetch();
}

function toggleAll() {
  if (allSelected.value) {
    items.value.forEach(s => store.selectedStyleIds.delete(s.id));
  } else {
    items.value.forEach(s => store.selectedStyleIds.add(s.id));
  }
}

function toggleOne(id: string) {
  if (store.selectedStyleIds.has(id)) store.selectedStyleIds.delete(id);
  else store.selectedStyleIds.add(id);
}

async function bulkDelete() {
  if (!confirm(`Delete ${store.selectedStyleIds.size} style(s)?`)) return;
  await store.bulkDeleteStyles([...store.selectedStyleIds]);
}

async function exportSelected() {
  await store.exportStyles([...store.selectedStyleIds]);
}

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await store.importStyle(file);
  } catch (err: any) {
    alert(err?.message ?? 'Import failed');
  } finally {
    (e.target as HTMLInputElement).value = '';
  }
}

function fmtDate(s: string) {
  return s ? new Date(s).toLocaleDateString() : '';
}

onMounted(fetch);
</script>

<style scoped>
.cms-list { }
.cms-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 0.75rem; }
.cms-list__header h1 { margin: 0; font-size: 1.25rem; color: var(--admin-heading, #2c3e50); }
.cms-list__actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cms-list__search { padding: 8px 12px; border: 1px solid var(--admin-input-border, #ddd); border-radius: 4px; font-size: 14px; width: 220px; background: var(--admin-card-bg, #fff); color: var(--admin-text, #333); }
.cms-list__search:focus { outline: none; border-color: var(--admin-focus, #3498db); }
.cms-list__bulk-bar { display: flex; align-items: center; gap: 10px; background: var(--admin-bulk-bg, #f0f4f8); border-left: 4px solid var(--admin-bulk-accent, #3498db); padding: 10px 16px; border-radius: 4px; margin-bottom: 16px; }
.cms-list__pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 20px; }
.cms-list__pagination button { padding: 8px 14px; border: 1px solid var(--admin-input-border, #ddd); border-radius: 4px; background: var(--admin-card-bg, #fff); color: var(--admin-text, #333); cursor: pointer; font-size: 14px; }
.cms-list__pagination button:disabled { opacity: 0.4; cursor: default; }
.cms-list__pagination button:not(:disabled):hover { background: var(--admin-th-bg, #f8f9fa); }

.cms-table { width: 100%; border-collapse: collapse; }
.cms-table th, .cms-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid var(--admin-border-light, #eee); font-size: 14px; color: var(--admin-text, #333); }
.cms-table th { background: var(--admin-th-bg, #f8f9fa); font-weight: 600; color: var(--admin-heading, #2c3e50); }
.cms-table__check { width: 40px; text-align: center; }
.cms-table__empty { text-align: center; color: var(--admin-muted, #666); padding: 40px; }
.cms-table__row { cursor: pointer; transition: background-color 0.15s; }
.cms-table__row:hover td { background: var(--admin-row-hover, #f8f9fa); }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { background: var(--admin-row-hover, #f8f9fa); }

.btn { padding: 8px 16px; border: 1px solid var(--admin-border, #e0e0e0); border-radius: 4px; background: var(--admin-card-bg, #fff); color: var(--admin-text, #333); cursor: pointer; font-size: 14px; }
.btn--primary { background: var(--admin-success, #27ae60); color: #fff; border-color: var(--admin-success, #27ae60); }
.btn--primary:hover { background: var(--admin-success-hover, #1e8449); }
.btn--danger { background: var(--admin-danger, #e74c3c); color: #fff; border-color: var(--admin-danger, #e74c3c); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
