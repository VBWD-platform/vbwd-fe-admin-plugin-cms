<template>
  <div class="cms-view cms-images-view">
    <div class="view-header">
      <h2>{{ $t('cms.images') }}</h2>
      <div class="view-header__actions">
        <button
          v-if="store.selectedImageIds.size"
          class="bulk-delete-btn"
          @click="bulkDelete"
        >
          {{ $t('cms.bulkDelete') }} ({{ store.selectedImageIds.size }})
        </button>
        <label class="create-btn">
          + {{ $t('cms.upload') }}
          <input
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            @change="onUpload"
          >
        </label>
      </div>
    </div>

    <div class="view-filters">
      <input
        v-model="search"
        type="text"
        class="search-input"
        :placeholder="$t('cms.search')"
        @input="onSearch"
      >
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
    >
      <div class="spinner" />
      <p>{{ $t('cms.loading') }}</p>
    </div>

    <div v-else>
      <div
        v-if="!store.images?.items?.length"
        class="empty-state"
      >
        <p>{{ $t('cms.noImages') }}</p>
        <label class="create-btn">
          {{ $t('cms.upload') }}
          <input
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            @change="onUpload"
          >
        </label>
      </div>

      <div
        v-else
        class="img-grid"
      >
        <div
          v-for="img in store.images.items"
          :key="img.id"
          :class="['img-card', { selected: store.selectedImageIds.has(img.id) }]"
          @click="toggleSelect(img.id)"
        >
          <img
            :src="img.url_path"
            :alt="img.alt_text ?? ''"
            class="img-card__thumb"
          >
          <div class="img-card__info">
            <div class="img-card__slug">
              {{ img.slug }}
            </div>
            <div class="img-card__meta">
              <span v-if="img.width_px">{{ img.width_px }}×{{ img.height_px }}</span>
              <span v-if="img.file_size_bytes">{{ formatSize(img.file_size_bytes) }}</span>
            </div>
          </div>
          <div
            class="img-card__actions"
            @click.stop
          >
            <button
              class="icon-btn"
              :title="$t('cms.edit')"
              @click="openEdit(img)"
            >
              ✏
            </button>
            <button
              class="icon-btn danger"
              :title="$t('cms.delete')"
              @click="remove(img.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="store.images && store.images.pages > 1"
        class="pagination"
      >
        <button
          :disabled="currentPage <= 1"
          @click="changePage(currentPage - 1)"
        >
          ‹
        </button>
        <span>{{ currentPage }} / {{ store.images.pages }}</span>
        <button
          :disabled="currentPage >= store.images.pages"
          @click="changePage(currentPage + 1)"
        >
          ›
        </button>
      </div>
    </div>

    <!-- Edit modal -->
    <div
      v-if="editTarget"
      class="modal-overlay"
      @click.self="editTarget = null"
    >
      <div class="modal">
        <h3>{{ $t('cms.editImage') }}</h3>
        <img
          :src="editTarget.url_path"
          class="modal__preview"
          :alt="editTarget.alt_text ?? ''"
        >
        <div class="field-group">
          <label class="field-label">{{ $t('cms.caption') }}</label>
          <input
            v-model="editForm.caption"
            class="field-input"
            type="text"
          >
        </div>
        <div class="field-group">
          <label class="field-label">{{ $t('cms.altText') }}</label>
          <input
            v-model="editForm.alt_text"
            class="field-input"
            type="text"
          >
        </div>
        <hr class="divider">
        <div class="field-group">
          <label class="field-label">{{ $t('cms.resize') }}</label>
          <div class="resize-row">
            <input
              v-model.number="resizeW"
              class="field-input field-input--sm"
              type="number"
              placeholder="W"
            >
            <span>×</span>
            <input
              v-model.number="resizeH"
              class="field-input field-input--sm"
              type="number"
              placeholder="H"
            >
            <button
              class="action-btn"
              :disabled="store.loading"
              @click="resize"
            >
              {{ $t('cms.resize') }}
            </button>
          </div>
        </div>
        <div class="modal__actions">
          <button
            class="create-btn"
            :disabled="store.loading"
            @click="saveEdit"
          >
            {{ $t('common.save') }}
          </button>
          <button
            class="cancel-btn"
            @click="editTarget = null"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import type { CmsImage } from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();
const search = ref('');
const currentPage = ref(1);
let searchTimer: ReturnType<typeof setTimeout>;

const editTarget = ref<CmsImage | null>(null);
const editForm = ref({ caption: '', alt_text: '' });
const resizeW = ref<number | null>(null);
const resizeH = ref<number | null>(null);

function load() {
  const params: Record<string, unknown> = { page: currentPage.value, per_page: 30 };
  if (search.value) params.search = search.value;
  store.fetchImages(params);
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentPage.value = 1; load(); }, 300);
}

function changePage(n: number) {
  currentPage.value = n;
  load();
}

function toggleSelect(id: string) {
  if (store.selectedImageIds.has(id)) store.selectedImageIds.delete(id);
  else store.selectedImageIds.add(id);
}

async function onUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  for (const file of Array.from(files)) {
    await store.uploadImage(file);
  }
  (e.target as HTMLInputElement).value = '';
  load();
}

async function bulkDelete() {
  if (!confirm(`Delete ${store.selectedImageIds.size} image(s)?`)) return;
  await store.bulkDeleteImages([...store.selectedImageIds]);
}

async function remove(id: string) {
  if (!confirm('Delete this image?')) return;
  await store.deleteImage(id);
}

function openEdit(img: CmsImage) {
  editTarget.value = img;
  editForm.value = { caption: img.caption ?? '', alt_text: img.alt_text ?? '' };
  resizeW.value = null;
  resizeH.value = null;
}

async function saveEdit() {
  if (!editTarget.value) return;
  await store.updateImage(editTarget.value.id, editForm.value);
  editTarget.value = null;
}

async function resize() {
  if (!editTarget.value || !resizeW.value || !resizeH.value) return;
  const result = await store.resizeImage(editTarget.value.id, resizeW.value, resizeH.value);
  editTarget.value = result;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

onMounted(load);
</script>

<style scoped>
.cms-images-view {
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

.view-header__actions {
  display: flex;
  gap: 10px;
  align-items: center;
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
}

.create-btn:hover {
  background: #1e8449;
}

.bulk-delete-btn {
  padding: 10px 16px;
  background: #f8d7da;
  color: #721c24;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.bulk-delete-btn:hover {
  background: #f5c6cb;
}

.view-filters {
  margin-bottom: 20px;
}

.search-input {
  width: 300px;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
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

/* Image grid */
.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.img-card {
  border: 2px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.img-card:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.2);
}

.img-card.selected {
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.3);
}

.img-card__thumb {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
}

.img-card__info {
  padding: 8px 10px;
  background: white;
}

.img-card__slug {
  font-size: 0.78rem;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #666;
}

.img-card__meta {
  font-size: 0.72rem;
  color: #999;
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.img-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  gap: 4px;
}

.img-card:hover .img-card__actions {
  display: flex;
}

.icon-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  font-size: 0.8rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.icon-btn.danger {
  color: #dc2626;
}

/* Pagination */
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

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 480px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h3 {
  margin: 0 0 16px;
  color: #2c3e50;
}

.modal__preview {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 16px;
}

.modal__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.divider {
  border: none;
  border-top: 1px solid #eee;
  margin: 16px 0;
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

.field-input--sm {
  width: 90px;
}

.resize-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #e9ecef;
  color: #2c3e50;
  cursor: pointer;
  font-size: 14px;
}

.action-btn:disabled {
  opacity: 0.5;
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
</style>
