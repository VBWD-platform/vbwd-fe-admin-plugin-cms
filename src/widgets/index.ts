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
