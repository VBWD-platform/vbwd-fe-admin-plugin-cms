import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import CmsPageList from '../../src/views/CmsPageList.vue';
import PostList from '../../src/views/PostList.vue';
import CmsContentList from '../../src/views/CmsContentList.vue';
import en from '../../locales/en.json';

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } });

// Stub the shared list so we can assert each wrapper delegates to it with the
// correct `type` prop — the wrappers must NOT diverge from the shared list.
const ContentListStub = {
  name: 'CmsContentList',
  props: ['type'],
  template: '<div data-testid="content-list-stub">{{ type }}</div>',
};

function mountWrapper(component: unknown) {
  return mount(component as any, {
    global: { plugins: [i18n], stubs: { CmsContentList: ContentListStub } },
  });
}

describe('Pages / Posts lists delegate to the shared CmsContentList', () => {
  it('CmsPageList renders the shared list with type="page"', () => {
    const wrapper = mountWrapper(CmsPageList);
    const stub = wrapper.findComponent(ContentListStub);
    expect(stub.exists()).toBe(true);
    expect(stub.props('type')).toBe('page');
  });

  it('PostList renders the shared list with type="post"', () => {
    const wrapper = mountWrapper(PostList);
    const stub = wrapper.findComponent(ContentListStub);
    expect(stub.exists()).toBe(true);
    expect(stub.props('type')).toBe('post');
  });

  it('the shared list component exists and is the single source for both', () => {
    expect(CmsContentList).toBeTruthy();
  });
});
