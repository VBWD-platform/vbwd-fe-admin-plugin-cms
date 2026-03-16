<template>
  <div class="menu-tree">
    <div class="menu-tree__toolbar">
      <button
        type="button"
        class="btn btn--sm"
        @click="addItem(null)"
      >
        + Add item
      </button>
    </div>

    <div
      v-if="!roots.length"
      class="menu-tree__empty"
    >
      No menu items yet.
    </div>

    <ul class="menu-tree__list">
      <li
        v-for="item in roots"
        :key="item.id ?? item._key"
        class="menu-tree__item"
      >
        <MenuItemRow
          :item="item"
          @edit="editItem"
          @remove="removeItem"
          @add-child="addItem(item.id ?? item._key ?? null)"
        />
        <ul
          v-if="childrenOf(item.id ?? item._key ?? null).length"
          class="menu-tree__children"
        >
          <li
            v-for="child in childrenOf(item.id ?? item._key ?? null)"
            :key="child.id ?? child._key"
            class="menu-tree__item"
          >
            <MenuItemRow
              :item="child"
              @edit="editItem"
              @remove="removeItem"
              @add-child="addItem(child.id ?? child._key ?? null)"
            />
          </li>
        </ul>
      </li>
    </ul>

    <!-- Inline edit form -->
    <div
      v-if="editing"
      class="menu-tree__edit-form"
    >
      <h4>{{ editing.id ? 'Edit' : 'Add' }} Menu Item</h4>
      <div class="field-row">
        <label class="field-label">Label *</label>
        <input
          v-model="editForm.label"
          class="field-input"
          type="text"
        >
      </div>
      <div class="field-row">
        <label class="field-label">URL</label>
        <input
          v-model="editForm.url"
          class="field-input"
          type="text"
          placeholder="https://..."
        >
      </div>
      <div class="field-row">
        <label class="field-label">Page Slug</label>
        <input
          v-model="editForm.page_slug"
          class="field-input"
          type="text"
          placeholder="/page-slug"
        >
      </div>
      <div class="field-row">
        <label class="field-label">Target</label>
        <select
          v-model="editForm.target"
          class="field-input"
        >
          <option value="_self">
            _self
          </option>
          <option value="_blank">
            _blank
          </option>
        </select>
      </div>
      <div class="field-row">
        <label class="field-label">Icon</label>
        <input
          v-model="editForm.icon"
          class="field-input"
          type="text"
          placeholder="icon class or name"
        >
      </div>
      <div class="field-row">
        <label class="field-label">Sort Order</label>
        <input
          v-model.number="editForm.sort_order"
          class="field-input"
          type="number"
          min="0"
        >
      </div>
      <div class="edit-form__actions">
        <button
          type="button"
          class="btn"
          @click="cancelEdit"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn--primary"
          @click="commitEdit"
        >
          Save item
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue';
import type { CmsMenuItemData } from '../stores/useCmsAdminStore';

type LocalItem = CmsMenuItemData & { _key?: string };

const props = defineProps<{
  modelValue: LocalItem[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: LocalItem[]): void;
}>();

let _keyCounter = 0;
function nextKey() { return `_new_${++_keyCounter}`; }

const items = computed(() => props.modelValue);
const roots = computed(() => items.value.filter(i => !i.parent_id));

function childrenOf(parentId: string | null) {
  if (!parentId) return [];
  return items.value.filter(i => i.parent_id === parentId);
}

// Editing state
const editing = ref<LocalItem | null>(null);
const editForm = ref<Omit<LocalItem, 'id' | '_key'>>({
  parent_id: null, label: '', url: null, page_slug: null,
  target: '_self', icon: null, sort_order: 0,
});

function addItem(parentId: string | null) {
  editing.value = { _key: nextKey(), parent_id: parentId, label: '', url: null, page_slug: null, target: '_self', icon: null, sort_order: 0 };
  editForm.value = { parent_id: parentId, label: '', url: null, page_slug: null, target: '_self', icon: null, sort_order: 0 };
}

function editItem(item: LocalItem) {
  editing.value = item;
  editForm.value = {
    parent_id: item.parent_id,
    label: item.label,
    url: item.url,
    page_slug: item.page_slug,
    target: item.target,
    icon: item.icon,
    sort_order: item.sort_order,
  };
}

function cancelEdit() {
  editing.value = null;
}

function commitEdit() {
  if (!editForm.value.label.trim()) return;
  const list = [...items.value];
  const key = editing.value!.id ?? editing.value!._key!;
  const existing = list.findIndex(i => (i.id ?? i._key) === key);
  const updated: LocalItem = { ...editing.value!, ...editForm.value };
  if (existing >= 0) {
    list[existing] = updated;
  } else {
    list.push(updated);
  }
  emit('update:modelValue', list);
  editing.value = null;
}

function removeItem(item: LocalItem) {
  if (!confirm(`Remove "${item.label}"?`)) return;
  const key = item.id ?? item._key!;
  // Also remove children
  const toRemove = new Set<string>();
  toRemove.add(key);
  // BFS for descendants
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of items.value) {
      const iKey = i.id ?? i._key!;
      if (i.parent_id && toRemove.has(i.parent_id) && !toRemove.has(iKey)) {
        toRemove.add(iKey);
        changed = true;
      }
    }
  }
  emit('update:modelValue', items.value.filter(i => !toRemove.has(i.id ?? i._key!)));
}

// Inline component for row rendering
const MenuItemRow = defineComponent({
  props: { item: { type: Object as () => LocalItem, required: true } },
  emits: ['edit', 'remove', 'add-child'],
  setup(p, { emit: emitRow }) {
    return () => h('div', { class: 'menu-row' }, [
      h('span', { class: 'menu-row__label' }, p.item.label || '(no label)'),
      h('span', { class: 'menu-row__url' }, p.item.url || p.item.page_slug || ''),
      h('div', { class: 'menu-row__actions' }, [
        h('button', { type: 'button', class: 'btn btn--xs', onClick: () => emitRow('add-child', p.item) }, '+ Child'),
        h('button', { type: 'button', class: 'btn btn--xs', onClick: () => emitRow('edit', p.item) }, 'Edit'),
        h('button', { type: 'button', class: 'btn btn--xs btn--danger', onClick: () => emitRow('remove', p.item) }, '×'),
      ]),
    ]);
  },
});
</script>

<style scoped>
.menu-tree { border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; }
.menu-tree__toolbar { margin-bottom: 0.75rem; }
.menu-tree__empty { color: #9ca3af; font-size: 0.875rem; padding: 0.5rem; }
.menu-tree__list { list-style: none; margin: 0; padding: 0; }
.menu-tree__children { list-style: none; margin: 0; padding-left: 1.5rem; border-left: 2px solid #e5e7eb; }
.menu-tree__item { margin-bottom: 4px; }

:deep(.menu-row) { display: flex; align-items: center; gap: 0.75rem; padding: 5px 8px; border-radius: 4px; background: #f9fafb; }
:deep(.menu-row__label) { font-weight: 500; font-size: 0.875rem; flex: 0 0 auto; }
:deep(.menu-row__url) { font-size: 0.8rem; color: #6b7280; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.menu-row__actions) { display: flex; gap: 4px; flex-shrink: 0; }

.menu-tree__edit-form { margin-top: 1rem; padding: 1rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
.menu-tree__edit-form h4 { margin: 0 0 0.75rem; font-size: 0.9rem; }
.field-row { display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.field-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
.field-input { padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; }
.edit-form__actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.75rem; }

.btn { padding: 0.35rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.8rem; }
.btn--sm { font-size: 0.8rem; padding: 0.3rem 0.65rem; }
.btn--xs { font-size: 0.75rem; padding: 0.2rem 0.5rem; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn--danger { background: #ef4444; color: #fff; border-color: #ef4444; }
</style>
