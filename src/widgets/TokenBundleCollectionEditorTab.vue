<template>
  <!-- Heading -->
  <div class="field-group">
    <label class="field-label">Heading</label>
    <input
      :value="cfg.heading"
      class="field-input"
      type="text"
      placeholder="Token Bundles"
      @input="set('heading', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Optional heading shown above the bundle grid. Leave blank for no heading.
    </p>
  </div>

  <!-- Bundle picker -->
  <div class="field-group">
    <label class="field-label">Bundles to show</label>
    <div
      v-if="availableBundles.length"
      class="plan-picker"
    >
      <label
        v-for="bundle in availableBundles"
        :key="bundle.id"
        class="plan-picker__item"
      >
        <input
          type="checkbox"
          :value="bundle.id"
          :checked="selectedIds.includes(bundle.id)"
          @change="toggleBundle(bundle.id)"
        >
        <span>{{ bundle.name }}</span>
        <span class="plan-picker__price">{{ bundle.price }}{{ currency ? ' ' + currency : '' }}</span>
      </label>
    </div>
    <p
      v-else
      class="editor-pane__hint"
    >
      Loading bundles…
    </p>
    <p class="editor-pane__hint">
      Leave all unchecked to show every active bundle.
    </p>
  </div>

  <!-- Default view -->
  <div class="field-group">
    <label class="field-label">Default view</label>
    <div style="display: flex; gap: 1.5rem; padding: 0.4rem 0;">
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="defaultView === 'cards'"
          type="radio"
          name="tbc_view"
          value="cards"
          @change="set('default_view', 'cards')"
        > Cards
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="defaultView === 'table'"
          type="radio"
          name="tbc_view"
          value="table"
          @change="set('default_view', 'table')"
        > Table
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface TokenBundleItem {
  id: string;
  name: string;
  price: number | string;
}

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);
const defaultView = computed(() => (cfg.value.default_view as string) || 'cards');
const selectedIds = computed<string[]>(() =>
  Array.isArray(cfg.value.bundle_ids) ? (cfg.value.bundle_ids as string[]) : []
);

const availableBundles = ref<TokenBundleItem[]>([]);
// Token bundles carry no per-bundle currency — it's the global default (S85).
const currency = ref('');

async function loadBundles() {
  try {
    const res = await fetch('/api/v1/token-bundles/');
    const data = await res.json();
    availableBundles.value = (data.bundles ?? []).map((bundle: Record<string, unknown>) => ({
      id: bundle.id as string,
      name: (bundle.name as string) ?? '',
      price: (bundle.price as number | string) ?? '',
    }));
  } catch {
    availableBundles.value = [];
  }
}

async function loadCurrency() {
  try {
    const res = await fetch('/api/v1/config');
    const data = await res.json();
    currency.value = (data.default_currency as string) ?? '';
  } catch {
    currency.value = '';
  }
}

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function toggleBundle(id: string) {
  const current = [...selectedIds.value];
  const idx = current.indexOf(id);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(id);
  set('bundle_ids', current);
}

onMounted(() => {
  void loadBundles();
  void loadCurrency();
});
</script>
