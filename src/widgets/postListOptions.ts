/**
 * Shared option arrays for post-list-style widget editors
 * (SearchResults, Category).
 *
 * DRY: both tabs render the same `mode` select and `meta` checkbox group.
 * Keep these in sync with fe-user `src/components/PostCard.vue`
 * (`PostListMode` / `PostMetaField`).
 */
export const POST_LIST_MODE_OPTIONS = ['titles', 'excerpt', 'full', 'gallery', 'video'] as const;

export const POST_META_FIELD_OPTIONS = ['author', 'time_ago', 'tags', 'published_at', 'reading_time'] as const;
