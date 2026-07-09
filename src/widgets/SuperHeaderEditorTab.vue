<template>
  <!-- ── Logo ─────────────────────────────────────────────────────────────── -->
  <h4 class="super-header-section">
    Logo
  </h4>

  <!-- Logo image — picked from the CMS Image Library -->
  <div class="field-group">
    <label class="field-label">Logo image</label>
    <div
      v-if="logoImageUrl"
      class="np-image"
    >
      <img
        data-test-id="super-header-logo-thumb"
        :src="logoImageUrl"
        alt=""
        class="np-image__thumb"
      >
      <button
        data-test-id="super-header-logo-change"
        type="button"
        class="np-btn"
        @click="showImagePicker = true"
      >
        Change
      </button>
      <button
        data-test-id="super-header-logo-remove"
        type="button"
        class="np-btn np-btn--danger"
        @click="set('logo_image_url', '')"
      >
        Remove
      </button>
    </div>
    <button
      v-else
      data-test-id="super-header-logo-select"
      type="button"
      class="np-btn"
      @click="showImagePicker = true"
    >
      Select image
    </button>
    <p class="editor-pane__hint">
      leave empty to show the text logo
    </p>
  </div>

  <div class="field-group">
    <label class="field-label">Logo text</label>
    <input
      data-test-id="super-header-logo-text"
      :value="cfg.logo_text"
      class="field-input"
      type="text"
      @input="set('logo_text', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <div class="field-group">
    <label class="field-label">Logo link</label>
    <input
      data-test-id="super-header-logo-link"
      :value="cfg.logo_link"
      class="field-input"
      type="text"
      placeholder="/"
      @input="set('logo_link', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <!-- ── Navigation ───────────────────────────────────────────────────────── -->
  <h4 class="super-header-section">
    Navigation
  </h4>

  <div class="field-group">
    <label class="field-label">Nav widget slug</label>
    <input
      data-test-id="super-header-nav-widget-slug"
      :value="cfg.nav_widget_slug"
      class="field-input"
      type="text"
      placeholder="header-nav"
      @input="set('nav_widget_slug', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      slug of an existing menu widget, e.g. header-nav
    </p>
  </div>

  <!-- ── Search ───────────────────────────────────────────────────────────── -->
  <h4 class="super-header-section">
    Search
  </h4>

  <div class="field-group">
    <label class="field-label">
      <input
        data-test-id="super-header-show-search"
        :checked="showSearch"
        type="checkbox"
        @change="set('show_search', ($event.target as HTMLInputElement).checked)"
      >
      Show search box
    </label>
  </div>

  <template v-if="showSearch">
    <div class="field-group">
      <label class="field-label">Search placeholder</label>
      <input
        data-test-id="super-header-search-placeholder"
        :value="cfg.search_placeholder"
        class="field-input"
        type="text"
        placeholder="Search…"
        @input="set('search_placeholder', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="field-group">
      <label class="field-label">Search target path</label>
      <input
        data-test-id="super-header-search-target-path"
        :value="cfg.search_target_path"
        class="field-input"
        type="text"
        placeholder="/search"
        @input="set('search_target_path', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="field-group">
      <label class="field-label">Search scope</label>
      <select
        data-test-id="super-header-search-scope"
        :value="resolvedSearchScope"
        class="field-input"
        @change="set('search_scope', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="scopeOption in SEARCH_SCOPE_OPTIONS"
          :key="scopeOption"
          :value="scopeOption"
        >
          {{ scopeOption }}
        </option>
      </select>
    </div>

    <div class="field-group">
      <label class="field-label">
        <input
          data-test-id="super-header-quicksearch"
          :checked="quicksearchEnabled"
          type="checkbox"
          @change="set('quicksearch', ($event.target as HTMLInputElement).checked)"
        >
        Quicksearch (instant dropdown)
      </label>
    </div>

    <div
      v-if="quicksearchEnabled"
      class="field-group"
    >
      <label class="field-label">Quicksearch results limit</label>
      <input
        data-test-id="super-header-quicksearch-limit"
        :value="quicksearchLimit"
        class="field-input field-input--sm"
        type="number"
        min="1"
        :max="QUICKSEARCH_LIMIT_MAX"
        @input="setQuicksearchLimit(($event.target as HTMLInputElement).value)"
      >
      <p class="editor-pane__hint">
        Maximum dropdown rows (1–{{ QUICKSEARCH_LIMIT_MAX }}).
      </p>
    </div>
  </template>

  <!-- ── Auth ─────────────────────────────────────────────────────────────── -->
  <h4 class="super-header-section">
    Auth
  </h4>

  <div class="field-group">
    <label class="field-label">
      <input
        data-test-id="super-header-show-auth-links"
        :checked="showAuthLinks"
        type="checkbox"
        @change="set('show_auth_links', ($event.target as HTMLInputElement).checked)"
      >
      Show auth link
    </label>
  </div>

  <template v-if="showAuthLinks">
    <div class="field-group">
      <label class="field-label">Login label</label>
      <input
        data-test-id="super-header-login-label"
        :value="cfg.login_label"
        class="field-input"
        type="text"
        placeholder="Login"
        @input="set('login_label', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="field-group">
      <label class="field-label">Login path</label>
      <input
        data-test-id="super-header-login-path"
        :value="cfg.login_path"
        class="field-input"
        type="text"
        placeholder="/login"
        @input="set('login_path', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="field-group">
      <label class="field-label">Dashboard label</label>
      <input
        data-test-id="super-header-dashboard-label"
        :value="cfg.dashboard_label"
        class="field-input"
        type="text"
        placeholder="Dashboard"
        @input="set('dashboard_label', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="field-group">
      <label class="field-label">Dashboard path</label>
      <input
        data-test-id="super-header-dashboard-path"
        :value="cfg.dashboard_path"
        class="field-input"
        type="text"
        placeholder="/dashboard"
        @input="set('dashboard_path', ($event.target as HTMLInputElement).value)"
      >
    </div>
  </template>

  <!-- ── Behaviour ────────────────────────────────────────────────────────── -->
  <h4 class="super-header-section">
    Behaviour
  </h4>

  <div class="field-group">
    <label class="field-label">
      <input
        data-test-id="super-header-stickable"
        :checked="stickableEnabled"
        type="checkbox"
        @change="set('stickable', ($event.target as HTMLInputElement).checked)"
      >
      Sticky header
    </label>
    <p class="editor-pane__hint">
      Pin the header to the top of the viewport after the visitor scrolls down.
    </p>
  </div>

  <div
    v-if="stickableEnabled"
    class="field-group"
  >
    <label class="field-label">Stick after (px)</label>
    <input
      data-test-id="super-header-stickable-offset"
      :value="stickableOffsetPx"
      class="field-input field-input--sm"
      type="number"
      min="0"
      @input="setStickableOffsetPx(($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Scroll distance before the header pins. Default 160.
    </p>
  </div>

  <!-- CMS Image Library picker -->
  <CmsImagePicker
    v-if="showImagePicker"
    @select="onImageSelect"
    @close="showImagePicker = false"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import CmsImagePicker from '../components/CmsImagePicker.vue';

const SEARCH_SCOPE_OPTIONS = ['pages', 'posts', 'both'] as const;
const DEFAULT_SEARCH_SCOPE = 'both';
const DEFAULT_QUICKSEARCH_LIMIT = 6;
const QUICKSEARCH_LIMIT_MIN = 1;
const QUICKSEARCH_LIMIT_MAX = 20;
const DEFAULT_STICKABLE_OFFSET_PX = 160;
const STICKABLE_OFFSET_MIN = 0;

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

const logoImageUrl = computed<string>(() =>
  typeof props.config.logo_image_url === 'string' ? props.config.logo_image_url : '',
);
const showImagePicker = ref(false);

const showSearch = computed<boolean>(() => props.config.show_search === true);
const showAuthLinks = computed<boolean>(() => props.config.show_auth_links === true);

const resolvedSearchScope = computed<string>(() =>
  typeof props.config.search_scope === 'string' ? props.config.search_scope : DEFAULT_SEARCH_SCOPE,
);

const quicksearchEnabled = computed<boolean>(() => props.config.quicksearch === true);

const quicksearchLimit = computed<number>(() =>
  typeof props.config.quicksearch_limit === 'number'
    ? props.config.quicksearch_limit
    : DEFAULT_QUICKSEARCH_LIMIT,
);

const stickableEnabled = computed<boolean>(() => props.config.stickable === true);

const stickableOffsetPx = computed<number>(() =>
  typeof props.config.stickable_offset_px === 'number'
    ? props.config.stickable_offset_px
    : DEFAULT_STICKABLE_OFFSET_PX,
);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function onImageSelect(url: string) {
  set('logo_image_url', url);
  showImagePicker.value = false;
}

function setQuicksearchLimit(rawValue: string) {
  const parsed = Number(rawValue);
  const clamped = Math.min(
    QUICKSEARCH_LIMIT_MAX,
    Math.max(QUICKSEARCH_LIMIT_MIN, Number.isFinite(parsed) ? parsed : DEFAULT_QUICKSEARCH_LIMIT),
  );
  set('quicksearch_limit', clamped);
}

function setStickableOffsetPx(rawValue: string) {
  const parsed = rawValue.trim() === '' ? Number.NaN : Number(rawValue);
  const clamped = Math.max(
    STICKABLE_OFFSET_MIN,
    Number.isFinite(parsed) ? parsed : DEFAULT_STICKABLE_OFFSET_PX,
  );
  set('stickable_offset_px', clamped);
}
</script>

<style scoped>
.super-header-section {
  margin: 1.25rem 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
}
.super-header-section:first-child {
  margin-top: 0;
}
.np-image {
  display: flex;
  align-items: center;
  gap: 12px;
}
.np-image__thumb {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 4px;
}
.np-btn {
  padding: 0.4rem 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.np-btn:hover {
  background: #f3f4f6;
}
.np-btn--danger {
  color: #b91c1c;
  border-color: #fca5a5;
}
</style>
