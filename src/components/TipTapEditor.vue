<template>
  <div class="tiptap-editor">
    <!-- Tab switcher -->
    <div
      v-if="!hideTabBar"
      class="tiptap-tabs"
    >
      <button
        type="button"
        class="tiptap-tab"
        :class="{ active: activeTab === 'visual' }"
        @click="switchTab('visual')"
      >
        Visual
      </button>
      <button
        type="button"
        class="tiptap-tab"
        :class="{ active: activeTab === 'html' }"
        @click="switchTab('html')"
      >
        HTML
      </button>
    </div>

    <!-- Visual tab -->
    <template v-if="activeTab === 'visual'">
      <div
        v-if="editor"
        class="tiptap-toolbar"
      >
        <button
          type="button"
          title="Bold"
          :class="{ active: editor.isActive('bold') }"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          title="Italic"
          :class="{ active: editor.isActive('italic') }"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          title="H1"
          :class="{ active: editor.isActive('heading', { level: 1 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          H1
        </button>
        <button
          type="button"
          title="H2"
          :class="{ active: editor.isActive('heading', { level: 2 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>
        <button
          type="button"
          title="H3"
          :class="{ active: editor.isActive('heading', { level: 3 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>
        <button
          type="button"
          title="Bullet list"
          :class="{ active: editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          • List
        </button>
        <button
          type="button"
          title="Ordered list"
          :class="{ active: editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          1. List
        </button>
        <button
          type="button"
          title="Blockquote"
          :class="{ active: editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          "
        </button>
        <button
          type="button"
          title="Code block"
          :class="{ active: editor.isActive('codeBlock') }"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          { }
        </button>
        <span class="tiptap-toolbar__sep">|</span>
        <button
          type="button"
          title="Insert image"
          @click="$emit('open-image-picker')"
        >
          Img
        </button>
        <button
          type="button"
          title="Insert link"
          @click="insertLink()"
        >
          Link
        </button>
        <button
          type="button"
          title="Video embed"
          @click="insertVideoEmbed()"
        >
          Video
        </button>
      </div>
      <editor-content
        :editor="editor"
        class="tiptap-content"
      />
    </template>

    <!-- HTML tab -->
    <template v-else>
      <CodeMirrorEditor
        v-model="rawHtml"
        lang="html"
        min-height="260px"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import CodeMirrorEditor from './CodeMirrorEditor.vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';

const props = defineProps<{
  modelValue: Record<string, unknown>;
  htmlValue?: string;
  hideTabBar?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: Record<string, unknown>): void;
  (e: 'update:htmlValue', val: string): void;
  (e: 'open-image-picker'): void;
}>();

const activeTab = ref<'visual' | 'html'>('visual');
const rawHtml = ref(props.htmlValue ?? '');

function isEmptyDoc(doc: Record<string, unknown>): boolean {
  return ((doc.content as unknown[]) ?? []).length === 0;
}

// If modelValue is an empty doc but htmlValue has content, init TipTap from HTML
const initialContent: string | Record<string, unknown> =
  (props.modelValue && !isEmptyDoc(props.modelValue))
    ? props.modelValue
    : (props.htmlValue || props.modelValue || { type: 'doc', content: [] });

const editor = useEditor({
  extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
  content: initialContent,
  onUpdate({ editor }) {
    const json = editor.getJSON() as Record<string, unknown>;
    const html = editor.getHTML();
    emit('update:modelValue', json);
    emit('update:htmlValue', html);
    rawHtml.value = html;
  },
});

watch(() => props.modelValue, (val) => {
  if (!editor.value || activeTab.value === 'html') return;
  const current = JSON.stringify(editor.value.getJSON());
  const next = JSON.stringify(val);
  if (current !== next) {
    editor.value.commands.setContent(val || { type: 'doc', content: [] });
  }
});

// When htmlValue prop changes (e.g. after async data load in parent):
// 1. Always keep rawHtml in sync for the HTML tab
// 2. If the editor is still visually empty, initialize it from the HTML.
//    Use getText() instead of isEmptyDoc() because TipTap normalizes e.g. {}
//    to { type: 'doc', content: [{ type: 'paragraph' }] }, making isEmptyDoc
//    return false even though the editor looks and feels empty.
watch(() => props.htmlValue, (val, old) => {
  if (val !== undefined) rawHtml.value = val;
  if (val && !old && editor.value && editor.value.getText().trim() === '') {
    editor.value.commands.setContent(val);
  }
});

function switchTab(tab: 'visual' | 'html') {
  if (tab === 'html' && activeTab.value === 'visual') {
    // Capture current HTML before switching
    rawHtml.value = editor.value?.getHTML() ?? '';
  } else if (tab === 'visual' && activeTab.value === 'html') {
    // Parse raw HTML back into TipTap on switch back to visual
    if (editor.value) {
      editor.value.commands.setContent(rawHtml.value);
      const json = editor.value.getJSON() as Record<string, unknown>;
      emit('update:modelValue', json);
      emit('update:htmlValue', rawHtml.value);
    }
  }
  activeTab.value = tab;
}

// Sync rawHtml changes to parent while on HTML tab
watch(rawHtml, (val) => {
  if (activeTab.value === 'html') {
    emit('update:htmlValue', val);
  }
});

function insertImageUrl(url: string, alt = '') {
  editor.value?.chain().focus().setImage({ src: url, alt }).run();
}

function insertLink() {
  const url = prompt('Enter URL:');
  if (url) editor.value?.chain().focus().setLink({ href: url }).run();
}

function insertVideoEmbed() {
  const url = prompt('Enter video embed URL (YouTube/Vimeo):');
  if (url) {
    editor.value?.chain().focus().insertContent(
      `<iframe src="${url}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9"></iframe>`
    ).run();
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});

function setFromHtml(html: string) {
  if (editor.value) {
    editor.value.commands.setContent(html);
    const json = editor.value.getJSON() as Record<string, unknown>;
    emit('update:modelValue', json);
    emit('update:htmlValue', html);
  }
}

defineExpose({ insertImageUrl, setFromHtml });
</script>

<style scoped>
.tiptap-editor { border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
.tiptap-tabs {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
}
.tiptap-tab {
  padding: 6px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tiptap-tab.active { color: #1d4ed8; border-bottom-color: #1d4ed8; background: #fff; }
.tiptap-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
}
.tiptap-toolbar button {
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.1s;
}
.tiptap-toolbar button:hover { background: #e5e7eb; }
.tiptap-toolbar button.active { background: #dbeafe; border-color: #93c5fd; }
.tiptap-toolbar__sep { color: #d1d5db; margin: 0 4px; align-self: center; }
.tiptap-content :deep(.ProseMirror) {
  padding: 12px;
  min-height: 200px;
  outline: none;
}
.tiptap-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #aaa;
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
