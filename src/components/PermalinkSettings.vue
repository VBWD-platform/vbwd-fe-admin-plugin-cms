<template>
  <div
    class="permalink-settings"
    data-testid="permalink-settings"
  >
    <p class="permalink-settings__hint">
      Configure the URL basis for <strong>posts</strong> (never pages). Pages keep
      their hand-authored slug. <code>off</code> uses the slug verbatim (zero
      behaviour change); <code>structured</code> builds
      <code>/&lt;root&gt;/[&lt;year&gt;/]&lt;category-path&gt;/&lt;slug&gt;</code>;
      <code>template</code> is a free-form <code>%token%</code> string. Changes
      apply going-forward only.
    </p>

    <label class="permalink-settings__field">
      <span class="permalink-settings__label">Mode</span>
      <select
        v-model="mode"
        class="permalink-settings__select"
        data-testid="permalink-mode"
      >
        <option value="off">
          Off — slug used verbatim
        </option>
        <option value="structured">
          Structured — guided category path
        </option>
        <option value="template">
          Template — free-form %token% string
        </option>
      </select>
    </label>

    <!-- posts_root + uncategorized apply to both engine modes -->
    <template v-if="mode !== 'off'">
      <label class="permalink-settings__field">
        <span class="permalink-settings__label">Posts root (<code>%root%</code>)</span>
        <input
          v-model="postsRoot"
          type="text"
          class="permalink-settings__input"
          data-testid="permalink-root"
          spellcheck="false"
        >
      </label>

      <label class="permalink-settings__field">
        <span class="permalink-settings__label">Uncategorized slug</span>
        <input
          v-model="uncategorizedSlug"
          type="text"
          class="permalink-settings__input"
          data-testid="permalink-uncategorized"
          spellcheck="false"
        >
        <span class="permalink-settings__note">
          Fallback category segment when a post has no primary category.
        </span>
      </label>
    </template>

    <!-- Structured-only: year toggle -->
    <label
      v-if="mode === 'structured'"
      class="permalink-settings__field permalink-settings__field--inline"
    >
      <input
        v-model="includeYear"
        type="checkbox"
        data-testid="permalink-include-year"
      >
      <span>Include the publish year as a path segment</span>
    </label>

    <!-- Template-only: the template string + token legend -->
    <template v-if="mode === 'template'">
      <label class="permalink-settings__field">
        <span class="permalink-settings__label">Template</span>
        <input
          v-model="template"
          type="text"
          class="permalink-settings__input permalink-settings__input--mono"
          data-testid="permalink-template"
          spellcheck="false"
        >
      </label>
      <p
        class="permalink-settings__legend"
        data-testid="permalink-legend"
      >
        Tokens: <code>%root%</code> <code>%slug%</code> <code>%category%</code>
        <code>%subcategory%</code> <code>%category_path%</code> <code>%year%</code>
        <code>%month%</code> <code>%day%</code> <code>%timestamp%</code>
        <code>%id%</code>. Empty tokens collapse their segment (no double slash).
      </p>
    </template>

    <div class="permalink-settings__actions">
      <button
        type="button"
        class="btn btn--primary"
        data-testid="permalink-save"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save permalinks' }}
      </button>
    </div>

    <p
      v-if="saved"
      class="permalink-settings__result"
      data-testid="permalink-saved"
    >
      Saved.
    </p>
    <p
      v-if="error"
      class="permalink-settings__error"
      data-testid="permalink-error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  useCmsAdminStore,
  PERMALINK_CONFIG_DEFAULTS,
  type PermalinkConfig,
} from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();

const mode = ref<PermalinkConfig['posts_permalink_mode']>(
  PERMALINK_CONFIG_DEFAULTS.posts_permalink_mode,
);
const postsRoot = ref(PERMALINK_CONFIG_DEFAULTS.posts_root);
const includeYear = ref(PERMALINK_CONFIG_DEFAULTS.posts_permalink_include_year);
const uncategorizedSlug = ref(
  PERMALINK_CONFIG_DEFAULTS.posts_permalink_uncategorized_slug,
);
const template = ref(PERMALINK_CONFIG_DEFAULTS.posts_permalink_template);

const saving = ref(false);
const saved = ref(false);
const error = ref('');

onMounted(load);

async function load(): Promise<void> {
  error.value = '';
  try {
    const config = await store.fetchPermalinkConfig();
    mode.value = config.posts_permalink_mode;
    postsRoot.value = config.posts_root;
    includeYear.value = config.posts_permalink_include_year;
    uncategorizedSlug.value = config.posts_permalink_uncategorized_slug;
    template.value = config.posts_permalink_template;
  } catch (e) {
    error.value = (e as Error)?.message ?? 'Failed to load permalink config';
  }
}

async function save(): Promise<void> {
  error.value = '';
  saved.value = false;
  saving.value = true;
  try {
    await store.savePermalinkConfig({
      posts_permalink_mode: mode.value,
      posts_root: postsRoot.value,
      posts_permalink_include_year: includeYear.value,
      posts_permalink_uncategorized_slug: uncategorizedSlug.value,
      posts_permalink_template: template.value,
    });
    saved.value = true;
  } catch (e) {
    error.value = (e as Error)?.message ?? 'Save failed';
  } finally {
    saving.value = false;
  }
}

defineExpose({ mode, postsRoot, includeYear, uncategorizedSlug, template, load, save });
</script>

<style scoped>
.permalink-settings__hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--admin-muted, #6b7280);
}
.permalink-settings__field {
  display: block;
  margin-bottom: 1rem;
}
.permalink-settings__field--inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.permalink-settings__label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--admin-text, #333);
}
.permalink-settings__select,
.permalink-settings__input {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.5rem;
  border: 1px solid var(--admin-border-light, #e5e7eb);
  border-radius: 6px;
}
.permalink-settings__input--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.permalink-settings__note,
.permalink-settings__legend {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--admin-muted, #6b7280);
}
.permalink-settings__legend code {
  white-space: nowrap;
}
.permalink-settings__actions {
  margin-top: 1.25rem;
}
.permalink-settings__result {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: var(--admin-text, #333);
}
.permalink-settings__error {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: var(--admin-danger, #e74c3c);
}
</style>
