import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import HtmlPreviewFrame from '../../src/components/HtmlPreviewFrame.vue';

// happy-dom's iframe element exposes a null `contentDocument`, so we stub a
// writable document on the element and capture what the component writes into it.
function stubIframeDocument(iframe: HTMLIFrameElement) {
  const writes: string[] = [];
  const fakeDoc = {
    open: vi.fn(),
    close: vi.fn(),
    write: (chunk: string) => writes.push(chunk),
  };
  Object.defineProperty(iframe, 'contentDocument', {
    configurable: true,
    get: () => fakeDoc,
  });
  return writes;
}

describe('HtmlPreviewFrame', () => {
  it('renders a sandboxed iframe', () => {
    const wrapper = mount(HtmlPreviewFrame, {
      props: { contentHtml: '<p>Hi</p>', sourceCss: '' },
    });
    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('sandbox')).toContain('allow-scripts');
  });

  it('writes the content HTML and source CSS into the iframe document', () => {
    const wrapper = mount(HtmlPreviewFrame, {
      props: { contentHtml: '<p>Hello</p>', sourceCss: 'p{color:red}' },
    });
    const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
    const writes = stubIframeDocument(iframe);
    (wrapper.vm as unknown as { render: () => void }).render();
    const written = writes.join('');
    expect(written).toContain('<p>Hello</p>');
    expect(written).toContain('p{color:red}');
  });

  it('re-renders the iframe when the props change', async () => {
    const wrapper = mount(HtmlPreviewFrame, {
      props: { contentHtml: '<p>First</p>', sourceCss: '' },
    });
    const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
    const writes = stubIframeDocument(iframe);
    await wrapper.setProps({ contentHtml: '<p>Second</p>', sourceCss: 'body{margin:0}' });
    await flushPromises();
    const written = writes.join('');
    expect(written).toContain('<p>Second</p>');
    expect(written).toContain('body{margin:0}');
  });
});
