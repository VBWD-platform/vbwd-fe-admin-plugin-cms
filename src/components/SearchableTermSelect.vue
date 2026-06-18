<template>
  <div class="searchable-term-select">
    <input
      v-model="query"
      type="text"
      class="field-input searchable-term-select__input"
      :placeholder="placeholder"
      data-testid="searchable-term-input"
      @focus="open = true"
      @input="open = true"
      @blur="onBlur"
      @keydown.escape="open = false"
    >
    <ul
      v-if="open && (matches.length || showCreate)"
      class="searchable-term-select__menu"
      data-testid="searchable-term-menu"
    >
      <li
        v-for="term in matches"
        :key="term.id"
        class="searchable-term-select__option"
        data-testid="searchable-term-option"
        @mousedown.prevent="onSelect(term)"
      >
        {{ term.name }}
      </li>
      <li
        v-if="showCreate"
        class="searchable-term-select__option searchable-term-select__option--create"
        data-testid="searchable-term-create"
        @mousedown.prevent="onCreate"
      >
        {{ createLabel || $t('cms.create', 'Create') }} "{{ trimmedQuery }}"
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CmsTerm } from '../stores/useCmsContentStore';

const props = withDefaults(
  defineProps<{
    /** The pickable (unselected) terms to filter over. */
    terms: CmsTerm[];
    placeholder?: string;
    /** When true, an unmatched query offers an inline "create" option. */
    allowCreate?: boolean;
    /** Label prefix for the create option (e.g. "Create"). */
    createLabel?: string;
  }>(),
  { placeholder: '', allowCreate: false, createLabel: '' },
);

const emit = defineEmits<{
  (event: 'select', term: CmsTerm): void;
  (event: 'create', name: string): void;
}>();

const query = ref('');
const open = ref(false);

const trimmedQuery = computed(() => query.value.trim());

const matches = computed<CmsTerm[]>(() => {
  const needle = trimmedQuery.value.toLowerCase();
  if (!needle) return props.terms;
  return props.terms.filter((term) => term.name.toLowerCase().includes(needle));
});

// Offer create only when allowed, the query is non-empty, and no existing term
// (selected or not) already carries that exact name (case-insensitive).
const showCreate = computed(() => {
  if (!props.allowCreate || !trimmedQuery.value) return false;
  const needle = trimmedQuery.value.toLowerCase();
  return !props.terms.some((term) => term.name.toLowerCase() === needle);
});

function onSelect(term: CmsTerm): void {
  emit('select', term);
  query.value = '';
  open.value = false;
}

function onCreate(): void {
  emit('create', trimmedQuery.value);
  query.value = '';
  open.value = false;
}

// Close on blur after the click (mousedown.prevent keeps the option clickable).
function onBlur(): void {
  open.value = false;
}
</script>

<style scoped>
.searchable-term-select {
  position: relative;
}

.searchable-term-select__input {
  width: 100%;
}

.searchable-term-select__menu {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.searchable-term-select__option {
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.searchable-term-select__option:hover {
  background: #eff6ff;
}

.searchable-term-select__option--create {
  border-top: 1px solid #e5e7eb;
  color: #1d4ed8;
  font-weight: 600;
}
</style>
