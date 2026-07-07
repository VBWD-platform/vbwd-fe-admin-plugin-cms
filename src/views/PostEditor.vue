<template>
  <div class="cms-view post-editor">
    <div class="post-editor__header">
      <h2>
        {{ isNew
          ? (form.type === 'page' ? $t('cms.newPage', 'New page') : $t('cms.newPost', 'New post'))
          : (form.type === 'page' ? $t('cms.editPage', 'Edit page') : $t('cms.editPost', 'Edit post')) }}
      </h2>
      <div class="post-editor__actions">
        <!-- AI-agnostic header-action seam (S41): sibling plugins inject the
             AI ✨ dropdown here, before Save. Empty registry → nothing renders. -->
        <component
          :is="action"
          v-for="(action, index) in headerActionComponents"
          :key="`cms-editor-header-action-${index}`"
          :context="editorContext"
        />
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

    <!-- AI-agnostic panel seam (S41): rendered between the header and the body.
         Sibling plugins mount the collapsible AI panel here. Empty → nothing. -->
    <component
      :is="panel"
      v-for="(panel, index) in panelComponents"
      :key="`cms-editor-panel-${index}`"
      :context="editorContext"
    />

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

        <!-- Live permalink preview (S122): the full path the post WOULD get,
             computed by the backend renderer (DRY). Read-only. Posts only —
             pages keep their hand-authored slug verbatim (§2). -->
        <div
          v-if="form.type === 'post'"
          class="field-group permalink-preview"
          data-testid="permalink-preview"
        >
          <label class="field-label">{{ $t('cms.permalinkPreview', 'Permalink preview') }}</label>
          <div
            class="permalink-preview__path"
            data-testid="permalink-preview-path"
          >
            /{{ permalinkPreviewPath }}
          </div>
          <a
            v-if="permalinkPreviewUrl"
            :href="permalinkPreviewUrl"
            target="_blank"
            class="permalink-preview__url"
            data-testid="permalink-preview-url"
          >{{ permalinkPreviewUrl }}</a>
          <p
            v-if="permalinkCanonicalMismatch"
            class="permalink-preview__mismatch"
            data-testid="permalink-canonical-mismatch"
          >
            {{ $t('cms.permalinkCanonicalMismatch',
                  'The canonical URL override differs from the computed permalink.') }}
          </p>
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
          <label class="field-label">{{ primaryContentLabel || $t('cms.content') }}</label>
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

        <!-- Additional content areas (S55.2) — one collapsible HTML/CSS editor
             per extra `type:content` layout area. The first content area stays
             in the primary editor above (→ content_html). -->
        <details
          v-for="area in additionalContentAreas"
          :key="area.name"
          class="content-block-section content-block-extra"
          :data-testid="`content-block-editor-${area.name}`"
          open
        >
          <summary class="content-block-extra__title">
            {{ area.label || area.name }}
          </summary>
          <label class="field-label">{{ $t('cms.content') }} (HTML)</label>
          <CodeMirrorEditor
            v-model="form.content_blocks[area.name].content_html"
            lang="html"
            min-height="240px"
          />
          <label class="field-label">{{ $t('cms.css', 'CSS') }}</label>
          <CodeMirrorEditor
            v-model="form.content_blocks[area.name].source_css"
            lang="css"
            min-height="160px"
          />
        </details>

        <!-- Page-widgets panel (S55.2) — assign a widget to each widget-capable
             layout area, overriding the layout default. Clearing falls back to
             the layout's own widget. -->
        <details
          v-if="widgetAreas.length"
          class="page-widgets-section"
          data-testid="page-widgets-panel"
          open
        >
          <summary class="page-widgets-section__title">
            {{ $t('cms.pageWidgets', 'Page widgets') }}
          </summary>
          <p class="page-widgets-hint">
            {{ $t('cms.pageWidgetsHint', 'Pick a widget per area to override the layout default for this page only.') }}
          </p>
          <template
            v-for="area in widgetAreas"
            :key="area.name"
          >
            <div
              class="page-widget-row"
              :data-testid="`page-widget-row-${area.name}`"
            >
              <span class="page-widget-row__area">{{ area.label || area.name }}</span>
              <select
                class="field-input"
                :data-testid="`page-widget-select-${area.name}`"
                :value="pageWidgetIdFor(area.name)"
                @change="setPageWidget(area.name, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  — {{ $t('cms.layoutDefault', 'Layout default') }} —
                </option>
                <option
                  v-for="widget in store.widgets?.items ?? []"
                  :key="widget.id"
                  :value="widget.id"
                >
                  {{ widget.name }}
                </option>
              </select>
            </div>

            <!-- Per-page config override: a SIBLING after its area's row (not
                 nested inside it), so it spans the panel width below the picker.
                 Shown for ANY selected widget; the body matches the global Widget
                 Editor per widget type + a per-page CSS editor (descriptor-less
                 vue widgets still get the CSS editor so the block is never empty). -->
            <details
              v-if="selectedWidgetFor(area.name)"
              class="page-widget-config"
              :data-testid="`page-widget-config-${area.name}`"
            >
              <summary class="page-widget-config__title">
                {{ $t('cms.configureForThisPage', 'Configure for this page') }}
              </summary>
              <CmsWidgetConfigFields
                :widget-type="selectedWidgetTypeFor(area.name)"
                :component-name="selectedComponentNameFor(area.name)"
                :model-value="pageWidgetConfigModelFor(area.name)"
                @update:model-value="setPageWidgetConfig(area.name, $event)"
              />
            </details>
          </template>
        </details>

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

          <!-- Magazine hero toggle — posts only. Default ON; unticking stores
               show_featured_hero=false in type_data so the fe-user post render
               falls back to the plain title header. -->
          <div
            v-if="form.type === 'post'"
            class="field-group"
          >
            <label class="field-label">
              <input
                v-model="showFeaturedHeroModel"
                type="checkbox"
                data-testid="post-show-featured-hero"
              >
              &nbsp;{{ $t('cms.showFeaturedHero', 'Show featured hero (magazine header)') }}
            </label>
            <p class="page-widgets-hint">
              {{ $t('cms.showFeaturedHeroHint', 'Render the title and excerpt over the featured image (or a themed gradient band) above the post body.') }}
            </p>
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
          <!-- Category picker — quicksearch typeahead over existing cms_term
               categories; selected shown as removable chips above. Categories
               are managed in Taxonomy, so there's no inline create here. -->
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
            <SearchableTermSelect
              data-testid="term-picker-category"
              :terms="unselectedCategories"
              :placeholder="$t('cms.addCategory', 'Add category…')"
              @select="addCategory($event.id)"
            />
          </div>

          <!-- Primary category (S122): the category whose ancestor chain feeds
               the permalink engine's %category%/%subcategory% tokens. Chosen
               ONLY from the post's currently-assigned categories; disabled with
               no options until at least one category is assigned. -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.primaryCategory', 'Primary category') }}</label>
            <select
              v-model="form.primary_term_id"
              class="field-input"
              data-testid="primary-category-picker"
              :disabled="!selectedCategories.length"
            >
              <option :value="null">
                — {{ $t('cms.none') }} —
              </option>
              <option
                v-for="cat in selectedCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- Tag picker — cms_term taxonomy (S77 reversal). Mirrors the
               category picker but with inline create: typing offers a "create"
               option that adds a new cms_term('tag'); selected tags show as
               removable chips above. Tags persist as cms_term links via
               assignTerms, exactly like categories. -->
          <div class="field-group">
            <label class="field-label">{{ $t('cms.tags', 'Tags') }}</label>
            <div
              v-if="selectedTags.length"
              class="term-chips"
              data-testid="selected-tags"
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
            <SearchableTermSelect
              data-testid="term-picker-tag"
              :terms="unselectedTags"
              :allow-create="true"
              :placeholder="$t('cms.addTag', 'Add tag…')"
              @select="addTag($event.id)"
              @create="createTag($event)"
            />
          </div>

          <!-- Custom fields — the generic core custom-fields editor (separate
               from CMS tags). Needs a saved entity id, so edit mode only. -->
          <div
            v-if="!isNew && id"
            class="field-group"
            data-testid="post-custom-fields"
          >
            <CustomFieldsEditor
              ref="customFieldsEditorRef"
              :entity-type="coreEntityType"
              :entity-id="id"
            />
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useCmsContentStore,
  type CmsTerm,
  type CmsPost,
  type PostTypeField,
  type CmsAreaSummary,
  type CmsWidgetSummary,
  type PostWidgetAssignment,
  type CmsPageWidgetOverride,
} from '../stores/useCmsContentStore';
import { getWidgetEditor } from '../widgets/widgetEditorRegistry';
// Register the built-in vue-component editor descriptors so the per-page widget
// config collapsible resolves them here too — not only after the Widget Editor
// view has been visited (which is the only other importer of this module).
import '../widgets/index';
import { useAuthStore } from '@/stores/auth';
import CmsImagePicker from '../components/CmsImagePicker.vue';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';
import CmsWidgetConfigFields, {
  type WidgetConfigModel,
} from '../components/CmsWidgetConfigFields.vue';
import TipTapEditor from '../components/TipTapEditor.vue';
import SearchableTermSelect from '../components/SearchableTermSelect.vue';
import CustomFieldsEditor from '@/components/CustomFieldsEditor.vue';
import { buildPostUrl, feUserBaseUrl as resolveFeUserBaseUrl } from '../utils/postUrl';
import {
  getCmsEditorHeaderActions,
  getCmsEditorPanels,
  type CmsEditorContext,
  type CmsEditorPatch,
} from '../editor/cmsEditorExtensionRegistry';

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

// S77 — the core tags / custom-fields entity type is keyed off the post's kind:
// a page edits `cms_page`, any other type edits `cms_post`. Added alongside the
// legacy cms_term taxonomy pickers (untouched).
const coreEntityType = computed(() => (form.value.type === 'page' ? 'cms_page' : 'cms_post'));

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
  /** Chosen primary category (S122) — feeds %category%/%subcategory% in the
   *  permalink engine. Must be one of the post's assigned categories. */
  primary_term_id: string | null;
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
  /** Non-primary content areas, keyed by area name. The first content area
   *  stays in content_html; every additional one lives here. */
  content_blocks: Record<string, ContentBlock>;
  /** Per-page widget overrides for the layout's widget-capable areas. */
  page_widgets: PostWidgetAssignment[];
}

interface ContentBlock {
  content_html: string;
  source_css: string;
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
  primary_term_id: null,
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
  content_blocks: {},
  page_widgets: [],
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
const feUserBaseUrl = resolveFeUserBaseUrl();
// Preview token (capability) for viewing unpublished content via a shareable
// URL — only known once a post is saved/loaded.
const previewToken = ref('');
// Published → public URL; otherwise a preview link that bypasses the published
// gate via the post's preview_token. Shared with the list "open page" icon.
const postUrl = computed(() =>
  buildPostUrl(form.value.slug, form.value.status, previewToken.value),
);

// type_data is kept as a plain object; this proxy keeps v-model bindings stable.
const typeDataModel = computed<Record<string, unknown>>(() => form.value.type_data);

// Magazine hero toggle (posts only), stored in type_data.show_featured_hero.
// Absent = hero ON (default), so the checkbox reads checked unless the flag is
// explicitly false; unticking writes `false` so the choice rides the payload.
const showFeaturedHeroModel = computed<boolean>({
  get: () => form.value.type_data.show_featured_hero !== false,
  set: (value: boolean) => {
    form.value.type_data = { ...form.value.type_data, show_featured_hero: value };
  },
});

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

function addCategory(id: string) {
  if (id && !selectedCategoryIds.value.includes(id)) selectedCategoryIds.value.push(id);
}
function removeCategory(id: string) {
  selectedCategoryIds.value = selectedCategoryIds.value.filter((c) => c !== id);
}

// ── Primary category (S122) ──────────────────────────────────────────────
// The primary category MUST be one of the post's assigned categories; if the
// current primary is unassigned (or the last one removed), clear it so the
// permalink engine falls back to the first-assigned / uncategorized rule.
watch(selectedCategoryIds, (ids) => {
  if (form.value.primary_term_id && !ids.includes(form.value.primary_term_id)) {
    form.value.primary_term_id = null;
  }
}, { deep: true });

// ── Live permalink preview (S122) ────────────────────────────────────────
// Reuses the exact backend renderer via the preview endpoint (DRY — no JS
// re-implementation). Debounced; recomputes on title/slug/primary-category/
// published-date/term change. Surfaces when an explicit canonical_url override
// disagrees with the computed URL so the operator can clear it deliberately.
const PERMALINK_PREVIEW_DEBOUNCE_MS = 300;
const permalinkPreviewPath = ref('');
const permalinkPreviewUrl = ref('');
let permalinkPreviewTimer: ReturnType<typeof setTimeout> | null = null;

async function refreshPermalinkPreview() {
  // The permalink engine only ever transforms posts (§2); pages keep their
  // hand-authored slug, so the editor shows no computed preview for them.
  if (form.value.type !== 'post') {
    permalinkPreviewPath.value = '';
    permalinkPreviewUrl.value = '';
    return;
  }
  try {
    const preview = await store.previewPermalink({
      type: form.value.type,
      title: form.value.title,
      slug: form.value.slug,
      primary_term_id: form.value.primary_term_id,
      term_ids: selectedTermIds.value,
      published_at: form.value.published_at,
    });
    permalinkPreviewPath.value = preview?.path ?? '';
    permalinkPreviewUrl.value = preview?.url ?? '';
  } catch {
    // Keep the last known preview on a transient failure; never blocks editing.
  }
}

function cancelPermalinkPreview() {
  if (permalinkPreviewTimer) {
    clearTimeout(permalinkPreviewTimer);
    permalinkPreviewTimer = null;
  }
}

function schedulePermalinkPreview() {
  cancelPermalinkPreview();
  if (form.value.type !== 'post') return;
  permalinkPreviewTimer = setTimeout(refreshPermalinkPreview, PERMALINK_PREVIEW_DEBOUNCE_MS);
}

// Never let a pending debounce outlive the editor (production hygiene + keeps
// the preview request from firing after the component is gone).
onBeforeUnmount(cancelPermalinkPreview);

watch(
  () => [
    form.value.type,
    form.value.title,
    form.value.slug,
    form.value.primary_term_id,
    form.value.published_at,
    selectedTermIds.value.join(','),
  ],
  schedulePermalinkPreview,
);

// True when an explicit canonical_url is set AND differs from the computed
// permalink URL — a signal the operator's override no longer matches the engine.
const permalinkCanonicalMismatch = computed(() =>
  !!form.value.canonical_url.trim() &&
  !!permalinkPreviewUrl.value.trim() &&
  form.value.canonical_url.trim() !== permalinkPreviewUrl.value.trim(),
);

// Tag selection — mirrors categories, but the picker allows inline create.
const selectedTags = computed(() =>
  tagTerms.value.filter((tag) => selectedTagIds.value.includes(tag.id)),
);
const unselectedTags = computed(() =>
  tagTerms.value.filter((tag) => !selectedTagIds.value.includes(tag.id)),
);

function addTag(id: string) {
  if (id && !selectedTagIds.value.includes(id)) selectedTagIds.value.push(id);
}
function removeTag(id: string) {
  selectedTagIds.value = selectedTagIds.value.filter((tagId) => tagId !== id);
}

// Inline-create a new cms_term('tag') then select it. saveTerm reloads the tag
// terms (store.terms), so refresh the local list before adding the chip.
async function createTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const created = await store.saveTerm({ term_type: 'tag', name: trimmed });
  tagTerms.value = [...store.terms];
  addTag(created.id);
}

// ── Post-type awareness ─────────────────────────────────────────────────
const currentPostType = computed(() => store.postTypes.find((pt) => pt.key === form.value.type) ?? null);
const isHierarchical = computed(() => currentPostType.value?.hierarchical ?? false);
const typeFields = computed<PostTypeField[]>(() => currentPostType.value?.type_data?.fields ?? []);

const parentCandidates = computed(() => {
  const items = store.posts?.items ?? [];
  return items.filter((post) => post.type === form.value.type && post.id !== id.value);
});

// ── Layout-area-driven content blocks + page widgets (S55.2) ──────────────
const selectedLayout = computed(() =>
  (store.layouts?.items ?? []).find((layout) => layout.id === form.value.layout_id) ?? null,
);
const layoutAreas = computed<CmsAreaSummary[]>(() => selectedLayout.value?.areas ?? []);

// The first `content` area binds to the existing single editor (→ content_html);
// every additional `content` area gets its own collapsible block editor.
const contentAreas = computed(() => layoutAreas.value.filter((area) => area.type === 'content'));
const additionalContentAreas = computed(() => contentAreas.value.slice(1));

// Label the primary content editor with the layout's first content-area name so
// the admin knows which slot it maps to; falls back to the generic "Content".
const primaryContentLabel = computed(() => {
  const primary = contentAreas.value[0];
  return primary ? (primary.label || primary.name) : '';
});

// Only dedicated `page-widget` areas take a per-page widget override; the panel
// shows nothing (and is hidden) unless the layout declares such an area. Other
// area types (header/footer/content/vue/vue-component) are layout-level and are
// not overridden per page.
const widgetAreas = computed(() =>
  layoutAreas.value.filter((area) => area.type === 'page-widget'),
);

// Keep a content-block entry present for each additional content area so the
// editors always have a model to bind to.
watch(additionalContentAreas, (areas) => {
  for (const area of areas) {
    if (!form.value.content_blocks[area.name]) {
      form.value.content_blocks[area.name] = { content_html: '', source_css: '' };
    }
  }
}, { immediate: true });

function pageWidgetIdFor(areaName: string): string {
  return form.value.page_widgets.find((assignment) => assignment.area_name === areaName)?.widget_id ?? '';
}

function setPageWidget(areaName: string, widgetId: string) {
  const existing = form.value.page_widgets.findIndex((assignment) => assignment.area_name === areaName);
  if (!widgetId) {
    // Clearing the override → drop the row so the layout default applies.
    if (existing >= 0) form.value.page_widgets.splice(existing, 1);
    return;
  }
  const assignment: PostWidgetAssignment = {
    widget_id: widgetId,
    area_name: areaName,
    sort_order: existing >= 0 ? form.value.page_widgets[existing].sort_order : 0,
    required_access_level_ids: existing >= 0 ? form.value.page_widgets[existing].required_access_level_ids : [],
  };
  if (existing >= 0) form.value.page_widgets[existing] = assignment;
  else form.value.page_widgets.push(assignment);
}

// ── Per-page widget config override (collapsible in the Page widgets panel) ──
// The selected widget summary (carries its widget_type + config for descriptor
// resolution). Undefined when the area is on layout default.
function selectedWidgetFor(areaName: string): CmsWidgetSummary | undefined {
  const widgetId = pageWidgetIdFor(areaName);
  if (!widgetId) return undefined;
  return (store.widgets?.items ?? []).find((widget) => widget.id === widgetId);
}

// The selected widget's type — drives which per-type editors render. Falls back
// to an empty string (the config-fields component then shows the CSS editor).
function selectedWidgetTypeFor(areaName: string): string {
  return selectedWidgetFor(areaName)?.widget_type ?? '';
}

// The vue-component identifier of the selected widget (for descriptor resolution).
function selectedComponentNameFor(areaName: string): string | undefined {
  const widget = selectedWidgetFor(areaName);
  if (!widget || widget.widget_type !== 'vue-component') return undefined;
  return (widget.config as { component_name?: string } | null | undefined)?.component_name;
}

// Decode a widget's base64 content_json.content the same way the renderer does
// (it pairs with encodeWidgetHtml on save / in the fe-user renderer).
function decodeWidgetHtml(contentJson: Record<string, unknown> | null | undefined): string {
  const encoded = (contentJson as { content?: string } | null | undefined)?.content;
  if (!encoded) return '';
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}

// The structured override model bound to CmsWidgetConfigFields for this area.
// Seeds from the saved override when present, else from the selected widget's
// own values so the editor opens with meaningful content per widget type.
function pageWidgetConfigModelFor(areaName: string): WidgetConfigModel {
  const assignment = form.value.page_widgets.find((entry) => entry.area_name === areaName);
  const override = assignment?.config_override;
  const widget = selectedWidgetFor(areaName);
  const widgetType = widget?.widget_type ?? '';

  if (widgetType === 'html') {
    return {
      content_html: override?.content_html ?? decodeWidgetHtml(widget?.content_json),
      source_css: override?.source_css ?? widget?.source_css ?? '',
    };
  }
  if (widgetType === 'menu') {
    return {
      menu_items: override?.menu_items ?? widget?.menu_items ?? [],
      source_css: override?.source_css ?? widget?.source_css ?? '',
    };
  }
  if (widgetType === 'vue-component') {
    const componentName = selectedComponentNameFor(areaName);
    const seededConfig =
      (widget?.config as Record<string, unknown> | null | undefined) ??
      (componentName ? getWidgetEditor(componentName)?.defaultConfig() : undefined) ??
      {};
    return {
      config: override?.config ?? { ...seededConfig },
      source_css: override?.source_css ?? widget?.source_css ?? '',
    };
  }
  // Unknown type: only CSS applies.
  return { source_css: override?.source_css ?? widget?.source_css ?? '' };
}

// Persist an edited per-page override onto the area's assignment, keeping only
// the keys relevant to the widget type (matches the canonical override shape).
function setPageWidgetConfig(areaName: string, model: WidgetConfigModel) {
  const existing = form.value.page_widgets.findIndex((entry) => entry.area_name === areaName);
  if (existing < 0) return;
  const widgetType = selectedWidgetTypeFor(areaName);
  const override: CmsPageWidgetOverride = {};
  if (widgetType === 'html') {
    if (typeof model.content_html === 'string') override.content_html = model.content_html;
    if (typeof model.source_css === 'string') override.source_css = model.source_css;
  } else if (widgetType === 'menu') {
    if (Array.isArray(model.menu_items)) override.menu_items = model.menu_items;
    if (typeof model.source_css === 'string') override.source_css = model.source_css;
  } else if (widgetType === 'vue-component') {
    if (model.config) override.config = model.config;
    if (typeof model.source_css === 'string') override.source_css = model.source_css;
  } else if (typeof model.source_css === 'string') {
    override.source_css = model.source_css;
  }
  form.value.page_widgets[existing] = {
    ...form.value.page_widgets[existing],
    config_override: override,
  };
}

// Map the admin GET post `content_blocks` dict (keyed by area) into the form's
// per-area {content_html, source_css} model.
function loadContentBlocks(
  blocks: NonNullable<CmsPost['content_blocks']> | undefined,
): Record<string, ContentBlock> {
  const result: Record<string, ContentBlock> = {};
  for (const [areaName, block] of Object.entries(blocks ?? {})) {
    result[areaName] = {
      content_html: block.content_html ?? '',
      source_css: block.source_css ?? '',
    };
  }
  return result;
}

// Map the admin GET post `page_assignments` list into the form's widget overrides.
function loadPageWidgets(
  assignments: NonNullable<CmsPost['page_assignments']> | undefined,
): PostWidgetAssignment[] {
  return (assignments ?? []).map((assignment) => ({
    widget_id: assignment.widget_id,
    area_name: assignment.area_name,
    sort_order: assignment.sort_order ?? 0,
    required_access_level_ids: assignment.required_access_level_ids ?? [],
    config_override: assignment.config_override ?? null,
  }));
}

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

// ── AI-agnostic editor seams (S41) ───────────────────────────────────────
// cms-admin exposes two slots so an AI plugin can inject the AI ✨ dropdown and
// the collapsible panel without cms-admin importing it. The slots receive one
// narrow `CmsEditorContext` (form + applyPatch + getContext). When the registry
// is empty, nothing renders — the editor behaves exactly as before.
const headerActionComponents = computed(() => getCmsEditorHeaderActions());
const panelComponents = computed(() => getCmsEditorPanels());

// The set of core PostForm keys a patch may write directly onto `form`. Any
// other key is a custom field (e.g. S77) and is routed separately.
const AI_WRITABLE_FORM_KEYS = new Set<keyof PostForm>([
  'content_html',
  'source_css',
  'excerpt',
  'title',
  'meta_title',
  'meta_description',
  'meta_keywords',
  'og_title',
  'og_description',
  'schema_json',
]);

// The mounted S77 custom-fields editor (edit mode only). Its `setValues` write
// seam lets a patch fill the custom-field inputs as if the operator typed them;
// S77 persists them on its own Save (§3.6). When it is not mounted (new mode /
// S77 disabled) custom-field keys degrade into the bucket below.
type CustomFieldsEditorSeam = { setValues(partial: Record<string, unknown>): void };
const customFieldsEditorRef = ref<CustomFieldsEditorSeam | null>(null);

// Custom-field values produced by a patch while the S77 editor is not mounted
// (graceful degrade). They travel back via getContext so the request keeps its
// context; once the editor is mounted, patches flow straight into its inputs.
const aiCustomFields = ref<Record<string, unknown>>({});

function applyEditorPatch(patch: CmsEditorPatch): void {
  const customFieldPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    if (AI_WRITABLE_FORM_KEYS.has(key as keyof PostForm)) {
      (form.value as Record<string, unknown>)[key] = value;
      // Keep the SEO schema textarea in sync when schema_json is patched.
      if (key === 'schema_json') {
        schemaJsonText.value = JSON.stringify(value, null, 2);
      }
      // Seed the Visual (TipTap) body editor with the AI HTML so it both
      // reflects the patch and does not echo a normalized (possibly empty)
      // value back over content_html. setFromHtml emits the verbatim HTML and
      // marks the doc non-empty, suppressing the htmlValue re-seed watch. Pages
      // have no TipTap editor (CodeMirror is already controlled via v-model).
      if (key === 'content_html') {
        tiptapEditor.value?.setFromHtml(value as string);
      }
    } else {
      customFieldPatch[key] = value;
    }
  }
  if (Object.keys(customFieldPatch).length === 0) return;
  // Prefer the mounted S77 editor's write seam; degrade to the bucket otherwise.
  if (customFieldsEditorRef.value) {
    customFieldsEditorRef.value.setValues(customFieldPatch);
  } else {
    Object.assign(aiCustomFields.value, customFieldPatch);
  }
}

function buildEditorContext(options: { readExcerpt: boolean }) {
  const customFields = aiCustomFields.value;
  return {
    title: form.value.title,
    excerpt: options.readExcerpt ? form.value.excerpt : '',
    content_html: form.value.content_html,
    type: form.value.type,
    ...(Object.keys(customFields).length ? { custom_fields: { ...customFields } } : {}),
  };
}

const editorContext: CmsEditorContext<PostForm> = {
  form,
  applyPatch: applyEditorPatch,
  getContext: buildEditorContext,
};

async function save() {
  // A pending debounced permalink preview must never race the save request.
  cancelPermalinkPreview();
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
    primary_term_id: form.value.primary_term_id || null,
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
    // Non-primary content areas ride the post payload as an array; the primary
    // area is excluded (it stays in content_html).
    content_blocks: additionalContentAreas.value.map((area, index) => ({
      area_name: area.name,
      content_html: form.value.content_blocks[area.name]?.content_html || null,
      source_css: form.value.content_blocks[area.name]?.source_css || null,
      sort_order: index,
    })),
  };
  if (id.value) payload.id = id.value;

  const saved = await store.savePost(payload);
  const postId = saved?.id ?? id.value;
  if (postId) {
    await store.assignTerms(postId, selectedTermIds.value);
    // Page-widget overrides are saved as a separate PUT, mirroring terms.
    await store.savePostWidgets(postId, form.value.page_widgets);
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
    store.fetchWidgets({ per_page: 200 }),
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
        primary_term_id: post.primary_term_id ?? null,
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
        content_blocks: loadContentBlocks(post.content_blocks),
        page_widgets: loadPageWidgets(post.page_assignments),
      };
      previewToken.value = (post as Record<string, unknown>).preview_token as string ?? '';
      schemaJsonText.value = post.schema_json ? JSON.stringify(post.schema_json, null, 2) : '';
      selectedTermIds.value = post.term_ids ?? [];
    }
  }
});

defineExpose({
  form,
  selectedTermIds,
  save,
  activeContentTab,
  openPicker,
  onImageSelect,
  onGallerySelect,
  sidebarCollapsed,
  toggleEditorSidebar,
  refreshPermalinkPreview,
  permalinkPreviewPath,
  permalinkPreviewUrl,
  permalinkCanonicalMismatch,
});
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

/* Live permalink preview (S122): the computed full path + canonical URL. */
.permalink-preview { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.5rem 0.75rem; }
.permalink-preview__path { font-family: monospace; font-size: 0.85rem; color: #111827; word-break: break-all; }
.permalink-preview__url { display: inline-block; margin-top: 4px; font-size: 0.78rem; color: #3b82f6; word-break: break-all; text-decoration: none; }
.permalink-preview__url:hover { text-decoration: underline; }
.permalink-preview__mismatch { margin: 6px 0 0; font-size: 0.78rem; color: #b45309; font-weight: 600; }
.field-input--multi { min-height: 90px; }
textarea.field-input { resize: vertical; }
.field-error { font-size: 0.8rem; color: #dc2626; margin-top: 2px; }

.section-subtitle { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 0 0 8px; }
.type-fields { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-bottom: 16px; }

.content-block-section { margin-bottom: 24px; }
.content-block-extra { border-top: 1px solid #e5e7eb; padding-top: 12px; }
.content-block-extra__title { cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

.page-widgets-section { margin: 20px 0; border-top: 1px solid #e5e7eb; padding-top: 12px; }
.page-widgets-section__title { cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #374151; padding: 6px 0; }
.page-widgets-hint { font-size: 0.78rem; color: #6b7280; margin: 4px 0 10px; }
.page-widget-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.page-widget-row__area { font-size: 0.8rem; padding: 2px 8px; border-radius: 10px; background: #dcfce7; color: #166534; white-space: nowrap; min-width: 110px; }
.page-widget-row .field-input { flex: 1; min-width: 150px; }
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
