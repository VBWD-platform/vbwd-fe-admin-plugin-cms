<template>
  <div class="field-group">
    <label class="field-label">Type</label>
    <input
      :value="cfg.type"
      class="field-input"
      type="text"
      readonly
      placeholder="post"
    >
    <p class="editor-pane__hint">
      Fixed to <code>post</code>. The term (category / tag) is read from the URL
      — one widget renders every archive.
    </p>
  </div>

  <div class="field-group">
    <label class="field-label">Mode</label>
    <select
      :value="cfg.mode"
      class="field-input"
      @change="set('mode', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="modeOption in TERM_ARCHIVE_MODE_OPTIONS"
        :key="modeOption"
        :value="modeOption"
      >
        {{ modeOption }}
      </option>
    </select>
  </div>

  <div class="field-group">
    <label class="field-label">Posts per page</label>
    <input
      :value="cfg.posts_per_page"
      class="field-input field-input--sm"
      type="number"
      min="1"
      @input="set('posts_per_page', Number(($event.target as HTMLInputElement).value))"
    >
  </div>

  <div class="field-group checkbox-group">
    <label class="field-label">
      <input
        :checked="cfg.paginate !== false"
        type="checkbox"
        @change="set('paginate', ($event.target as HTMLInputElement).checked)"
      >
      Paginate
    </label>
  </div>

  <ArchiveDisplayToggles
    :config="cfg"
    @update:config="emit('update:config', $event)"
  />
</template>

<script setup lang="ts">
/**
 * Editor tab for the shared "TermArchive" widget. Mirrors the PostArchive editor
 * (no term picker) — the term type + slug are read from the catch-all route
 * (`/category/<slug>` / `/tag/<slug>`), so ONE widget on the ONE terms-archive
 * layout renders every category AND tag archive. Exposes `mode` +
 * `posts_per_page` (+ `paginate`) + the shared card-display toggles; the fe-user
 * TermArchive widget reads them.
 */
import { computed } from 'vue';
import ArchiveDisplayToggles from './ArchiveDisplayToggles.vue';

/** Mode options shared with the other post-list archives (DRY). */
const TERM_ARCHIVE_MODE_OPTIONS = ['category', 'excerpt', 'titles', 'gallery', 'full'] as const;

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
