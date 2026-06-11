// Shared builder for the fe-user public/preview URL of a CMS post or page.
//
// Single source of truth for the "open the page" link used by the editor's
// View/Preview link and by the slug "open page" icon on the post/page lists.
// Published posts get the plain public URL; an unpublished post with a known
// preview_token gets a ?preview_token= URL that bypasses the published gate
// (the public route validates the token). No slug → no URL.

const ADMIN_PORT = '8081';
const FE_USER_ORIGIN = 'http://localhost:8080';

/** The fe-user base origin, derived from the admin app's current location. */
export function feUserBaseUrl(): string {
  if (typeof window === 'undefined') {
    return FE_USER_ORIGIN;
  }
  return window.location.port === ADMIN_PORT
    ? FE_USER_ORIGIN
    : window.location.origin.replace(`:${ADMIN_PORT}`, ':8080');
}

/**
 * Build the fe-user URL for a post/page.
 *
 * @param slug          the post slug (a leading slash is stripped)
 * @param status        the post status; anything other than 'published' is a
 *                      preview and uses the token when one is available
 * @param previewToken  the post's preview_token (optional)
 * @returns the public/preview URL, or '' when there is no slug
 */
export function buildPostUrl(
  slug: string | null | undefined,
  status: string,
  previewToken?: string | null,
): string {
  const cleanSlug = (slug || '').replace(/^\//, '');
  if (!cleanSlug) {
    return '';
  }
  const url = `${feUserBaseUrl()}/${cleanSlug}`;
  if (status !== 'published' && previewToken) {
    return `${url}?preview_token=${previewToken}`;
  }
  return url;
}
