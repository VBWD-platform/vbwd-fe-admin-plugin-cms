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
      Fixed to <code>post</code> — the archive lists every published post.
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
        v-for="modeOption in POST_ARCHIVE_MODE_OPTIONS"
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
</template>

<script setup lang="ts">
/**
 * Editor tab for the "PostArchive" (blog index) widget. Mirrors the Category
 * editor but WITHOUT the term picker — the archive lists ALL published posts of
 * `type` (fixed to `post`). Exposes `mode` + `posts_per_page` (+ `paginate`) and
 * writes them into the widget config, which the fe-user PostArchive widget reads.
 */
import { computed } from 'vue';

/**
 * Mode options for the blog-index archive. `category` (default) is the only mode
 * that renders the WordPress-archive card WITH a featured-image thumbnail; the
 * rest mirror the shared post-list modes and stay selectable.
 */
const POST_ARCHIVE_MODE_OPTIONS = ['category', 'excerpt', 'titles', 'gallery', 'full'] as const;

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>
