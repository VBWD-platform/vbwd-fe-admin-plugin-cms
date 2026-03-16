<template>
  <div
    ref="editorEl"
    class="cm-wrap"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { syntaxTree } from '@codemirror/language';

const props = defineProps<{
  modelValue: string;
  lang: 'html' | 'css';
  minHeight?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const editorEl = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

/** Surface Lezer parse-tree ERROR nodes as lint diagnostics (underlines syntax errors). */
const syntaxLinter = linter((v): Diagnostic[] => {
  const diags: Diagnostic[] = [];
  syntaxTree(v.state).cursor().iterate((node) => {
    if (node.name === '⚠') {
      diags.push({
        from: node.from,
        to: Math.max(node.to, node.from + 1),
        severity: 'error',
        message: `${props.lang.toUpperCase()} syntax error`,
      });
    }
  });
  return diags;
});

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue ?? '',
      extensions: [
        basicSetup,
        oneDark,
        props.lang === 'html' ? html() : css(),
        syntaxLinter,
        lintGutter(),
        EditorView.updateListener.of((upd) => {
          if (upd.docChanged) emit('update:modelValue', view!.state.doc.toString());
        }),
        EditorView.theme({
          '&': { minHeight: props.minHeight ?? '260px' },
          '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", overflowX: 'auto' },
        }),
      ],
    }),
    parent: editorEl.value!,
  });
});

watch(() => props.modelValue, (val) => {
  if (!view) return;
  const cur = view.state.doc.toString();
  if (cur !== val) {
    view.dispatch({ changes: { from: 0, to: cur.length, insert: val ?? '' } });
  }
});

function insertAtCursor(text: string) {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

defineExpose({ insertAtCursor });

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<style scoped>
.cm-wrap {
  width: 100%;
  min-width: 0;
  border: 1px solid #374151;
  border-radius: 6px;
  overflow: hidden;
}
.cm-wrap :deep(.cm-editor) {
  min-width: 0;
  width: 100%;
  font-size: 0.8rem;
}
.cm-wrap :deep(.cm-gutters) {
  border-right: 1px solid #374151;
}
</style>
