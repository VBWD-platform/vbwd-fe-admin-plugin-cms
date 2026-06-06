<template>
  <th
    class="cms-th sortable"
    :data-testid="`sort-${col}`"
    @click="$emit('sort', col)"
  >
    <slot /><span
      class="sort-ind"
      :class="{ 'sort-ind--active': active }"
    >{{ icon }}</span>
  </th>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  col: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}>();

defineEmits<{ (e: 'sort', col: string): void }>();

// Every sortable column shows an indicator: a neutral glyph when inactive and a
// directional arrow (▲/▼) when it is the active sort column — mirroring the
// "name" column on cms/widgets, applied to every column.
const active = computed(() => props.sortBy === props.col);
const icon = computed(() => (active.value ? (props.sortDir === 'asc' ? '▲' : '▼') : '⇅'));
</script>

<style scoped>
.cms-th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.cms-th.sortable:hover { background: var(--admin-row-hover, #f8f9fa); }
.sort-ind { margin-left: 4px; font-size: 0.8em; color: var(--admin-muted, #9ca3af); }
.sort-ind--active { color: var(--admin-focus, #3498db); }
</style>
