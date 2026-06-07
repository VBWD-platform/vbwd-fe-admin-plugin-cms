<template>
  <div class="cms-view cms-seo">
    <div class="cms-seo__header">
      <h1>CMS SEO</h1>
    </div>

    <nav
      class="cms-seo__tabs"
      role="tablist"
    >
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'prerender' }"
        data-testid="tab-prerender"
        type="button"
        @click="activeTab = 'prerender'"
      >
        Prerendered content
      </button>
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'robots' }"
        data-testid="tab-robots"
        type="button"
        @click="activeTab = 'robots'"
      >
        Robots.txt
      </button>
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'sitemap' }"
        data-testid="tab-sitemap"
        type="button"
        @click="activeTab = 'sitemap'"
      >
        Sitemap.xml
      </button>
    </nav>

    <!-- Prerendered content (default) -->
    <section
      v-show="activeTab === 'prerender'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        Prerendered content
      </h2>
      <p class="cms-seo__hint">
        Prerendered SEO pages are static <code>.html</code> files served to
        crawlers. nginx serves them by file existence, so switching
        <strong>“prerendered SEO generation”</strong> off in the plugin config
        only stops <em>new</em> files being written — the files already on disk
        keep being served.
        <strong>Generate</strong> (re)builds a file for every published post;
        <strong>Clean up</strong> removes them all so traffic falls back to the
        SPA. Both are manual actions and run regardless of the on/off toggle.
      </p>

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="seo-generate"
          :disabled="generating || busy"
          @click="doGenerate"
        >
          {{ generating ? 'Generating…' : 'Generate prerendered content' }}
        </button>
        <button
          class="btn btn--danger"
          data-testid="seo-cleanup"
          :disabled="busy || generating"
          @click="doCleanup"
        >
          {{ busy ? 'Cleaning up…' : 'Clean up prerendered content' }}
        </button>
      </div>

      <p
        v-if="generateResult !== null"
        class="cms-seo__result"
        data-testid="seo-generate-result"
      >
        Generated {{ generateResult }} prerendered file{{ generateResult === 1 ? '' : 's' }}.
      </p>
      <p
        v-if="result !== null"
        class="cms-seo__result"
        data-testid="seo-cleanup-result"
      >
        Removed {{ result }} prerendered file{{ result === 1 ? '' : 's' }}.
      </p>
      <p
        v-if="error"
        class="cms-seo__error"
        data-testid="seo-cleanup-error"
      >
        {{ error }}
      </p>
    </section>

    <!-- Robots.txt -->
    <section
      v-show="activeTab === 'robots'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        Robots.txt
      </h2>
      <p class="cms-seo__hint">
        Edit the served <code>robots.txt</code>. Empty = the default robots
        template. <code>seo.mode=off</code> always forces
        <code>Disallow: /</code> regardless of this content.
      </p>

      <textarea
        v-model="robotsTxt"
        class="cms-seo__textarea"
        data-testid="robots-editor"
        rows="12"
        spellcheck="false"
      />

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="robots-save"
          :disabled="robotsSaving"
          @click="doSaveRobots"
        >
          {{ robotsSaving ? 'Saving…' : 'Save robots.txt' }}
        </button>
      </div>

      <p
        v-if="robotsSaved"
        class="cms-seo__result"
        data-testid="robots-saved"
      >
        Saved.
      </p>
      <p
        v-if="robotsError"
        class="cms-seo__error"
        data-testid="robots-error"
      >
        {{ robotsError }}
      </p>
    </section>

    <!-- Sitemap.xml -->
    <section
      v-show="activeTab === 'sitemap'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        Sitemap.xml
      </h2>
      <p class="cms-seo__hint">
        Control which posts are listed in <code>sitemap.xml</code>. Only
        search-visible published posts are ever included; these filters narrow
        that set further.
      </p>

      <label class="cms-seo__field cms-seo__field--inline">
        <input
          v-model="sitemapIncludePages"
          type="checkbox"
          data-testid="sitemap-include-pages"
        >
        <span>Include pages (uncheck to list posts only)</span>
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Excluded page slugs</span>
        <textarea
          v-model="excludedSlugsText"
          class="cms-seo__textarea"
          data-testid="sitemap-excluded-slugs"
          rows="4"
          spellcheck="false"
          placeholder="one slug per line (commas also accepted)"
        />
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Include terms (list only posts carrying ≥1)</span>
        <select
          v-model="includeTerms"
          class="cms-seo__select"
          data-testid="sitemap-include-terms"
          multiple
          size="6"
        >
          <option
            v-for="term in termOptions"
            :key="`inc-${term.slug}`"
            :value="term.slug"
          >
            {{ term.name }} ({{ term.slug }})
          </option>
        </select>
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Exclude terms (drop posts carrying any)</span>
        <select
          v-model="excludeTerms"
          class="cms-seo__select"
          data-testid="sitemap-exclude-terms"
          multiple
          size="6"
        >
          <option
            v-for="term in termOptions"
            :key="`exc-${term.slug}`"
            :value="term.slug"
          >
            {{ term.name }} ({{ term.slug }})
          </option>
        </select>
      </label>

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="sitemap-save"
          :disabled="sitemapSaving"
          @click="doSaveSitemap"
        >
          {{ sitemapSaving ? 'Saving…' : 'Save sitemap settings' }}
        </button>
      </div>

      <p
        v-if="sitemapSaved"
        class="cms-seo__result"
        data-testid="sitemap-saved"
      >
        Saved.
      </p>
      <p
        v-if="sitemapError"
        class="cms-seo__error"
        data-testid="sitemap-error"
      >
        {{ sitemapError }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useCmsAdminStore, type CmsTerm } from '../stores/useCmsAdminStore';

type SeoTab = 'prerender' | 'robots' | 'sitemap';

const store = useCmsAdminStore();

const activeTab = ref<SeoTab>('prerender');

// ── Prerendered tab ──────────────────────────────────────────────────────────
const busy = ref(false);
const result = ref<number | null>(null);
const error = ref('');
const generating = ref(false);
const generateResult = ref<number | null>(null);

// ── Robots tab ───────────────────────────────────────────────────────────────
const robotsTxt = ref('');
const robotsSaving = ref(false);
const robotsSaved = ref(false);
const robotsError = ref('');

// ── Sitemap tab ──────────────────────────────────────────────────────────────
const sitemapIncludePages = ref(true);
const excludedSlugsText = ref('');
const includeTerms = ref<string[]>([]);
const excludeTerms = ref<string[]>([]);
const termOptions = ref<CmsTerm[]>([]);
const sitemapSaving = ref(false);
const sitemapSaved = ref(false);
const sitemapError = ref('');

const excludedSlugs = computed<string[]>(() =>
  excludedSlugsText.value
    .split(/[\n,]/)
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0),
);

onMounted(async () => {
  await Promise.all([loadSettings(), loadTerms()]);
});

async function loadSettings() {
  try {
    const settings = await store.fetchSeoSettings();
    robotsTxt.value = settings.robots_txt ?? '';
    sitemapIncludePages.value = settings.sitemap_include_pages ?? true;
    excludedSlugsText.value = (settings.sitemap_excluded_slugs ?? []).join('\n');
    includeTerms.value = settings.sitemap_include_terms ?? [];
    excludeTerms.value = settings.sitemap_exclude_terms ?? [];
  } catch (e: any) {
    robotsError.value = e?.message ?? 'Failed to load settings';
    sitemapError.value = e?.message ?? 'Failed to load settings';
  }
}

async function loadTerms() {
  try {
    const [categories, tags] = await Promise.all([
      store.fetchTerms('category'),
      store.fetchTerms('tag'),
    ]);
    termOptions.value = [...categories, ...tags];
  } catch (e: any) {
    sitemapError.value = e?.message ?? 'Failed to load terms';
  }
}

async function doGenerate() {
  error.value = '';
  generateResult.value = null;
  result.value = null;
  generating.value = true;
  try {
    generateResult.value = await store.regenerateSeo();
  } catch (e: any) {
    error.value = e?.message ?? 'Generation failed';
  } finally {
    generating.value = false;
  }
}

async function doCleanup() {
  error.value = '';
  result.value = null;
  generateResult.value = null;
  busy.value = true;
  try {
    result.value = await store.cleanupSeo();
  } catch (e: any) {
    error.value = e?.message ?? 'Cleanup failed';
  } finally {
    busy.value = false;
  }
}

async function doSaveRobots() {
  robotsError.value = '';
  robotsSaved.value = false;
  robotsSaving.value = true;
  try {
    await store.saveSeoSettings({ robots_txt: robotsTxt.value });
    robotsSaved.value = true;
  } catch (e: any) {
    robotsError.value = e?.message ?? 'Save failed';
  } finally {
    robotsSaving.value = false;
  }
}

async function doSaveSitemap() {
  sitemapError.value = '';
  sitemapSaved.value = false;
  sitemapSaving.value = true;
  try {
    await store.saveSeoSettings({
      sitemap_include_pages: sitemapIncludePages.value,
      sitemap_excluded_slugs: excludedSlugs.value,
      sitemap_include_terms: includeTerms.value,
      sitemap_exclude_terms: excludeTerms.value,
    });
    sitemapSaved.value = true;
  } catch (e: any) {
    sitemapError.value = e?.message ?? 'Save failed';
  } finally {
    sitemapSaving.value = false;
  }
}
</script>

<style scoped>
.cms-seo__header {
  margin-bottom: 1.5rem;
}
.cms-seo__header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--admin-heading, #2c3e50);
}

.cms-seo__tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--admin-border-light, #e5e7eb);
  margin-bottom: 1.5rem;
}

.cms-seo__tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--admin-muted, #6b7280);
}
.cms-seo__tab--active {
  color: var(--admin-heading, #2c3e50);
  border-bottom-color: var(--admin-primary, #3b82f6);
  font-weight: 600;
}

.cms-seo__card {
  background: var(--admin-card-bg, #fff);
  border: 1px solid var(--admin-border-light, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.cms-seo__section-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--admin-heading, #2c3e50);
}

.cms-seo__hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--admin-muted, #6b7280);
}

.cms-seo__field {
  display: block;
  margin-bottom: 1rem;
}
.cms-seo__field--inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cms-seo__label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--admin-text, #333);
}

.cms-seo__textarea,
.cms-seo__select {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.5rem;
  border: 1px solid var(--admin-border-light, #e5e7eb);
  border-radius: 6px;
}
.cms-seo__textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.cms-seo__actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 1rem;
}

.cms-seo__result {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: var(--admin-text, #333);
}

.cms-seo__error {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: var(--admin-danger, #e74c3c);
}

@media (max-width: 599px) {
  .cms-seo__card {
    padding: 1rem;
  }
}
</style>
