<template>
  <div class="cms-view widget-editor">
    <div class="widget-editor__header">
      <h2>{{ isNew ? 'New Widget' : 'Edit Widget' }}</h2>
      <div class="widget-editor__actions">
        <router-link
          to="/admin/cms/widgets"
          class="btn btn--ghost"
        >
          Cancel
        </router-link>
        <button
          class="btn btn--danger"
          :disabled="isNew || store.loading"
          @click="remove"
        >
          Delete
        </button>
        <button
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
      class="widget-editor__error"
    >
      {{ store.error }}
    </div>

    <div class="widget-editor__body">
      <!-- Meta fields -->
      <div class="meta-fields">
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
        <div class="field-group">
          <label class="field-label">Type *</label>
          <select
            v-model="form.widget_type"
            class="field-input"
            :disabled="!isNew"
          >
            <option value="html">
              HTML
            </option>
            <option value="menu">
              Menu
            </option>
            <option value="slideshow">
              Slideshow
            </option>
            <option value="vue-component">
              Vue Component
            </option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Sort Order</label>
          <input
            v-model.number="form.sort_order"
            class="field-input field-input--sm"
            type="number"
            min="0"
          >
        </div>
        <div class="field-group checkbox-group">
          <label class="field-label">
            <input
              v-model="form.is_active"
              type="checkbox"
            > Active
          </label>
        </div>
      </div>

      <!-- Type-specific editor -->
      <div class="type-editor">
        <!-- HTML widget: CodeMirror HTML + CSS editors + Preview -->
        <template v-if="form.widget_type === 'html'">
          <div class="html-widget-editors">
            <div class="editor-pane">
              <div class="editor-pane__tabs">
                <button
                  v-for="tab in ['HTML', 'CSS', 'Preview']"
                  :key="tab"
                  type="button"
                  :class="['pane-tab', { active: activeHtmlTab === tab }]"
                  @click="onWidgetTabChange(tab as 'HTML' | 'CSS' | 'Preview')"
                >
                  {{ tab }}
                </button>
              </div>
              <div v-show="activeHtmlTab === 'HTML'">
                <div class="editor-toolbar">
                  <button
                    type="button"
                    class="toolbar-btn"
                    title="Insert image from library"
                    @click="htmlImagePickerOpen = true"
                  >
                    + Image
                  </button>
                </div>
                <CodeMirrorEditor
                  ref="htmlEditorRef"
                  v-model="htmlContent"
                  lang="html"
                  min-height="380px"
                />
              </div>
              <div v-show="activeHtmlTab === 'CSS'">
                <CodeMirrorEditor
                  v-model="cssContent"
                  lang="css"
                  min-height="380px"
                />
                <p class="editor-pane__hint">
                  Style the widget's structural classes here (e.g. <code>.features__grid</code>,
                  <code>.feature-card</code>). These styles are injected with the widget on the page.
                </p>
              </div>
              <div v-show="activeHtmlTab === 'Preview'">
                <iframe
                  ref="widgetPreviewFrame"
                  class="widget-preview-iframe"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Menu widget: Visual / CSS / Preview tabs -->
        <template v-else-if="form.widget_type === 'menu'">
          <div class="html-widget-editors">
            <div class="editor-pane">
              <div class="editor-pane__tabs">
                <button
                  v-for="tab in ['Visual', 'CSS', 'Preview']"
                  :key="tab"
                  type="button"
                  :class="['pane-tab', { active: activeMenuTab === tab }]"
                  @click="onMenuTabChange(tab as 'Visual' | 'CSS' | 'Preview')"
                >
                  {{ tab }}
                </button>
              </div>
              <div v-show="activeMenuTab === 'Visual'">
                <CmsMenuTreeEditor v-model="menuItems" />
              </div>
              <div v-show="activeMenuTab === 'CSS'">
                <CodeMirrorEditor
                  v-model="menuCssContent"
                  lang="css"
                  min-height="380px"
                />
                <p class="editor-pane__hint">
                  Style the menu classes here (<code>.cms-menu</code>, <code>.cms-menu__link</code>,
                  <code>.cms-burger</code>, etc.). These styles are injected with the widget on the page.
                </p>
              </div>
              <div v-show="activeMenuTab === 'Preview'">
                <iframe
                  ref="menuPreviewFrame"
                  class="widget-preview-iframe"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Vue Component widget — widget-agnostic via descriptor registry -->
        <template v-else-if="form.widget_type === 'vue-component'">
          <div class="html-widget-editors">
            <div class="editor-pane">
              <!-- Tabs: General / CSS / Preview — CSS+Preview only when a descriptor is registered -->
              <div class="editor-pane__tabs">
                <button
                  type="button"
                  :class="['pane-tab', { active: activeVueTab === 'General' }]"
                  @click="activeVueTab = 'General'"
                >
                  General
                </button>
                <template v-if="currentDescriptor">
                  <button
                    type="button"
                    :class="['pane-tab', { active: activeVueTab === 'CSS' }]"
                    @click="activeVueTab = 'CSS'"
                  >
                    CSS
                  </button>
                  <button
                    type="button"
                    :class="['pane-tab', { active: activeVueTab === 'Preview' }]"
                    @click="onVueTabChange('Preview')"
                  >
                    Preview
                  </button>
                </template>
              </div>

              <!-- General tab -->
              <div
                v-show="activeVueTab === 'General'"
                class="vue-general-panel"
              >
                <!-- Component identifier (always shown; read-only for existing widgets) -->
                <div class="field-group">
                  <label class="field-label">Component</label>
                  <input
                    v-model="vueComponentConfig.component_name"
                    class="field-input field-input--mono"
                    type="text"
                    :disabled="!isNew && !!vueComponentConfig.component_name"
                    placeholder="e.g. ContactForm"
                  >
                  <p
                    v-if="isNew"
                    class="editor-pane__hint"
                  >
                    Identifier used by the fe-user plugin to mount this component.
                  </p>
                </div>

                <!-- Descriptor-provided General tab component -->
                <component
                  :is="currentDescriptor.generalTabComponent"
                  v-if="currentDescriptor"
                  :config="vueComponentConfig"
                  @update:config="vueComponentConfig = $event"
                />
              </div>

              <!-- CSS tab -->
              <div v-show="activeVueTab === 'CSS' && currentDescriptor">
                <CodeMirrorEditor
                  v-model="vcCss"
                  lang="css"
                  min-height="380px"
                />
                <!-- eslint-disable-next-line vue/no-v-html -->
                <p
                  v-if="currentDescriptor?.cssHint"
                  class="editor-pane__hint"
                  v-html="currentDescriptor.cssHint"
                />
              </div>

              <!-- Preview tab -->
              <div v-show="activeVueTab === 'Preview' && currentDescriptor">
                <iframe
                  ref="vuePreviewFrame"
                  class="widget-preview-iframe"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Slideshow widget: image list -->
        <template v-else-if="form.widget_type === 'slideshow'">
          <label class="field-label">Slideshow Images</label>
          <div class="slideshow-list">
            <div
              v-if="!slideshowImages.length"
              class="slideshow-empty"
            >
              No images added.
            </div>
            <div
              v-for="(img, idx) in slideshowImages"
              :key="idx"
              class="slideshow-item"
            >
              <img
                :src="img.url"
                :alt="img.alt"
                class="slideshow-thumb"
              >
              <div class="slideshow-item__meta">
                <input
                  v-model="img.alt"
                  class="field-input field-input--sm"
                  type="text"
                  placeholder="Alt text"
                >
                <input
                  v-model="img.caption"
                  class="field-input field-input--sm"
                  type="text"
                  placeholder="Caption"
                >
              </div>
              <button
                type="button"
                class="btn btn--xs btn--danger"
                @click="slideshowImages.splice(idx, 1)"
              >
                ×
              </button>
            </div>
            <button
              type="button"
              class="btn btn--sm"
              @click="imagePickerOpen = true"
            >
              + Add Image
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Image picker (slideshow) -->
    <CmsImagePicker
      v-if="imagePickerOpen"
      @select="onImageSelected"
      @close="imagePickerOpen = false"
    />

    <!-- Image picker (HTML editor insert) -->
    <CmsImagePicker
      v-if="htmlImagePickerOpen"
      @select="onHtmlImageSelected"
      @close="htmlImagePickerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import type { CmsMenuItemData } from '../stores/useCmsAdminStore';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';
import CmsMenuTreeEditor from '../components/CmsMenuTreeEditor.vue';
import CmsImagePicker from '../components/CmsImagePicker.vue';
import { getWidgetEditor } from '../widgets/widgetEditorRegistry';
import '../widgets/index'; // register all vue-component descriptors

const route  = useRoute();
const router = useRouter();
const store  = useCmsAdminStore();

const id    = route.params.id as string | undefined;
const isNew = !id;

const imagePickerOpen     = ref(false);
const htmlImagePickerOpen = ref(false);

const activeHtmlTab      = ref<'HTML' | 'CSS' | 'Preview'>('HTML');
const widgetPreviewFrame = ref<HTMLIFrameElement | null>(null);
const htmlEditorRef      = ref<InstanceType<typeof CodeMirrorEditor> | null>(null);

const activeMenuTab    = ref<'Visual' | 'CSS' | 'Preview'>('Visual');
const menuPreviewFrame = ref<HTMLIFrameElement | null>(null);
const menuCssContent   = ref('');

const activeVueTab    = ref<'General' | 'CSS' | 'Preview'>('General');
const vuePreviewFrame = ref<HTMLIFrameElement | null>(null);

const form = ref({
  name: '',
  slug: '',
  widget_type: 'html' as 'html' | 'menu' | 'slideshow' | 'vue-component',
  sort_order: 0,
  is_active: true,
});

/** Config object for vue-component widgets. Managed by the descriptor's tab component. */
const vueComponentConfig = ref<Record<string, unknown>>({ component_name: '' });

/** Resolved descriptor for the currently selected component_name. */
const currentDescriptor = computed(() =>
  getWidgetEditor(vueComponentConfig.value.component_name as string)
);

/** CSS string for CodeMirror — merged into config.css on save. */
const vcCss = ref('');

/** Decoded HTML content for the HTML editor. */
const htmlContent = ref('');
/** CSS for HTML widget structural classes. */
const cssContent  = ref('');

const menuItems      = ref<CmsMenuItemData[]>([]);
const slideshowImages = ref<{ url: string; alt: string; caption: string }[]>([]);

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function autoSlug() {
  if (!form.value.slug) form.value.slug = slugify(form.value.name);
}

// ── HTML widget preview ────────────────────────────────────────────────────────

function updateWidgetPreview() {
  const frame = widgetPreviewFrame.value;
  if (!frame) return;
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>${cssContent.value}</style></head><body>${htmlContent.value}</body></html>`);
  doc.close();
}

async function onWidgetTabChange(tab: 'HTML' | 'CSS' | 'Preview') {
  activeHtmlTab.value = tab;
  if (tab === 'Preview') {
    await nextTick();
    updateWidgetPreview();
  }
}

// ── Menu widget preview ────────────────────────────────────────────────────────

function buildMenuHtml(): string {
  function renderItems(items: CmsMenuItemData[], parentId: string | null = null): string {
    const children = items.filter(i => (i.parent_id ?? null) === parentId);
    if (!children.length) return '';
    const isRoot = parentId === null;
    return `<ul class="${isRoot ? 'cms-menu' : 'cms-menu__sub'}">${children.map(item => {
      const href = item.url ?? (item.page_slug ? `/${item.page_slug}` : '#');
      const kids = renderItems(items, item.id);
      return `<li class="cms-menu__item${kids ? ' cms-menu__item--has-children' : ''}"><a href="${href}" class="cms-menu__link">${item.label}${kids ? ' <span class="cms-menu__arrow">▾</span>' : ''}</a>${kids}</li>`;
    }).join('')}</ul>`;
  }
  return `<nav class="cms-widget cms-widget--menu">${renderItems(menuItems.value)}</nav>`;
}

function updateMenuPreview() {
  const frame = menuPreviewFrame.value;
  if (!frame) return;
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}
    .cms-menu{list-style:none;margin:0;padding:0}
    .cms-menu__sub{list-style:none;margin:0;padding:0}
    ${menuCssContent.value}
  </style></head><body>${buildMenuHtml()}</body></html>`);
  doc.close();
}

async function onMenuTabChange(tab: 'Visual' | 'CSS' | 'Preview') {
  activeMenuTab.value = tab;
  if (tab === 'Preview') {
    await nextTick();
    updateMenuPreview();
  }
}

// ── Vue-component preview (delegated to descriptor) ────────────────────────────

function updateVuePreview() {
  const frame = vuePreviewFrame.value;
  const desc  = currentDescriptor.value;
  if (!frame || !desc) return;
  const { html, baseStyles = '' } = desc.buildPreview(vueComponentConfig.value);
  const base = `*{box-sizing:border-box}body{margin:20px;font-family:system-ui,sans-serif;background:#fff}${baseStyles}`;
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>${base}${vcCss.value}</style></head><body>${html}</body></html>`);
  doc.close();
}

async function onVueTabChange(tab: 'General' | 'CSS' | 'Preview') {
  activeVueTab.value = tab;
  if (tab === 'Preview') {
    await nextTick();
    updateVuePreview();
  }
}

// ── Image picker handlers ─────────────────────────────────────────────────────

function onImageSelected(url: string, alt: string) {
  if (form.value.widget_type === 'slideshow') {
    slideshowImages.value.push({ url, alt, caption: '' });
  }
  imagePickerOpen.value = false;
}

function onHtmlImageSelected(url: string, alt: string) {
  htmlEditorRef.value?.insertAtCursor(`<img src="${url}" alt="${alt}">`);
  htmlImagePickerOpen.value = false;
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  const payload: Record<string, unknown> = { ...form.value };
  if (id) payload.id = id;

  if (form.value.widget_type === 'html') {
    const b64 = btoa(unescape(encodeURIComponent(htmlContent.value)));
    payload.content_json = { content: b64 };
    payload.source_css   = cssContent.value;
  } else if (form.value.widget_type === 'menu') {
    payload.content_json = null;
    payload.source_css   = menuCssContent.value || null;
  } else if (form.value.widget_type === 'slideshow') {
    payload.content_json = { images: slideshowImages.value };
    payload.source_css   = null;
  } else if (form.value.widget_type === 'vue-component') {
    const componentName = (vueComponentConfig.value.component_name as string) || '';
    payload.content_json = componentName ? { component: componentName } : null;
    payload.config       = { ...vueComponentConfig.value, css: vcCss.value };
    payload.source_css   = null;
  }

  const saved = await store.saveWidget(payload as any);

  if (form.value.widget_type === 'menu') {
    const wid = saved?.id ?? id!;
    await store.replaceMenuTree(wid, menuItems.value as CmsMenuItemData[]);
  }

  if (saved && isNew) {
    router.replace(`/admin/cms/widgets/${saved.id}/edit`);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function remove() {
  if (!id || !confirm('Delete this widget? It cannot be deleted if assigned to a layout.')) return;
  try {
    await store.deleteWidget(id);
    router.push('/admin/cms/widgets');
  } catch (e: any) {
    alert(e?.message ?? 'Failed to delete widget');
  }
}

// ── Load on mount ─────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!isNew) {
    await store.fetchWidget(id!);
    const w = store.currentWidget;
    if (w) {
      form.value = {
        name:        w.name,
        slug:        w.slug,
        widget_type: w.widget_type as 'html' | 'menu' | 'slideshow' | 'vue-component',
        sort_order:  w.sort_order,
        is_active:   w.is_active,
      };

      if (w.widget_type === 'html') {
        const b64 = (w.content_json as any)?.content ?? '';
        try {
          htmlContent.value = b64 ? decodeURIComponent(escape(atob(b64))) : '';
        } catch {
          htmlContent.value = b64;
        }
        cssContent.value = (w as any).source_css ?? '';
      }

      if (w.widget_type === 'menu') {
        menuCssContent.value = (w as any).source_css ?? '';
        if (w.menu_items) menuItems.value = w.menu_items;
      }

      if (w.widget_type === 'vue-component') {
        const componentName = (w.content_json as any)?.component
          ?? (w.config as any)?.component_name
          ?? '';
        vueComponentConfig.value = { component_name: componentName, ...(w.config ?? {}) };
        vcCss.value = (w.config?.css as string) ?? '';
      }

      if (w.widget_type === 'slideshow' && w.content_json?.images) {
        slideshowImages.value = (w.content_json.images as any[]).map(i => ({
          url: i.url ?? '', alt: i.alt ?? '', caption: i.caption ?? '',
        }));
      }
    }
  }
});
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.widget-editor { padding: 1rem; }
.widget-editor__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
.widget-editor__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.widget-editor__error { background: #fee2e2; color: #991b1b; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
.widget-editor__body { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }

/* ── Meta-fields grid ─────────────────────────────────────────────────────── */
.meta-fields { display: grid; grid-template-columns: 1fr 1fr 140px 100px 100px; gap: 0 1rem; align-items: start; }
.checkbox-group { padding-top: 1.5rem; }

/* tablet */
@media (max-width: 800px) {
  .meta-fields { grid-template-columns: 1fr 1fr; }
  .checkbox-group { padding-top: 0; }
}

/* portrait phone */
@media (max-width: 480px) {
  .widget-editor { padding: 0.625rem; }
  .meta-fields { grid-template-columns: 1fr; gap: 0; }
  .widget-editor__header { flex-direction: column; align-items: stretch; }
  .widget-editor__actions { justify-content: flex-end; }
}

/* ── Type editor + CodeMirror ─────────────────────────────────────────────── */
.type-editor { min-height: 200px; min-width: 0; overflow: hidden; }
.type-editor :deep(.cm-editor) { min-width: 0; max-width: 100%; }
.type-editor :deep(.cm-scroller) { overflow-x: auto; }

/* ── Editor toolbar (above HTML CodeMirror) ───────────────────────────────── */
.editor-toolbar { display: flex; gap: 0.5rem; padding: 4px 8px; background: #1e2030; border-bottom: 1px solid #374151; }
.toolbar-btn { padding: 2px 10px; font-size: 0.78rem; background: #374151; color: #d1d5db; border: 1px solid #4b5563; border-radius: 3px; cursor: pointer; }
.toolbar-btn:hover { background: #4b5563; color: #f9fafb; }

/* ── Pane tabs + iframe ───────────────────────────────────────────────────── */
.html-widget-editors { display: flex; flex-direction: column; gap: 0; min-width: 0; overflow: hidden; }
.editor-pane { min-width: 0; overflow: hidden; width: 100%; }
.editor-pane__tabs { display: flex; gap: 0; border-bottom: 1px solid #374151; margin-bottom: 0; background: #1e2030; border-radius: 6px 6px 0 0; overflow: hidden; overflow-x: auto; }
.pane-tab { padding: 0.5rem 1.1rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.85rem; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
.pane-tab.active { color: #60a5fa; border-bottom-color: #60a5fa; background: #1a1a2e; }

.widget-preview-iframe { width: 100%; height: 420px; border: none; border-radius: 0 0 6px 6px; background: #fff; }

@media (max-width: 480px) {
  .widget-preview-iframe { height: 280px; }
  .pane-tab { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
}

/* ── Slideshow ────────────────────────────────────────────────────────────── */
.slideshow-list { display: flex; flex-direction: column; gap: 0.75rem; }
.slideshow-empty { color: #9ca3af; font-size: 0.875rem; padding: 0.5rem; }
.slideshow-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 6px; flex-wrap: wrap; }
.slideshow-thumb { width: 80px; height: 56px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb; flex-shrink: 0; }
.slideshow-item__meta { flex: 1; min-width: 120px; display: flex; flex-direction: column; gap: 4px; }

/* field-group, field-label, field-input*, editor-pane__hint, btn* — see cms-admin.css */
.vue-general-panel { padding: 1rem 0 0.5rem; }
</style>
