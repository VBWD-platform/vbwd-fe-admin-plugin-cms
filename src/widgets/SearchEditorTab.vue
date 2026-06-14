<template>
  <div class="field-group">
    <label class="field-label">Placeholder</label>
    <input
      :value="cfg.placeholder"
      class="field-input"
      type="text"
      placeholder="Search…"
      @input="set('placeholder', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Target path</label>
    <input
      :value="cfg.target_path"
      class="field-input"
      type="text"
      placeholder="/search"
      @input="set('target_path', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Path of the page hosting the SearchResults widget. Leave blank to stay on the current page.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
