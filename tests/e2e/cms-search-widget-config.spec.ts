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
 * S121 T7 — fe-admin Search / SearchResults widget config.
 *
 * Proves the admin scope control end-to-end against the running fe-admin
 * (E2E_BASE_URL=http://localhost:8081): the Search editor exposes a scope
 * <select> (pages/posts/both), a quicksearch toggle + limit that round-trips
 * through save, and a SearchResults widget carrying the legacy free-text `type`
 * presents the derived scope.
 *
 * Auth harness (fe-admin lesson): a real UI login seeds BOTH `admin_token` and
 * `admin_token_user`; navigation is by URL. Test widgets are seeded/cleaned via
 * the admin CMS API (self-cleaning — the demo widgets are never mutated).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const API = `${BASE_URL}/api/v1`;
const SHOT_DIR = process.env.S121_SHOT_DIR;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

const SEARCH_WIDGET_SLUG = 's121-e2e-search-widget';
const LEGACY_RESULTS_SLUG = 's121-e2e-searchresults-legacy';

const scopeSelect = '[data-test-id="search-scope"]';
const quicksearchToggle = '[data-test-id="search-quicksearch"]';
const quicksearchLimit = '[data-test-id="search-quicksearch-limit"]';
const resultsScopeSelect = '[data-test-id="search-results-scope"]';

let api: APIRequestContext;
let token: string;
let searchWidgetId: string;
let legacyResultsId: string;

test.describe.configure({ mode: 'serial' });

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 15000 });
  await page.locator('[data-testid="username-input"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="password-input"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-button"]').click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20000 });
}

async function apiToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await response.json();
  return body.token ?? body.access_token;
}

async function deleteWidgetBySlug(slug: string): Promise<void> {
  const response = await api.get(`${API}/admin/cms/widgets?per_page=300`, { headers: authHeaders() });
  const body = await response.json();
  const items = Array.isArray(body) ? body : body.items ?? [];
  for (const widget of items) {
    if (widget.slug === slug) {
      await api.delete(`${API}/admin/cms/widgets/${widget.id}`, { headers: authHeaders() });
    }
  }
}

async function createWidget(payload: Record<string, unknown>): Promise<string> {
  const response = await api.post(`${API}/admin/cms/widgets`, { headers: authHeaders(), data: payload });
  if (!response.ok()) {
    throw new Error(`create widget failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return body.id;
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test.beforeAll(async () => {
  api = await apiRequest.newContext();
  token = await apiToken(api);

  await deleteWidgetBySlug(SEARCH_WIDGET_SLUG);
  await deleteWidgetBySlug(LEGACY_RESULTS_SLUG);

  searchWidgetId = await createWidget({
    name: 'S121 E2E Search',
    slug: SEARCH_WIDGET_SLUG,
    widget_type: 'vue-component',
    content_json: { component: 'Search' },
    config: {
      component_name: 'Search',
      placeholder: 'Search…',
      target_path: '',
      scope: 'both',
      quicksearch: false,
      quicksearch_limit: 6,
    },
  });

  // A SearchResults widget carrying ONLY the legacy free-text `type` (no scope).
  legacyResultsId = await createWidget({
    name: 'S121 E2E SearchResults Legacy',
    slug: LEGACY_RESULTS_SLUG,
    widget_type: 'vue-component',
    content_json: { component: 'SearchResults' },
    config: { component_name: 'SearchResults', type: 'post', mode: 'titles', per_page: 10 },
  });
});

test.afterAll(async () => {
  await deleteWidgetBySlug(SEARCH_WIDGET_SLUG);
  await deleteWidgetBySlug(LEGACY_RESULTS_SLUG);
  await api.dispose();
});

test('Search editor: scope select + quicksearch toggle + limit round-trip through save', async ({ page }) => {
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/widgets/${searchWidgetId}/edit`, { waitUntil: 'networkidle' });

  await expect(page.locator(scopeSelect)).toBeVisible();
  await expect(page.locator(scopeSelect)).toHaveValue('both');

  await page.locator(scopeSelect).selectOption('pages');
  await page.locator(quicksearchToggle).check();
  // The limit field only renders once quicksearch is on.
  await expect(page.locator(quicksearchLimit)).toBeVisible();
  await page.locator(quicksearchLimit).fill('8');

  await shot(page, '01-admin-search-widget-config');

  const savePut = page.waitForResponse(
    (response) =>
      response.url().includes(`/admin/cms/widgets/${searchWidgetId}`) &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save' }).click();
  await savePut;

  // Reload the editor from scratch — the saved config must repopulate.
  await page.goto(`${BASE_URL}/admin/cms/widgets/${searchWidgetId}/edit`, { waitUntil: 'networkidle' });
  await expect(page.locator(scopeSelect)).toHaveValue('pages');
  await expect(page.locator(quicksearchToggle)).toBeChecked();
  await expect(page.locator(quicksearchLimit)).toHaveValue('8');

  // Confirm the persisted record independently of the UI.
  const persisted = await api.get(`${API}/admin/cms/widgets/${searchWidgetId}`, { headers: authHeaders() });
  const widget = await persisted.json();
  expect(widget.config.scope).toBe('pages');
  expect(widget.config.quicksearch).toBe(true);
  expect(widget.config.quicksearch_limit).toBe(8);
});

test('SearchResults editor: a widget stored with legacy `type` presents the derived scope', async ({ page }) => {
  await loginViaUI(page);
  await page.goto(`${BASE_URL}/admin/cms/widgets/${legacyResultsId}/edit`, { waitUntil: 'networkidle' });

  const select = page.locator(resultsScopeSelect);
  await expect(select).toBeVisible();
  // Legacy `type: 'post'` (no explicit scope) must derive to `posts`.
  await expect(select).toHaveValue('posts');
});
