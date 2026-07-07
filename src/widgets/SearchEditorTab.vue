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

  <div class="field-group">
    <label class="field-label">Scope</label>
    <select
      data-test-id="search-scope"
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
      Which published content to search: pages, posts, or both.
    </p>
  </div>

  <div class="field-group">
    <label class="field-label">
      <input
        data-test-id="search-quicksearch"
        :checked="quicksearchEnabled"
        type="checkbox"
        @change="set('quicksearch', ($event.target as HTMLInputElement).checked)"
      >
      Quicksearch (instant dropdown)
    </label>
  </div>

  <div
    v-if="quicksearchEnabled"
    class="field-group"
  >
    <label class="field-label">Quicksearch results limit</label>
    <input
      data-test-id="search-quicksearch-limit"
      :value="quicksearchLimit"
      class="field-input field-input--sm"
      type="number"
      min="1"
      :max="QUICKSEARCH_LIMIT_MAX"
      @input="setQuicksearchLimit(($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Maximum dropdown rows (1–{{ QUICKSEARCH_LIMIT_MAX }}).
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const SCOPE_OPTIONS = ['pages', 'posts', 'both'] as const;
const DEFAULT_SCOPE = 'both';
const DEFAULT_QUICKSEARCH_LIMIT = 6;
const QUICKSEARCH_LIMIT_MIN = 1;
const QUICKSEARCH_LIMIT_MAX = 20;

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

const resolvedScope = computed<string>(() =>
  typeof props.config.scope === 'string' ? props.config.scope : DEFAULT_SCOPE,
);

const quicksearchEnabled = computed<boolean>(() => props.config.quicksearch === true);

const quicksearchLimit = computed<number>(() =>
  typeof props.config.quicksearch_limit === 'number'
    ? props.config.quicksearch_limit
    : DEFAULT_QUICKSEARCH_LIMIT,
);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function setQuicksearchLimit(rawValue: string) {
  const parsed = Number(rawValue);
  const clamped = Math.min(
    QUICKSEARCH_LIMIT_MAX,
    Math.max(QUICKSEARCH_LIMIT_MIN, Number.isFinite(parsed) ? parsed : DEFAULT_QUICKSEARCH_LIMIT),
  );
  set('quicksearch_limit', clamped);
}
</script>
