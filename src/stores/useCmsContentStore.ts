/**
 * CMS Content store (S47.6) — unified type-aware authoring.
 *
 * Drives the unified `cms_post` / `cms_term` admin surface introduced by
 * S47.0. Distinct from the legacy `useCmsAdminStore` (pages/categories/…) so
 * the existing page editor is untouched; the two coexist during the cutover.
 *
 * Endpoints (S47.0): /admin/cms/posts, /admin/cms/terms, and the two
 * registry endpoints /admin/cms/post-types + /admin/cms/term-types.
 */
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { CmsMenuItemData } from './useCmsAdminStore';

/** A field declared by a post-type's `type_data` schema. */
export interface PostTypeField {
  key: string;
  label: string;
  type: string;
}

/** A registered post-type (from the post-type registry). */
export interface PostType {
  key: string;
  label: string;
  routable: boolean;
  hierarchical: boolean;
  default_template: string | null;
  /** Optional type-specific field schema surfaced by the registry. */
  type_data?: { fields?: PostTypeField[] } | null;
}

/** A registered term-type (from the term-type registry). */
export interface TermType {
  key: string;
  label: string;
  hierarchical: boolean;
}

/** A taxonomy term (category / tag / custom). */
export interface CmsTerm {
  id: string;
  term_type: string;
  slug: string;
  name: string;
  parent_id: string | null;
  description?: string | null;
  seo_excluded: boolean;
  sort_order: number;
}

/** A unified content item (page / post / custom type). */
export interface CmsPost {
  id: string;
  type: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_json: Record<string, unknown>;
  content_html: string | null;
  type_data: Record<string, unknown> | null;
  parent_id: string | null;
  /** Chosen primary category (S122) — feeds the permalink engine. */
  primary_term_id?: string | null;
  /** The post's own final path segment (S122) — feeds %slug%. */
  slug_base?: string | null;
  status: string;
  /** Shareable preview token for the fe-user ?preview_token= URL. */
  preview_token?: string | null;
  published_at: string | null;
  language: string;
  translation_group_id: string | null;
  sort_order: number;
  /** Global blog-index pin (S-archives) — floats the post to the top of the
   *  /{posts_root} blog listing. */
  pinned?: boolean;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  robots: string;
  schema_json: unknown;
  seo_excluded: boolean;
  /** Render target: which layout/style the published page uses. */
  layout_id?: string | null;
  style_id?: string | null;
  term_ids?: string[];
  /** Term ids whose link is pinned (per-category pin, S-archives) — hydrates
   *  the editor's per-category pin toggles on load. */
  pinned_term_ids?: string[];
  /** Non-primary content areas, keyed by area name (admin GET post, S55). */
  content_blocks?: Record<string, {
    id?: string;
    area_name: string;
    content_html?: string | null;
    source_css?: string | null;
    sort_order?: number;
    content_json?: Record<string, unknown> | null;
  }>;
  /** Per-page widget overrides for layout areas (admin GET post, S55). */
  page_assignments?: Array<{
    id?: string;
    widget_id: string;
    area_name: string;
    sort_order: number;
    required_access_level_ids?: string[];
    config_override?: CmsPageWidgetOverride | null;
    widget?: Record<string, unknown>;
  }>;
  updated_at?: string;
}

export interface PaginatedPosts {
  items: CmsPost[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/** The computed permalink returned by the admin preview endpoint (S122). */
export interface PermalinkPreview {
  /** Full URL path the post would get (no leading/trailing slash). */
  path: string;
  /** Absolute canonical URL for that path. */
  url: string;
}

/** Body accepted by the permalink-preview endpoint (S122). */
export interface PermalinkPreviewInput {
  type: string;
  title: string;
  slug: string;
  primary_term_id: string | null;
  term_ids: string[];
  published_at: string | null;
}

/** A layout area declaration (subset surfaced by the layout list endpoint). */
export interface CmsAreaSummary {
  name: string;
  type: string;
  label?: string;
}

/** A renderable layout (subset surfaced by the layout list endpoint). */
export interface CmsLayoutSummary {
  id: string;
  slug: string;
  name: string;
  /** Declared render areas (header/content/page-widget/…) — drives the
   *  PostEditor's per-area content blocks + page-widget panel (S55.2). */
  areas?: CmsAreaSummary[];
}

/** A widget assignable to a layout/page area (subset for the widget picker).
 *  `widget_type` / `config` / `content_json` / `source_css` / `menu_items` are
 *  surfaced so the PostEditor can resolve a per-page config editor for the
 *  widget AND seed that editor from the widget's own current values.
 *  (`menu_items` is only present in the single-widget GET, not the list — the
 *  per-page menu editor seeds empty when absent, then writes the override.) */
export interface CmsWidgetSummary {
  id: string;
  slug: string;
  name: string;
  widget_type?: string;
  config?: Record<string, unknown> | null;
  content_json?: Record<string, unknown> | null;
  source_css?: string | null;
  menu_items?: CmsMenuItemData[];
}

/** Structured per-page widget override. Only the keys relevant to the widget
 *  type are written; absent/null `config_override` → use the widget's own
 *  values unchanged. Mirrors the fe-user `CmsPageWidgetOverride` shape. */
export interface CmsPageWidgetOverride {
  config?: Record<string, unknown>;
  content_html?: string;
  source_css?: string;
  menu_items?: CmsMenuItemData[];
}

/** A per-post widget override for a layout area (mirrors the layout assignment).
 *  `config_override` (optional) is the structured per-page override applied over
 *  the widget's own values at render time, for this page only. */
export interface PostWidgetAssignment {
  widget_id: string;
  area_name: string;
  sort_order: number;
  required_access_level_ids: string[];
  config_override?: CmsPageWidgetOverride | null;
}

/** A renderable style (subset surfaced by the style list endpoint). */
export interface CmsStyleSummary {
  id: string;
  slug: string;
  name: string;
  is_default: boolean;
}

interface CmsContentState {
  postTypes: PostType[];
  termTypes: TermType[];
  posts: PaginatedPosts | null;
  currentPost: CmsPost | null;
  terms: CmsTerm[];
  layouts: { items: CmsLayoutSummary[] } | null;
  styles: { items: CmsStyleSummary[] } | null;
  widgets: { items: CmsWidgetSummary[] } | null;
  loading: boolean;
  error: string | null;
}

function unwrapList<T>(res: unknown, key: string): T[] {
  if (Array.isArray(res)) return res as T[];
  const obj = res as Record<string, unknown> | null;
  const list = obj?.[key] ?? obj?.items;
  return Array.isArray(list) ? (list as T[]) : [];
}

export const useCmsContentStore = defineStore('cms-content', {
  state: (): CmsContentState => ({
    postTypes: [],
    termTypes: [],
    posts: null,
    currentPost: null,
    terms: [],
    layouts: null,
    styles: null,
    widgets: null,
    loading: false,
    error: null,
  }),

  actions: {
    // ── Layouts / Styles (for the PostEditor render-target pickers) ────────
    async fetchLayouts(params: Record<string, unknown> = {}) {
      const res = await api.get<{ items: CmsLayoutSummary[] }>('/admin/cms/layouts', { params });
      this.layouts = { items: unwrapList<CmsLayoutSummary>(res, 'items') };
    },

    async fetchStyles(params: Record<string, unknown> = {}) {
      const res = await api.get<{ items: CmsStyleSummary[] }>('/admin/cms/styles', { params });
      this.styles = { items: unwrapList<CmsStyleSummary>(res, 'items') };
    },

    async fetchWidgets(params: Record<string, unknown> = {}) {
      const res = await api.get<{ items: CmsWidgetSummary[] }>('/admin/cms/widgets', { params });
      this.widgets = { items: unwrapList<CmsWidgetSummary>(res, 'items') };
    },

    // ── Registries ───────────────────────────────────────────────────────
    async fetchPostTypes() {
      const res = await api.get<unknown>('/admin/cms/post-types');
      this.postTypes = unwrapList<PostType>(res, 'post_types');
    },

    async fetchTermTypes() {
      const res = await api.get<unknown>('/admin/cms/term-types');
      this.termTypes = unwrapList<TermType>(res, 'term_types');
    },

    // ── Posts ────────────────────────────────────────────────────────────
    async fetchPosts(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        this.posts = await api.get<PaginatedPosts>('/admin/cms/posts', { params });
      } catch (e) {
        this.error = (e as Error)?.message ?? 'Failed to load posts';
      } finally {
        this.loading = false;
      }
    },

    async fetchPost(id: string) {
      this.loading = true;
      this.error = null;
      try {
        this.currentPost = await api.get<CmsPost>(`/admin/cms/posts/${id}`);
      } catch (e) {
        this.error = (e as Error)?.message ?? 'Failed to load post';
      } finally {
        this.loading = false;
      }
    },

    async savePost(data: Partial<CmsPost>): Promise<CmsPost> {
      this.loading = true;
      this.error = null;
      try {
        const res = data.id
          ? await api.put<CmsPost>(`/admin/cms/posts/${data.id}`, data)
          : await api.post<CmsPost>('/admin/cms/posts', data);
        this.currentPost = res;
        return res;
      } catch (e) {
        this.error = (e as Error)?.message ?? 'Failed to save post';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deletePost(id: string) {
      await api.delete(`/admin/cms/posts/${id}`);
      await this.fetchPosts();
    },

    async changeStatus(id: string, status: string): Promise<void> {
      // 'published' / 'draft' have dedicated transition endpoints; any other
      // target status is written through a normal update.
      if (status === 'published') {
        await api.post(`/admin/cms/posts/${id}/publish`);
        return;
      }
      if (status === 'draft') {
        await api.post(`/admin/cms/posts/${id}/unpublish`);
        return;
      }
      await api.put(`/admin/cms/posts/${id}`, { status });
    },

    async assignTerms(
      postId: string,
      termIds: string[],
      pinnedTermIds: string[] = [],
    ): Promise<void> {
      // ``pinned_term_ids`` (subset of term_ids) carries the per-category pins
      // (cms_post_term.pinned). Always sent (authoritative) so the editor can
      // clear a pin as well as set one (S-archives).
      await api.put(`/admin/cms/posts/${postId}/terms`, {
        term_ids: termIds,
        pinned_term_ids: pinnedTermIds,
      });
    },

    /**
     * Compute the permalink a post WOULD get, without persisting (S122). Backs
     * the editor's live preview and reuses the exact backend renderer, so the
     * preview stays DRY with the real write-path engine.
     */
    async previewPermalink(data: PermalinkPreviewInput): Promise<PermalinkPreview> {
      return await api.post<PermalinkPreview>('/admin/cms/posts/permalink-preview', data);
    },

    /** Replace the per-post widget overrides for the layout's page areas. */
    async savePostWidgets(postId: string, assignments: PostWidgetAssignment[]): Promise<void> {
      await api.put(`/admin/cms/posts/${postId}/widgets`, assignments);
    },

    // ── Bulk operations (list bulk-bar) ──────────────────────────────────
    /** Every post id matching the current filter (for "totally all" scope).
     *  Pages through the list (per_page is capped at 100 server-side). */
    async fetchAllPostIds(params: Record<string, unknown> = {}): Promise<string[]> {
      const ids: string[] = [];
      let page = 1;
      for (;;) {
        const res = await api.get<{ items?: { id: string }[]; pages?: number }>(
          '/admin/cms/posts',
          { params: { ...params, page, per_page: 100 } },
        );
        const items = res.items ?? [];
        ids.push(...items.map((p) => p.id));
        if (!items.length || page >= (res.pages ?? 1)) break;
        page += 1;
      }
      return ids;
    },
    async bulkDeletePosts(ids: string[]): Promise<void> {
      await api.post('/admin/cms/posts/bulk', { ids });
    },
    /** Duplicate the selected posts. Copies land inactive / draft; the caller
     *  refreshes the list + clears the selection (mirrors bulkDeletePosts). */
    async bulkCopyPosts(ids: string[]): Promise<void> {
      await api.post('/admin/cms/posts/bulk/copy', { ids });
    },
    async bulkSetStatus(ids: string[], status: string): Promise<void> {
      await api.post('/admin/cms/posts/bulk/status', { ids, status });
    },
    async bulkSetSearchable(ids: string[], searchable: boolean): Promise<void> {
      await api.post('/admin/cms/posts/bulk/searchable', { ids, searchable });
    },
    async bulkAssignTerm(ids: string[], termId: string): Promise<void> {
      await api.post('/admin/cms/posts/bulk/assign-term', { ids, term_id: termId });
    },
    async bulkAssignLayout(ids: string[], layoutId: string | null): Promise<void> {
      await api.post('/admin/cms/posts/bulk/assign-layout', { ids, layout_id: layoutId });
    },
    async bulkUnassignCategory(ids: string[]): Promise<void> {
      await api.post('/admin/cms/posts/bulk/unassign-category', { ids });
    },
    async bulkDeleteTerms(ids: string[]): Promise<void> {
      await api.post('/admin/cms/terms/bulk', { ids });
    },

    // ── Terms ────────────────────────────────────────────────────────────
    async fetchTerms(termType: string) {
      const res = await api.get<unknown>('/admin/cms/terms', { params: { type: termType } });
      this.terms = unwrapList<CmsTerm>(res, 'terms');
    },

    async saveTerm(data: Partial<CmsTerm>): Promise<CmsTerm> {
      const res = data.id
        ? await api.put<CmsTerm>(`/admin/cms/terms/${data.id}`, data)
        : await api.post<CmsTerm>('/admin/cms/terms', data);
      if (data.term_type) await this.fetchTerms(data.term_type);
      return res;
    },

    async deleteTerm(id: string, termType?: string) {
      await api.delete(`/admin/cms/terms/${id}`);
      if (termType) await this.fetchTerms(termType);
    },
  },
});
