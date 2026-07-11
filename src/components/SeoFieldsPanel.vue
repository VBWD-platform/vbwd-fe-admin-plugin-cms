<template>
  <div class="seo-fields-panel">
    <!-- Live SERP preview -->
    <div
      class="serp-preview"
      data-testid="serp-preview"
    >
      <div class="serp-preview__title">
        {{ serpTitle }}
      </div>
      <div class="serp-preview__url">
        {{ previewUrl }}
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
        v-model="metaTitle"
        class="field-input"
        type="text"
        data-testid="seo-meta-title"
      >
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.metaDescription') }}</label>
      <textarea
        v-model="metaDescription"
        class="field-input"
        rows="3"
        data-testid="seo-meta-description"
      />
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.metaKeywords') }}</label>
      <input
        v-model="metaKeywords"
        class="field-input"
        type="text"
      >
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.ogTitle') }}</label>
      <input
        v-model="ogTitle"
        class="field-input"
        type="text"
      >
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.ogDescription') }}</label>
      <textarea
        v-model="ogDescription"
        class="field-input"
        rows="3"
      />
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.ogImage') }}</label>
      <input
        v-model="ogImageUrl"
        class="field-input"
        type="text"
      >
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.canonicalUrl') }}</label>
      <input
        v-model="canonicalUrl"
        class="field-input"
        type="text"
      >
    </div>
    <div class="field-group">
      <label class="field-label">{{ $t('cms.robots') }}</label>
      <input
        v-model="robots"
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
        data-testid="seo-schema-json"
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
          v-model="seoExcluded"
          type="checkbox"
          data-testid="seo-excluded-toggle"
        >
        &nbsp;{{ $t('cms.excludeFromSearch') }}
      </label>
      <p
        class="seo-effective"
        data-testid="seo-effective-state"
      >
        {{ effectiveState }}
      </p>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The ten SEO fields authored on any CMS content page (a post, a page, or an
 * entity page). Kept as one flat model so the panel is a plain v-model editor
 * that any editor host can bind to. `schema_json` is the parsed JSON-LD object
 * (or null); the panel keeps its own text buffer for the raw textarea.
 */
export interface SeoFields {
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
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const SERP_TITLE_MAX = 60;
const SERP_DESC_MAX = 160;

const props = withDefaults(
  defineProps<{
    modelValue: SeoFields;
    /** Fallback for the SERP title when meta_title is empty (e.g. the post title). */
    title?: string;
    /** Fallback for the SERP description when meta_description is empty. */
    excerpt?: string;
    /** The URL shown in the SERP preview (computed by the host). */
    previewUrl?: string;
    /** Effective robots/noindex state, resolved by the host (may inherit from
     *  excluded terms). Falls back to a local computation when not provided. */
    effectiveSeoState?: string;
  }>(),
  { title: '', excerpt: '', previewUrl: '', effectiveSeoState: undefined },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: SeoFields): void;
}>();

function emitField<Key extends keyof SeoFields>(key: Key, value: SeoFields[Key]): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function stringField(key: keyof SeoFields) {
  return computed<string>({
    get: () => (props.modelValue[key] as string) ?? '',
    set: (value: string) => emitField(key, value as SeoFields[typeof key]),
  });
}

const metaTitle = stringField('meta_title');
const metaDescription = stringField('meta_description');
const metaKeywords = stringField('meta_keywords');
const ogTitle = stringField('og_title');
const ogDescription = stringField('og_description');
const ogImageUrl = stringField('og_image_url');
const canonicalUrl = stringField('canonical_url');
const robots = stringField('robots');

const seoExcluded = computed<boolean>({
  get: () => props.modelValue.seo_excluded,
  set: (value: boolean) => emitField('seo_excluded', value),
});

// ── Schema.org JSON textarea ────────────────────────────────────────────────
// The textarea keeps a raw text buffer; parsing happens on blur (mirrors the
// legacy post editor). We reformat the buffer only when schema_json changes
// externally (e.g. an AI patch), never off our own parse — so the operator's
// own text is never rewritten under their cursor.
const schemaJsonText = ref(
  props.modelValue.schema_json ? JSON.stringify(props.modelValue.schema_json, null, 2) : '',
);
const schemaError = ref('');
let schemaUpdateFromSelf = false;

watch(
  () => props.modelValue.schema_json,
  (value) => {
    if (schemaUpdateFromSelf) {
      schemaUpdateFromSelf = false;
      return;
    }
    schemaJsonText.value = value ? JSON.stringify(value, null, 2) : '';
  },
);

function parseSchemaJson(): void {
  schemaError.value = '';
  const text = schemaJsonText.value.trim();
  if (!text) {
    schemaUpdateFromSelf = true;
    emitField('schema_json', null);
    return;
  }
  try {
    const parsed = JSON.parse(text);
    schemaUpdateFromSelf = true;
    emitField('schema_json', parsed);
  } catch {
    schemaError.value = 'Invalid JSON';
  }
}

// ── SERP preview ────────────────────────────────────────────────────────────
const serpTitle = computed(() => (props.modelValue.meta_title || props.title || '').trim());
const serpDescription = computed(
  () => (props.modelValue.meta_description || props.excerpt || '').trim(),
);
const titleTooLong = computed(() => serpTitle.value.length > SERP_TITLE_MAX);
const descTooLong = computed(() => serpDescription.value.length > SERP_DESC_MAX);

// The host resolves the effective state (it may inherit noindex from excluded
// terms); fall back to a self-contained computation when it is not provided.
const effectiveState = computed(() => {
  if (props.effectiveSeoState !== undefined) return props.effectiveSeoState;
  if (props.modelValue.seo_excluded) return 'noindex — excluded on this post';
  return props.modelValue.robots || 'index,follow';
});
</script>

<style scoped>
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #374151; }
.field-input { width: 100%; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box; }
.field-input--mono { font-family: monospace; }
textarea.field-input { resize: vertical; }
.field-error { font-size: 0.8rem; color: #dc2626; margin-top: 2px; }

.serp-preview { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: #fff; }
.serp-preview__title { color: #1a0dab; font-size: 1.1rem; line-height: 1.3; }
.serp-preview__url { color: #006621; font-size: 0.8rem; }
.serp-preview__desc { color: #4d5156; font-size: 0.85rem; margin-top: 4px; }
.serp-preview__counts { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.72rem; color: #6b7280; margin-top: 8px; }
.serp-count--warn { color: #b45309; font-weight: 600; }
.serp-warn { color: #b45309; font-weight: 600; }

.seo-effective { font-size: 0.78rem; color: #6b7280; margin-top: 4px; }
</style>
