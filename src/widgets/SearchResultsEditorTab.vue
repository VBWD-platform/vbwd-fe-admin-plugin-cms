<template>
  <div class="field-group">
    <label class="field-label">Scope</label>
    <select
      data-test-id="search-results-scope"
      :value="resolvedScope"
      class="field-input"
      @change="set('scope', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="scopeOption in SCOPE_OPTIONS"
        :key="scopeOption"
        :value="scopeOption"
      >
        {{ scopeOption }}
      </option>
    </select>
    <p class="editor-pane__hint">
      Which published content to list: pages, posts, or both.
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
    <label class="field-label">Per page</label>
    <input
      :value="cfg.per_page"
      class="field-input field-input--sm"
      type="number"
      min="1"
      @input="set('per_page', Number(($event.target as HTMLInputElement).value))"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Scope term type</label>
    <input
      :value="cfg.scope_term_type"
      class="field-input"
      type="text"
      placeholder="category"
      @input="set('scope_term_type', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Scope term slug</label>
    <input
      :value="cfg.scope_term_slug"
      class="field-input"
      type="text"
      placeholder="news"
      @input="set('scope_term_slug', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { POST_LIST_MODE_OPTIONS, POST_META_FIELD_OPTIONS } from './postListOptions';

const SCOPE_OPTIONS = ['pages', 'posts', 'both'] as const;
const DEFAULT_SCOPE = 'both';
const LEGACY_TYPE_TO_SCOPE: Record<string, string> = { page: 'pages', post: 'posts' };

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

// Backward-compat: derive scope from the legacy free-text `type` when no
// explicit `scope` is stored (page→pages, post→posts, anything else→both).
const resolvedScope = computed<string>(() => {
  if (typeof props.config.scope === 'string') {
    return props.config.scope;
  }
  if (typeof props.config.type === 'string') {
    return LEGACY_TYPE_TO_SCOPE[props.config.type] ?? DEFAULT_SCOPE;
  }
  return DEFAULT_SCOPE;
});

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
