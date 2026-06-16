<template>
  <!-- Heading -->
  <div class="field-group">
    <label class="field-label">Heading</label>
    <input
      :value="cfg.heading"
      class="field-input"
      type="text"
      placeholder="Our Plans"
      @input="set('heading', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Optional heading shown above the plan grid. Leave blank for no heading.
    </p>
  </div>

  <!-- Source mode -->
  <div class="field-group">
    <label class="field-label">Plan source</label>
    <div style="display: flex; gap: 1.5rem; padding: 0.4rem 0;">
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="sourceMode === 'category'"
          type="radio"
          name="tpc_source"
          value="category"
          @change="set('source_mode', 'category')"
        > By category
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="sourceMode === 'slugs'"
          type="radio"
          name="tpc_source"
          value="slugs"
          @change="set('source_mode', 'slugs')"
        > Specific plans
      </label>
    </div>
  </div>

  <!-- Category slug -->
  <div
    v-if="sourceMode !== 'slugs'"
    class="field-group"
  >
    <label class="field-label">Category slug</label>
    <input
      :value="cfg.category"
      class="field-input field-input--mono"
      type="text"
      placeholder="e.g. root (blank = all plans)"
      @input="set('category', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Passed as <code>?category=…</code> to the plans API. Use <code>root</code> for base subscription plans.
    </p>
  </div>

  <!-- Plans picker -->
  <div
    v-else
    class="field-group"
  >
    <label class="field-label">Plans to show</label>
    <div
      v-if="availablePlans.length"
      class="plan-picker"
    >
      <label
        v-for="plan in availablePlans"
        :key="plan.slug"
        class="plan-picker__item"
      >
        <input
          type="checkbox"
          :value="plan.slug"
          :checked="selectedSlugs.includes(plan.slug)"
          @change="togglePlan(plan.slug)"
        >
        <span>{{ plan.name }}</span>
        <span class="plan-picker__price">{{ plan.display_price }} {{ plan.display_currency }}</span>
      </label>
    </div>
    <p
      v-else
      class="editor-pane__hint"
    >
      Loading plans…
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
          name="tpc_view"
          value="cards"
          @change="set('default_view', 'cards')"
        > Cards
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="defaultView === 'table'"
          type="radio"
          name="tpc_view"
          value="table"
          @change="set('default_view', 'table')"
        > Table
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

interface TarifPlanItem { slug: string; name: string; display_price: number; display_currency: string; }

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);
const sourceMode = computed(() => (cfg.value.source_mode as string) || 'category');
const defaultView = computed(() => (cfg.value.default_view as string) || 'cards');
const selectedSlugs = computed<string[]>(() =>
  Array.isArray(cfg.value.plan_slugs) ? (cfg.value.plan_slugs as string[]) : []
);

const availablePlans = ref<TarifPlanItem[]>([]);

async function loadPlans() {
  try {
    const res = await fetch('/api/v1/tarif-plans');
    const data = await res.json();
    availablePlans.value = data.plans ?? [];
  } catch {
    availablePlans.value = [];
  }
}

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function togglePlan(slug: string) {
  const current = [...selectedSlugs.value];
  const idx = current.indexOf(slug);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(slug);
  set('plan_slugs', current);
}

onMounted(() => {
  if (sourceMode.value === 'slugs') loadPlans();
});

watch(sourceMode, (m) => {
  if (m === 'slugs' && !availablePlans.value.length) loadPlans();
});
</script>
