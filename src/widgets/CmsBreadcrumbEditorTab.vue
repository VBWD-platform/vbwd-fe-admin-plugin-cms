<template>
  <div
    class="meta-fields"
    style="grid-template-columns: 80px 1fr 1fr 100px 1fr"
  >
    <div class="field-group">
      <label class="field-label">Separator</label>
      <input
        :value="cfg.separator"
        class="field-input field-input--sm"
        type="text"
        maxlength="4"
        @input="set('separator', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="field-group">
      <label class="field-label">Root label</label>
      <input
        :value="cfg.root_name"
        class="field-input"
        type="text"
        @input="set('root_name', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="field-group">
      <label class="field-label">Root URL</label>
      <input
        :value="cfg.root_slug"
        class="field-input"
        type="text"
        @input="set('root_slug', ($event.target as HTMLInputElement).value)"
      >
    </div>
    <div class="field-group">
      <label class="field-label">Max length</label>
      <input
        :value="cfg.max_label_length"
        class="field-input field-input--sm"
        type="number"
        min="10"
        max="120"
        @input="set('max_label_length', Number(($event.target as HTMLInputElement).value))"
      >
    </div>
    <div class="field-group checkbox-group">
      <label class="field-label">
        <input
          :checked="!!cfg.show_category"
          type="checkbox"
          @change="set('show_category', ($event.target as HTMLInputElement).checked)"
        >
        Show category
      </label>
    </div>
  </div>

  <div
    class="meta-fields"
    style="grid-template-columns: 1fr 1fr; margin-top: 8px;"
  >
    <div class="field-group">
      <label class="field-label">Category label</label>
      <input
        :value="cfg.category_label"
        class="field-input"
        type="text"
        placeholder="e.g. Software (auto from URL if blank)"
        @input="set('category_label', ($event.target as HTMLInputElement).value)"
      >
      <p class="editor-pane__hint">
        Display name for the first URL segment.
      </p>
    </div>
    <div class="field-group">
      <label class="field-label">Category URL</label>
      <input
        :value="cfg.category_slug"
        class="field-input"
        type="text"
        placeholder="e.g. /software"
        @input="set('category_slug', ($event.target as HTMLInputElement).value)"
      >
      <p class="editor-pane__hint">
        Where the first crumb links to.
      </p>
    </div>
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
