import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import CmsSeo from '../../src/views/CmsSeo.vue';

vi.mock('@/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('CmsSeo.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('cleans up prerendered content and reports the removed count', async () => {
    (api.post as any).mockResolvedValue({ removed: 3 });
    const wrapper = mount(CmsSeo);

    await wrapper.find('[data-testid="seo-cleanup"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/admin/cms/seo/cleanup', {});
    expect(wrapper.find('[data-testid="seo-cleanup-result"]').text()).toContain('Removed 3');
  });

  it('generates prerendered content and reports the written count', async () => {
    (api.post as any).mockResolvedValue({ regenerated: 5 });
    const wrapper = mount(CmsSeo);

    await wrapper.find('[data-testid="seo-generate"]').trigger('click');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/admin/cms/seo/regenerate', {});
    expect(wrapper.find('[data-testid="seo-generate-result"]').text()).toContain('Generated 5');
  });

  it('surfaces an error when cleanup fails', async () => {
    (api.post as any).mockRejectedValue(new Error('boom'));
    const wrapper = mount(CmsSeo);

    await wrapper.find('[data-testid="seo-cleanup"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="seo-cleanup-error"]').text()).toContain('boom');
    expect(wrapper.find('[data-testid="seo-cleanup-result"]').exists()).toBe(false);
  });
});
