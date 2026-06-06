<template>
  <div class="cms-view post-editor">
    <div class="post-editor__header">
      <h2>
        {{ isNew
          ? (form.type === 'page' ? $t('cms.newPage', 'New page') : $t('cms.newPost', 'New post'))
          : (form.type === 'page' ? $t('cms.editPage', 'Edit page') : $t('cms.editPost', 'Edit post')) }}
      </h2>
      <div class="post-editor__actions">
        <button
          type="button"
          class="btn btn--ghost"
          data-testid="editor-sidebar-toggle"
          :title="sidebarCollapsed ? 'Show settings panel' : 'Hide settings panel'"
          @click="toggleEditorSidebar"
        >
          {{ sidebarCollapsed ? '⚙ Settings' : 'Hide settings »' }}
        </button>
        <a
          v-if="!isNew && form.slug"
          :href="postUrl"
          target="_blank"
          class="btn btn--ghost post-editor__view-link"
          data-testid="post-view-link"
          :title="form.status === 'published' ? 'View published page' : 'Preview'"
        >
          {{ form.status === 'published' ? 'View Page 🔗' : 'Preview 🔗' }}
        </a>
        <router-link
          :to="{ name: form.type === 'page' ? 'cms-admin-pages' : 'cms-posts' }"
          class="btn btn--ghost"
          data-testid="post-cancel"
        >
          {{ $t('cms.cancel') }}
        </router-link>
        <button
          v-if="canManage"
          class="btn btn--primary"
          :disabled="store.loading"
          data-testid="post-save"
          @click="save()"
        >
          {{ $t('cms.save') }}
        </button>
      </div>
    </div>

    <div
      v-if="store.error"
      class="post-editor__error"
    >
      {{ store.error }}
    </div>

    <div
      class="post-editor__body"
      :class="{ 'post-editor__body--full': sidebarCollapsed }"
    >
      <!-- Main column -->
      <div class="post-editor__main">
        <div class="field-group">
          <label class="field-label">{{ $t('cms.title') }} *</label>
          <input
            v-model="form.title"
            class="field-input"
            type="text"
            data-testid="post-title"
            @blur="autoSlug"
          >
        </div>
        <div class="field-group">
          <label class="field-label">
            {{ $t('cms.slug') }} *
            <a
              v-if="postUrl"
              :href="postUrl"
              target="_blank"
              class="slug-preview-link"
              data-testid="slug-preview-link"
              :title="form.status === 'published' ? 'View page' : 'Preview (unpublished)'"
            >🔗</a>
          </label>
          <div class="slug-input-row">
            <span
              class="slug-prefix"
              :title="feUserBaseUrl + '/'"
            >{{ feUserBaseUrl }}/</span>
            <input
              v-model="form.slug"
              class="field-input field-input--mono slug-input"
              type="text"
              data-testid="post-slug"
            >
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">{{ $t('cms.excerpt') }}</label>
          <textarea
            v-model="form.excerpt"
            class="field-input"
            rows="2"
            data-testid="post-excerpt"
          />
        </div>

        <!-- Type-specific fields, rendered from the post-type schema -->
        <div
          v-if="typeFields.length"
          class="type-fields"
        >
          <h3 class="section-subtitle">
            {{ $t('cms.typeFields') }}
          </h3>
          <div
            v-for="field in typeFields"
            :key="field.key"
            class="field-group"
          >
            <label class="field-label">{{ field.label }}</label>
            <input
              v-model="typeDataModel[field.key]"
              class="field-input"
              :type="field.type === 'number' ? 'number' : 'text'"
              :data-testid="`typefield-${field.key}`"
            >
          </div>
        </div>

        <!-- Body — a Visual (WYSIWYG) tab plus raw HTML / CSS and a live preview.
             content_html is the single source of truth: the Visual editor writes
             back to it via update:htmlValue, and on switching to Visual we re-seed
             the editor from the current HTML so hand-authored markup is never
             silently flattened. content_json keeps a single richtext block for
             back-compat. -->
        <div class="content-block-section">
          <label class="field-label">{{ $t('cms.content') }}</label>
          <div class="tabs">
            <button
              v-for="tab in contentTabs"
              :key="tab"
              type="button"
              :class="['tab-btn', { active: activeContentTab === tab }]"
              data-testid="content-tab"
              @click="activeContentTab = tab"
            >
              {{ tab }}
            </button>
          </div>

          <!-- Visual (WYSIWYG) — posts only; pages are hand-authored HTML. -->
          <div
            v-if="showVisualTab"
            v-show="activeContentTab === 'Visual'"
          >
            <TipTapEditor
              ref="tiptapEditor"
              v-model="contentDoc"
              data-testid="post-visual-editor"
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
                data-testid="html-insert-image"
                @click="openPicker('html')"
              >
                {{ $t('cms.insertImage', 'Insert image') }}
              </button>
              <button
                type="button"
                class="btn btn--sm"
                data-testid="html-insert-gallery"
                @click="openPicker('gallery')"
              >
                {{ $t('cms.insertGallery', 'Insert gallery') }}
              </button>
            </div>
            <CodeMirrorEditor
              ref="htmlEditor"
              v-model="form.content_html"
              lang="html"
              min-height="380px"
            />
          </div>

          <!-- CSS -->
          <div v-show="activeContentTab === 'CSS'">
            <CodeMirrorEditor
              v-model="form.source_css"
              lang="css"
              min-height="380px"
            />
          </div>

          <!-- Preview -->
          <div v-show="activeContentTab === 'Preview'">
            <iframe
              ref="postPreviewFrame"
              class="post-preview-iframe"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>

        <!-- SEO panel -->
        <details
          class="seo-section"
          open
        >
          <summary class="seo-section__toggle">
            {{ $t('cms.seo') }}
          </summary>
          <div class="seo-tab">
            <!-- Live SERP preview -->
            <div
              class="serp-preview"
              data-testid="serp-preview"
            >
              <div class="serp-preview__title">
                {{ serpTitle }}
              </div>
              <div class="serp-preview__url">
                {{ serpUrl }}
              </div>
              <div class="serp-preview__desc">
                {{ serpDescription }}
              </div>
              <div class="serp-preview__counts">
                <span :class="{ 'serp-count--warn': titleTooLong }">
                  {{ $t('cms.titleChars') }}: {{ serpTitle.length }} / {{ SERP_TITLE_MAX }}
                </span>
                <span
                  v-if="titleTooLong"
                  class="serp-warn"
                  data-testid="serp-title-warning"
                >{{ $t('cms.titleTooLong') }}</span>
                <span :class="{ 'serp-count--warn': descTooLong }">
                  {{ $t('cms.descChars') }}: {{ serpDescription.length }} / {{ SERP_DESC_MAX }}
                </span>
                <span
                  v-if="descTooLong"
                  class="serp-warn"
                  data-testid="serp-desc-warning"
                >{{ $t('cms.descTooLong') }}</span>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">{{ $t('cms.metaTitle') }}</label>
              <input
                v-model="form.meta_title"
                class="field-input"
                type="text"
                data-testid="seo-meta-title"
              >
            </div>
            <div class="field-group">
              <label class="field-label">{{ $t('cms.metaDescription') }}</label>
              <textarea
                v-model="form.meta_description"
                class="field-input"
                rows="3"
                data-testid="seo-meta-description"
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
                rows="4"
                @blur="parseSchemaJson"
              />
              <span
                v-if="schemaError"
                class="field-error"
              >{{ schemaError }}</span>
            </div>

            <!-- Exclude from search engines -->
            <div class="field-group">
              <label class="field-label">
                <input
                  v-model="form.seo_excluded"
                  type="checkbox"
                  data-testid="seo-excluded-toggle"
                >
                &nbsp;{{ $t('cms.excludeFromSearch') }}
              </label>
              <p
                class="seo-effective"
                data-testid="seo-effective-state"
              >
                {{ effectiveSeoState }}
              </p>
            </div>

            <!-- hreflang / translation-of picker -->
            <div class="field-group">
              <label class="field-label">{{ $t('cms.translationOf') }}</label>
              <input
                v-model="form.translation_group_id"
                class="field-input field-input--mono"
                type="text"
                data-testid="translation-group"
                :placeholder="$t('cms.translationGroupHint')"
              >
            </div>
          </div>
        </details>
      </div>

      <!-- Sidebar — collapsible to give the editor more width -->
      <div
        v-show="!sidebarCollapsed"
        class="post-editor__sidebar"
      >
        <div class="sidebar-card">
          <!-- Featured image — select from / upload to the CMS image gallery -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.featuredImage', 'Featured image') }}</label>
            <div
              v-if="form.featured_image_url"
              class="featured-image"
              data-testid="featured-image-preview"
            >
              <img
                :src="form.featured_image_url"
                alt=""
                class="featured-image__thumb"
              >
              <div class="featured-image__actions">
                <button
                  type="button"
                  class="btn btn--sm"
                  data-testid="featured-image-change"
                  @click="openPicker('featured')"
                >
                  {{ $t('cms.change', 'Change') }}
                </button>
                <button
                  type="button"
                  class="btn btn--sm btn--danger"
                  data-testid="featured-image-remove"
                  @click="form.featured_image_url = ''"
                >
                  {{ $t('cms.remove', 'Remove') }}
                </button>
              </div>
            </div>
            <button
              v-else
              type="button"
              class="btn featured-image__select"
              data-testid="featured-image-select"
              @click="openPicker('featured')"
            >
              {{ $t('cms.selectImage', 'Select image') }}
            </button>
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('cms.type') }}</label>
            <select
              v-model="form.type"
              class="field-input"
              data-testid="post-type"
            >
              <option
                v-for="pt in store.postTypes"
                :key="pt.key"
                :value="pt.key"
              >
                {{ pt.label }}
              </option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('cms.status') }}</label>
            <select
              v-model="form.status"
              class="field-input"
              data-testid="post-status"
              :style="statusStyle(form.status)"
            >
              <option
                v-for="s in POST_STATUSES"
                :key="s"
                :value="s"
                :style="statusStyle(s)"
              >
                {{ $t(`cms.status_${s}`) }}
              </option>
            </select>
          </div>

          <div
            v-if="form.status === 'scheduled'"
            class="field-group"
          >
            <label class="field-label">{{ $t('cms.publishedAt') }}</label>
            <input
              v-model="publishedAtLocal"
              class="field-input"
              type="datetime-local"
              data-testid="published-at"
            >
          </div>

          <!-- Parent picker — hierarchical types only -->
          <div
            v-if="isHierarchical"
            class="field-group"
          >
            <label class="field-label">{{ $t('cms.parent') }}</label>
            <select
              v-model="form.parent_id"
              class="field-input"
              data-testid="parent-picker"
            >
              <option :value="null">
                — {{ $t('cms.none') }} —
              </option>
              <option
                v-for="candidate in parentCandidates"
                :key="candidate.id"
                :value="candidate.id"
              >
                {{ candidate.title }}
              </option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('cms.language') }}</label>
            <select
              v-model="form.language"
              class="field-input"
            >
              <option value="en">
                English
              </option>
              <option value="de">
                Deutsch
              </option>
              <option value="ru">
                Russian
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

          <!-- Render target — layout / style / theme-switcher (parity with the
               page editor): which layout + style the published page renders with. -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.layout') }}</label>
            <select
              v-model="form.layout_id"
              class="field-input"
              data-testid="post-layout"
            >
              <option value="">
                — {{ $t('cms.none') }} —
              </option>
              <option
                v-for="layout in store.layouts?.items ?? []"
                :key="layout.id"
                :value="layout.id"
              >
                {{ layout.name }}
              </option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">{{ $t('cms.style') }}</label>
            <select
              v-model="form.style_id"
              class="field-input"
              data-testid="post-style"
            >
              <option value="">
                — {{ $t('cms.none') }} —
              </option>
              <option
                v-for="style in store.styles?.items ?? []"
                :key="style.id"
                :value="style.id"
              >
                {{ style.name }}{{ style.is_default ? ' (default)' : '' }}
              </option>
            </select>
          </div>
          <!-- Category picker — selected shown as removable chips above -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.categories') }}</label>
            <div
              v-if="selectedCategories.length"
              class="term-chips"
              data-testid="selected-categories"
            >
              <span
                v-for="cat in selectedCategories"
                :key="cat.id"
                class="term-chip term-chip--category"
              >
                {{ cat.name }}
                <button
                  type="button"
                  class="term-chip__x"
                  :data-testid="`remove-category-${cat.id}`"
                  :aria-label="`Remove ${cat.name}`"
                  @click="removeCategory(cat.id)"
                >×</button>
              </span>
            </div>
            <select
              :value="''"
              class="field-input"
              data-testid="term-picker-category"
              @change="addCategory(($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                + {{ $t('cms.addCategory', 'Add category…') }}
              </option>
              <option
                v-for="cat in unselectedCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}{{ cat.seo_excluded ? ' (noindex)' : '' }}
              </option>
            </select>
          </div>

          <!-- Tag picker — selected shown as a removable cloud above -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.tags') }}</label>
            <div
              v-if="selectedTags.length"
              class="term-chips"
              data-testid="tags-cloud"
            >
              <span
                v-for="tag in selectedTags"
                :key="tag.id"
                class="term-chip term-chip--tag"
              >
                {{ tag.name }}
                <button
                  type="button"
                  class="term-chip__x"
                  :data-testid="`remove-tag-${tag.id}`"
                  :aria-label="`Remove ${tag.name}`"
                  @click="removeTag(tag.id)"
                >×</button>
              </span>
            </div>
            <select
              :value="''"
              class="field-input"
              data-testid="term-picker-tag"
              @change="addTag(($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                + {{ $t('cms.addTag', 'Add tag…') }}
              </option>
              <option
                v-for="tag in unselectedTags"
                :key="tag.id"
                :value="tag.id"
              >
                {{ tag.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <CmsImagePicker
      v-if="showImagePicker"
      :multiple="pickerMode === 'gallery'"
      @select="onImageSelect"
      @select-many="onGallerySelect"
      @close="showImagePicker = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCmsContentStore, type CmsTerm, type PostTypeField } from '../stores/useCmsContentStore';
import { useAuthStore } from '@/stores/auth';
import CmsImagePicker from '../components/CmsImagePicker.vue';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';
import TipTapEditor from '../components/TipTapEditor.vue';

const SERP_TITLE_MAX = 60;
const SERP_DESC_MAX = 160;
const POST_STATUSES = ['draft', 'pending', 'scheduled', 'published', 'private', 'trash'] as const;

// Per-status colours for the status selector (options + the closed control).
const STATUS_STYLES: Record<string, { color: string; fontWeight?: string }> = {
  published: { color: '#16a34a' }, // green
  draft: { color: '#dc2626' }, // red
  pending: { color: '#f59e0b' }, // orange
  scheduled: { color: '#d946ef' }, // magenta
  private: { color: '#000000', fontWeight: '700' }, // black, bold
};
function statusStyle(status: string): Record<string, string> {
  return STATUS_STYLES[status] ?? {};
}
const CONTENT_TABS = ['Visual', 'HTML', 'CSS', 'Preview'] as const;

const route = useRoute();
const router = useRouter();
const store = useCmsContentStore();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasPermission('cms.manage'));

const id = computed(() => route.params.id as string | undefined);
const isNew = computed(() => !id.value);

interface PostForm {
  type: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image_url: string;
  content_json: Record<string, unknown>;
  content_html: string;
  source_css: string;
  type_data: Record<string, unknown>;
  parent_id: string | null;
  status: string;
  published_at: string | null;
  language: string;
  translation_group_id: string | null;
  sort_order: number;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_url: string;
  robots: string;
  schema_json: unknown;
  seo_excluded: boolean;
  layout_id: string;
  style_id: string;
}

const form = ref<PostForm>({
  type: '',
  slug: '',
  title: '',
  excerpt: '',
  featured_image_url: '',
  content_json: { type: 'doc', content: [] },
  content_html: '',
  source_css: '',
  type_data: {},
  parent_id: null,
  status: 'draft',
  published_at: null,
  language: 'en',
  translation_group_id: null,
  sort_order: 0,
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
  layout_id: '',
  style_id: '',
});

const schemaJsonText = ref('');
const schemaError = ref('');

// ── Settings-panel collapse (more width for the editor) ─────────────────────
const SIDEBAR_KEY = 'post_editor_sidebar_collapsed';
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1');
watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
});
function toggleEditorSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

// ── Image picker (featured image, or insert into content) ───────────────────
// One picker, three targets: the sidebar featured image, the Visual (TipTap)
// editor at the cursor, or the raw HTML editor at the cursor.
const showImagePicker = ref(false);
const pickerMode = ref<'featured' | 'visual' | 'html' | 'gallery'>('featured');
const htmlEditor = ref<{ insertAtCursor: (text: string) => void } | null>(null);

function openPicker(mode: 'featured' | 'visual' | 'html' | 'gallery') {
  pickerMode.value = mode;
  showImagePicker.value = true;
}

function onImageSelect(url: string, alt: string) {
  if (pickerMode.value === 'featured') {
    form.value.featured_image_url = url;
  } else if (pickerMode.value === 'visual') {
    tiptapEditor.value?.insertImageUrl(url, alt);
  } else {
    const altAttr = alt ? ` alt="${alt.replace(/"/g, '&quot;')}"` : '';
    htmlEditor.value?.insertAtCursor(`<img src="${url}"${altAttr} style="max-width:100%">`);
  }
  showImagePicker.value = false;
}

// Build a self-contained, pure-CSS scroll-snap slideshow. Inline styles only, so
// it needs no global CSS and renders through the public renderer's v-html on both
// pages and posts. No JS — swipe/scroll moves between slides.
function buildGalleryHtml(images: { url: string; alt: string }[]): string {
  const slides = images
    .map((img) => {
      const altAttr = img.alt ? ` alt="${img.alt.replace(/"/g, '&quot;')}"` : ' alt=""';
      return (
        `<img src="${img.url}"${altAttr} loading="lazy" ` +
        'style="flex:0 0 100%;scroll-snap-align:center;width:100%;height:100%;object-fit:cover;border-radius:8px;">'
      );
    })
    .join('');
  return (
    '<div class="cms-gallery" ' +
    'style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;' +
    '-webkit-overflow-scrolling:touch;aspect-ratio:16/9;margin:1rem 0;">' +
    slides +
    '</div>'
  );
}

function onGallerySelect(images: { url: string; alt: string }[]) {
  if (images.length) {
    htmlEditor.value?.insertAtCursor(buildGalleryHtml(images));
  }
  showImagePicker.value = false;
}

// ── Content tabs ────────────────────────────────────────────────────────────
// The Visual (WYSIWYG) tab is posts-only: pages are hand-authored marketing
// HTML where a WYSIWYG would flatten the markup. Default to HTML so pages never
// land on (a hidden) Visual; a post is flipped to Visual once its type resolves.
const activeContentTab = ref<(typeof CONTENT_TABS)[number]>('HTML');
const showVisualTab = computed(() => form.value.type === 'post');
type ContentTab = (typeof CONTENT_TABS)[number];
const contentTabs = computed<ContentTab[]>(() =>
  CONTENT_TABS.filter((tab) => showVisualTab.value || tab !== 'Visual'),
);
const postPreviewFrame = ref<HTMLIFrameElement | null>(null);
// The Visual editor keeps its own ProseMirror doc; content_html stays the
// source of truth, so this is a working model, never persisted directly.
const contentDoc = ref<Record<string, unknown>>({ type: 'doc', content: [] });
const tiptapEditor = ref<{
  setFromHtml: (html: string) => void;
  insertImageUrl: (url: string, alt?: string) => void;
} | null>(null);

function updatePostPreview() {
  const frame = postPreviewFrame.value;
  const doc = frame?.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>img{max-width:100%;height:auto}${form.value.source_css}</style></head><body>${form.value.content_html}</body></html>`);
  doc.close();
}

watch(activeContentTab, async (tab) => {
  if (tab === 'Preview') {
    await nextTick();
    updatePostPreview();
  } else if (tab === 'Visual') {
    // Re-seed the WYSIWYG from the current HTML so edits made on the HTML tab
    // are reflected and hand-authored markup is preserved on round-trip.
    await nextTick();
    tiptapEditor.value?.setFromHtml(form.value.content_html);
  }
});

// ── View Page link (fe-user public URL), mirroring the page editor ──────────
const feUserBaseUrl = window.location.port === '8081'
  ? 'http://localhost:8080'
  : window.location.origin.replace(':8081', ':8080');
// Preview token (capability) for viewing unpublished content via a shareable
// URL — only known once a post is saved/loaded.
const previewToken = ref('');
const postUrl = computed(() => {
  const slug = (form.value.slug || '').replace(/^\//, '');
  if (!slug) return '';
  const url = `${feUserBaseUrl}/${slug}`;
  // Published → public URL; otherwise a preview link that bypasses the
  // published gate via the post's preview_token.
  if (form.value.status !== 'published' && previewToken.value) {
    return `${url}?preview_token=${previewToken.value}`;
  }
  return url;
});

// type_data is kept as a plain object; this proxy keeps v-model bindings stable.
const typeDataModel = computed<Record<string, unknown>>(() => form.value.type_data);

// ── Term selection ──────────────────────────────────────────────────────
const selectedCategoryIds = ref<string[]>([]);
const selectedTagIds = ref<string[]>([]);
const categoryTerms = ref<CmsTerm[]>([]);
const tagTerms = ref<CmsTerm[]>([]);

const selectedTermIds = computed<string[]>({
  get: () => [...selectedCategoryIds.value, ...selectedTagIds.value],
  set: (ids: string[]) => {
    const catIds = new Set(categoryTerms.value.map((t) => t.id));
    selectedCategoryIds.value = ids.filter((termId) => catIds.has(termId));
    selectedTagIds.value = ids.filter((termId) => !catIds.has(termId));
  },
});

// Selected chips (shown above each selector) + the still-pickable remainder.
const selectedCategories = computed(() =>
  categoryTerms.value.filter((cat) => selectedCategoryIds.value.includes(cat.id)),
);
const unselectedCategories = computed(() =>
  categoryTerms.value.filter((cat) => !selectedCategoryIds.value.includes(cat.id)),
);
const selectedTags = computed(() =>
  tagTerms.value.filter((tag) => selectedTagIds.value.includes(tag.id)),
);
const unselectedTags = computed(() =>
  tagTerms.value.filter((tag) => !selectedTagIds.value.includes(tag.id)),
);

function addCategory(id: string) {
  if (id && !selectedCategoryIds.value.includes(id)) selectedCategoryIds.value.push(id);
}
function removeCategory(id: string) {
  selectedCategoryIds.value = selectedCategoryIds.value.filter((c) => c !== id);
}
function addTag(id: string) {
  if (id && !selectedTagIds.value.includes(id)) selectedTagIds.value.push(id);
}
function removeTag(id: string) {
  selectedTagIds.value = selectedTagIds.value.filter((t) => t !== id);
}

// ── Post-type awareness ─────────────────────────────────────────────────
const currentPostType = computed(() => store.postTypes.find((pt) => pt.key === form.value.type) ?? null);
const isHierarchical = computed(() => currentPostType.value?.hierarchical ?? false);
const typeFields = computed<PostTypeField[]>(() => currentPostType.value?.type_data?.fields ?? []);

const parentCandidates = computed(() => {
  const items = store.posts?.items ?? [];
  return items.filter((post) => post.type === form.value.type && post.id !== id.value);
});

// ── SERP preview ────────────────────────────────────────────────────────
const serpTitle = computed(() => (form.value.meta_title || form.value.title || '').trim());
const serpUrl = computed(() => {
  const slug = (form.value.slug || '').replace(/^\//, '');
  return `${window.location.origin.replace(/:8081$/, ':8080')}/${slug}`;
});
const serpDescription = computed(() => (form.value.meta_description || form.value.excerpt || '').trim());
const titleTooLong = computed(() => serpTitle.value.length > SERP_TITLE_MAX);
const descTooLong = computed(() => serpDescription.value.length > SERP_DESC_MAX);

// ── Effective SEO (inheritance from excluded terms) ─────────────────────
const excludedSelectedTerms = computed(() => {
  const all = [...categoryTerms.value, ...tagTerms.value];
  const selected = new Set(selectedTermIds.value);
  return all.filter((term) => selected.has(term.id) && term.seo_excluded);
});

const effectiveSeoState = computed(() => {
  if (form.value.seo_excluded) return 'noindex — excluded on this post';
  if (excludedSelectedTerms.value.length) {
    const names = excludedSelectedTerms.value.map((term) => term.name).join(', ');
    return `noindex — inherited from ${names}`;
  }
  return form.value.robots || 'index,follow';
});

// ── published_at <-> datetime-local binding ─────────────────────────────
const publishedAtLocal = computed<string>({
  get: () => {
    if (!form.value.published_at) return '';
    // ISO → local datetime-local value (yyyy-MM-ddTHH:mm)
    return form.value.published_at.slice(0, 16);
  },
  set: (val: string) => {
    form.value.published_at = val ? new Date(val).toISOString() : null;
  },
});

// Back-compat: pull HTML out of a single-richtext content_json block when a
// post predates the dedicated content_html column.
function extractRichtextHtml(contentJson: Record<string, unknown> | null | undefined): string {
  const blocks = (contentJson as { blocks?: Array<{ type?: string; data?: { html?: string } }> } | null)?.blocks;
  if (!Array.isArray(blocks)) return '';
  const richtext = blocks.find((block) => block.type === 'richtext');
  return richtext?.data?.html ?? '';
}

// ── Slug helper ─────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function autoSlug() {
  if (!form.value.slug && form.value.title) {
    form.value.slug = slugify(form.value.title);
  }
}

function parseSchemaJson() {
  schemaError.value = '';
  const text = schemaJsonText.value.trim();
  if (!text) {
    form.value.schema_json = null;
    return;
  }
  try {
    form.value.schema_json = JSON.parse(text);
  } catch {
    schemaError.value = 'Invalid JSON';
  }
}

// Non-hierarchical types can't carry a parent — clear it on type change.
watch(isHierarchical, (hierarchical) => {
  if (!hierarchical) form.value.parent_id = null;
});

// Keep the active content tab valid for the type: posts open on Visual; any
// other type (page, custom) has no Visual tab, so bounce off it to HTML.
watch(() => form.value.type, (type) => {
  if (type === 'post') activeContentTab.value = 'Visual';
  else if (activeContentTab.value === 'Visual') activeContentTab.value = 'HTML';
});

async function save() {
  // content_html is the source of truth; content_json carries the same markup
  // as a single richtext block so back-compat consumers keep working.
  const contentJson = {
    blocks: [{ type: 'richtext', data: { html: form.value.content_html }, position: 0 }],
  };
  const payload: Record<string, unknown> = {
    type: form.value.type,
    slug: form.value.slug,
    title: form.value.title,
    excerpt: form.value.excerpt || null,
    featured_image_url: form.value.featured_image_url || null,
    content_json: contentJson,
    content_html: form.value.content_html || null,
    source_css: form.value.source_css || null,
    type_data: Object.keys(form.value.type_data).length ? form.value.type_data : null,
    parent_id: isHierarchical.value ? form.value.parent_id : null,
    status: form.value.status,
    published_at: form.value.status === 'scheduled' ? form.value.published_at : form.value.published_at,
    language: form.value.language,
    translation_group_id: form.value.translation_group_id || null,
    sort_order: form.value.sort_order,
    meta_title: form.value.meta_title || null,
    meta_description: form.value.meta_description || null,
    meta_keywords: form.value.meta_keywords || null,
    og_title: form.value.og_title || null,
    og_description: form.value.og_description || null,
    og_image_url: form.value.og_image_url || null,
    canonical_url: form.value.canonical_url || null,
    robots: form.value.robots || 'index,follow',
    schema_json: form.value.schema_json,
    seo_excluded: form.value.seo_excluded,
    layout_id: form.value.layout_id || null,
    style_id: form.value.style_id || null,
  };
  if (id.value) payload.id = id.value;

  const saved = await store.savePost(payload);
  const postId = saved?.id ?? id.value;
  if (postId) {
    await store.assignTerms(postId, selectedTermIds.value);
  }
  if (saved && isNew.value) {
    router.replace({ name: 'cms-post-edit', params: { id: saved.id } });
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchPostTypes(),
    store.fetchTermTypes(),
    store.fetchLayouts({ per_page: 100 }),
    store.fetchStyles({ per_page: 100 }),
  ]);

  // For a new post, honor the ?type= the list passed (post vs page); otherwise
  // default to the first registered post-type.
  const presetType = route.query.type as string | undefined;
  if (isNew.value && presetType && store.postTypes.some((pt) => pt.key === presetType)) {
    form.value.type = presetType;
  } else if (!form.value.type && store.postTypes.length) {
    form.value.type = store.postTypes[0].key;
  }

  // Load term pickers for category + tag (built-in taxonomies).
  await store.fetchTerms('category');
  categoryTerms.value = [...store.terms];
  await store.fetchTerms('tag');
  tagTerms.value = [...store.terms];

  // Load parent candidates for hierarchical types.
  await store.fetchPosts({ per_page: 100 });

  if (!isNew.value) {
    await store.fetchPost(id.value!);
    const post = store.currentPost;
    if (post) {
      form.value = {
        type: post.type,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? '',
        featured_image_url: (post as Record<string, unknown>).featured_image_url as string ?? '',
        content_json: post.content_json ?? { type: 'doc', content: [] },
        content_html: post.content_html ?? extractRichtextHtml(post.content_json),
        source_css: (post as Record<string, unknown>).source_css as string ?? '',
        type_data: (post.type_data as Record<string, unknown>) ?? {},
        parent_id: post.parent_id,
        status: post.status,
        published_at: post.published_at,
        language: post.language,
        translation_group_id: post.translation_group_id,
        sort_order: post.sort_order,
        meta_title: post.meta_title ?? '',
        meta_description: post.meta_description ?? '',
        meta_keywords: post.meta_keywords ?? '',
        og_title: post.og_title ?? '',
        og_description: post.og_description ?? '',
        og_image_url: post.og_image_url ?? '',
        canonical_url: post.canonical_url ?? '',
        robots: post.robots ?? 'index,follow',
        schema_json: post.schema_json ?? null,
        seo_excluded: post.seo_excluded ?? false,
        layout_id: post.layout_id ?? '',
        style_id: post.style_id ?? '',
      };
      previewToken.value = (post as Record<string, unknown>).preview_token as string ?? '';
      schemaJsonText.value = post.schema_json ? JSON.stringify(post.schema_json, null, 2) : '';
      selectedTermIds.value = post.term_ids ?? [];
    }
  }
});

defineExpose({ form, selectedTermIds, save, activeContentTab, openPicker, onImageSelect, onGallerySelect, sidebarCollapsed, toggleEditorSidebar });
</script>

<style scoped>
.post-editor__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
.post-editor__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.post-editor__error { background: #fee2e2; color: #991b1b; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
.post-editor__body { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; align-items: start; min-width: 0; }
.post-editor__body--full { grid-template-columns: 1fr; }
@media (max-width: 900px) { .post-editor__body { grid-template-columns: 1fr; } }

.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #374151; }
.field-input { width: 100%; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.field-input--mono { font-family: monospace; }

/* Slug field: a fixed base-URL prefix glued to the editable slug input. */
.slug-input-row { display: flex; align-items: stretch; min-width: 0; }
.slug-prefix {
  display: inline-flex; align-items: center; padding: 0 0.5rem;
  background: #f3f4f6; border: 1px solid #d1d5db; border-right: none;
  border-radius: 4px 0 0 4px; font-size: 0.8rem; color: #6b7280;
  font-family: monospace; white-space: nowrap; max-width: 55%; overflow: hidden; text-overflow: ellipsis;
}
.slug-input { border-radius: 0 4px 4px 0; min-width: 0; }
.slug-preview-link {
  margin-left: 6px; text-decoration: none; color: #3b82f6; font-weight: 700;
  font-size: 0.95rem;
}
.slug-preview-link:hover { color: #1d4ed8; }
.field-input--multi { min-height: 90px; }
textarea.field-input { resize: vertical; }
.field-error { font-size: 0.8rem; color: #dc2626; margin-top: 2px; }

.section-subtitle { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 0 0 8px; }
.type-fields { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 16px; }

.content-block-section { margin-bottom: 24px; }
.content-toolbar { display: flex; gap: 0.5rem; padding: 6px 0; }
.tabs { display: flex; gap: 0; margin-bottom: 0; border-bottom: 1px solid #e5e7eb; }
.tab-btn { padding: 0.5rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9rem; color: #6b7280; }
.tab-btn.active { color: #1d4ed8; border-bottom-color: #1d4ed8; font-weight: 600; }
.post-preview-iframe { width: 100%; height: 420px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; }
.post-editor__view-link { color: #3b82f6; font-size: 0.85rem; }

.sidebar-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; }

.featured-image__thumb { width: 100%; border-radius: 6px; display: block; border: 1px solid #e5e7eb; object-fit: cover; max-height: 180px; }
.featured-image__actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.featured-image__select { width: 100%; }

.term-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.5rem; }
.term-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px 2px 10px; border-radius: 12px; font-size: 0.8rem; line-height: 1.6; }
.term-chip--category { background: #dbeafe; color: #1e40af; }
.term-chip--tag { background: #e5e7eb; color: #374151; }
.term-chip__x { border: none; background: none; cursor: pointer; font-size: 1rem; line-height: 1; color: inherit; opacity: 0.6; padding: 0 2px; }
.term-chip__x:hover { opacity: 1; }
.btn--sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.btn--danger { color: #b91c1c; border-color: #fca5a5; }

.seo-section { margin-top: 20px; }
.seo-section__toggle { cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #374151; padding: 10px 0; border-top: 1px solid #e5e7eb; }
.seo-tab { padding-top: 1rem; }

.serp-preview { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: #fff; }
.serp-preview__title { color: #1a0dab; font-size: 1.1rem; line-height: 1.3; }
.serp-preview__url { color: #006621; font-size: 0.8rem; }
.serp-preview__desc { color: #4d5156; font-size: 0.85rem; margin-top: 4px; }
.serp-preview__counts { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.72rem; color: #6b7280; margin-top: 8px; }
.serp-count--warn { color: #b45309; font-weight: 600; }
.serp-warn { color: #b45309; font-weight: 600; }

.seo-effective { font-size: 0.78rem; color: #6b7280; margin-top: 4px; }

.btn { padding: 0.45rem 1rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.875rem; }
.btn--ghost { text-decoration: none; color: #374151; display: inline-flex; align-items: center; }
.btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
