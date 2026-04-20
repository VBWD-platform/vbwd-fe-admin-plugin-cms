<template>
  <div class="cms-view style-editor">
    <div class="style-editor__header">
      <h2>{{ isNew ? 'New Style' : 'Edit Style' }}</h2>
      <div class="style-editor__actions">
        <router-link
          to="/admin/cms/styles"
          class="btn btn--ghost"
        >
          Cancel
        </router-link>
        <button
          v-if="canManage"
          class="btn btn--danger"
          :disabled="isNew || store.loading"
          @click="remove"
        >
          Delete
        </button>
        <button
          v-if="canManage"
          class="btn btn--primary"
          :disabled="store.loading"
          @click="save"
        >
          Save
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="style-editor__error"
    >
      {{ store.error }}
    </div>

    <div class="style-editor__body">
      <div class="style-editor__fields">
        <div class="field-group">
          <label class="field-label">Name *</label>
          <input
            v-model="form.name"
            class="field-input"
            type="text"
            @blur="autoSlug"
          >
        </div>
        <div class="field-group">
          <label class="field-label">Slug *</label>
          <input
            v-model="form.slug"
            class="field-input field-input--mono"
            type="text"
          >
        </div>
        <div class="field-group row-group">
          <label class="field-label">
            <input
              v-model="form.is_active"
              type="checkbox"
            > Active
          </label>
          <label
            class="field-label"
            style="margin-left:1.5rem"
          >
            Sort Order
            <input
              v-model.number="form.sort_order"
              class="field-input field-input--sm"
              type="number"
              min="0"
            >
          </label>
        </div>
        <div
          v-if="!isNew"
          class="field-group default-section"
        >
          <label class="field-label">Default style</label>
          <div v-if="form.is_default">
            <span
              class="badge badge--default"
              data-testid="style-is-default-badge"
            >This is the current default</span>
            <button
              v-if="canManage"
              class="btn"
              data-testid="clear-default-btn"
              style="margin-left:0.75rem"
              @click="onClearDefault"
            >Clear default</button>
          </div>
          <div v-else>
            <button
              v-if="canManage"
              class="btn btn--primary"
              data-testid="set-default-btn"
              @click="onSetDefault"
            >Set as default</button>
            <p class="hint">
              Any page without an explicit style falls back to the default.
            </p>
          </div>
        </div>
      </div>

      <div class="style-editor__panels">
        <div class="style-editor__css-panel">
          <label class="field-label">CSS Source</label>
          <CodeMirrorEditor
            v-model="form.source_css"
            lang="css"
            min-height="420px"
          />
        </div>
        <div class="style-editor__preview-panel">
          <label class="field-label">Live Preview</label>
          <iframe
            ref="previewFrame"
            class="preview-iframe"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import { useAuthStore } from '@/stores/auth';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';

const route = useRoute();
const router = useRouter();
const store = useCmsAdminStore();
const authStore = useAuthStore();
const canManage = computed(() => authStore.hasPermission('cms.styles.manage'));

const id = route.params.id as string | undefined;
const isNew = !id;

const previewFrame = ref<HTMLIFrameElement | null>(null);

const form = ref({
  name: '',
  slug: '',
  source_css: '',
  sort_order: 0,
  is_active: true,
  is_default: false,
});

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function autoSlug() {
  if (!form.value.slug) form.value.slug = slugify(form.value.name);
}

watch(() => form.value.source_css, updatePreview);

function updatePreview() {
  const frame = previewFrame.value;
  if (!frame) return;
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>${form.value.source_css}</style></head><body>
    <h1>Heading 1</h1><h2>Heading 2</h2><p>Paragraph text. <strong>Bold</strong> <em>italic</em> <a href="#">link</a>.</p>
    <ul><li>Item one</li><li>Item two</li></ul>
    <blockquote>Blockquote text</blockquote>
    <button>Button</button>
  </body></html>`);
  doc.close();
}

async function save() {
  const payload: Record<string, unknown> = { ...form.value };
  if (id) payload.id = id;
  const saved = await store.saveStyle(payload as any);
  if (saved && isNew) {
    router.replace(`/admin/cms/styles/${saved.id}/edit`);
  }
}

async function remove() {
  if (!id || !confirm('Delete this style?')) return;
  await store.deleteStyle(id);
  router.push('/admin/cms/styles');
}

async function onSetDefault() {
  if (!id) return;
  await store.setDefaultStyle(id);
  form.value.is_default = true;
}

async function onClearDefault() {
  await store.clearDefaultStyle();
  form.value.is_default = false;
}

onMounted(async () => {
  if (!isNew) {
    await store.fetchStyle(id!);
    const s = store.currentStyle;
    if (s) {
      form.value = {
        name: s.name,
        slug: s.slug,
        source_css: s.source_css,
        sort_order: s.sort_order,
        is_active: s.is_active,
        is_default: (s as any).is_default === true,
      };
    }
  }
  await nextTick();
  updatePreview();
});
</script>

<style scoped>
.style-editor { }
.style-editor__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
.style-editor__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.style-editor__error { background: #fee2e2; color: #991b1b; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 1rem; }

.style-editor__body { display: flex; flex-direction: column; gap: 1.25rem; }
.style-editor__fields { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0 1rem; align-items: start; }
@media (max-width: 700px) { .style-editor__fields { grid-template-columns: 1fr; } }

.style-editor__panels { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .style-editor__panels { grid-template-columns: 1fr; } }

.preview-iframe { width: 100%; height: 420px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; }

.field-group { margin-bottom: 1rem; }
.row-group { display: flex; align-items: center; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #374151; }
.field-input { width: 100%; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.field-input--mono { font-family: monospace; }
.field-input--sm { width: 80px; display: inline-block; margin-left: 0.5rem; }

.btn { padding: 0.45rem 1rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.875rem; text-decoration: none; }
.btn--ghost { color: #374151; display: inline-flex; align-items: center; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn--danger { background: #ef4444; color: #fff; border-color: #ef4444; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
