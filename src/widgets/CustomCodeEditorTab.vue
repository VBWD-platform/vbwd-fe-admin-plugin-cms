<template>
  <div class="field-group">
    <label class="field-label">Custom Code (HTML / JavaScript)</label>
    <CodeMirrorEditor
      :model-value="(cfg.code as string) || ''"
      lang="html"
      min-height="320px"
      data-testid="custom-code-input"
      @update:model-value="set('code', $event)"
    />
    <p class="editor-pane__hint">
      Injected verbatim on the public site. Raw HTML and
      <code>&lt;script&gt;</code> tags are rebuilt and executed as-is —
      paste only code you trust.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
