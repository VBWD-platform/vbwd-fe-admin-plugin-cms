import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import { useCmsContentStore } from '../../src/stores/useCmsContentStore';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useCmsContentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches post types from the registry endpoint', async () => {
    (api.get as any).mockResolvedValueOnce({
      post_types: [
        { key: 'page', label: 'Page', routable: true, hierarchical: true, default_template: null },
        { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
      ],
    });
    const store = useCmsContentStore();
    await store.fetchPostTypes();
    expect(api.get).toHaveBeenCalledWith('/admin/cms/post-types');
    expect(store.postTypes).toHaveLength(2);
    expect(store.postTypes[0].key).toBe('page');
  });

  it('accepts a bare array response for post types', async () => {
    (api.get as any).mockResolvedValueOnce([
      { key: 'post', label: 'Post', routable: true, hierarchical: false, default_template: null },
    ]);
    const store = useCmsContentStore();
    await store.fetchPostTypes();
    expect(store.postTypes).toHaveLength(1);
  });

  it('fetches term types from the registry endpoint', async () => {
    (api.get as any).mockResolvedValueOnce({
      term_types: [
        { key: 'category', label: 'Category', hierarchical: true },
        { key: 'tag', label: 'Tag', hierarchical: false },
      ],
    });
    const store = useCmsContentStore();
    await store.fetchTermTypes();
    expect(api.get).toHaveBeenCalledWith('/admin/cms/term-types');
    expect(store.termTypes.map((t) => t.key)).toEqual(['category', 'tag']);
  });

  it('fetches terms for a given term type', async () => {
    (api.get as any).mockResolvedValueOnce([
      { id: 't1', term_type: 'category', slug: 'news', name: 'News', parent_id: null, seo_excluded: false, sort_order: 0 },
    ]);
    const store = useCmsContentStore();
    await store.fetchTerms('category');
    expect(api.get).toHaveBeenCalledWith('/admin/cms/terms', { params: { type: 'category' } });
    expect(store.terms).toHaveLength(1);
  });

  it('creates a post via POST when no id is present', async () => {
    (api.post as any).mockResolvedValueOnce({ id: 'p1', type: 'page', slug: 'about', title: 'About' });
    const store = useCmsContentStore();
    const saved = await store.savePost({ type: 'page', slug: 'about', title: 'About' });
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts', { type: 'page', slug: 'about', title: 'About' });
    expect(saved.id).toBe('p1');
    expect(store.currentPost?.id).toBe('p1');
  });

  it('updates a post via PUT when an id is present', async () => {
    (api.put as any).mockResolvedValueOnce({ id: 'p1', type: 'page', slug: 'about', title: 'About v2' });
    const store = useCmsContentStore();
    await store.savePost({ id: 'p1', type: 'page', slug: 'about', title: 'About v2' });
    expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/p1', expect.objectContaining({ title: 'About v2' }));
  });

  it('assigns terms to a post through the dedicated endpoint', async () => {
    (api.put as any).mockResolvedValueOnce({ post_id: 'p1', term_ids: ['t1', 't2'] });
    const store = useCmsContentStore();
    await store.assignTerms('p1', ['t1', 't2']);
    expect(api.put).toHaveBeenCalledWith('/admin/cms/posts/p1/terms', { term_ids: ['t1', 't2'] });
  });

  it('bulk-assigns a layout to many posts through the dedicated endpoint (S54)', async () => {
    (api.post as any).mockResolvedValueOnce({ updated: 2 });
    const store = useCmsContentStore();
    await store.bulkAssignLayout(['p1', 'p2'], 'lay-9');
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/assign-layout', {
      ids: ['p1', 'p2'],
      layout_id: 'lay-9',
    });
  });

  it('bulk-clears the layout (null) through the assign-layout endpoint', async () => {
    (api.post as any).mockResolvedValueOnce({ updated: 2 });
    const store = useCmsContentStore();
    await store.bulkAssignLayout(['p1', 'p2'], null);
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/assign-layout', {
      ids: ['p1', 'p2'],
      layout_id: null,
    });
  });

  it('bulk-unassigns categories through the dedicated endpoint', async () => {
    (api.post as any).mockResolvedValueOnce({ updated: 2 });
    const store = useCmsContentStore();
    await store.bulkUnassignCategory(['p1', 'p2']);
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/bulk/unassign-category', {
      ids: ['p1', 'p2'],
    });
  });

  it('changes status through the publish endpoint when publishing', async () => {
    (api.post as any).mockResolvedValueOnce({ id: 'p1', status: 'published' });
    const store = useCmsContentStore();
    await store.changeStatus('p1', 'published');
    expect(api.post).toHaveBeenCalledWith('/admin/cms/posts/p1/publish');
  });

  it('creates a term via POST and updates via PUT', async () => {
    (api.post as any).mockResolvedValueOnce({ id: 't1' });
    (api.get as any).mockResolvedValue([]);
    const store = useCmsContentStore();
    await store.saveTerm({ term_type: 'category', slug: 'news', name: 'News' });
    expect(api.post).toHaveBeenCalledWith('/admin/cms/terms', expect.objectContaining({ term_type: 'category' }));

    (api.put as any).mockResolvedValueOnce({ id: 't1' });
    await store.saveTerm({ id: 't1', term_type: 'category', slug: 'news', name: 'News!' });
    expect(api.put).toHaveBeenCalledWith('/admin/cms/terms/t1', expect.objectContaining({ name: 'News!' }));
  });
});
