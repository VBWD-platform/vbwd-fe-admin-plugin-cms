import { defineStore } from 'pinia';
import { api } from '@/api';

export interface CmsImage {
  id: string;
  slug: string;
  caption: string | null;
  file_path: string;
  url_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  alt_text: string | null;
  updated_at: string;
}

export interface CmsTerm {
  id: string;
  slug: string;
  name: string;
}

export interface SeoSettings {
  robots_txt: string;
  global_head_html: string;
  sitemap_include_pages: boolean;
  sitemap_excluded_slugs: string[];
  sitemap_include_terms: string[];
  sitemap_exclude_terms: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CmsAreaDefinition {
  name: string;
  type: string;
  label: string;
}

export interface CmsLayoutWidgetAssignment {
  id?: string;
  layout_id?: string;
  widget_id: string;
  area_name: string;
  sort_order: number;
  required_access_level_ids?: string[];
}

export interface CmsLayout {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  areas: CmsAreaDefinition[];
  assignments?: CmsLayoutWidgetAssignment[];
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  head_html?: string | null;
  updated_at: string;
}

export interface CmsMenuItemData {
  id?: string;
  parent_id: string | null;
  label: string;
  url: string | null;
  page_slug: string | null;
  target: string;
  icon: string | null;
  sort_order: number;
}

export interface CmsWidget {
  id: string;
  slug: string;
  name: string;
  widget_type: 'html' | 'menu' | 'slideshow' | 'vue-component';
  content_json: Record<string, unknown> | null;
  content_html: string | null;
  config: Record<string, unknown> | null;
  menu_items?: CmsMenuItemData[];
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface CmsStyle {
  id: string;
  slug: string;
  name: string;
  source_css: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  updated_at: string;
}

interface CmsAdminState {
  images: PaginatedResult<CmsImage> | null;
  layouts: PaginatedResult<CmsLayout> | null;
  currentLayout: CmsLayout | null;
  widgets: PaginatedResult<CmsWidget> | null;
  currentWidget: CmsWidget | null;
  styles: PaginatedResult<CmsStyle> | null;
  currentStyle: CmsStyle | null;
  loading: boolean;
  error: string | null;
  selectedImageIds: Set<string>;
  selectedLayoutIds: Set<string>;
  selectedWidgetIds: Set<string>;
  selectedStyleIds: Set<string>;
}

export const useCmsAdminStore = defineStore('cms-admin', {
  state: (): CmsAdminState => ({
    images: null,
    layouts: null,
    currentLayout: null,
    widgets: null,
    currentWidget: null,
    styles: null,
    currentStyle: null,
    loading: false,
    error: null,
    selectedImageIds: new Set(),
    selectedLayoutIds: new Set(),
    selectedWidgetIds: new Set(),
    selectedStyleIds: new Set(),
  }),

  actions: {
    // ── Images ────────────────────────────────────────────────────────────────

    async fetchImages(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get<any>('/admin/cms/images', { params });
        this.images = res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load images';
      } finally {
        this.loading = false;
      }
    },

    async uploadImage(file: File, caption?: string): Promise<CmsImage> {
      const formData = new FormData();
      formData.append('file', file);
      if (caption) formData.append('caption', caption);
      const res = await api.post<any>('/admin/cms/images/upload', formData);
      await this.fetchImages();
      return res;
    },

    async updateImage(id: string, data: Partial<CmsImage>) {
      await api.put<any>(`/admin/cms/images/${id}`, data);
      await this.fetchImages();
    },

    async deleteImage(id: string) {
      await api.delete<any>(`/admin/cms/images/${id}`);
      await this.fetchImages();
    },

    async bulkDeleteImages(ids: string[]) {
      await api.post<any>('/admin/cms/images/bulk', { ids, action: 'delete' });
      this.selectedImageIds.clear();
      await this.fetchImages();
    },

    async resizeImage(id: string, width: number, height: number): Promise<CmsImage> {
      const res = await api.post<any>(`/admin/cms/images/${id}/resize`, { width, height });
      await this.fetchImages();
      return res;
    },

    // ── Layouts ───────────────────────────────────────────────────────────────

    async fetchLayouts(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        this.layouts = await api.get<any>('/admin/cms/layouts', { params });
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load layouts';
      } finally {
        this.loading = false;
      }
    },

    async fetchLayout(id: string) {
      this.loading = true;
      this.error = null;
      try {
        this.currentLayout = await api.get<any>(`/admin/cms/layouts/${id}`);
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load layout';
      } finally {
        this.loading = false;
      }
    },

    async saveLayout(data: Partial<CmsLayout>): Promise<CmsLayout> {
      this.loading = true;
      this.error = null;
      try {
        const res = data.id
          ? await api.put<any>(`/admin/cms/layouts/${data.id}`, data)
          : await api.post<any>('/admin/cms/layouts', data);
        this.currentLayout = res;
        return res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to save layout';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async setWidgetAssignments(layoutId: string, assignments: CmsLayoutWidgetAssignment[]) {
      await api.put<any>(`/admin/cms/layouts/${layoutId}/widgets`, assignments);
      await this.fetchLayout(layoutId);
    },

    async deleteLayout(id: string) {
      await api.delete<any>(`/admin/cms/layouts/${id}`);
      await this.fetchLayouts();
    },

    async bulkDeleteLayouts(ids: string[]) {
      await api.post<any>('/admin/cms/layouts/bulk', { ids });
      this.selectedLayoutIds.clear();
      await this.fetchLayouts();
    },

    async bulkSetLayoutActive(ids: string[], active: boolean) {
      await api.post<any>('/admin/cms/layouts/bulk/active', { ids, active });
      this.selectedLayoutIds.clear();
      await this.fetchLayouts();
    },

    /** Every id matching the current filter for an entity list ("totally all"
     *  scope). Pages through the list (server caps per_page at 100). */
    async fetchAllIds(entity: string, params: Record<string, unknown> = {}): Promise<string[]> {
      const ids: string[] = [];
      let page = 1;
      for (;;) {
        const res = await api.get<{ items?: { id: string }[]; pages?: number }>(
          `/admin/cms/${entity}`,
          { params: { ...params, page, per_page: 100 } },
        );
        const items = res.items ?? [];
        ids.push(...items.map((i) => i.id));
        if (!items.length || page >= (res.pages ?? 1)) break;
        page += 1;
      }
      return ids;
    },

    // ── default-layout management (mirrors setDefaultStyle) ─────────────────
    async setDefaultLayout(id: string) {
      await api.post<any>(`/admin/cms/layouts/${id}/default`);
      await this.fetchLayouts();
    },

    async clearDefaultLayout() {
      await api.delete<any>('/admin/cms/layouts/default');
      await this.fetchLayouts();
    },

    // ── Widgets ───────────────────────────────────────────────────────────────

    async fetchWidgets(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        this.widgets = await api.get<any>('/admin/cms/widgets', { params });
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load widgets';
      } finally {
        this.loading = false;
      }
    },

    async fetchWidget(id: string) {
      this.loading = true;
      this.error = null;
      try {
        this.currentWidget = await api.get<any>(`/admin/cms/widgets/${id}`);
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load widget';
      } finally {
        this.loading = false;
      }
    },

    async saveWidget(data: Partial<CmsWidget>): Promise<CmsWidget> {
      this.loading = true;
      this.error = null;
      try {
        const res = data.id
          ? await api.put<any>(`/admin/cms/widgets/${data.id}`, data)
          : await api.post<any>('/admin/cms/widgets', data);
        this.currentWidget = res;
        return res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to save widget';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async replaceMenuTree(widgetId: string, items: CmsMenuItemData[]) {
      await api.put<any>(`/admin/cms/widgets/${widgetId}/menu`, items);
      await this.fetchWidget(widgetId);
    },

    async deleteWidget(id: string) {
      await api.delete<any>(`/admin/cms/widgets/${id}`);
      await this.fetchWidgets();
    },

    async bulkDeleteWidgets(ids: string[]) {
      await api.post<any>('/admin/cms/widgets/bulk', { ids });
      this.selectedWidgetIds.clear();
      await this.fetchWidgets();
    },

    // ── Styles ────────────────────────────────────────────────────────────────

    async fetchStyles(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        this.styles = await api.get<any>('/admin/cms/styles', { params });
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load styles';
      } finally {
        this.loading = false;
      }
    },

    async fetchStyle(id: string) {
      this.loading = true;
      this.error = null;
      try {
        this.currentStyle = await api.get<any>(`/admin/cms/styles/${id}`);
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load style';
      } finally {
        this.loading = false;
      }
    },

    async saveStyle(data: Partial<CmsStyle>): Promise<CmsStyle> {
      this.loading = true;
      this.error = null;
      try {
        const res = data.id
          ? await api.put<any>(`/admin/cms/styles/${data.id}`, data)
          : await api.post<any>('/admin/cms/styles', data);
        this.currentStyle = res;
        return res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to save style';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteStyle(id: string) {
      await api.delete<any>(`/admin/cms/styles/${id}`);
      await this.fetchStyles();
    },

    async bulkDeleteStyles(ids: string[]) {
      await api.post<any>('/admin/cms/styles/bulk', { ids });
      this.selectedStyleIds.clear();
      await this.fetchStyles();
    },

    // ── default-style management (sprint 26) ───────────────────────────────
    async setDefaultStyle(id: string) {
      await api.post<any>(`/admin/cms/styles/${id}/default`);
      await this.fetchStyles();
    },

    async clearDefaultStyle() {
      await api.delete<any>('/admin/cms/styles/default');
      await this.fetchStyles();
    },

    // Delete every prerendered ${VAR_DIR}/seo/*.html. nginx serves prerendered
    // pages by file existence, so this is how switching SEO prerendering off
    // actually takes effect (traffic falls back to the SPA). Returns the count.
    async cleanupSeo(): Promise<number> {
      const res = await api.post<{ removed: number }>('/admin/cms/seo/cleanup', {});
      return res.removed;
    },

    // (Re)build a prerendered ${VAR_DIR}/seo/<slug>.html for every published
    // post. Manual override — runs regardless of the on/off toggle. Returns the
    // number of files written.
    async regenerateSeo(): Promise<number> {
      const res = await api.post<{ regenerated: number }>('/admin/cms/seo/regenerate', {});
      return res.regenerated;
    },

    // Editable robots.txt + sitemap filtering config (S56). The five keys are
    // stored in the cms config blob server-side; PUT accepts a partial body and
    // merges it (does not clobber the other keys).
    async fetchSeoSettings(): Promise<SeoSettings> {
      return await api.get<SeoSettings>('/admin/cms/seo/settings');
    },

    async saveSeoSettings(payload: Partial<SeoSettings>): Promise<void> {
      await api.put<SeoSettings>('/admin/cms/seo/settings', payload);
    },

    // Terms used to populate the sitemap include/exclude pickers (option value
    // = term slug). Mirrors the term fetch used by TermManager.
    async fetchTerms(type: string): Promise<CmsTerm[]> {
      const res = await api.get<any>('/admin/cms/terms', { params: { type } });
      return Array.isArray(res) ? res : (res.items ?? []);
    },
  },
});
