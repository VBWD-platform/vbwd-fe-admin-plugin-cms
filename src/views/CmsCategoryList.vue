<template>
  <div class="cms-view cms-categories-view">
    <div class="view-header">
      <h2>{{ $t('cms.categories') }}</h2>
      <button
        class="create-btn"
        @click="openCreate"
      >
        + {{ $t('cms.addCategory') }}
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
      v-else-if="!store.categories.length"
      class="empty-state"
    >
      <p>{{ $t('cms.noCategories') }}</p>
      <button
        class="create-btn"
        @click="openCreate"
      >
        {{ $t('cms.addCategory') }}
      </button>
    </div>

    <table
      v-else
      class="data-table"
    >
      <thead>
        <tr>
          <th>{{ $t('cms.name') }}</th>
          <th>{{ $t('cms.slug') }}</th>
          <th>{{ $t('cms.parentCategory') }}</th>
          <th>{{ $t('cms.sortOrder') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cat in store.categories"
          :key="cat.id"
          class="table-row"
        >
          <td>{{ cat.name }}</td>
          <td class="slug-cell">
            {{ cat.slug }}
          </td>
          <td>{{ parentName(cat.parent_id) }}</td>
          <td>{{ cat.sort_order }}</td>
          <td>
            <button
              class="action-btn"
              @click="openEdit(cat)"
            >
              {{ $t('cms.edit') }}
            </button>
            &nbsp;
            <button
              class="action-btn danger"
              @click="remove(cat.id)"
            >
              {{ $t('cms.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Inline create/edit form -->
    <div
      v-if="formOpen"
      class="inline-form"
    >
      <h3 class="inline-form__title">
        {{ editing ? $t('cms.edit') + ' ' + $t('cms.category') : $t('cms.addCategory') }}
      </h3>
      <div class="field-group">
        <label class="field-label">{{ $t('cms.name') }} *</label>
        <input
          v-model="form.name"
          class="field-input"
          type="text"
          @blur="autoSlug"
        >
      </div>
      <div class="field-group">
        <label class="field-label">{{ $t('cms.slug') }}</label>
        <input
          v-model="form.slug"
          class="field-input field-input--mono"
          type="text"
        >
      </div>
      <div class="field-group">
        <label class="field-label">{{ $t('cms.parentCategory') }}</label>
        <select
          v-model="form.parent_id"
          class="field-input"
        >
          <option value="">
            {{ $t('cms.noParent') }}
          </option>
          <option
            v-for="cat in eligibleParents"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.name }}
          </option>
        </select>
      </div>
      <div class="field-group">
        <label class="field-label">{{ $t('cms.sortOrder') }}</label>
        <input
          v-model.number="form.sort_order"
          class="field-input field-input--sm"
          type="number"
          min="0"
        >
      </div>
      <div
        v-if="store.error"
        class="error-msg"
      >
        {{ store.error }}
      </div>
      <div class="inline-form__actions">
        <button
          class="create-btn"
          :disabled="store.loading"
          @click="submit"
        >
          {{ $t('cms.saveCategory') }}
        </button>
        <button
          class="cancel-btn"
          @click="closeForm"
        >
          {{ $t('cms.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import type { CmsCategory } from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();

const formOpen = ref(false);
const editing = ref<CmsCategory | null>(null);

interface CatForm {
  name: string;
  slug: string;
  parent_id: string;
  sort_order: number;
}

const form = ref<CatForm>({ name: '', slug: '', parent_id: '', sort_order: 0 });

const eligibleParents = computed(() => {
  if (!editing.value) return store.categories;
  return store.categories.filter(c => c.id !== editing.value!.id);
});

function parentName(id: string | null) {
  if (!id) return '—';
  return store.categories.find(c => c.id === id)?.name ?? '—';
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function autoSlug() {
  if (!form.value.slug) form.value.slug = slugify(form.value.name);
}

function openCreate() {
  editing.value = null;
  form.value = { name: '', slug: '', parent_id: '', sort_order: 0 };
  formOpen.value = true;
}

function openEdit(cat: CmsCategory) {
  editing.value = cat;
  form.value = {
    name: cat.name,
    slug: cat.slug,
    parent_id: cat.parent_id ?? '',
    sort_order: cat.sort_order,
  };
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  editing.value = null;
}

async function submit() {
  const payload: Partial<CmsCategory> = {
    ...form.value,
    parent_id: form.value.parent_id || null,
  };
  if (editing.value) payload.id = editing.value.id;
  await store.saveCategory(payload);
  if (!store.error) closeForm();
}

async function remove(id: string) {
  if (!confirm('Delete this category? Pages in this category will become uncategorized.')) return;
  await store.deleteCategory(id);
}

onMounted(() => store.fetchCategories());
</script>

<style scoped>
.cms-categories-view {
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
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.create-btn:hover {
  background: #1e8449;
}

.create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 10px 20px;
  background: #e9ecef;
  color: #2c3e50;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #dee2e6;
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

.table-row:hover {
  background-color: #f8f9fa;
}

.slug-cell {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  background: #e9ecef;
  color: #2c3e50;
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

/* Inline form */
.inline-form {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  max-width: 560px;
}

.inline-form__title {
  margin: 0 0 16px;
  font-size: 1rem;
  color: #2c3e50;
}

.inline-form__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.field-group {
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 5px;
}

.field-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.field-input:focus {
  outline: none;
  border-color: #3498db;
}

.field-input--mono {
  font-family: monospace;
}

.field-input--sm {
  width: 120px;
}

.error-msg {
  margin-top: 8px;
  color: #dc2626;
  font-size: 0.875rem;
}
</style>
