<template>
  <!-- Display mode -->
  <div
    class="field-group"
    style="margin-top: 8px;"
  >
    <label class="field-label">Display mode</label>
    <div style="display: flex; gap: 1.5rem; padding: 0.4rem 0;">
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="mode === 'category'"
          type="radio"
          name="np_mode"
          value="category"
          @change="set('mode', 'category')"
        > By category
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer;">
        <input
          :checked="mode === 'plans'"
          type="radio"
          name="np_mode"
          value="plans"
          @change="set('mode', 'plans')"
        > Individual plans
      </label>
    </div>
  </div>

  <!-- Category slug -->
  <div
    v-if="mode !== 'plans'"
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

interface TarifPlanItem { slug: string; name: string; display_price: number; display_currency: string; }

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);
const mode = computed(() => (cfg.value.mode as string) || 'category');
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
  if (mode.value === 'plans') loadPlans();
});

watch(mode, (m) => {
  if (m === 'plans' && !availablePlans.value.length) loadPlans();
});
</script>
