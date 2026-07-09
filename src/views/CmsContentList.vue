<template>
  <div class="cms-view cms-content-list">
    <div class="view-header">
      <h2>{{ isPage ? $t('cms.pages') : $t('cms.posts') }}</h2>
      <div class="view-header__actions">
        <!-- Unified data-exchange controls — the only import/export path. -->
        <ImportExportControls
          v-if="showImportExport"
          :api="dataExchangeApi"
          entity-key="cms_posts"
          :selected-ids="selectedContentIds"
          :filter-state="filterParams()"
          :can-export="contentCapabilities.can_export"
          :can-import="contentCapabilities.can_import"
          :can-export-pii="contentCapabilities.can_export_pii"
          :is-superadmin="isSuperadmin"
          :supported-formats="contentCapabilities.supported_formats"
          @refresh="load"
        />
        <router-link
          v-if="canManage"
          :to="{ name: 'cms-post-new', query: { type: props.type } }"
          class="create-btn"
          data-testid="content-new"
        >
          + {{ isPage ? $t('cms.newPage') : $t('cms.newPost') }}
        </router-link>
      </div>
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
        v-model="filterStatus"
        class="filter-select"
        data-testid="filter-status"
        @change="applyFilters"
      >
        <option value="">
          {{ $t('cms.allStates') }}
        </option>
        <option
          v-for="status in POST_STATUSES"
          :key="status"
          :value="status"
        >
          {{ $t(`cms.status_${status}`) }}
        </option>
      </select>
      <select
        v-model="filterLanguage"
        class="filter-select"
        data-testid="filter-language"
        @change="applyFilters"
      >
        <option value="">
          {{ $t('cms.allLanguages', 'All languages') }}
        </option>
        <option value="en">
          English
        </option>
        <option value="de">
          Deutsch
        </option>
        <option value="ru">
          Russian
        </option>
      </select>
      <select
        v-model="filterCategory"
        class="filter-select"
        data-testid="filter-category"
        @change="applyFilters"
      >
        <option value="">
          {{ $t('cms.allCategories', 'All categories') }}
        </option>
        <option
          v-for="cat in categoryTerms"
          :key="cat.id"
          :value="cat.id"
        >
          {{ cat.name }}
        </option>
      </select>
      <select
        v-model="filterLayout"
        class="filter-select"
        data-testid="filter-layout"
        @change="applyFilters"
      >
        <option value="">
          {{ $t('cms.allLayouts', 'All layouts') }}
        </option>
        <option
          v-for="layout in (store.layouts?.items ?? [])"
          :key="layout.id"
          :value="layout.id"
        >
          {{ layout.name }}
        </option>
      </select>
      <select
        v-model="filterStyle"
        class="filter-select"
        data-testid="filter-style"
        @change="applyFilters"
      >
        <option value="">
          {{ $t('cms.allStyles', 'All styles') }}
        </option>
        <option
          v-for="style in (store.styles?.items ?? [])"
          :key="style.id"
          :value="style.id"
        >
          {{ style.name }}
        </option>
      </select>
      <input
        v-model="dateFrom"
        type="date"
        class="filter-date"
        data-testid="filter-date-from"
        :title="$t('cms.updatedFrom', 'Updated from')"
        @change="applyFilters"
      >
      <input
        v-model="dateTo"
        type="date"
        class="filter-date"
        data-testid="filter-date-to"
        :title="$t('cms.updatedTo', 'Updated to')"
        @change="applyFilters"
      >
    </div>

    <!-- Bulk actions bar — only when at least one row is selected -->
    <CmsBulkBar
      :count="bulk.selectedCount.value"
      :can-manage="canManage"
      :all-matching="bulk.allMatching.value"
      :total="store.posts?.total ?? 0"
      @delete="bulkDelete"
      @clear="bulk.clear"
    >
      <template #actions>
        <select
          v-if="canManage"
          class="bulk-select"
          data-testid="bulk-assign-category"
          @change="onBulkAssignCategory($event)"
        >
          <option value="">
            + {{ $t('cms.assignCategory', 'Assign to a category') }}…
          </option>
          <option value="__unset__">
            ⊘ {{ $t('cms.unsetCategory', 'Unset category') }}
          </option>
          <option
            v-for="cat in categoryTerms"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.name }}
          </option>
        </select>
        <select
          v-if="canManage"
          class="bulk-select"
          data-testid="bulk-assign-layout"
          @change="onBulkAssignLayout($event)"
        >
          <option value="">
            + {{ $t('cms.assignLayout', 'Assign layout') }}…
          </option>
          <option value="__unset__">
            ⊘ {{ $t('cms.unsetLayout', 'Unset layout') }}
          </option>
          <option
            v-for="layout in (store.layouts?.items ?? [])"
            :key="layout.id"
            :value="layout.id"
          >
            {{ layout.name }}
          </option>
        </select>
        <button
          v-if="canManage"
          type="button"
          class="btn"
          data-testid="bulk-publish"
          @click="bulkStatus('published')"
        >
          {{ $t('cms.publish', 'Publish') }}
        </button>
        <button
          v-if="canManage"
          type="button"
          class="btn"
          data-testid="bulk-unpublish"
          @click="bulkStatus('draft')"
        >
          {{ $t('cms.unpublish', 'Unpublish') }}
        </button>
        <button
          v-if="canManage"
          type="button"
          class="btn"
          data-testid="bulk-copy"
          @click="bulkCopy"
        >
          {{ $t('cms.makeACopy', 'Make a copy') }}
        </button>
        <button
          v-if="canManage"
          type="button"
          class="btn"
          data-testid="bulk-searchable"
          @click="bulkSearchable(true)"
        >
          {{ $t('cms.searchable', 'Searchable') }}
        </button>
        <button
          v-if="canManage"
          type="button"
          class="btn"
          data-testid="bulk-unsearchable"
          @click="bulkSearchable(false)"
        >
          {{ $t('cms.unsearchable', 'Unsearchable') }}
        </button>
      </template>
    </CmsBulkBar>

    <div
      v-if="store.error"
      class="cms-content-list__error"
    >
      {{ store.error }}
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
    >
      <div class="spinner" />
      <p>{{ $t('cms.loading') }}</p>
    </div>

    <div
      v-else-if="!store.posts?.items?.length"
      class="empty-state"
    >
      <p>{{ isPage ? $t('cms.noPages') : $t('cms.noPosts') }}</p>
      <router-link
        v-if="canManage"
        :to="{ name: 'cms-post-new' }"
        class="create-btn"
      >
        {{ isPage ? $t('cms.newPage') : $t('cms.newPost') }}
      </router-link>
    </div>

    <table
      v-else
      class="data-table"
    >
      <thead>
        <tr>
          <CmsSelectAllTh
            :all-page-selected="bulk.allPageSelected.value"
            :all-matching="bulk.allMatching.value"
            :show-scope-menu="bulk.showScopeMenu.value"
            :total="store.posts?.total ?? 0"
            @toggle="bulk.onHeaderToggle"
            @select-page="bulk.selectPage"
            @select-all="bulk.selectAllMatching"
          />
          <CmsSortableTh
            col="title"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            @sort="sort"
          >
            {{ $t('cms.name') }}
          </CmsSortableTh>
          <CmsSortableTh
            col="slug"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            @sort="sort"
          >
            {{ $t('cms.slug') }}
          </CmsSortableTh>
          <th v-if="!isPage">
            {{ $t('cms.category') }}
          </th>
          <th v-if="!isPage">
            {{ $t('cms.tags') }}
          </th>
          <CmsSortableTh
            col="language"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            @sort="sort"
          >
            {{ $t('cms.language') }}
          </CmsSortableTh>
          <CmsSortableTh
            col="status"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            @sort="sort"
          >
            {{ $t('cms.status') }}
          </CmsSortableTh>
          <CmsSortableTh
            col="updated_at"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            @sort="sort"
          >
            {{ $t('cms.updated') }}
          </CmsSortableTh>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in store.posts.items"
          :key="item.id"
          class="table-row"
          data-testid="content-row"
          @click="openEditor(item.id)"
        >
          <td
            class="select-col"
            @click.stop
          >
            <input
              type="checkbox"
              :data-testid="`row-select-${item.id}`"
              :checked="bulk.isSelected(item.id)"
              @change="bulk.toggleOne(item.id)"
            >
          </td>
          <td>{{ item.title }}</td>
          <td class="slug-cell">
            {{ item.slug }}
            <a
              v-if="item.slug"
              :href="buildPostUrl(item.slug, item.status, item.preview_token)"
              target="_blank"
              rel="noopener"
              class="slug-preview-link"
              data-testid="row-slug-link"
              :title="item.status === 'published' ? 'View page' : 'Preview (unpublished)'"
              @click.stop
            >🔗</a>
          </td>
          <td v-if="!isPage">
            {{ categoryNamesFor(item) }}
          </td>
          <td v-if="!isPage">
            {{ tagNamesFor(item) }}
          </td>
          <td>{{ item.language }}</td>
          <td>
            <span
              class="status-badge"
              :class="item.status === 'published' ? 'active' : 'inactive'"
            >
              {{ $t(`cms.status_${item.status}`) }}
            </span>
          </td>
          <td>{{ formatDate(item.updated_at) }}</td>
          <td @click.stop>
            <router-link
              :to="{ name: 'cms-post-edit', params: { id: item.id } }"
              class="action-btn"
              :data-testid="`content-edit-${item.id}`"
            >
              {{ $t('cms.edit') }}
            </router-link>
            &nbsp;
            <button
              v-if="canManage"
              class="action-btn danger"
              @click="deleteOne(item.id)"
            >
              {{ $t('cms.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div
      v-if="store.posts && store.posts.pages > 1"
      class="pagination"
    >
      <button
        :disabled="currentPage <= 1"
        @click="changePage(currentPage - 1)"
      >
        ‹
      </button>
      <span>{{ currentPage }} / {{ store.posts.pages }}</span>
      <button
        :disabled="currentPage >= store.posts.pages"
        @click="changePage(currentPage + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { useCmsContentStore, type CmsPost, type CmsTerm } from '../stores/useCmsContentStore';
import { useAuthStore } from '@/stores/auth';
import { useCmsBulkSelection } from '../composables/useCmsBulkSelection';
import CmsBulkBar from '../components/CmsBulkBar.vue';
import CmsSelectAllTh from '../components/CmsSelectAllTh.vue';
import CmsSortableTh from '../components/CmsSortableTh.vue';
import { ImportExportControls } from 'vbwd-view-component';
import { createDataExchangeApi } from '@/api/dataExchangeApi';
import { useDataExchangeManifest } from '@/composables/useDataExchangeManifest';
import { buildPostUrl } from '../utils/postUrl';

const POST_STATUSES = ['draft', 'pending', 'scheduled', 'published', 'private', 'trash'] as const;
const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const props = defineProps<{ type: 'post' | 'page' }>();

const router = useRouter();
const store = useCmsContentStore();
const authStore = useAuthStore();
const canManage = computed(() => authStore.hasPermission('cms.manage'));

const isPage = computed(() => props.type === 'page');

const search = ref('');
const filterStatus = ref('');
const filterLanguage = ref('');
const filterCategory = ref('');
const filterLayout = ref('');
const filterStyle = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const currentPage = ref(1);
const sortBy = ref('updated_at');
const sortDir = ref<'asc' | 'desc'>('desc');

// Term name lookups (posts only) — resolves term_ids → category / tag names.
const categoryTerms = ref<CmsTerm[]>([]);
const tagTerms = ref<CmsTerm[]>([]);

let searchTimer: ReturnType<typeof setTimeout>;

// Filter params shared by the list query and the "totally all" id-fetch.
function filterParams(): Record<string, unknown> {
  const params: Record<string, unknown> = { type: props.type };
  if (search.value) params.search = search.value;
  if (filterStatus.value) params.status = filterStatus.value;
  if (filterLanguage.value) params.language = filterLanguage.value;
  if (filterCategory.value) params.category = filterCategory.value;
  if (filterLayout.value) params.layout_id = filterLayout.value;
  if (filterStyle.value) params.style_id = filterStyle.value;
  if (dateFrom.value) params.date_from = dateFrom.value;
  if (dateTo.value) params.date_to = dateTo.value;
  return params;
}

// Any filter change resets to page 1 and reloads.
function applyFilters() {
  currentPage.value = 1;
  load();
}

const bulk = useCmsBulkSelection({
  pageIds: () => (store.posts?.items ?? []).map((item) => item.id),
  totalCount: () => store.posts?.total ?? 0,
  fetchAllIds: () => store.fetchAllPostIds(filterParams()),
});

// ── Unified data-exchange controls ─────────────────────────────────────────
// Posts and pages share the single `cms_posts` exchanger (one DB table); the
// per-list control derives its capabilities from the permission-filtered
// manifest and reuses the existing bulk selection for "Export selected".
const CONTENT_ENTITY_KEY = 'cms_posts';
const dataExchangeApi = createDataExchangeApi();
const isSuperadmin = computed(() => authStore.isSuperAdmin);
const { load: loadManifest, capabilitiesFor } = useDataExchangeManifest();
const contentCapabilities = computed(() => capabilitiesFor(CONTENT_ENTITY_KEY));
const showImportExport = computed(
  () => contentCapabilities.value.can_export || contentCapabilities.value.can_import,
);
const selectedContentIds = computed(() => [...bulk.selected.value]);

function load() {
  store.fetchPosts({
    ...filterParams(),
    page: currentPage.value,
    per_page: PER_PAGE,
    sort_by: sortBy.value,
    sort_dir: sortDir.value,
  });
}

function sort(col: string) {
  if (sortBy.value === col) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = col; sortDir.value = 'asc'; }
  load();
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, SEARCH_DEBOUNCE_MS);
}

function changePage(page: number) {
  currentPage.value = page;
  load();
}

function formatDate(iso?: string) {
  return iso ? iso.slice(0, 10) : '—';
}

function openEditor(id: string) {
  router.push({ name: 'cms-post-edit', params: { id } });
}

// ── Term name resolution (posts) ─────────────────────────────────────────
function namesFor(item: CmsPost, terms: CmsTerm[]): string {
  const ids = new Set(item.term_ids ?? []);
  return terms
    .filter((term) => ids.has(term.id))
    .map((term) => term.name)
    .join(', ');
}
function categoryNamesFor(item: CmsPost): string {
  return namesFor(item, categoryTerms.value);
}
function tagNamesFor(item: CmsPost): string {
  return namesFor(item, tagTerms.value);
}

// ── Bulk actions ─────────────────────────────────────────────────────────
async function bulkDelete() {
  const ids = await bulk.resolveIds();
  if (!ids.length || !confirm(`Delete ${ids.length} selected item(s)?`)) return;
  await store.bulkDeletePosts(ids);
  bulk.clear();
  load();
}

async function bulkCopy() {
  const ids = await bulk.resolveIds();
  if (!ids.length) return;
  await store.bulkCopyPosts(ids);
  bulk.clear();
  load();
}

async function bulkStatus(status: string) {
  const ids = await bulk.resolveIds();
  if (!ids.length) return;
  await store.bulkSetStatus(ids, status);
  bulk.clear();
  load();
}

async function bulkSearchable(searchable: boolean) {
  const ids = await bulk.resolveIds();
  if (!ids.length) return;
  await store.bulkSetSearchable(ids, searchable);
  bulk.clear();
  load();
}

const BULK_UNSET = '__unset__';

async function onBulkAssignCategory(event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  select.value = '';
  if (!value) return;
  const ids = await bulk.resolveIds();
  if (!ids.length) return;
  if (value === BULK_UNSET) {
    await store.bulkUnassignCategory(ids);
  } else {
    await store.bulkAssignTerm(ids, value);
  }
  bulk.clear();
  load();
}

async function onBulkAssignLayout(event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  select.value = '';
  if (!value) return;
  const ids = await bulk.resolveIds();
  if (!ids.length) return;
  await store.bulkAssignLayout(ids, value === BULK_UNSET ? null : value);
  bulk.clear();
  load();
}

async function deleteOne(id: string) {
  if (!confirm('Delete this item?')) return;
  await api.delete(`/admin/cms/posts/${id}`);
  load();
}

onMounted(async () => {
  // Categories feed both the "Assign to a category" bulk action and the
  // category filter; layouts + styles feed their filter dropdowns.
  await store.fetchTerms('category');
  categoryTerms.value = [...store.terms];
  if (!isPage.value) {
    await store.fetchTerms('tag');
    tagTerms.value = [...store.terms];
  }
  store.fetchLayouts({ per_page: 100 });
  store.fetchStyles({ per_page: 100 });
  void loadManifest();
  load();
});

defineExpose({
  bulkDelete, bulkCopy, bulkStatus, bulkSearchable,
  onBulkAssignCategory, onBulkAssignLayout, sort, load, bulk,
});
</script>

<style scoped>
.cms-content-list {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

/* Bulk-bar slotted controls (slotted content is styled in this parent scope). */
.btn {
  padding: 8px 16px; border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 4px; background: var(--admin-card-bg, #fff);
  color: var(--admin-text, #333); cursor: pointer; font-size: 14px; white-space: nowrap;
}
.btn:hover { background: var(--admin-row-hover, #f8f9fa); }
.bulk-select {
  padding: 8px 10px; border: 1px solid var(--admin-input-border, #ddd);
  border-radius: 4px; font-size: 13px; background: var(--admin-card-bg, #fff); color: var(--admin-text, #333);
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.view-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.view-header h2 {
  margin: 0;
  color: #2c3e50;
}

.cms-content-list__error {
  background: #fee2e2;
  color: #991b1b;
  padding: 0.6rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
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
.filter-date {
  padding: 9px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}
.view-filters { flex-wrap: wrap; gap: 8px; }

.bulk-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 16px;
  padding: 10px 15px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  font-size: 14px;
  color: #3730a3;
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

.select-col {
  width: 36px;
  text-align: center;
}

.table-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: #f8f9fa;
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
