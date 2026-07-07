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
        :class="{ 'cms-seo__tab--active': activeTab === 'head-html' }"
        data-testid="tab-head-html"
        type="button"
        @click="activeTab = 'head-html'"
      >
        &lt;head&gt; HTML
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
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'serving' }"
        data-testid="tab-serving"
        type="button"
        @click="activeTab = 'serving'"
      >
        Serving
      </button>
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'indexnow' }"
        data-testid="tab-indexnow"
        type="button"
        @click="activeTab = 'indexnow'"
      >
        IndexNow
      </button>
      <button
        class="cms-seo__tab"
        :class="{ 'cms-seo__tab--active': activeTab === 'permalinks' }"
        data-testid="tab-permalinks"
        type="button"
        @click="activeTab = 'permalinks'"
      >
        Permalinks
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

    <!-- <head> HTML -->
    <section
      v-show="activeTab === 'head-html'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        &lt;head&gt; HTML
      </h2>
      <p class="cms-seo__hint">
        Raw HTML injected before <code>&lt;/head&gt;</code> on
        <strong>every</strong> prerendered page (site-wide) — the crawler-visible
        home for site-verification tags (Bing <code>msvalidate.01</code>),
        Google Analytics / GTM snippets, etc. It is baked into the static
        <code>.html</code> files, so click
        <strong>Generate</strong> on the Prerendered content tab afterwards to
        rewrite existing prerenders.
      </p>

      <CodeMirrorEditor
        v-model="globalHeadHtml"
        lang="html"
        min-height="200px"
        data-testid="seo-global-head-html"
      />

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="head-html-save"
          :disabled="headHtmlSaving"
          @click="doSaveHeadHtml"
        >
          {{ headHtmlSaving ? 'Saving…' : 'Save <head> HTML' }}
        </button>
      </div>

      <p
        v-if="headHtmlSaved"
        class="cms-seo__result"
        data-testid="head-html-saved"
      >
        Saved.
      </p>
      <p
        v-if="headHtmlError"
        class="cms-seo__error"
        data-testid="head-html-error"
      >
        {{ headHtmlError }}
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

    <!-- Serving -->
    <section
      v-show="activeTab === 'serving'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        Serving
      </h2>
      <p class="cms-seo__hint">
        Control who is served the prerendered <code>.html</code> and how it is
        emitted. By default only crawlers get the prerender and humans get the
        SPA shell. <strong>Serve to humans</strong> lets visitors on public
        content routes receive the fast prerender too; the excluded prefixes
        (e.g. <code>dashboard</code>, <code>checkout</code>, <code>cart</code>)
        always fall back to the SPA so a private page is never served an
        anonymous prerender.
      </p>
      <p
        class="cms-seo__hint cms-seo__hint--warn"
        data-testid="serving-restart-hint"
      >
        Changing serve mode requires an fe-user redeploy/restart to take effect.
      </p>

      <label class="cms-seo__field cms-seo__field--inline">
        <input
          v-model="serveToHumans"
          type="checkbox"
          data-testid="seo-serve-to-humans"
        >
        <span>Serve prerendered content to human visitors (not only crawlers)</span>
      </label>

      <label class="cms-seo__field cms-seo__field--inline">
        <input
          v-model="minifyOutput"
          type="checkbox"
          data-testid="seo-minify-output"
        >
        <span>Minify emitted prerender HTML (inline CSS/JS + inter-tag whitespace)</span>
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Excluded URL prefixes (always served the SPA)</span>
        <input
          v-model="serveExcludePrefixes"
          type="text"
          class="cms-seo__input"
          data-testid="seo-serve-exclude-prefixes"
          spellcheck="false"
          placeholder="comma-separated, e.g. dashboard,checkout,cart"
        >
      </label>

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="serving-save"
          :disabled="servingSaving"
          @click="doSaveServing"
        >
          {{ servingSaving ? 'Saving…' : 'Save serving settings' }}
        </button>
      </div>

      <p
        v-if="servingSaved"
        class="cms-seo__result"
        data-testid="serving-saved"
      >
        Saved.
      </p>
      <p
        v-if="servingError"
        class="cms-seo__error"
        data-testid="serving-error"
      >
        {{ servingError }}
      </p>
    </section>

    <!-- IndexNow -->
    <section
      v-show="activeTab === 'indexnow'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        IndexNow
      </h2>
      <p class="cms-seo__hint">
        <strong>IndexNow</strong> instantly notifies Bing, Yandex, Seznam and
        other participating engines whenever a page is published or updated, so
        they recrawl it right away (the fix for
        <em>“Discovered — currently not indexed”</em>). The verification key is
        served at the site root as
        <code>/&lt;key&gt;.txt</code>; the engine fetches it to confirm you own
        the host before accepting submissions. Requires a
        <strong>public base URL</strong> to be configured for the site.
      </p>

      <label class="cms-seo__field cms-seo__field--inline">
        <input
          v-model="indexnowEnabled"
          type="checkbox"
          data-testid="indexnow-enabled"
        >
        <span>Enable IndexNow submissions on publish/update</span>
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Key</span>
        <input
          v-model="indexnowKey"
          type="text"
          class="cms-seo__input"
          data-testid="indexnow-key"
          spellcheck="false"
          placeholder="8–128 chars of letters, digits and hyphens"
        >
        <span class="cms-seo__hint">
          Allowed: <code>A–Z a–z 0–9 -</code>, 8–128 characters. Served at
          <code>/{{ indexnowKey || '&lt;key&gt;' }}.txt</code>.
        </span>
      </label>

      <label class="cms-seo__field">
        <span class="cms-seo__label">Submission endpoint</span>
        <input
          v-model="indexnowEndpoint"
          type="text"
          class="cms-seo__input"
          data-testid="indexnow-endpoint"
          spellcheck="false"
          placeholder="https://api.indexnow.org/indexnow"
        >
      </label>

      <div class="cms-seo__actions">
        <button
          class="btn btn--primary"
          data-testid="indexnow-save"
          :disabled="indexnowSaving"
          @click="doSaveIndexNow"
        >
          {{ indexnowSaving ? 'Saving…' : 'Save IndexNow settings' }}
        </button>
      </div>

      <p
        v-if="indexnowSaved"
        class="cms-seo__result"
        data-testid="indexnow-saved"
      >
        Saved.
      </p>
      <p
        v-if="indexnowError"
        class="cms-seo__error"
        data-testid="indexnow-error"
      >
        {{ indexnowError }}
      </p>
    </section>

    <!-- Permalinks (S122) — post-permalink engine config -->
    <section
      v-show="activeTab === 'permalinks'"
      class="cms-seo__card"
    >
      <h2 class="cms-seo__section-title">
        Post permalinks
      </h2>
      <PermalinkSettings />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useCmsAdminStore, type CmsTerm } from '../stores/useCmsAdminStore';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';
import PermalinkSettings from '../components/PermalinkSettings.vue';

type SeoTab =
  | 'prerender'
  | 'robots'
  | 'head-html'
  | 'sitemap'
  | 'serving'
  | 'indexnow'
  | 'permalinks';

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

// ── Head HTML tab ─────────────────────────────────────────────────────────────
const globalHeadHtml = ref('');
const headHtmlSaving = ref(false);
const headHtmlSaved = ref(false);
const headHtmlError = ref('');

// ── Sitemap tab ──────────────────────────────────────────────────────────────
const sitemapIncludePages = ref(true);
const excludedSlugsText = ref('');
const includeTerms = ref<string[]>([]);
const excludeTerms = ref<string[]>([]);
const termOptions = ref<CmsTerm[]>([]);
const sitemapSaving = ref(false);
const sitemapSaved = ref(false);
const sitemapError = ref('');

// ── Serving tab ──────────────────────────────────────────────────────────────
const serveToHumans = ref(false);
const minifyOutput = ref(false);
const serveExcludePrefixes = ref('dashboard,checkout,cart');
const servingSaving = ref(false);
const servingSaved = ref(false);
const servingError = ref('');

// ── IndexNow tab ─────────────────────────────────────────────────────────────
const indexnowEnabled = ref(false);
const indexnowKey = ref('');
const indexnowEndpoint = ref('https://api.indexnow.org/indexnow');
const indexnowSaving = ref(false);
const indexnowSaved = ref(false);
const indexnowError = ref('');

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
    globalHeadHtml.value = settings.global_head_html ?? '';
    sitemapIncludePages.value = settings.sitemap_include_pages ?? true;
    excludedSlugsText.value = (settings.sitemap_excluded_slugs ?? []).join('\n');
    includeTerms.value = settings.sitemap_include_terms ?? [];
    excludeTerms.value = settings.sitemap_exclude_terms ?? [];
    serveToHumans.value = settings.seo_serve_to_humans ?? false;
    minifyOutput.value = settings.minify_prerender_output ?? false;
    serveExcludePrefixes.value =
      settings.seo_serve_exclude_prefixes ?? 'dashboard,checkout,cart';
    indexnowEnabled.value = settings.indexnow_enabled ?? false;
    indexnowKey.value = settings.indexnow_key ?? '';
    indexnowEndpoint.value =
      settings.indexnow_endpoint ?? 'https://api.indexnow.org/indexnow';
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

async function doSaveHeadHtml() {
  headHtmlError.value = '';
  headHtmlSaved.value = false;
  headHtmlSaving.value = true;
  try {
    await store.saveSeoSettings({ global_head_html: globalHeadHtml.value });
    headHtmlSaved.value = true;
  } catch (e: any) {
    headHtmlError.value = e?.message ?? 'Save failed';
  } finally {
    headHtmlSaving.value = false;
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

async function doSaveServing() {
  servingError.value = '';
  servingSaved.value = false;
  servingSaving.value = true;
  try {
    await store.saveSeoSettings({
      seo_serve_to_humans: serveToHumans.value,
      minify_prerender_output: minifyOutput.value,
      seo_serve_exclude_prefixes: serveExcludePrefixes.value,
    });
    servingSaved.value = true;
  } catch (e: any) {
    servingError.value = e?.message ?? 'Save failed';
  } finally {
    servingSaving.value = false;
  }
}

async function doSaveIndexNow() {
  indexnowError.value = '';
  indexnowSaved.value = false;
  indexnowSaving.value = true;
  try {
    await store.saveSeoSettings({
      indexnow_enabled: indexnowEnabled.value,
      indexnow_key: indexnowKey.value,
      indexnow_endpoint: indexnowEndpoint.value,
    });
    indexnowSaved.value = true;
  } catch (e: any) {
    indexnowError.value = e?.message ?? 'Save failed';
  } finally {
    indexnowSaving.value = false;
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
.cms-seo__select,
.cms-seo__input {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.5rem;
  border: 1px solid var(--admin-border-light, #e5e7eb);
  border-radius: 6px;
}

.cms-seo__hint--warn {
  color: var(--admin-danger, #e74c3c);
  font-weight: 600;
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
