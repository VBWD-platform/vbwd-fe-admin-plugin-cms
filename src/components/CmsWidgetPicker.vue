<template>
  <div
    class="picker-overlay"
    @click.self="$emit('close')"
  >
    <div class="picker-modal">
      <div class="picker-modal__header">
        <h3>Select Widget</h3>
        <button
          type="button"
          class="picker-close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
      <div class="picker-modal__search">
        <input
          v-model="query"
          type="search"
          placeholder="Search widgets…"
          class="picker-search"
          @input="fetchDebounced"
        >
        <select
          v-model="typeFilter"
          class="picker-filter"
          @change="fetch"
        >
          <option value="">
            All types
          </option>
          <option value="html">
            HTML
          </option>
          <option value="menu">
            Menu
          </option>
          <option value="slideshow">
            Slideshow
          </option>
          <option value="vue-component">
            Vue Component
          </option>
        </select>
      </div>
      <div class="picker-modal__list">
        <div
          v-if="!items.length"
          class="picker-empty"
        >
          No widgets found.
        </div>
        <button
          v-for="w in items"
          :key="w.id"
          type="button"
          class="picker-item"
          @click="$emit('select', w)"
        >
          <span class="picker-item__name">{{ w.name }}</span>
          <span class="picker-item__meta">
            <span class="type-badge">{{ w.widget_type }}</span>
            {{ w.slug }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import type { CmsWidget } from '../stores/useCmsAdminStore';

defineEmits<{
  (e: 'select', widget: CmsWidget): void;
  (e: 'close'): void;
}>();

const store = useCmsAdminStore();
const query = ref('');
const typeFilter = ref('');
const items = computed(() => store.widgets?.items ?? []);

let debounceTimer: ReturnType<typeof setTimeout>;
function fetchDebounced() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetch, 250);
}

function fetch() {
  const params: Record<string, unknown> = { page: 1, per_page: 50, query: query.value };
  if (typeFilter.value) params.widget_type = typeFilter.value;
  store.fetchWidgets(params);
}

onMounted(fetch);
</script>

<style scoped>
.picker-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.picker-modal {
  background: #fff; border-radius: 8px; width: 520px; max-width: 95vw;
  max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.picker-modal__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.25rem; border-bottom: 1px solid #e5e7eb;
}
.picker-modal__header h3 { margin: 0; font-size: 1rem; }
.picker-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #6b7280; line-height: 1; }
.picker-modal__search { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid #e5e7eb; }
.picker-search { flex: 1; padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; }
.picker-filter { padding: 0.4rem 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; }
.picker-modal__list { overflow-y: auto; flex: 1; padding: 0.5rem; }
.picker-empty { text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem; }
.picker-item {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 0.75rem; border: 1px solid transparent; border-radius: 4px;
  background: transparent; cursor: pointer; text-align: left; gap: 0.75rem;
}
.picker-item:hover { background: #f0f9ff; border-color: #bae6fd; }
.picker-item__name { font-size: 0.9rem; font-weight: 500; }
.picker-item__meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #6b7280; }
.type-badge { font-size: 0.7rem; padding: 1px 6px; border-radius: 10px; background: #e0e7ff; color: #3730a3; font-weight: 600; text-transform: uppercase; }
</style>
