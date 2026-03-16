<template>
  <div
    class="picker-overlay"
    @click.self="$emit('close')"
  >
    <div class="picker">
      <div class="picker__header">
        <h3>{{ $t('cms.selectImage') }}</h3>
        <button
          class="close-btn"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Upload + search -->
      <div class="picker__toolbar">
        <input
          v-model="search"
          type="text"
          class="search-input"
          :placeholder="$t('cms.search')"
          @input="onSearch"
        >
        <label class="upload-btn">
          {{ $t('cms.upload') }}
          <input
            type="file"
            accept="image/*"
            @change="onUpload"
          >
        </label>
      </div>

      <div
        v-if="store.loading"
        class="picker__loading"
      >
        {{ $t('cms.loading') }}
      </div>

      <div
        v-else
        class="picker__grid"
      >
        <div
          v-if="!store.images?.items?.length"
          class="picker__empty"
        >
          {{ $t('cms.noImages') }}
        </div>
        <div
          v-for="img in store.images?.items"
          :key="img.id"
          :class="['picker__item', { selected: selectedId === img.id }]"
          @click="select(img)"
        >
          <img
            :src="img.url_path"
            :alt="img.alt_text ?? ''"
            class="picker__thumb"
          >
          <div class="picker__label">
            {{ img.slug }}
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="store.images && store.images.pages > 1"
        class="picker__pagination"
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

      <div class="picker__footer">
        <button
          class="btn btn--primary"
          :disabled="!selectedId"
          @click="confirm"
        >
          {{ $t('cms.insertImage') }}
        </button>
        <button
          class="btn"
          @click="$emit('close')"
        >
          {{ $t('cms.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import type { CmsImage } from '../stores/useCmsAdminStore';

const emit = defineEmits<{
  (e: 'select', url: string, alt: string): void;
  (e: 'close'): void;
}>();

const store = useCmsAdminStore();
const search = ref('');
const currentPage = ref(1);
const selectedId = ref<string | null>(null);
const selectedImg = ref<CmsImage | null>(null);
let searchTimer: ReturnType<typeof setTimeout>;

function load() {
  const params: Record<string, unknown> = { page: currentPage.value, per_page: 24 };
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

function select(img: CmsImage) {
  selectedId.value = img.id;
  selectedImg.value = img;
}

async function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const uploaded = await store.uploadImage(file);
  select(uploaded);
  (e.target as HTMLInputElement).value = '';
}

function confirm() {
  if (!selectedImg.value) return;
  emit('select', selectedImg.value.url_path, selectedImg.value.alt_text ?? '');
}

onMounted(load);
</script>

<style scoped>
.picker-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 2000;
}
.picker {
  background: #fff; border-radius: 8px;
  width: 720px; max-width: 95vw; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.picker__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.25rem; border-bottom: 1px solid #e5e7eb;
}
.picker__header h3 { margin: 0; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #6b7280; }
.picker__toolbar {
  display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #e5e7eb; align-items: center;
}
.search-input { flex: 1; padding: 0.4rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; }
.upload-btn {
  padding: 0.4rem 0.9rem; background: #f3f4f6; border: 1px solid #d1d5db;
  border-radius: 4px; cursor: pointer; font-size: 0.85rem; white-space: nowrap;
}
.upload-btn input[type="file"] { display: none; }

.picker__loading, .picker__empty { padding: 2rem; text-align: center; color: #999; }

.picker__grid {
  flex: 1; overflow-y: auto; padding: 1rem 1.25rem;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.75rem;
}
.picker__item {
  border: 2px solid #e5e7eb; border-radius: 6px; overflow: hidden;
  cursor: pointer; transition: border-color 0.15s;
}
.picker__item:hover { border-color: #93c5fd; }
.picker__item.selected { border-color: #3b82f6; }
.picker__thumb { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.picker__label { font-size: 0.72rem; font-family: monospace; padding: 3px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: #f9fafb; }

.picker__pagination {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 1.25rem; border-top: 1px solid #e5e7eb;
}
.picker__pagination button { padding: 0.25rem 0.6rem; cursor: pointer; }
.picker__pagination button:disabled { opacity: 0.4; cursor: default; }

.picker__footer {
  display: flex; gap: 0.5rem; padding: 0.875rem 1.25rem;
  border-top: 1px solid #e5e7eb; background: #f9fafb;
}
.btn { padding: 0.4rem 0.9rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
