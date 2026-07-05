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

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;">

  <!-- Card text -->
  <div class="field-group">
    <label class="field-label">Heading</label>
    <input
      :value="cfg.heading"
      class="field-input"
      type="text"
      placeholder="Choose Your Plan (blank = default)"
      @input="set('heading', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Subtitle</label>
    <input
      :value="cfg.subtitle"
      class="field-input"
      type="text"
      placeholder="Select the plan that works best for you (blank = default)"
      @input="set('subtitle', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Button label</label>
    <input
      :value="cfg.cta_label"
      class="field-input"
      type="text"
      placeholder="Choose Plan (blank = default)"
      @input="set('cta_label', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <!-- Theme -->
  <div class="field-group">
    <label class="field-label">Card theme</label>
    <select
      :value="theme"
      class="field-input"
      @change="set('theme', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="opt in themeOptions"
        :key="opt"
        :value="opt"
      >
        {{ opt }}
      </option>
    </select>
    <p class="editor-pane__hint">
      Recolours the cards. <code>dark</code> also darkens the embed background.
    </p>
  </div>

  <!-- Card image — picked from the CMS Image Library -->
  <div class="field-group">
    <label class="field-label">Card image</label>
    <div
      v-if="imageUrl"
      class="np-image"
    >
      <img
        :src="imageUrl"
        alt=""
        class="np-image__thumb"
      >
      <button
        type="button"
        class="np-btn"
        @click="showImagePicker = true"
      >
        Change
      </button>
      <button
        type="button"
        class="np-btn np-btn--danger"
        @click="set('image_url', '')"
      >
        Remove
      </button>
    </div>
    <button
      v-else
      type="button"
      class="np-btn"
      @click="showImagePicker = true"
    >
      Select image
    </button>
    <p class="editor-pane__hint">
      Optional icon shown at the top of each card. Pick from the CMS Image Library.
    </p>
  </div>

  <!-- Emphasized plan -->
  <div class="field-group">
    <label class="field-label">Emphasize plan (slug)</label>
    <select
      v-if="availablePlans.length"
      :value="cfg.highlight_slug || ''"
      class="field-input"
      @change="set('highlight_slug', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">
        — none —
      </option>
      <option
        v-for="plan in availablePlans"
        :key="plan.slug"
        :value="plan.slug"
      >
        {{ plan.name }} ({{ plan.slug }})
      </option>
    </select>
    <input
      v-else
      :value="cfg.highlight_slug"
      class="field-input field-input--mono"
      type="text"
      placeholder="plan slug to mark as popular"
      @input="set('highlight_slug', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Emphasis badge text</label>
    <input
      :value="cfg.highlight_badge"
      class="field-input"
      type="text"
      placeholder="Most Popular (blank = default)"
      @input="set('highlight_badge', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <!-- Features -->
  <div class="field-group">
    <label class="field-label">Features (one per line)</label>
    <textarea
      :value="featuresText"
      class="field-input field-input--mono"
      rows="5"
      placeholder="2000 MB Bandwidth&#10;5 GB Space&#10;Unlimited Users"
      @input="onFeaturesInput(($event.target as HTMLTextAreaElement).value)"
    />
    <p class="editor-pane__hint">
      Shown as a checkmark list on every card.
    </p>
  </div>

  <!-- CMS Image Library picker -->
  <CmsImagePicker
    v-if="showImagePicker"
    @select="onImageSelect"
    @close="showImagePicker = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import CmsImagePicker from '../components/CmsImagePicker.vue';

interface TarifPlanItem { slug: string; name: string; display_price: number; display_currency: string; }

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const themeOptions = ['default', 'light', 'dark', 'teal', 'indigo', 'emerald'];

const cfg = computed(() => props.config);
const mode = computed(() => (cfg.value.mode as string) || 'category');
const theme = computed(() => (cfg.value.theme as string) || 'default');
const imageUrl = computed(() => (cfg.value.image_url as string) || '');
const showImagePicker = ref(false);
const selectedSlugs = computed<string[]>(() =>
  Array.isArray(cfg.value.plan_slugs) ? (cfg.value.plan_slugs as string[]) : []
);
const featuresText = computed(() =>
  Array.isArray(cfg.value.features) ? (cfg.value.features as string[]).join('\n') : ''
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

function onFeaturesInput(value: string) {
  // Keep raw lines so the controlled textarea round-trips while typing;
  // the fe-user widget trims and drops blanks at render time.
  set('features', value.split('\n'));
}

function onImageSelect(url: string) {
  set('image_url', url);
  showImagePicker.value = false;
}

onMounted(loadPlans);

watch(mode, (m) => {
  if (m === 'plans' && !availablePlans.value.length) loadPlans();
});
</script>

<style scoped>
.np-image {
  display: flex;
  align-items: center;
  gap: 12px;
}
.np-image__thumb {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 4px;
}
.np-btn {
  padding: 0.4rem 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.np-btn:hover {
  background: #f3f4f6;
}
.np-btn--danger {
  color: #b91c1c;
  border-color: #fca5a5;
}
</style>
