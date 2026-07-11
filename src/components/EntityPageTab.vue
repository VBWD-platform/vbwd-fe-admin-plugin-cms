<template>
  <div
    class="entity-page-tab"
    data-testid="entity-page-tab"
  >
    <!-- Primary authored content: Visual / HTML / CSS / Preview sub-tabs. -->
    <div class="content-block-section">
      <label class="field-label">{{ $t('cms.content') }}</label>
      <div class="tabs">
        <button
          v-for="tab in CONTENT_TABS"
          :key="tab.key"
          type="button"
          :class="['tab-btn', { active: activeContentTab === tab.key }]"
          :data-testid="tab.testid"
          @click="activeContentTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Visual (WYSIWYG) -->
      <div v-show="activeContentTab === 'Visual'">
        <TipTapEditor
          ref="tiptapEditor"
          v-model="contentDoc"
          :html-value="form.content_html"
          :hide-tab-bar="true"
          @update:html-value="form.content_html = $event"
          @open-image-picker="openPicker('visual')"
        />
      </div>

      <!-- HTML -->
      <div v-show="activeContentTab === 'HTML'">
        <div class="content-toolbar">
          <button
            type="button"
            class="btn btn--sm"
            data-testid="entity-page-insert-image"
            @click="openPicker('html')"
          >
            {{ $t('cms.insertImage', 'Insert image') }}
          </button>
        </div>
        <CodeMirrorEditor
          ref="htmlEditor"
          v-model="form.content_html"
          lang="html"
          min-height="360px"
        />
      </div>

      <!-- CSS -->
      <div v-show="activeContentTab === 'CSS'">
        <CodeMirrorEditor
          v-model="form.source_css"
          lang="css"
          min-height="360px"
        />
      </div>

      <!-- Preview -->
      <div v-show="activeContentTab === 'Preview'">
        <HtmlPreviewFrame
          ref="previewFrame"
          :content-html="form.content_html"
          :source-css="form.source_css"
        />
      </div>
    </div>

    <!-- Stackable additional content blocks (named areas). -->
    <div class="content-blocks-section">
      <div class="content-blocks-header">
        <label class="field-label">{{ $t('cms.additionalBlocks', 'Additional blocks') }}</label>
        <button
          type="button"
          class="btn btn--sm"
          data-testid="entity-page-add-block"
          @click="addBlock"
        >
          {{ $t('cms.addBlock', 'Add block') }}
        </button>
      </div>

      <div
        v-for="(block, index) in form.content_blocks"
        :key="index"
        class="content-block-row"
      >
        <input
          v-model="block.area_name"
          class="field-input block-area-input"
          type="text"
          :placeholder="$t('cms.areaName', 'Area name')"
          data-testid="entity-page-block-area"
        >
        <textarea
          v-model="block.content_html"
          class="field-input block-content-input"
          rows="3"
          :placeholder="$t('cms.blockContent', 'Block HTML')"
          data-testid="entity-page-block-content"
        />
        <button
          type="button"
          class="btn btn--sm btn--danger"
          data-testid="entity-page-remove-block"
          @click="removeBlock(index)"
        >
          {{ $t('cms.remove') }}
        </button>
      </div>
    </div>

    <!-- SEO fields for this entity page. -->
    <div
      class="seo-section"
      data-testid="entity-page-seo"
    >
      <label class="field-label">{{ $t('cms.seo') }}</label>
      <SeoFieldsPanel v-model="form.seo" />
    </div>

    <!-- Save -->
    <div class="actions">
      <button
        type="button"
        class="btn btn--primary"
        :disabled="saving"
        data-testid="entity-page-save"
        @click="save"
      >
        {{ $t('cms.save') }}
      </button>
      <span
        v-if="saveState === 'saved'"
        class="save-status save-status--ok"
        data-testid="entity-page-saved"
      >{{ $t('cms.saved', 'Saved') }}</span>
      <span
        v-if="saveState === 'error'"
        class="save-status save-status--error"
        data-testid="entity-page-error"
      >{{ $t('cms.saveFailed', 'Save failed') }}</span>
    </div>

    <!-- Image picker modal -->
    <CmsImagePicker
      v-if="showImagePicker"
      @select="onImageSelect"
      @close="showImagePicker = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * S128 — CMS Entity Pages authoring tab.
 *
 * A self-contained editor that any owner (a product, a dataset, a booking, …)
 * can mount to author a CMS-backed page for one of its slots. It composes the
 * same authoring primitives the CMS post editor uses (TipTap / CodeMirror /
 * image picker / SEO panel / preview) so there is one home for the behaviour,
 * and talks only to the agnostic backend entity-page projection route.
 */
import { onMounted, reactive, ref, nextTick, watch } from 'vue';
import { api } from '@/api';
import TipTapEditor from './TipTapEditor.vue';
import CodeMirrorEditor from './CodeMirrorEditor.vue';
import HtmlPreviewFrame from './HtmlPreviewFrame.vue';
import CmsImagePicker from './CmsImagePicker.vue';
import SeoFieldsPanel, { type SeoFields } from './SeoFieldsPanel.vue';

interface ContentBlock {
  area_name: string;
  content_html: string;
  source_css?: string;
  sort_order?: number;
}

interface EntityPageForm {
  content_html: string;
  source_css: string;
  seo: SeoFields;
  content_blocks: ContentBlock[];
}

const CONTENT_TABS = [
  { key: 'Visual', label: 'Visual', testid: 'entity-page-visual' },
  { key: 'HTML', label: 'HTML', testid: 'entity-page-html' },
  { key: 'CSS', label: 'CSS', testid: 'entity-page-css' },
  { key: 'Preview', label: 'Preview', testid: 'entity-page-preview' },
] as const;

type ContentTabKey = (typeof CONTENT_TABS)[number]['key'];

const props = withDefaults(
  defineProps<{
    ownerType: string;
    ownerId: string;
    slot?: string;
  }>(),
  { slot: 'main' },
);

const emit = defineEmits<{
  (event: 'saved', projection: unknown): void;
}>();

function emptySeo(): SeoFields {
  return {
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    canonical_url: '',
    robots: 'index,follow',
    schema_json: null,
    seo_excluded: false,
  };
}

const form = reactive<EntityPageForm>({
  content_html: '',
  source_css: '',
  seo: emptySeo(),
  content_blocks: [],
});

// The TipTap working doc; content_html stays the single source of truth.
const contentDoc = ref<Record<string, unknown>>({ type: 'doc', content: [] });

const activeContentTab = ref<ContentTabKey>('HTML');
const saving = ref(false);
const saveState = ref<'idle' | 'saved' | 'error'>('idle');

const tiptapEditor = ref<{
  setFromHtml: (html: string) => void;
  insertImageUrl: (url: string, alt?: string) => void;
} | null>(null);
const htmlEditor = ref<{ insertAtCursor: (text: string) => void } | null>(null);
const previewFrame = ref<{ render: () => void } | null>(null);

function endpoint(): string {
  return `/admin/cms/entity-pages/${props.ownerType}/${props.ownerId}/${props.slot}`;
}

function seedFrom(projection: Record<string, unknown>): void {
  form.content_html = (projection.content_html as string) ?? '';
  form.source_css = (projection.source_css as string) ?? '';
  form.seo = { ...emptySeo(), ...((projection.seo as Partial<SeoFields>) ?? {}) };
  const blocks = (projection.content_blocks as ContentBlock[]) ?? [];
  form.content_blocks = blocks.map((block) => ({
    area_name: block.area_name ?? '',
    content_html: block.content_html ?? '',
    source_css: block.source_css,
    sort_order: block.sort_order,
  }));
  const doc = projection.content_json as Record<string, unknown> | undefined;
  if (doc && Object.keys(doc).length) contentDoc.value = doc;
}

onMounted(async () => {
  const projection = await api.get<Record<string, unknown>>(endpoint());
  seedFrom(projection ?? {});
});

// The Preview frame lives behind a v-show tab; force a re-render on entry.
watch(activeContentTab, async (tab) => {
  if (tab === 'Preview') {
    await nextTick();
    previewFrame.value?.render();
  } else if (tab === 'Visual') {
    await nextTick();
    tiptapEditor.value?.setFromHtml(form.content_html);
  }
});

function addBlock(): void {
  form.content_blocks.push({ area_name: '', content_html: '', source_css: '' });
}

function removeBlock(index: number): void {
  form.content_blocks.splice(index, 1);
}

// ── Image picker: one modal, two targets (Visual cursor / HTML cursor) ──────
const showImagePicker = ref(false);
const pickerMode = ref<'visual' | 'html'>('visual');

function openPicker(mode: 'visual' | 'html'): void {
  pickerMode.value = mode;
  showImagePicker.value = true;
}

function onImageSelect(url: string, alt: string): void {
  if (pickerMode.value === 'visual') {
    tiptapEditor.value?.insertImageUrl(url, alt);
  } else {
    const altAttr = alt ? ` alt="${alt.replace(/"/g, '&quot;')}"` : '';
    htmlEditor.value?.insertAtCursor(`<img src="${url}"${altAttr} style="max-width:100%">`);
  }
  showImagePicker.value = false;
}

async function save(): Promise<void> {
  saving.value = true;
  saveState.value = 'idle';
  const payload = {
    content_html: form.content_html,
    content_json: contentDoc.value,
    source_css: form.source_css,
    seo: form.seo,
    content_blocks: form.content_blocks
      .filter((block) => block.area_name.trim())
      .map((block, index) => ({
        area_name: block.area_name,
        content_html: block.content_html,
        source_css: block.source_css,
        sort_order: block.sort_order ?? index,
      })),
  };
  try {
    const projection = await api.put<Record<string, unknown>>(endpoint(), payload);
    if (projection) seedFrom(projection);
    saveState.value = 'saved';
    emit('saved', projection);
  } catch {
    saveState.value = 'error';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.entity-page-tab { display: flex; flex-direction: column; gap: 1.5rem; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: #374151; }

.tabs { display: flex; gap: 2px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; }
.tab-btn {
  padding: 6px 16px; border: none; background: transparent; cursor: pointer;
  font-size: 0.85rem; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab-btn.active { color: #1d4ed8; border-bottom-color: #1d4ed8; }

.content-toolbar { margin-bottom: 8px; }

.content-blocks-header { display: flex; align-items: center; justify-content: space-between; }
.content-block-row { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.75rem; }
.field-input {
  padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px;
  font-size: 0.9rem; box-sizing: border-box;
}
.block-area-input { flex: 0 0 200px; }
.block-content-input { flex: 1; font-family: monospace; resize: vertical; }

.actions { display: flex; align-items: center; gap: 1rem; }
.save-status { font-size: 0.85rem; }
.save-status--ok { color: #059669; }
.save-status--error { color: #dc2626; }

.btn { padding: 0.4rem 0.9rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.btn--sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn--danger { color: #dc2626; border-color: #fecaca; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
