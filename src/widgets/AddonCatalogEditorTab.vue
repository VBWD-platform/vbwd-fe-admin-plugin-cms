<template>
  <div class="field-group">
    <label class="field-label">Heading</label>
    <input
      :value="cfg.heading"
      class="field-input"
      type="text"
      placeholder="Add-ons"
      @input="set('heading', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Optional heading shown above the add-on grid. Leave blank for no heading.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
