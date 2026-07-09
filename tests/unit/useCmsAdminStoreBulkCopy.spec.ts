import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import { useCmsAdminStore } from '../../src/stores/useCmsAdminStore';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useCmsAdminStore bulk-copy actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue({ items: [], total: 0, page: 1, per_page: 20, pages: 1 });
    (api.post as any).mockResolvedValue({ items: [], count: 0 });
  });

  it('bulk-copies widgets, clears the selection and refetches', async () => {
    const store = useCmsAdminStore();
    store.selectedWidgetIds.add('w1');
    store.selectedWidgetIds.add('w2');
    await store.bulkCopyWidgets(['w1', 'w2']);
    expect(api.post).toHaveBeenCalledWith('/admin/cms/widgets/bulk/copy', { ids: ['w1', 'w2'] });
    expect(store.selectedWidgetIds.size).toBe(0);
    expect(api.get).toHaveBeenCalledWith('/admin/cms/widgets', expect.anything());
  });

  it('bulk-copies layouts, clears the selection and refetches', async () => {
    const store = useCmsAdminStore();
    store.selectedLayoutIds.add('l1');
    await store.bulkCopyLayouts(['l1', 'l2']);
    expect(api.post).toHaveBeenCalledWith('/admin/cms/layouts/bulk/copy', { ids: ['l1', 'l2'] });
    expect(store.selectedLayoutIds.size).toBe(0);
    expect(api.get).toHaveBeenCalledWith('/admin/cms/layouts', expect.anything());
  });

  it('bulk-copies styles, clears the selection and refetches', async () => {
    const store = useCmsAdminStore();
    store.selectedStyleIds.add('s1');
    await store.bulkCopyStyles(['s1', 's2']);
    expect(api.post).toHaveBeenCalledWith('/admin/cms/styles/bulk/copy', { ids: ['s1', 's2'] });
    expect(store.selectedStyleIds.size).toBe(0);
    expect(api.get).toHaveBeenCalledWith('/admin/cms/styles', expect.anything());
  });
});
