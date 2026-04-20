import { defineStore } from 'pinia';
import { api } from '@/api';

export interface CmsCategory {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export interface CmsPage {
  id: string;
  slug: string;
  name: string;
  language: string;
  content_json: Record<string, unknown>;
  category_id: string | null;
  is_published: boolean;
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
  updated_at: string;
}

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
  categories: CmsCategory[];
  pages: PaginatedResult<CmsPage> | null;
  currentPage: CmsPage | null;
  images: PaginatedResult<CmsImage> | null;
  layouts: PaginatedResult<CmsLayout> | null;
  currentLayout: CmsLayout | null;
  widgets: PaginatedResult<CmsWidget> | null;
  currentWidget: CmsWidget | null;
  styles: PaginatedResult<CmsStyle> | null;
  currentStyle: CmsStyle | null;
  loading: boolean;
  error: string | null;
  selectedPageIds: Set<string>;
  selectedImageIds: Set<string>;
  selectedLayoutIds: Set<string>;
  selectedWidgetIds: Set<string>;
  selectedStyleIds: Set<string>;
}

async function _downloadExport(path: string, filename: string, ids: string[]) {
  const { useAuthStore } = await import('@/stores/auth');
  const auth = useAuthStore();
  const base = (import.meta.env.VITE_API_URL as string) || '/api/v1';
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const useCmsAdminStore = defineStore('cms-admin', {
  state: (): CmsAdminState => ({
    categories: [],
    pages: null,
    currentPage: null,
    images: null,
    layouts: null,
    currentLayout: null,
    widgets: null,
    currentWidget: null,
    styles: null,
    currentStyle: null,
    loading: false,
    error: null,
    selectedPageIds: new Set(),
    selectedImageIds: new Set(),
    selectedLayoutIds: new Set(),
    selectedWidgetIds: new Set(),
    selectedStyleIds: new Set(),
  }),

  actions: {
    // ── Categories ────────────────────────────────────────────────────────────

    async fetchCategories() {
      const res = await api.get<any>('/admin/cms/categories');
      this.categories = Array.isArray(res) ? res : (res.items ?? []);
    },

    async saveCategory(data: Partial<CmsCategory>) {
      if (data.id) {
        await api.put<any>(`/admin/cms/categories/${data.id}`, data);
      } else {
        await api.post<any>('/admin/cms/categories', data);
      }
      await this.fetchCategories();
    },

    async deleteCategory(id: string) {
      await api.delete<any>(`/admin/cms/categories/${id}`);
      await this.fetchCategories();
    },

    // ── Pages ────────────────────────────────────────────────────────────────

    async fetchPages(params: Record<string, unknown> = {}) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get<any>('/admin/cms/pages', { params });
        this.pages = res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load pages';
      } finally {
        this.loading = false;
      }
    },

    async fetchPage(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get<any>(`/admin/cms/pages/${id}`);
        this.currentPage = res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load page';
      } finally {
        this.loading = false;
      }
    },

    async savePage(data: Partial<CmsPage>): Promise<CmsPage> {
      this.loading = true;
      this.error = null;
      try {
        const res = data.id
          ? await api.put<any>(`/admin/cms/pages/${data.id}`, data)
          : await api.post<any>('/admin/cms/pages', data);
        this.currentPage = res;
        return res;
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to save page';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deletePage(id: string) {
      await api.delete<any>(`/admin/cms/pages/${id}`);
      await this.fetchPages();
    },

    async bulkAction(ids: string[], action: string, params: Record<string, unknown> = {}) {
      await api.post<any>('/admin/cms/pages/bulk', { ids, action, params });
      this.selectedPageIds.clear();
      await this.fetchPages();
    },

    async exportPages(ids: string[]) {
      await _downloadExport('/admin/cms/pages/export', ids.length === 1 ? 'cms-page.json' : 'cms-pages.json', ids);
    },

    async importPages(file: File) {
      const payload = JSON.parse(await file.text());
      await api.post<any>('/admin/cms/pages/import', payload);
      await this.fetchPages();
    },

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

    async exportLayouts(ids: string[]) {
      await _downloadExport('/admin/cms/layouts/export', ids.length === 1 ? 'cms-layout.json' : 'cms-layouts.zip', ids);
    },

    async importLayout(file: File) {
      const payload = JSON.parse(await file.text());
      await api.post<any>('/admin/cms/layouts/import', payload);
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

    async exportWidgets(ids: string[]) {
      await _downloadExport('/admin/cms/widgets/export', ids.length === 1 ? 'cms-widget.json' : 'cms-widgets.zip', ids);
    },

    async importWidget(file: File) {
      const payload = JSON.parse(await file.text());
      await api.post<any>('/admin/cms/widgets/import', payload);
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

    async exportStyles(ids: string[]) {
      await _downloadExport('/admin/cms/styles/export', ids.length === 1 ? 'cms-style.json' : 'cms-styles.zip', ids);
    },

    async importStyle(file: File) {
      const payload = JSON.parse(await file.text());
      await api.post<any>('/admin/cms/styles/import', payload);
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

    // ── CMS Import / Export ──────────────────────────────────────────────────

    async exportCms(sections: string[]): Promise<void> {
      const { useAuthStore } = await import('@/stores/auth');
      const auth = useAuthStore();
      const base = (import.meta.env.VITE_API_URL as string) || '/api/v1';
      const res = await fetch(`${base}/admin/cms/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({ sections }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cms-export.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    },

    async importCms(file: File, strategy: string): Promise<{ imported: Record<string, number>; errors: string[] }> {
      const { useAuthStore } = await import('@/stores/auth');
      const auth = useAuthStore();
      const base = (import.meta.env.VITE_API_URL as string) || '/api/v1';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('strategy', strategy);
      const res = await fetch(`${base}/admin/cms/import`, {
        method: 'POST',
        headers: {
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Import failed: ${res.statusText}`);
      return data;
    },
  },
});
