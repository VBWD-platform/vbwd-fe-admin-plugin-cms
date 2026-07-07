import {
  test,
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * S122 — CMS Posts Permalink Engine (fe-admin surface).
 *
 * Drives the live fe-admin (E2E_BASE_URL=http://localhost:8081) against the real
 * backend permalink engine:
 *  1. The Permalinks config tab sets STRUCTURED mode (posts_root=blog, year on)
 *     and persists the five keys.
 *  2. The editor's live permalink preview shows the nested structured path for a
 *     post whose primary category is nested (Electronics > Phones).
 *  3. A post with NO category resolves to an `/uncategorized/` segment.
 *  4. TEMPLATE mode: the editor preview reflects the free-form %token% template.
 *
 * Auth harness (fe-admin lesson): a real UI login seeds BOTH `admin_token` and
 * `admin_token_user`; navigation is by URL. Test terms/posts + the permalink
 * config are created/restored via the admin API (self-cleaning — no demo data
 * is mutated permanently).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const API = `${BASE_URL}/api/v1`;
const SHOT_DIR = process.env.S122_SHOT_DIR;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

const PARENT_SLUG = 's122-electronics';
const CHILD_SLUG = 's122-phones';
const POST_NESTED_SLUG = 's122-nested-post';
const POST_ORPHAN_SLUG = 's122-orphan-post';
const TEMPLATE_EXAMPLE =
  'abracadabra/%subcategory%/anotherabracadabra/%year%/%slug%-%timestamp%-%category%';

let api: APIRequestContext;
let token: string;
let parentTermId: string;
let childTermId: string;
let nestedPostId: string;
let orphanPostId: string;
let originalMode = 'off';

test.describe.configure({ mode: 'serial' });

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function apiToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await response.json();
  return body.token ?? body.access_token;
}

async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 15000 });
  await page.locator('[data-testid="username-input"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="password-input"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-button"]').click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20000 });
}

async function deleteTermBySlug(slug: string): Promise<void> {
  const response = await api.get(`${API}/admin/cms/terms?type=category`, { headers: authHeaders() });
  const body = await response.json();
  const items = Array.isArray(body) ? body : body.terms ?? body.items ?? [];
  for (const term of items) {
    if (term.slug === slug) {
      await api.delete(`${API}/admin/cms/terms/${term.id}`, { headers: authHeaders() });
    }
  }
}

async function deletePostBySlugContains(fragment: string): Promise<void> {
  const response = await api.get(`${API}/admin/cms/posts?per_page=300`, { headers: authHeaders() });
  const body = await response.json();
  const items = Array.isArray(body) ? body : body.items ?? [];
  for (const post of items) {
    if (typeof post.slug === 'string' && post.slug.includes(fragment)) {
      await api.delete(`${API}/admin/cms/posts/${post.id}`, { headers: authHeaders() });
    }
  }
}

async function createTerm(payload: Record<string, unknown>): Promise<string> {
  const response = await api.post(`${API}/admin/cms/terms`, { headers: authHeaders(), data: payload });
  if (!response.ok()) throw new Error(`create term failed: ${response.status()} ${await response.text()}`);
  return (await response.json()).id;
}

async function createPost(payload: Record<string, unknown>): Promise<string> {
  const response = await api.post(`${API}/admin/cms/posts`, { headers: authHeaders(), data: payload });
  if (!response.ok()) throw new Error(`create post failed: ${response.status()} ${await response.text()}`);
  return (await response.json()).id;
}

async function getFullCmsConfig(): Promise<Record<string, unknown>> {
  const detail = await (await api.get(`${API}/admin/plugins/cms`, { headers: authHeaders() })).json();
  const schema = (detail.configSchema ?? {}) as Record<string, { default?: unknown }>;
  const full: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) full[key] = field?.default;
  Object.assign(full, detail.savedConfig ?? {});
  return full;
}

async function setPermalinkMode(mode: string): Promise<void> {
  const full = await getFullCmsConfig();
  full.posts_permalink_mode = mode;
  await api.put(`${API}/admin/plugins/cms/config`, { headers: authHeaders(), data: full });
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test.beforeAll(async () => {
  api = await apiRequest.newContext();
  token = await apiToken(api);
  originalMode = String((await getFullCmsConfig()).posts_permalink_mode ?? 'off');

  await deletePostBySlugContains('s122-');
  await deleteTermBySlug(CHILD_SLUG);
  await deleteTermBySlug(PARENT_SLUG);

  parentTermId = await createTerm({ term_type: 'category', name: 'S122 Electronics', slug: PARENT_SLUG });
  childTermId = await createTerm({
    term_type: 'category', name: 'S122 Phones', slug: CHILD_SLUG, parent_id: parentTermId,
  });

  // A draft post whose primary category is the nested child term. Terms are
  // assigned through the dedicated endpoint (the create body does not attach
  // them — same flow the editor uses), then the primary category is set.
  nestedPostId = await createPost({
    type: 'post', title: 'S122 Nested Post', slug: POST_NESTED_SLUG, status: 'draft',
  });
  await api.put(`${API}/admin/cms/posts/${nestedPostId}/terms`, {
    headers: authHeaders(), data: { term_ids: [childTermId] },
  });
  await api.put(`${API}/admin/cms/posts/${nestedPostId}`, {
    headers: authHeaders(), data: { primary_term_id: childTermId },
  });
  // A draft post with NO category → uncategorized fallback.
  orphanPostId = await createPost({
    type: 'post', title: 'S122 Orphan Post', slug: POST_ORPHAN_SLUG, status: 'draft',
  });
});

test.afterAll(async () => {
  // Restore the permalink mode + remove all S122 fixtures.
  await setPermalinkMode(originalMode);
  await api.delete(`${API}/admin/cms/posts/${nestedPostId}`, { headers: authHeaders() });
  await api.delete(`${API}/admin/cms/posts/${orphanPostId}`, { headers: authHeaders() });
  await deleteTermBySlug(CHILD_SLUG);
  await deleteTermBySlug(PARENT_SLUG);
  await api.dispose();
});

test('Permalinks config tab: enable structured mode + persist the five keys', async ({ page }) => {
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/seo`, { waitUntil: 'networkidle' });

  await page.locator('[data-testid="tab-permalinks"]').click();
  await expect(page.locator('[data-testid="permalink-mode"]')).toBeVisible();

  await page.locator('[data-testid="permalink-mode"]').selectOption('structured');
  await expect(page.locator('[data-testid="permalink-root"]')).toBeVisible();
  await page.locator('[data-testid="permalink-root"]').fill('blog');
  await page.locator('[data-testid="permalink-include-year"]').check();
  // Template field is gated OUT of structured mode.
  await expect(page.locator('[data-testid="permalink-template"]')).toHaveCount(0);

  await shot(page, '01-permalinks-config-structured');
  await page.locator('[data-testid="permalink-save"]').click();
  await expect(page.locator('[data-testid="permalink-saved"]')).toBeVisible();

  const config = await getFullCmsConfig();
  expect(config.posts_permalink_mode).toBe('structured');
  expect(config.posts_root).toBe('blog');
  expect(config.posts_permalink_include_year).toBe(true);
});

test('Editor preview: nested primary category → /blog/<year>/<cat>/<sub>/<slug>', async ({ page }) => {
  await setPermalinkMode('structured');
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/posts/${nestedPostId}/edit`, { waitUntil: 'networkidle' });

  const pathField = page.locator('[data-testid="permalink-preview-path"]');
  await expect(pathField).toBeVisible();
  const year = String(new Date().getFullYear());
  await expect(pathField).toContainText(
    `blog/${year}/${PARENT_SLUG}/${CHILD_SLUG}/${POST_NESTED_SLUG}`,
    { timeout: 15000 },
  );
  // The primary-category picker is limited to the post's assigned category.
  await expect(page.locator('[data-testid="primary-category-picker"]')).toHaveValue(childTermId);
  await shot(page, '02-editor-preview-structured');
});

test('Editor preview: no category → /uncategorized/ segment', async ({ page }) => {
  await setPermalinkMode('structured');
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/posts/${orphanPostId}/edit`, { waitUntil: 'networkidle' });

  const pathField = page.locator('[data-testid="permalink-preview-path"]');
  await expect(pathField).toContainText('/uncategorized/', { timeout: 15000 });
  await shot(page, '03-editor-preview-uncategorized');
});

test('Template mode: editor preview reflects the %token% template', async ({ page }) => {
  // Set template mode via the Permalinks tab UI.
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/seo`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="tab-permalinks"]').click();
  await page.locator('[data-testid="permalink-mode"]').selectOption('template');
  await expect(page.locator('[data-testid="permalink-template"]')).toBeVisible();
  await expect(page.locator('[data-testid="permalink-legend"]')).toBeVisible();
  await expect(page.locator('[data-testid="permalink-include-year"]')).toHaveCount(0);
  await page.locator('[data-testid="permalink-template"]').fill(TEMPLATE_EXAMPLE);
  await shot(page, '04-permalinks-config-template');
  await page.locator('[data-testid="permalink-save"]').click();
  await expect(page.locator('[data-testid="permalink-saved"]')).toBeVisible();

  // The nested post's preview must reflect the template's literal + token layout.
  await page.goto(`${BASE_URL}/admin/cms/posts/${nestedPostId}/edit`, { waitUntil: 'networkidle' });
  const pathField = page.locator('[data-testid="permalink-preview-path"]');
  await expect(pathField).toContainText('abracadabra/', { timeout: 15000 });
  await expect(pathField).toContainText('anotherabracadabra/');
  await shot(page, '05-editor-preview-template');
});
