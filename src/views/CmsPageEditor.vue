<template>
  <div class="cms-view page-editor">
    <div class="page-editor__header">
      <h2>{{ isNew ? $t('cms.newPage') : $t('cms.editPage') }}</h2>
      <div class="page-editor__actions">
        <a
          v-if="!isNew && form.slug"
          :href="pageUrl"
          target="_blank"
          class="btn btn--ghost page-editor__view-link"
          :title="form.is_published ? 'View published page' : 'Preview (unpublished)'"
        >
          {{ form.is_published ? 'View Page ↗' : 'Preview ↗' }}
        </a>
        <router-link
          :to="{ name: 'cms-admin-pages' }"
          class="btn btn--ghost"
        >
          {{ $t('cms.cancel') }}
        </router-link>
        <button
          v-if="canManage"
          class="btn"
          :disabled="store.loading"
          @click="save()"
        >
          {{ $t('cms.savePage') }}
        </button>
        <button
          v-if="canManage && form.is_published"
          class="btn btn--warn"
          :disabled="store.loading"
          @click="togglePublish"
        >
          {{ $t('cms.unpublish') }}
        </button>
        <button
          v-else-if="canManage"
          class="btn btn--primary"
          :disabled="store.loading"
          @click="togglePublish"
        >
          {{ $t('cms.publish') }}
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="page-editor__error"
    >
      {{ store.error }}
    </div>

    <div class="page-editor__body">
      <!-- Main column -->
      <div class="page-editor__main">
        <!-- Basic fields -->
        <div class="field-group">
          <label class="field-label">{{ $t('cms.name') }} *</label>
          <input
            v-model="form.name"
            class="field-input"
            type="text"
            @blur="autoSlug"
          >
        </div>
        <div class="field-group">
          <label class="field-label">{{ $t('cms.slug') }} *</label>
          <input
            v-model="form.slug"
            class="field-input field-input--mono"
            type="text"
          >
        </div>

        <!-- Content Block Editors — one per content area in layout, or single default -->
        <div
          v-for="(block, blockIndex) in editableBlocks"
          :key="block.areaName"
          class="content-block-section"
        >
          <h3
            v-if="editableBlocks.length > 1"
            class="content-block-section__title"
          >
            {{ block.label }}
          </h3>

          <!-- Tabs for this block -->
          <div class="tabs">
            <button
              v-for="tab in blockTabs"
              :key="`${block.areaName}-${tab}`"
              type="button"
              :class="['tab-btn', { active: activeBlockTabs[block.areaName] === tab }]"
              @click="activeBlockTabs[block.areaName] = tab"
            >
              {{ tab }}
            </button>
          </div>

          <!-- WYSIWYG -->
          <div v-show="activeBlockTabs[block.areaName] === 'WYSIWYG'">
            <TipTapEditor
              :ref="(el: any) => { if (el && blockIndex === 0) editorRef = el }"
              v-model="block.content_json"
              v-model:html-value="block.content_html"
              hide-tab-bar
              @open-image-picker="activeImageBlock = block.areaName; imagePickerOpen = true"
            />
          </div>

          <!-- HTML -->
          <div v-show="activeBlockTabs[block.areaName] === 'HTML'">
            <CodeMirrorEditor
              v-model="block.content_html"
              lang="html"
              min-height="380px"
            />
          </div>

          <!-- CSS -->
          <div v-show="activeBlockTabs[block.areaName] === 'CSS'">
            <CodeMirrorEditor
              v-model="block.source_css"
              lang="css"
              min-height="380px"
            />
          </div>

          <!-- Preview -->
          <div v-show="activeBlockTabs[block.areaName] === 'Preview'">
            <iframe
              v-if="blockIndex === 0"
              ref="pagePreviewFrame"
              class="page-preview-iframe"
              sandbox="allow-same-origin allow-scripts"
            />
            <div
              v-else
              class="block-preview"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="block.content_html" />
            </div>
          </div>
        </div>

        <!-- SEO Section (collapsible) -->
        <details class="seo-section">
          <summary class="seo-section__toggle">
            SEO Settings
          </summary>
          <div class="seo-tab">
            <div class="field-group">
              <label class="field-label">{{ $t('cms.metaTitle') }}</label>
              <input
                v-model="form.meta_title"
                class="field-input"
                type="text"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.metaDescription') }}</label>
              <textarea
                v-model="form.meta_description"
                class="field-input"
                rows="3"
              />
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.metaKeywords') }}</label>
              <input
                v-model="form.meta_keywords"
                class="field-input"
                type="text"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.ogTitle') }}</label>
              <input
                v-model="form.og_title"
                class="field-input"
                type="text"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.ogDescription') }}</label>
              <textarea
                v-model="form.og_description"
                class="field-input"
                rows="3"
              />
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.ogImage') }}</label>
              <input
                v-model="form.og_image_url"
                class="field-input"
                type="text"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.canonicalUrl') }}</label>
              <input
                v-model="form.canonical_url"
                class="field-input"
                type="text"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.robots') }}</label>
              <input
                v-model="form.robots"
                class="field-input"
                type="text"
                placeholder="index,follow"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.schemaJson') }}</label>
              <textarea
                v-model="schemaJsonText"
                class="field-input field-input--mono"
                rows="5"
                @blur="parseSchemaJson"
              />
              <span
                v-if="schemaError"
                class="field-error"
              >{{ schemaError }}</span>
            </div>
          </div>
        </details>
      </div>

      <!-- Sidebar -->
      <div class="page-editor__sidebar">
        <div class="sidebar-card">
          <div class="field-group">
            <label class="field-label">{{ $t('cms.language') }}</label>
            <select
              v-model="form.language"
              class="field-input"
            >
              <option value="en">
                English
              </option>
              <option value="ru">
                Russian
              </option>
              <option value="uk">
                Ukrainian
              </option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">{{ $t('cms.category') }}</label>
            <select
              v-model="form.category_id"
              class="field-input"
            >
              <option value="">
                — none —
              </option>
              <option
                v-for="cat in store.categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">{{ $t('cms.sortOrder') }}</label>
            <input
              v-model.number="form.sort_order"
              class="field-input"
              type="number"
              min="0"
            >
          </div>
          <div class="field-group">
            <label class="field-label">Layout</label>
            <select
              v-model="form.layout_id"
              class="field-input"
            >
              <option value="">
                — none —
              </option>
              <option
                v-for="l in store.layouts?.items ?? []"
                :key="l.id"
                :value="l.id"
              >
                {{ l.name }}
              </option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Style</label>
            <select
              v-model="form.style_id"
              class="field-input"
            >
              <option value="">
                — none —
              </option>
              <option
                v-for="s in store.styles?.items ?? []"
                :key="s.id"
                :value="s.id"
              >
                {{ s.name }}{{ s.is_default ? ' (default)' : '' }}
              </option>
            </select>
            <p
              v-if="!form.style_id && defaultStyle"
              class="hint"
              data-testid="page-default-style-hint"
            >
              No style selected — this page will render with the default style
              <strong>{{ defaultStyle.name }}</strong>.
            </p>
            <p
              v-else-if="!form.style_id"
              class="hint"
              data-testid="page-no-default-hint"
            >
              No style selected and no default configured — the theme-switcher
              will render this page.
            </p>
          </div>
          <div class="field-group">
            <label class="field-label">
              <input
                v-model="form.use_theme_switcher_styles"
                type="checkbox"
              >
              &nbsp;Use theme-switcher styles
            </label>
          </div>
          <div class="field-group">
            <label class="field-label">
              <input
                v-model="form.is_published"
                type="checkbox"
              >
              &nbsp;{{ $t('cms.published') }}
            </label>
          </div>
          <div
            v-if="pageAccessLevels.length > 0"
            class="field-group"
          >
            <label class="field-label">Page visible to</label>
            <div class="visibility-tags">
              <span
                v-if="!form.required_access_level_ids.length"
                class="visibility-tag visibility-tag--everyone"
              >Everyone</span>
              <span
                v-for="levelId in form.required_access_level_ids"
                :key="levelId"
                class="visibility-tag"
              >
                {{ pageLevelName(levelId) }}
                <button
                  type="button"
                  class="tag-remove"
                  @click="form.required_access_level_ids = form.required_access_level_ids.filter((id: string) => id !== levelId)"
                >×</button>
              </span>
            </div>
            <select
              class="field-input"
              :value="''"
              @change="addPageAccessLevel(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">
                + Add level...
              </option>
              <option
                v-for="level in availablePageLevels"
                :key="level.id"
                :value="level.id"
              >
                {{ level.name }}
              </option>
            </select>
            <span class="field-hint">Restrict this page to users with specific access levels. Empty = visible to everyone.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Page Widget Slots (areas of type "page-widget" defined in the layout) -->
    <div
      v-if="!isNew && pageWidgetSlots.length > 0"
      class="page-widgets-section card"
    >
      <div class="section-header">
        <h3 class="section-title">
          Page Widgets
        </h3>
      </div>
      <p class="field-hint">
        Choose a widget for each slot. Each page can have its own widget selection.
      </p>

      <div
        v-for="slot in pageWidgetSlots"
        :key="slot.name"
        class="pw-row"
      >
        <span class="pw-area">{{ slot.label || slot.name }}</span>
        <div class="pw-widget">
          <span
            v-if="pageWidgetFor(slot.name)"
            class="pw-assigned"
          >
            {{ pageWidgetName(pageWidgetFor(slot.name)!.widget_id) }}
            <button
              v-if="canManage"
              type="button"
              class="btn btn--xs btn--danger"
              @click="clearPageWidget(slot.name)"
            >×</button>
          </span>
          <button
            v-else-if="canManage"
            type="button"
            class="btn btn--xs"
            @click="openPageWidgetPicker(slot.name)"
          >
            + Choose widget
          </button>
          <span
            v-else
            class="pw-empty-slot"
          >(empty)</span>
        </div>
        <!-- Visible to -->
        <div
          v-if="pageWidgetFor(slot.name) && pageAccessLevels.length > 0"
          class="pw-visibility"
        >
          <span class="visibility-label">Visible to:</span>
          <span
            v-if="!(pageWidgetFor(slot.name)!.required_access_level_ids || []).length"
            class="visibility-tag visibility-tag--everyone"
          >Everyone</span>
          <span
            v-for="levelId in (pageWidgetFor(slot.name)!.required_access_level_ids || [])"
            :key="levelId"
            class="visibility-tag"
          >
            {{ pageLevelName(levelId) }}
            <button
              type="button"
              class="tag-remove"
              @click="removePageWidgetLevel(slot.name, levelId)"
            >×</button>
          </span>
          <select
            class="visibility-select"
            :value="''"
            @change="addPageWidgetLevel(slot.name, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
          >
            <option value="">
              +
            </option>
            <option
              v-for="level in availablePageWidgetLevels(slot.name)"
              :key="level.id"
              :value="level.id"
            >
              {{ level.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Page widget picker modal -->
    <CmsWidgetPicker
      v-if="pageWidgetPickerArea !== null"
      @select="onPageWidgetSelected"
      @close="pageWidgetPickerArea = null"
    />

    <!-- Image picker modal -->
    <CmsImagePicker
      v-if="imagePickerOpen"
      @select="onImageSelected"
      @close="imagePickerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api';

const authStore = useAuthStore();

// ── Page access-level visibility ────────────────────────────────────────
interface PageAccessLevel { id: string; name: string; slug: string; }
const pageAccessLevels = ref<PageAccessLevel[]>([]);

function pageLevelName(levelId: string): string {
  return pageAccessLevels.value.find(l => l.id === levelId)?.name || levelId.slice(0, 8);
}
const availablePageLevels = computed(() =>
  pageAccessLevels.value.filter(l => !form.value.required_access_level_ids.includes(l.id))
);
function addPageAccessLevel(levelId: string) {
  if (levelId && !form.value.required_access_level_ids.includes(levelId)) {
    form.value.required_access_level_ids.push(levelId);
  }
}
const canManage = computed(() => authStore.hasPermission('cms.pages.manage'));

// ── Page Widget Assignments ─────────────────────────────────────────────
const pageWidgets = ref<CmsLayoutWidgetAssignment[]>([]);
const pageWidgetPickerArea = ref<string | null>(null);

// Areas of type "page-widget" — slots that each page fills with its own widget
const pageWidgetSlots = computed(() => {
  const layout = (store.layouts?.items ?? []).find(
    (l: { id: string }) => l.id === form.value.layout_id
  );
  if (!layout) return [];
  return (layout.areas || []).filter(
    (a: { type: string }) => a.type === 'page-widget'
  );
});

function pageWidgetFor(areaName: string) {
  return pageWidgets.value.find(pw => pw.area_name === areaName) ?? null;
}

function pageWidgetName(widgetId: string): string {
  const w = (store.widgets?.items ?? []).find(
    (i: { id: string }) => i.id === widgetId
  );
  return w ? w.name : widgetId.slice(0, 8) + '...';
}

function clearPageWidget(areaName: string) {
  pageWidgets.value = pageWidgets.value.filter(pw => pw.area_name !== areaName);
}

function openPageWidgetPicker(areaName: string) {
  pageWidgetPickerArea.value = areaName;
}

function onPageWidgetSelected(widget: CmsWidget) {
  const areaName = pageWidgetPickerArea.value!;
  const existing = pageWidgets.value.findIndex(pw => pw.area_name === areaName);
  const entry: CmsLayoutWidgetAssignment = {
    widget_id: widget.id,
    area_name: areaName,
    sort_order: existing >= 0 ? pageWidgets.value[existing].sort_order : pageWidgets.value.length,
    required_access_level_ids: [],
  };
  if (existing >= 0) pageWidgets.value[existing] = entry;
  else pageWidgets.value.push(entry);
  pageWidgetPickerArea.value = null;
}

async function savePageWidgets() {
  const pageId = id.value;
  if (!pageId) return;
  try {
    await api.put(`/admin/cms/pages/${pageId}/widgets`, pageWidgets.value);
  } catch (e: unknown) {
    alert((e as Error)?.message ?? 'Failed to save page widgets');
  }
}

function availablePageWidgetLevels(areaName: string) {
  const pw = pageWidgetFor(areaName);
  const selected = pw?.required_access_level_ids || [];
  return pageAccessLevels.value.filter(l => !selected.includes(l.id));
}

function addPageWidgetLevel(areaName: string, levelId: string) {
  if (!levelId) return;
  const pw = pageWidgetFor(areaName);
  if (!pw) return;
  if (!pw.required_access_level_ids) pw.required_access_level_ids = [];
  if (!pw.required_access_level_ids.includes(levelId)) {
    pw.required_access_level_ids.push(levelId);
  }
}

function removePageWidgetLevel(areaName: string, levelId: string) {
  const pw = pageWidgetFor(areaName);
  if (!pw?.required_access_level_ids) return;
  pw.required_access_level_ids = pw.required_access_level_ids.filter(
    (id: string) => id !== levelId
  );
}
import TipTapEditor from '../components/TipTapEditor.vue';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';
import CmsImagePicker from '../components/CmsImagePicker.vue';
import CmsWidgetPicker from '../components/CmsWidgetPicker.vue';
import type { CmsLayoutWidgetAssignment, CmsWidget } from '../stores/useCmsAdminStore';

const route = useRoute();
const router = useRouter();
const store = useCmsAdminStore();

const id = computed(() => route.params.id as string | undefined);
const isNew = computed(() => !id.value);

// Surface the default style (if any) next to the style dropdown so the admin
// knows what a "— none —" selection will resolve to at render time.
const defaultStyle = computed(() =>
  (store.styles?.items ?? []).find((s: any) => s.is_default),
);
const feUserBaseUrl = window.location.port === '8081' ? 'http://localhost:8080' : window.location.origin.replace(':8081', ':8080');
const previewToken = ref('');
const pageUrl = computed(() => {
  if (!form.value.slug) return '';
  if (form.value.is_published) return `${feUserBaseUrl}/${form.value.slug}`;
  return previewToken.value
    ? `${feUserBaseUrl}/${form.value.slug}?preview_token=${previewToken.value}`
    : '';
});

const blockTabs = ['WYSIWYG', 'HTML', 'CSS', 'Preview'];

// Editable content blocks — one per "content" area in layout, or single default
interface EditableBlock {
  areaName: string;
  label: string;
  content_json: Record<string, unknown>;
  content_html: string;
  source_css: string;
}

const editableBlocks = ref<EditableBlock[]>([
  { areaName: 'content', label: 'Content', content_json: { type: 'doc', content: [] }, content_html: '', source_css: '' },
]);

const activeBlockTabs = ref<Record<string, string>>({});
const activeImageBlock = ref('content');

// Detect "content" type areas in selected layout and rebuild editable blocks
function rebuildBlocks() {
  const layouts = store.layouts?.items ?? [];
  const layout = layouts.find((l: Record<string, unknown>) => l.id === form.value.layout_id);
  const contentAreas = layout?.areas
    ? (layout.areas as Array<{ name: string; type: string; label: string }>).filter((a) => a.type === 'content')
    : [];

  if (contentAreas.length === 0) {
    // No layout or no content areas — single default block
    if (editableBlocks.value.length !== 1 || editableBlocks.value[0].areaName !== 'content') {
      editableBlocks.value = [{
        areaName: 'content',
        label: 'Content',
        content_json: form.value.content_json,
        content_html: form.value.content_html,
        source_css: form.value.source_css,
      }];
    }
  } else {
    // One block per content area
    editableBlocks.value = contentAreas.map((area) => {
      const existing = editableBlocks.value.find((b) => b.areaName === area.name);
      return existing || {
        areaName: area.name,
        label: area.label || area.name,
        content_json: { type: 'doc', content: [] },
        content_html: '',
        source_css: '',
      };
    });
  }

  // Ensure active tabs are set
  for (const block of editableBlocks.value) {
    if (!activeBlockTabs.value[block.areaName]) {
      activeBlockTabs.value[block.areaName] = 'WYSIWYG';
    }
  }
}

// Watches are registered after form declaration (see below)
const imagePickerOpen = ref(false);
const editorRef = ref<InstanceType<typeof TipTapEditor> | null>(null);
const pagePreviewFrame = ref<HTMLIFrameElement | null>(null);
const schemaJsonText = ref('');
const schemaError = ref('');

interface PageForm {
  name: string;
  slug: string;
  language: string;
  category_id: string;
  content_json: Record<string, unknown>;
  content_html: string;
  source_css: string;
  is_published: boolean;
  sort_order: number;
  layout_id: string;
  style_id: string;
  use_theme_switcher_styles: boolean;
  required_access_level_ids: string[];
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_url: string;
  robots: string;
  schema_json: unknown;
}

const form = ref<PageForm>({
  name: '',
  slug: '',
  language: 'en',
  category_id: '',
  content_json: { type: 'doc', content: [] },
  content_html: '',
  source_css: '',
  is_published: false,
  sort_order: 0,
  layout_id: '',
  style_id: '',
  use_theme_switcher_styles: true,
  required_access_level_ids: [] as string[],
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  og_image_url: '',
  canonical_url: '',
  robots: 'index,follow',
  schema_json: null,
});

// Watch layout changes to rebuild content blocks
watch(() => form.value.layout_id, rebuildBlocks);

// Update preview when switching to Preview tab
watch(activeBlockTabs, async (tabs) => {
  for (const [, tab] of Object.entries(tabs)) {
    if (tab === 'Preview') {
      await nextTick();
      updatePagePreview();
      break;
    }
  }
}, { deep: true });

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function autoSlug() {
  if (!form.value.slug) {
    form.value.slug = slugify(form.value.name);
  }
}

function updatePagePreview() {
  const frame = pagePreviewFrame.value;
  if (!frame) return;
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>${form.value.source_css}</style></head><body>${form.value.content_html}</body></html>`);
  doc.close();
}


function parseSchemaJson() {
  schemaError.value = '';
  const txt = schemaJsonText.value.trim();
  if (!txt) { form.value.schema_json = null; return; }
  try {
    form.value.schema_json = JSON.parse(txt);
  } catch {
    schemaError.value = 'Invalid JSON';
  }
}

async function save(publish?: boolean) {
  if (publish !== undefined) form.value.is_published = publish;
  const payload: Record<string, unknown> = { ...form.value };
  if (!payload.category_id) payload.category_id = null;
  if (!payload.layout_id) payload.layout_id = null;
  if (!payload.style_id) payload.style_id = null;
  if (id.value) payload.id = id.value;

  // Sync editable blocks back to payload
  if (editableBlocks.value.length === 1 && editableBlocks.value[0].areaName === 'content') {
    // Single default block — save as main page content (backward compat)
    const block = editableBlocks.value[0];
    payload.content_json = block.content_json;
    payload.content_html = block.content_html;
    payload.source_css = block.source_css;
  } else {
    // Multi-block — save as content_blocks
    const blocks: Record<string, { content_json: Record<string, unknown>; content_html: string; source_css: string }> = {};
    for (const block of editableBlocks.value) {
      blocks[block.areaName] = {
        content_json: block.content_json,
        content_html: block.content_html,
        source_css: block.source_css,
      };
    }
    payload.content_blocks = blocks;
  }

  const saved = await store.savePage(payload as any);
  if (saved && isNew.value) {
    router.replace({ name: 'cms-page-edit', params: { id: saved.id } });
  }

  // Save page widget assignments together with page data
  const pageId = saved?.id || id.value;
  if (pageId && pageWidgets.value.length > 0) {
    await savePageWidgets();
  }
}

async function togglePublish() {
  await save(!form.value.is_published);
}

function onImageSelected(url: string, alt: string) {
  editorRef.value?.insertImageUrl(url, alt);
  imagePickerOpen.value = false;
}

onMounted(async () => {
  await Promise.all([
    store.fetchCategories(),
    store.fetchLayouts({ per_page: 100 }),
    store.fetchStyles({ per_page: 100 }),
    store.fetchWidgets({ per_page: 200 }),
    api.get('/admin/access/user-levels').then((res: any) => {
      pageAccessLevels.value = res.levels || [];
    }).catch(() => {}),
  ]);
  if (!isNew.value) {
    await store.fetchPage(id.value!);
    const p = store.currentPage;
    if (p) {
      form.value = {
        name: p.name,
        slug: p.slug,
        language: p.language,
        category_id: p.category_id ?? '',
        content_json: p.content_json ?? { type: 'doc', content: [] },
        content_html: (p as any).content_html ?? '',
        source_css: (p as any).source_css ?? '',
        is_published: p.is_published,
        sort_order: p.sort_order,
        layout_id: (p as any).layout_id ?? '',
        style_id: (p as any).style_id ?? '',
        use_theme_switcher_styles: (p as any).use_theme_switcher_styles ?? true,
        required_access_level_ids: (p as any).required_access_level_ids ?? [],
        meta_title: p.meta_title ?? '',
        meta_description: p.meta_description ?? '',
        meta_keywords: p.meta_keywords ?? '',
        og_title: p.og_title ?? '',
        og_description: p.og_description ?? '',
        og_image_url: p.og_image_url ?? '',
        canonical_url: p.canonical_url ?? '',
        robots: p.robots ?? 'index,follow',
        schema_json: p.schema_json ?? null,
      };
      schemaJsonText.value = p.schema_json ? JSON.stringify(p.schema_json, null, 2) : '';
      previewToken.value = (p as any).preview_token ?? '';

      // Load page widget assignments
      const pageAssignments = (p as any).page_assignments;
      if (Array.isArray(pageAssignments)) {
        pageWidgets.value = pageAssignments.map((a: CmsLayoutWidgetAssignment) => ({ ...a }));
      }

      // Build content blocks from layout areas + saved data
      rebuildBlocks();

      // Load saved content blocks into editable blocks
      const savedBlocks = (p as Record<string, unknown>).content_blocks as Record<string, { content_json?: Record<string, unknown>; content_html?: string; source_css?: string }> | undefined;
      if (savedBlocks) {
        for (const block of editableBlocks.value) {
          const saved = savedBlocks[block.areaName];
          if (saved) {
            block.content_json = saved.content_json || { type: 'doc', content: [] };
            block.content_html = saved.content_html || '';
            block.source_css = saved.source_css || '';
          }
        }
      }

      // For backward compat: if only a default "content" block, populate from page's main content
      if (editableBlocks.value.length === 1 && editableBlocks.value[0].areaName === 'content') {
        const block = editableBlocks.value[0];
        if (!block.content_html && form.value.content_html) {
          block.content_json = form.value.content_json;
          block.content_html = form.value.content_html;
          block.source_css = form.value.source_css;
        }
      }
    }
  }
});
</script>

<style scoped>
.page-editor { }
.page-editor__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
.page-editor__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.page-editor__error { background: #fee2e2; color: #991b1b; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
.page-editor__body { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; min-width: 0; overflow: hidden; }
@media (max-width: 900px) { .page-editor__body { grid-template-columns: 1fr; } }

.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #374151; }
.field-input { width: 100%; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.field-input--mono { font-family: monospace; }
textarea.field-input { resize: vertical; }
.field-error { font-size: 0.8rem; color: #dc2626; margin-top: 2px; }

.tabs { display: flex; gap: 0; margin-bottom: 0; border-bottom: 1px solid #e5e7eb; }
.tab-btn { padding: 0.5rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9rem; color: #6b7280; }
.tab-btn.active { color: #1d4ed8; border-bottom-color: #1d4ed8; font-weight: 600; }

.page-editor__view-link { color: #3b82f6; font-size: 0.85rem; }
.seo-tab { padding-top: 1rem; }
.tab-hint { font-size: 0.78rem; color: #6b7280; margin-top: 0.5rem; }
.page-preview-iframe { width: 100%; height: 500px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; }
.sidebar-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; }

.btn { padding: 0.45rem 1rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.875rem; }
.btn--ghost { text-decoration: none; color: #374151; display: inline-flex; align-items: center; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn--warn { background: #f59e0b; color: #fff; border-color: #f59e0b; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Content block sections */
.content-block-section { margin-bottom: 24px; }
.content-block-section__title { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 0 0 8px; padding: 10px 0 6px; border-top: 1px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.5px; }
.block-preview { border: 1px solid #d1d5db; border-radius: 4px; padding: 20px; background: #fff; min-height: 200px; }

/* SEO collapsible */
.seo-section { margin-top: 20px; }
.seo-section__toggle { cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #374151; padding: 10px 0; border-top: 1px solid #e5e7eb; }
.field-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 4px; }
.visibility-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.visibility-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: #dbeafe; color: #1e40af; }
.visibility-tag--everyone { background: #d1fae5; color: #065f46; }
.tag-remove { background: none; border: none; color: #1e40af; cursor: pointer; font-size: 0.85rem; padding: 0 2px; line-height: 1; }
/* Page widgets */
.page-widgets-section { margin-top: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.section-title { font-size: 1rem; font-weight: 600; margin: 0; }
.pw-row { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; flex-wrap: wrap; }
.pw-area { font-size: 0.8rem; padding: 2px 8px; border-radius: 10px; background: #dcfce7; color: #166534; white-space: nowrap; }
.pw-widget { flex: 1; min-width: 150px; }
.pw-assigned { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
.pw-visibility { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; width: 100%; }
.visibility-label { font-size: 0.7rem; color: #6b7280; white-space: nowrap; }
.visibility-select { font-size: 0.75rem; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 3px; }
</style>
