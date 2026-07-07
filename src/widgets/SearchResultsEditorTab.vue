<template>
  <div class="field-group">
    <label class="field-label">Post types</label>
    <div
      data-test-id="search-results-types"
      class="checkbox-group"
    >
      <label
        v-for="postType in postTypeOptions"
        :key="postType.key"
        class="field-label"
      >
        <input
          :data-test-id="`search-results-type-${postType.key}`"
          :checked="selectedTypes.includes(postType.key)"
          type="checkbox"
          @change="toggleType(postType.key, ($event.target as HTMLInputElement).checked)"
        >
        {{ postType.label }}
      </label>
    </div>
    <p class="editor-pane__hint">
      Which registered content types to list. Leave all unchecked to list every type.
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
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import { POST_LIST_MODE_OPTIONS, POST_META_FIELD_OPTIONS } from './postListOptions';

/** Narrow view of a registered post type — only what the picker needs. */
interface PostTypeOption {
  key: string;
  label: string;
}

// Backward-compat: map the legacy `scope` / free-text `type` onto the derived
// post-type set (pages→[page], posts→[post], both/anything else→[] = all types).
const LEGACY_SCOPE_TO_TYPES: Record<string, string[]> = {
  pages: ['page'],
  posts: ['post'],
  both: [],
};
const LEGACY_TYPE_TO_TYPES: Record<string, string[]> = {
  page: ['page'],
  post: ['post'],
};

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);
const postTypeOptions = ref<PostTypeOption[]>([]);

// Selected post types, derived from the legacy `scope`/`type` when the modern
// `config.types` array is absent so existing widgets keep their behaviour.
const selectedTypes = computed<string[]>(() => {
  if (Array.isArray(props.config.types)) {
    return props.config.types as string[];
  }
  if (typeof props.config.scope === 'string') {
    return LEGACY_SCOPE_TO_TYPES[props.config.scope] ?? [];
  }
  if (typeof props.config.type === 'string') {
    return LEGACY_TYPE_TO_TYPES[props.config.type] ?? [];
  }
  return [];
});

const selectedMeta = computed<string[]>(() =>
  Array.isArray(props.config.meta) ? (props.config.meta as string[]) : [],
);

function unwrapPostTypes(response: unknown): PostTypeOption[] {
  const list = Array.isArray(response)
    ? response
    : (response as Record<string, unknown> | null)?.post_types
      ?? (response as Record<string, unknown> | null)?.items;
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    key: String((entry as Record<string, unknown>).key),
    label: String((entry as Record<string, unknown>).label ?? (entry as Record<string, unknown>).key),
  }));
}

async function loadPostTypes() {
  try {
    const response = await api.get<unknown>('/admin/cms/post-types');
    postTypeOptions.value = unwrapPostTypes(response);
  } catch {
    postTypeOptions.value = [];
  }
}

// Every emit materialises the derived `types` and drops the legacy `scope`/
// `type` keys, so saving migrates old widgets to the modern shape.
function migratedConfig(): Record<string, unknown> {
  const next: Record<string, unknown> = { ...props.config, types: selectedTypes.value };
  delete next.scope;
  delete next.type;
  return next;
}

function set(key: string, value: unknown) {
  emit('update:config', { ...migratedConfig(), [key]: value });
}

function toggleType(key: string, checked: boolean) {
  const next = checked
    ? [...selectedTypes.value, key]
    : selectedTypes.value.filter((entry) => entry !== key);
  emit('update:config', { ...migratedConfig(), types: next });
}

function toggleMeta(field: string, checked: boolean) {
  const next = checked
    ? [...selectedMeta.value, field]
    : selectedMeta.value.filter((entry) => entry !== field);
  set('meta', next);
}

onMounted(loadPostTypes);
</script>
