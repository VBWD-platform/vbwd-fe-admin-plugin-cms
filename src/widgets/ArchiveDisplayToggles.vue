<template>
  <div class="field-group checkbox-group archive-display-toggles">
    <label class="field-label">Card display</label>

    <label class="field-label">
      <input
        data-test-id="toggle-show-categories"
        :checked="cfg.show_categories !== false"
        type="checkbox"
        @change="set('show_categories', ($event.target as HTMLInputElement).checked)"
      >
      {{ t('cms.widget.showCategories', 'Show categories') }}
    </label>

    <label class="field-label">
      <input
        data-test-id="toggle-show-tags"
        :checked="cfg.show_tags !== false"
        type="checkbox"
        @change="set('show_tags', ($event.target as HTMLInputElement).checked)"
      >
      {{ t('cms.widget.showTags', 'Show tags') }}
    </label>

    <label class="field-label">
      <input
        data-test-id="toggle-show-article-size"
        :checked="cfg.show_article_size !== false"
        type="checkbox"
        @change="set('show_article_size', ($event.target as HTMLInputElement).checked)"
      >
      {{ t('cms.widget.showReadingTime', 'Show reading time') }}
    </label>
  </div>
</template>

<script setup lang="ts">
/**
 * Shared "Card display" toggles for every post-archive widget editor
 * (PostArchive, TermArchive, Category, SearchResults). Renders the three
 * per-widget booleans — `show_categories`, `show_tags`, `show_article_size` —
 * each defaulting ON (absence ⇒ checked), and writes the snake_case key into the
 * widget config the fe-user card reads.
 *
 * DRY: ONE control included by all four editor tabs, so the toggles appear
 * identically on each widget's standalone `/admin/cms/widgets/<id>/edit`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: boolean) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
