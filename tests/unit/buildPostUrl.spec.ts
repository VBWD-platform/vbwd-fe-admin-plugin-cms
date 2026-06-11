import { describe, it, expect } from 'vitest';
import { buildPostUrl, feUserBaseUrl } from '../../src/utils/postUrl';

describe('buildPostUrl', () => {
  it('returns the public URL for a published post (no token)', () => {
    const url = buildPostUrl('live', 'published', 'tok-xyz');
    expect(url).toBe(`${feUserBaseUrl()}/live`);
    expect(url).not.toContain('preview_token');
  });

  it('appends ?preview_token= for a non-published post with a token', () => {
    const url = buildPostUrl('draft-page', 'draft', 'tok-abc');
    expect(url).toBe(`${feUserBaseUrl()}/draft-page?preview_token=tok-abc`);
  });

  it('returns the plain public URL for a non-published post without a token', () => {
    const url = buildPostUrl('draft-page', 'draft', '');
    expect(url).toBe(`${feUserBaseUrl()}/draft-page`);
  });

  it('returns an empty string when the slug is missing', () => {
    expect(buildPostUrl('', 'draft', 'tok-abc')).toBe('');
    expect(buildPostUrl(undefined, 'published')).toBe('');
  });

  it('strips a leading slash from the slug', () => {
    expect(buildPostUrl('/about', 'published')).toBe(`${feUserBaseUrl()}/about`);
  });
});
