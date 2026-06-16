/**
 * Widget editor descriptor registrations.
 *
 * Import this file once at app start (CmsWidgetEditor.vue does it).
 * Each call to registerWidgetEditor() is idempotent — re-importing is safe.
 */
import { registerWidgetEditor } from './widgetEditorRegistry';
import CmsBreadcrumbEditorTab from './CmsBreadcrumbEditorTab.vue';
import NativePricingPlansEditorTab from './NativePricingPlansEditorTab.vue';
import ContactFormEditorTab from './ContactFormEditorTab.vue';
import CustomCodeEditorTab from './CustomCodeEditorTab.vue';
import SearchEditorTab from './SearchEditorTab.vue';
import SearchResultsEditorTab from './SearchResultsEditorTab.vue';
import CategoryEditorTab from './CategoryEditorTab.vue';
import AddonCatalogEditorTab from './AddonCatalogEditorTab.vue';
import TariffPlanCollectionEditorTab from './TariffPlanCollectionEditorTab.vue';
import TokenBundleCollectionEditorTab from './TokenBundleCollectionEditorTab.vue';

// ── CmsBreadcrumb ─────────────────────────────────────────────────────────────

registerWidgetEditor({
  componentName: 'CmsBreadcrumb',

  defaultConfig: () => ({
    component_name: 'CmsBreadcrumb',
    separator: '/',
    root_name: 'Home',
    root_slug: '/',
    max_label_length: 40,
    show_category: true,
  }),

  generalTabComponent: CmsBreadcrumbEditorTab,

  cssHint: 'Scoped to <code>.ghrm-breadcrumb</code>. Overrides default styles.',

  buildPreview(config) {
    const sep      = (config.separator as string) || '/';
    const rootName = (config.root_name as string) || 'Home';
    const showCat  = config.show_category !== false;
    const html = `<nav class="ghrm-breadcrumb" aria-label="breadcrumb">
  <a href="#" class="ghrm-breadcrumb__link">${rootName}</a>
  ${showCat
    ? `<span class="ghrm-breadcrumb__separator" aria-hidden="true">${sep}</span>
  <a href="#" class="ghrm-breadcrumb__link">Category</a>`
    : ''}
  <span class="ghrm-breadcrumb__separator" aria-hidden="true">${sep}</span>
  <span class="ghrm-breadcrumb__current">Package Name</span>
</nav>`;
    return { html };
  },
});

// ── NativePricingPlans ────────────────────────────────────────────────────────

registerWidgetEditor({
  componentName: 'NativePricingPlans',

  defaultConfig: () => ({
    component_name: 'NativePricingPlans',
    mode: 'category',
    category: 'root',
    plan_slugs: [],
  }),

  generalTabComponent: NativePricingPlansEditorTab,

  cssHint: 'Injected into <code>&lt;head&gt;</code> when this widget is on the page. Target <code>.landing1</code>, <code>.plan-card</code>, <code>.plans-grid</code>, etc.',

  buildPreview(config) {
    const baseStyles = `
.plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
.plan-card{background:#fff;padding:24px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.08);text-align:center;border:2px solid transparent}
.plan-name{font-size:1.2rem;color:#2c3e50;margin-bottom:12px}
.plan-price{font-size:1.8rem;font-weight:700;color:#3498db;margin-bottom:16px}
.choose-btn{width:100%;padding:12px;background:#3498db;color:#fff;border:none;border-radius:6px;font-size:.95rem;cursor:pointer}`;

    const slugs = Array.isArray(config.plan_slugs) ? (config.plan_slugs as string[]) : [];
    const samplePlans = slugs.length
      ? slugs.map(s => `<div class="plan-card"><h2 class="plan-name">${s}</h2><div class="plan-price">—</div><button class="choose-btn">Choose Plan</button></div>`).join('')
      : `<div class="plan-card"><h2 class="plan-name">Basic</h2><div class="plan-price">9 USD</div><button class="choose-btn">Choose Plan</button></div>
<div class="plan-card"><h2 class="plan-name">Pro</h2><div class="plan-price">29 USD</div><button class="choose-btn">Choose Plan</button></div>
<div class="plan-card"><h2 class="plan-name">Enterprise</h2><div class="plan-price">99 USD</div><button class="choose-btn">Choose Plan</button></div>`;

    return { html: `<div class="plans-grid">${samplePlans}</div>`, baseStyles };
  },
});

// ── ContactForm ───────────────────────────────────────────────────────────────

registerWidgetEditor({
  componentName: 'ContactForm',

  defaultConfig: () => ({
    component_name: 'ContactForm',
    recipient_email: '',
    success_message: 'Thank you! We will get back to you soon.',
    fields: [
      { id: 'name',  type: 'text',  label: 'Name',  required: true },
      { id: 'email', type: 'email', label: 'Email', required: true },
    ],
    rate_limit_enabled: true,
    rate_limit_max: 5,
    rate_limit_window_minutes: 60,
    captcha_html: '',
    analytics_html: '',
  }),

  generalTabComponent: ContactFormEditorTab,

  cssHint: 'Injected into <code>&lt;head&gt;</code> when this widget is on the page. Target <code>.contact-form-widget</code>, <code>.contact-form-widget__input</code>, etc.',

  buildPreview(config) {
    const fields = Array.isArray(config.fields) ? (config.fields as any[]) : [];
    const fieldRows = fields.map((f: any) => {
      const inputHtml = f.type === 'textarea'
        ? `<textarea style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:.9rem" rows="3" placeholder="${f.label}"></textarea>`
        : (f.type === 'radio' || f.type === 'checkbox')
          ? (f.options ?? []).map((o: string) =>
              `<label style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><input type="${f.type}"> ${o}</label>`
            ).join('')
          : `<input type="${f.type}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:.9rem" placeholder="${f.label}">`;
      return `<div style="margin-bottom:14px">
        <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:4px;color:#374151">
          ${f.label}${f.required ? ' <span style="color:#e74c3c">*</span>' : ''}
        </label>
        ${inputHtml}
      </div>`;
    }).join('');

    const html = `<div style="max-width:520px;margin:0 auto">
      <form style="display:flex;flex-direction:column;gap:0">
        ${fieldRows}
        <button style="align-self:flex-start;padding:10px 24px;background:#3498db;color:#fff;border:none;border-radius:6px;font-size:.95rem;font-weight:600;cursor:pointer">
          Send Message
        </button>
      </form>
    </div>`;
    return { html };
  },
});

// ── CustomCode ──────────────────────────────────────────────────────────────
// Raw HTML/JS injected verbatim on the public site (analytics snippets,
// third-party embeds, etc.). The fe-user CustomCodeWidget reads config.code.

registerWidgetEditor({
  componentName: 'CustomCode',

  defaultConfig: () => ({
    component_name: 'CustomCode',
    code: '',
  }),

  generalTabComponent: CustomCodeEditorTab,

  cssHint: 'Optional styles injected alongside the custom code on the page.',

  buildPreview(config) {
    const code = (config.code as string) || '';
    return { html: code };
  },
});

// ── Search ────────────────────────────────────────────────────────────────────
// fe-user component PostSearch.vue — a search box that posts a query to a page
// hosting the SearchResults widget.

registerWidgetEditor({
  componentName: 'Search',

  defaultConfig: () => ({
    component_name: 'Search',
    placeholder: 'Search…',
    target_path: '',
  }),

  generalTabComponent: SearchEditorTab,

  cssHint: 'Target <code>.post-search</code>, <code>.post-search__input</code>.',

  buildPreview(config) {
    const placeholder = (config.placeholder as string) || 'Search…';
    return {
      html: `<input type="search" placeholder="${placeholder}" style="width:100%;padding:.6rem .9rem;border:1px solid #cbd5e1;border-radius:6px;font-size:1rem">`,
    };
  },
});

// ── SearchResults ─────────────────────────────────────────────────────────────
// fe-user component PostSearchResults.vue — renders matched posts as a list.

registerWidgetEditor({
  componentName: 'SearchResults',

  defaultConfig: () => ({
    component_name: 'SearchResults',
    type: 'post',
    mode: 'titles',
    meta: [],
    per_page: 10,
    scope_term_type: '',
    scope_term_slug: '',
  }),

  generalTabComponent: SearchResultsEditorTab,

  cssHint: 'Target <code>.post-search-results</code>, <code>.post-list</code>.',

  buildPreview() {
    return {
      html: '<ul style="list-style:none;padding:0"><li style="padding:.5rem 0;border-bottom:1px solid #eee">Result title one</li><li style="padding:.5rem 0;border-bottom:1px solid #eee">Result title two</li></ul>',
    };
  },
});

// ── Category ──────────────────────────────────────────────────────────────────
// fe-user component PostTermListWidget.vue — lists posts under a given term.

registerWidgetEditor({
  componentName: 'Category',

  defaultConfig: () => ({
    component_name: 'Category',
    type: 'post',
    term_type: 'category',
    term_slug: '',
    mode: 'titles',
    meta: [],
    limit: 10,
    paginate: false,
  }),

  generalTabComponent: CategoryEditorTab,

  cssHint: 'Target <code>.post-term-list-widget</code>, <code>.post-list</code>.',

  buildPreview() {
    return {
      html: '<ul style="list-style:none;padding:0"><li style="padding:.5rem 0;border-bottom:1px solid #eee">Result title one</li><li style="padding:.5rem 0;border-bottom:1px solid #eee">Result title two</li></ul>',
    };
  },
});

// ── AddonCatalog ──────────────────────────────────────────────────────────────
// fe-user component AddonCatalog.vue — lists the public add-on catalogue, one
// card per add-on, price rendered through the shared PriceDisplay.

registerWidgetEditor({
  componentName: 'AddonCatalog',

  defaultConfig: () => ({
    component_name: 'AddonCatalog',
    heading: '',
  }),

  generalTabComponent: AddonCatalogEditorTab,

  cssHint: 'Target <code>.addon-catalog</code>, <code>.addon-card</code>, <code>.addon-card__name</code>, <code>.addon-card__price</code>.',

  buildPreview(config) {
    const heading = (config.heading as string) || '';
    const headingHtml = heading
      ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${heading}</h2>`
      : '';
    const card = (name: string, price: string) =>
      `<div style="border:1px solid #ddd;border-radius:8px;padding:1rem 1.25rem 1.25rem">
  <h3 style="font-size:1.0625rem;font-weight:600;margin:0 0 .5rem">${name}</h3>
  <p style="font-size:.9375rem;color:#666;margin:0 0 .75rem">Add-on description.</p>
  <p style="font-size:1rem;font-weight:700;margin:0">${price}</p>
</div>`;
    return {
      html: `${headingHtml}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.5rem">
  ${card('Extra Tokens', '5.00 EUR')}
  ${card('Priority Support', '12.00 EUR')}
</div>`,
    };
  },
});

// ── TariffPlanCollection ──────────────────────────────────────────────────────
// fe-user component TariffPlanCollection.vue — lists subscription tarif plans,
// either by category or an explicit slug set, as cards or a table.

registerWidgetEditor({
  componentName: 'TariffPlanCollection',

  defaultConfig: () => ({
    component_name: 'TariffPlanCollection',
    source_mode: 'category',
    category: 'root',
    plan_slugs: [],
    default_view: 'cards',
    heading: '',
  }),

  generalTabComponent: TariffPlanCollectionEditorTab,

  cssHint: 'Target <code>.tariff-plan-collection</code>, <code>.tariff-plan-collection__heading</code>, and the shared plan/table card styles.',

  buildPreview(config) {
    const heading = (config.heading as string) || '';
    const headingHtml = heading
      ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${heading}</h2>`
      : '';
    const card = (name: string, price: string) =>
      `<div style="border:1px solid #ddd;border-radius:8px;padding:1.25rem;text-align:center">
  <h3 style="font-size:1.0625rem;font-weight:600;margin:0 0 .5rem">${name}</h3>
  <p style="font-size:1.3rem;font-weight:700;color:#3498db;margin:0 0 .75rem">${price}</p>
  <button style="width:100%;padding:10px;background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer">Choose</button>
</div>`;
    return {
      html: `${headingHtml}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.25rem">
  ${card('Basic', '9 EUR')}
  ${card('Pro', '29 EUR')}
  ${card('Enterprise', '99 EUR')}
</div>`,
    };
  },
});

// ── TokenBundleCollection ─────────────────────────────────────────────────────
// fe-user component TokenBundleCollection.vue — lists active token bundles,
// either all or an explicit id set, as cards or a table.

registerWidgetEditor({
  componentName: 'TokenBundleCollection',

  defaultConfig: () => ({
    component_name: 'TokenBundleCollection',
    bundle_ids: [],
    default_view: 'cards',
    heading: '',
  }),

  generalTabComponent: TokenBundleCollectionEditorTab,

  cssHint: 'Target <code>.token-bundle-collection</code>, <code>.token-bundle-collection__heading</code>, and the shared bundle/table card styles.',

  buildPreview(config) {
    const heading = (config.heading as string) || '';
    const headingHtml = heading
      ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${heading}</h2>`
      : '';
    const card = (tokens: string, price: string) =>
      `<div style="border:1px solid #ddd;border-radius:8px;padding:1.25rem;text-align:center">
  <h3 style="font-size:1.0625rem;font-weight:600;margin:0 0 .5rem">${tokens} Tokens</h3>
  <p style="font-size:1.3rem;font-weight:700;color:#3498db;margin:0 0 .75rem">${price}</p>
  <button style="width:100%;padding:10px;background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer">Add to cart</button>
</div>`;
    return {
      html: `${headingHtml}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.25rem">
  ${card('1,000', '5 EUR')}
  ${card('5,000', '20 EUR')}
  ${card('20,000', '70 EUR')}
</div>`,
    };
  },
});
