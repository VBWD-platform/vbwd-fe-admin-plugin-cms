/**
 * Shared option arrays for post-list-style widget editors
 * (SearchResults, Category).
 *
 * DRY: both tabs render the same `mode` select and `meta` checkbox group.
 * Keep these in sync with fe-user `src/components/PostCard.vue`
 * (`PostListMode` / `PostMetaField`).
 */
export const POST_LIST_MODE_OPTIONS = ['titles', 'excerpt', 'full', 'gallery', 'video'] as const;

/**
 * Meta-row fields still driven by the free-form `meta` array. `tags` and
 * `reading_time` were REMOVED here: on archive widgets they are now owned by the
 * dedicated `show_tags` / `show_article_size` toggles (ArchiveDisplayToggles),
 * the single source of truth — so they never render twice via two mechanisms.
 */
export const POST_META_FIELD_OPTIONS = ['author', 'time_ago', 'published_at'] as const;
