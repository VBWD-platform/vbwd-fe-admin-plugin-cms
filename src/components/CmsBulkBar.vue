<template>
  <div
    v-if="count > 0"
    class="cms-list__bulk-bar"
    data-testid="bulk-bar"
  >
    <span class="cms-list__bulk-count">{{ label }}</span>

    <!-- Entity-specific actions (e.g. assign category / publish / searchable). -->
    <slot name="actions" />

    <button
      class="btn"
      data-testid="bulk-export"
      @click="$emit('export')"
    >
      {{ $t('cms.exportSelected', 'Export selected') }}
    </button>
    <button
      v-if="canManage"
      class="btn btn--danger"
      data-testid="bulk-delete"
      @click="$emit('delete')"
    >
      {{ $t('cms.deleteSelected', 'Delete selected') }}
    </button>
    <button
      class="btn btn--ghost"
      data-testid="bulk-clear"
      @click="$emit('clear')"
    >
      {{ $t('cms.clear', 'Clear') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  count: number;
  canManage?: boolean;
  allMatching?: boolean;
  total?: number;
}>();

defineEmits<{
  (e: 'export'): void;
  (e: 'delete'): void;
  (e: 'clear'): void;
}>();

const label = computed(() =>
  props.allMatching
    ? `All ${props.total ?? props.count} entries selected`
    : `${props.count} selected`,
);
</script>

<style scoped>
.cms-list__bulk-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--admin-bulk-bg, #f0f4f8);
  border-left: 4px solid var(--admin-bulk-accent, #3498db);
  padding: 10px 16px; border-radius: 4px; margin-bottom: 16px;
}
.cms-list__bulk-count { font-weight: 600; color: var(--admin-text, #333); }
.btn {
  padding: 8px 16px; border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 4px; background: var(--admin-card-bg, #fff);
  color: var(--admin-text, #333); cursor: pointer; font-size: 14px; white-space: nowrap;
}
.btn--danger { background: var(--admin-danger, #e74c3c); color: #fff; border-color: var(--admin-danger, #e74c3c); }
.btn--ghost { background: transparent; border-color: transparent; color: var(--admin-muted, #6b7280); }
.btn--ghost:hover { text-decoration: underline; }
</style>
