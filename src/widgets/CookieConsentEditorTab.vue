<template>
  <!-- Privacy policy URL -->
  <div class="field-group">
    <label class="field-label">Privacy Policy URL</label>
    <input
      :value="cfg.privacy_policy_url"
      class="field-input"
      type="text"
      placeholder="/privacy"
      data-testid="cc-privacy-url"
      @input="set('privacy_policy_url', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Linked from the consent dialog (informed-consent requirement).
    </p>
  </div>

  <!-- Mode -->
  <div class="field-group">
    <label class="field-label">Display Mode</label>
    <select
      :value="cfg.mode"
      class="field-input"
      data-testid="cc-mode"
      @change="set('mode', ($event.target as HTMLSelectElement).value)"
    >
      <option value="modal">
        Modal (blocking overlay)
      </option>
      <option value="banner">
        Banner (non-blocking)
      </option>
    </select>
  </div>

  <!-- Consent version -->
  <div class="field-group">
    <label class="field-label">Consent Version</label>
    <input
      :value="cfg.consent_version"
      class="field-input field-input--sm"
      type="number"
      min="1"
      data-testid="cc-version"
      @input="set('consent_version', Number(($event.target as HTMLInputElement).value))"
    >
    <p class="editor-pane__hint">
      Bump this to re-prompt every visitor after a policy change.
    </p>
  </div>

  <!-- Optional categories -->
  <div class="field-group">
    <label class="field-label">Optional Categories</label>
    <label
      v-for="category in OPTIONAL_CATEGORIES"
      :key="category"
      class="cc-toggle"
    >
      <input
        type="checkbox"
        :checked="selectedCategories.includes(category)"
        :data-testid="`cc-category-${category}`"
        @change="toggleCategory(category, ($event.target as HTMLInputElement).checked)"
      >
      {{ categoryLabels[category] }}
    </label>
    <p class="editor-pane__hint">
      <code>necessary</code> is always on and cannot be disabled (strictly-necessary cookies are exempt).
    </p>
  </div>

  <!-- Settings affordance -->
  <div class="field-group">
    <label class="cc-toggle">
      <input
        :checked="cfg.show_settings_button !== false"
        type="checkbox"
        data-testid="cc-show-settings"
        @change="set('show_settings_button', ($event.target as HTMLInputElement).checked)"
      >
      Show persistent "Cookie settings" button
    </label>
    <p class="editor-pane__hint">
      Lets visitors withdraw or change consent as easily as they gave it.
    </p>
  </div>

  <!-- Debug -->
  <div class="field-group">
    <label class="cc-toggle">
      <input
        :checked="!!cfg.debug_mode"
        type="checkbox"
        data-testid="cc-debug"
        @change="set('debug_mode', ($event.target as HTMLInputElement).checked)"
      >
      Debug mode
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type OptionalCategory = 'preferences' | 'statistics' | 'marketing';

const OPTIONAL_CATEGORIES: OptionalCategory[] = ['preferences', 'statistics', 'marketing'];
const categoryLabels: Record<OptionalCategory, string> = {
  preferences: 'Preferences',
  statistics: 'Statistics',
  marketing: 'Marketing',
};

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

const selectedCategories = computed<string[]>(() =>
  Array.isArray(props.config.categories) ? (props.config.categories as string[]) : [],
);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function toggleCategory(category: OptionalCategory, checked: boolean) {
  const optional = OPTIONAL_CATEGORIES.filter((c) =>
    c === category ? checked : selectedCategories.value.includes(c),
  );
  // `necessary` is always first and implicit.
  set('categories', ['necessary', ...optional]);
}
</script>

<style scoped>
.cc-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 0;
}
</style>
