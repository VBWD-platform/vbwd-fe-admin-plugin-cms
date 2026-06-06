<template>
  <div class="cms-view cms-seo">
    <div class="cms-seo__header">
      <h1>CMS SEO</h1>
    </div>

    <section class="cms-seo__card">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();

const busy = ref(false);
const result = ref<number | null>(null);
const error = ref('');

const generating = ref(false);
const generateResult = ref<number | null>(null);

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
