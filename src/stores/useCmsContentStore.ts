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
  status: string;
  published_at: string | null;
  language: string;
  translation_group_id: string | null;
  sort_order: number;
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
  updated_at?: string;
}

export interface PaginatedPosts {
  items: CmsPost[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/** A renderable layout (subset surfaced by the layout list endpoint). */
export interface CmsLayoutSummary {
  id: string;
  slug: string;
  name: string;
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

    async assignTerms(postId: string, termIds: string[]): Promise<void> {
      await api.put(`/admin/cms/posts/${postId}/terms`, { term_ids: termIds });
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

    // ── Taxonomy import / export (VBWD-standard JSON) ─────────────────────
    /** Fetch the export payload for a term type (caller triggers the download). */
    async exportTerms(termType: string): Promise<unknown> {
      return api.get<unknown>('/admin/cms/terms/export', { params: { type: termType } });
    },

    /**
     * Import terms from a VBWD-standard JSON payload. Returns the backend's
     * {created, updated} summary; callers refresh the list afterwards.
     */
    async importTerms(payload: unknown): Promise<{ created: number; updated: number }> {
      return api.post<{ created: number; updated: number }>('/admin/cms/terms/import', payload);
    },
  },
});
