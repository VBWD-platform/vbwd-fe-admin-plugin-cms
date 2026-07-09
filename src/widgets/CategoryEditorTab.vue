<template>
  <div class="field-group">
    <label class="field-label">Type</label>
    <input
      :value="cfg.type"
      class="field-input"
      type="text"
      placeholder="post"
      @input="set('type', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Term type</label>
    <input
      :value="cfg.term_type"
      class="field-input"
      type="text"
      placeholder="category"
      @input="set('term_type', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Term slug *</label>
    <input
      :value="cfg.term_slug"
      class="field-input"
      type="text"
      placeholder="news"
      @input="set('term_slug', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Required — the widget lists nothing until a term slug is set.
    </p>
  </div>

  <div class="field-group">
    <label class="field-label">Mode</label>
    <select
      :value="cfg.mode"
      class="field-input"
      @change="set('mode', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="modeOption in POST_LIST_MODE_OPTIONS"
        :key="modeOption"
        :value="modeOption"
      >
        {{ modeOption }}
      </option>
    </select>
  </div>

  <div class="field-group">
    <label class="field-label">Meta fields</label>
    <div class="checkbox-group">
      <label
        v-for="metaOption in POST_META_FIELD_OPTIONS"
        :key="metaOption"
        class="field-label"
      >
        <input
          :checked="selectedMeta.includes(metaOption)"
          type="checkbox"
          @change="toggleMeta(metaOption, ($event.target as HTMLInputElement).checked)"
        >
        {{ metaOption }}
      </label>
    </div>
  </div>

  <div class="field-group">
    <label class="field-label">Limit</label>
    <input
      :value="cfg.limit"
      class="field-input field-input--sm"
      type="number"
      min="1"
      @input="set('limit', Number(($event.target as HTMLInputElement).value))"
    >
  </div>

  <div class="field-group checkbox-group">
    <label class="field-label">
      <input
        :checked="!!cfg.paginate"
        type="checkbox"
        @change="set('paginate', ($event.target as HTMLInputElement).checked)"
      >
      Paginate
    </label>
  </div>

  <ArchiveDisplayToggles
    :config="cfg"
    @update:config="emit('update:config', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ArchiveDisplayToggles from './ArchiveDisplayToggles.vue';
import { POST_LIST_MODE_OPTIONS, POST_META_FIELD_OPTIONS } from './postListOptions';

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

const selectedMeta = computed<string[]>(() =>
  Array.isArray(props.config.meta) ? (props.config.meta as string[]) : [],
);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function toggleMeta(field: string, checked: boolean) {
  const next = checked
    ? [...selectedMeta.value, field]
    : selectedMeta.value.filter((entry) => entry !== field);
  set('meta', next);
}
</script>
