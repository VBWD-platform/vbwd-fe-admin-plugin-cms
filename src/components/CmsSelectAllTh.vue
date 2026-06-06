<template>
  <th class="cms-table__check select-all">
    <input
      type="checkbox"
      :checked="allPageSelected || allMatching"
      data-testid="select-all"
      @click.prevent="$emit('toggle')"
    >
    <div
      v-if="showScopeMenu"
      class="scope-menu"
      data-testid="scope-menu"
    >
      <button
        type="button"
        class="scope-menu__item"
        data-testid="scope-page"
        @click="$emit('select-page')"
      >
        {{ $t('cms.selectAllOnPage', 'All on this page') }}
      </button>
      <button
        type="button"
        class="scope-menu__item"
        data-testid="scope-all"
        @click="$emit('select-all')"
      >
        {{ $t('cms.selectAllEntries', 'Totally all') }} {{ total }} {{ $t('cms.entries', 'entries') }}
      </button>
    </div>
  </th>
</template>

<script setup lang="ts">
defineProps<{
  allPageSelected: boolean;
  allMatching: boolean;
  showScopeMenu: boolean;
  total: number;
}>();

defineEmits<{
  (e: 'toggle'): void;
  (e: 'select-page'): void;
  (e: 'select-all'): void;
}>();
</script>

<style scoped>
.select-all { position: relative; width: 40px; text-align: center; }
.scope-menu {
  position: absolute; top: 100%; left: 0; z-index: 30;
  background: var(--admin-card-bg, #fff); border: 1px solid var(--admin-border, #e0e0e0);
  border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.12); min-width: 180px; overflow: hidden;
}
.scope-menu__item {
  display: block; width: 100%; text-align: left; padding: 8px 14px;
  background: none; border: none; cursor: pointer; font-size: 13px; color: var(--admin-text, #333); white-space: nowrap;
}
.scope-menu__item:hover { background: var(--admin-row-hover, #f8f9fa); }
</style>
