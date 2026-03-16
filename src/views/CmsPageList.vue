<template>
  <div class="cms-view cms-pages-view">
    <div class="view-header">
      <h2>{{ $t('cms.pages') }}</h2>
      <router-link
        :to="{ name: 'cms-page-new' }"
        class="create-btn"
      >
        + {{ $t('cms.newPage') }}
      </router-link>
    </div>

    <!-- Filters -->
    <div class="view-filters">
      <input
        v-model="search"
        type="text"
        class="search-input"
        :placeholder="$t('cms.search')"
        @input="onSearch"
      >
      <select
        v-model="filterCategory"
        class="filter-select"
        @change="load"
      >
        <option value="">
          {{ $t('cms.allCategories') }}
        </option>
        <option
          v-for="cat in store.categories"
          :key="cat.id"
          :value="cat.id"
        >
          {{ cat.name }}
        </option>
      </select>
      <select
        v-model="filterPublished"
        class="filter-select"
        @change="load"
      >
        <option value="">
          {{ $t('cms.allStates') }}
        </option>
        <option value="true">
          {{ $t('cms.published') }}
        </option>
        <option value="false">
          {{ $t('cms.draft') }}
        </option>
      </select>
      <select
        v-model="filterLanguage"
        class="filter-select"
        @change="load"
      >
        <option value="">
          {{ $t('cms.allLanguages') }}
        </option>
        <option value="en">
          EN
        </option>
        <option value="de">
          DE
        </option>
        <option value="fr">
          FR
        </option>
        <option value="es">
          ES
        </option>
        <option value="ru">
          RU
        </option>
        <option value="zh">
          ZH
        </option>
        <option value="ja">
          JA
        </option>
        <option value="th">
          TH
        </option>
      </select>
    </div>

    <!-- Bulk toolbar -->
    <div
      v-if="store.selectedPageIds.size"
      class="bulk-actions"
    >
      <span class="selection-info">{{ $t('common.selected', { count: store.selectedPageIds.size }) }}</span>
      <button
        class="bulk-btn activate"
        @click="bulkAction('publish')"
      >
        {{ $t('cms.bulkPublish') }}
      </button>
      <button
        class="bulk-btn deactivate"
        @click="bulkAction('unpublish')"
      >
        {{ $t('cms.bulkUnpublish') }}
      </button>
      <button
        class="bulk-btn delete"
        @click="bulkAction('delete')"
      >
        {{ $t('cms.bulkDelete') }}
      </button>
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
    >
      <div class="spinner" />
      <p>{{ $t('cms.loading') }}</p>
    </div>

    <div
      v-else-if="!store.pages?.items?.length"
      class="empty-state"
    >
      <p>{{ $t('cms.noPages') }}</p>
      <router-link
        :to="{ name: 'cms-page-new' }"
        class="create-btn"
      >
        {{ $t('cms.newPage') }}
      </router-link>
    </div>

    <table
      v-else
      class="data-table"
    >
      <thead>
        <tr>
          <th class="checkbox-col">
            <input
              type="checkbox"
              :checked="allChecked"
              @change="toggleAll"
            >
          </th>
          <th
            class="sortable"
            @click="sortBy('name')"
          >
            {{ $t('cms.name') }} <span class="sort-indicator">{{ sortIndicator('name') }}</span>
          </th>
          <th
            class="sortable"
            @click="sortBy('slug')"
          >
            {{ $t('cms.slug') }} <span class="sort-indicator">{{ sortIndicator('slug') }}</span>
          </th>
          <th>{{ $t('cms.language') }}</th>
          <th>{{ $t('cms.category') }}</th>
          <th
            class="sortable"
            @click="sortBy('is_published')"
          >
            {{ $t('cms.published') }} <span class="sort-indicator">{{ sortIndicator('is_published') }}</span>
          </th>
          <th
            class="sortable"
            @click="sortBy('updated_at')"
          >
            {{ $t('cms.updated') }} <span class="sort-indicator">{{ sortIndicator('updated_at') }}</span>
          </th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="page in store.pages.items"
          :key="page.id"
          class="table-row"
          @click="$router.push({ name: 'cms-page-edit', params: { id: page.id } })"
        >
          <td
            class="checkbox-col"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="store.selectedPageIds.has(page.id)"
              @change="togglePage(page.id)"
            >
          </td>
          <td>{{ page.name }}</td>
          <td class="slug-cell">
            {{ page.slug }}
          </td>
          <td>{{ page.language }}</td>
          <td>{{ categoryName(page.category_id) }}</td>
          <td>
            <span :class="['status-badge', page.is_published ? 'active' : 'inactive']">
              {{ page.is_published ? $t('cms.published') : $t('cms.draft') }}
            </span>
          </td>
          <td>{{ formatDate(page.updated_at) }}</td>
          <td @click.stop>
            <router-link
              :to="{ name: 'cms-page-edit', params: { id: page.id } }"
              class="action-btn"
            >
              {{ $t('cms.edit') }}
            </router-link>
            &nbsp;
            <button
              class="action-btn danger"
              @click="deletePage(page.id)"
            >
              {{ $t('cms.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div
      v-if="store.pages && store.pages.pages > 1"
      class="pagination"
    >
      <button
        :disabled="currentPage <= 1"
        @click="changePage(currentPage - 1)"
      >
        ‹
      </button>
      <span>{{ currentPage }} / {{ store.pages.pages }}</span>
      <button
        :disabled="currentPage >= store.pages.pages"
        @click="changePage(currentPage + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();
const search = ref('');
const filterCategory = ref('');
const filterPublished = ref('');
const filterLanguage = ref('');
const currentPage = ref(1);
const currentSort = ref('updated_at');
const currentDir = ref<'asc' | 'desc'>('desc');

let searchTimer: ReturnType<typeof setTimeout>;

function load() {
  const params: Record<string, unknown> = {
    page: currentPage.value,
    per_page: 20,
    sort_by: currentSort.value,
    sort_dir: currentDir.value,
  };
  if (search.value) params.search = search.value;
  if (filterCategory.value) params.category_id = filterCategory.value;
  if (filterPublished.value !== '') params.is_published = filterPublished.value;
  if (filterLanguage.value) params.language = filterLanguage.value;
  store.fetchPages(params);
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
}

function sortBy(col: string) {
  if (currentSort.value === col) {
    currentDir.value = currentDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.value = col;
    currentDir.value = 'desc';
  }
  load();
}

function sortIndicator(col: string) {
  if (currentSort.value !== col) return '';
  return currentDir.value === 'asc' ? '▲' : '▼';
}

function changePage(n: number) {
  currentPage.value = n;
  load();
}

const allChecked = computed(() => {
  const items = store.pages?.items ?? [];
  return items.length > 0 && items.every(p => store.selectedPageIds.has(p.id));
});

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  store.pages?.items.forEach(p => {
    if (checked) store.selectedPageIds.add(p.id);
    else store.selectedPageIds.delete(p.id);
  });
}

function togglePage(id: string) {
  if (store.selectedPageIds.has(id)) store.selectedPageIds.delete(id);
  else store.selectedPageIds.add(id);
}

function categoryName(id: string | null) {
  if (!id) return '—';
  return store.categories.find(c => c.id === id)?.name ?? '—';
}

function formatDate(iso: string) {
  return iso ? iso.slice(0, 10) : '—';
}

async function deletePage(id: string) {
  if (!confirm('Delete this page?')) return;
  await store.deletePage(id);
}

async function bulkAction(action: string) {
  if (!confirm(`${action} ${store.selectedPageIds.size} page(s)?`)) return;
  await store.bulkAction([...store.selectedPageIds], action);
}

onMounted(() => {
  store.fetchCategories();
  load();
});
</script>

<style scoped>
.cms-pages-view {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.view-header h2 {
  margin: 0;
  color: #2c3e50;
}

.create-btn {
  display: inline-block;
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.create-btn:hover {
  background: #1e8449;
}

.view-filters {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  max-width: 300px;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
}

.filter-select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.bulk-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 15px;
  margin-bottom: 20px;
  background: #f0f4f8;
  border-left: 4px solid #3498db;
  border-radius: 4px;
}

.selection-info {
  flex: 1;
  font-weight: 500;
  color: #2c3e50;
}

.bulk-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.bulk-btn.activate {
  background: #d4edda;
  color: #155724;
}

.bulk-btn.deactivate {
  background: #fff3cd;
  color: #856404;
}

.bulk-btn.delete {
  background: #f8d7da;
  color: #721c24;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  white-space: nowrap;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 4px;
  font-size: 0.75rem;
  color: #3498db;
}

.table-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: #f8f9fa;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.slug-cell {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  background: #e9ecef;
  color: #2c3e50;
  text-decoration: none;
  display: inline-block;
}

.action-btn:hover {
  background: #dee2e6;
}

.action-btn.danger {
  background: none;
  color: #dc2626;
  text-decoration: underline;
  padding: 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
}

.pagination button {
  padding: 8px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}

.pagination button:not(:disabled):hover {
  background: #f8f9fa;
}
</style>
