/**
 * Shared-seam re-export oracle (D9).
 *
 * cms-admin promotes the widget-editor registry to a SHARED seam so another
 * fe-admin plugin (meinchat-admin) can register its own widget editor without
 * any meinchat strings landing in cms-admin (OCP). The plugin's index.ts is the
 * stable public path; it must re-export registerWidgetEditor / getWidgetEditor /
 * the VueWidgetEditorDescriptor type. This is a re-export only — no behaviour
 * change — so the built-in editors must still register and resolve.
 *
 * Engineering requirements (binding, restated): TDD-first (this RED set); SOLID
 * (OCP — extension surface; DIP — consumers depend on the seam, not concrete
 * widgets); DRY (one registry); no overengineering (re-export only). Quality
 * guard: ``npm run test`` + ``npm run lint`` + ``vue-tsc``.
 */
import { describe, it, expect } from 'vitest';
import {
  registerWidgetEditor,
  getWidgetEditor,
} from '../../index';
import type { VueWidgetEditorDescriptor } from '../../index';
import '../../src/widgets/index';

describe('cms-admin widget-editor shared seam', () => {
  it('re-exports registerWidgetEditor and getWidgetEditor from the plugin index', () => {
    expect(typeof registerWidgetEditor).toBe('function');
    expect(typeof getWidgetEditor).toBe('function');
  });

  it('still registers every built-in widget editor (characterisation)', () => {
    const builtIns = [
      'CmsBreadcrumb',
      'NativePricingPlans',
      'ContactForm',
      'CustomCode',
      'Search',
      'SearchResults',
      'Category',
      'AddonCatalog',
    ];
    for (const componentName of builtIns) {
      expect(getWidgetEditor(componentName)).toBeDefined();
    }
  });

  it('the re-exported register and get share the same registry instance', () => {
    const descriptor: VueWidgetEditorDescriptor = {
      componentName: 'SharedSeamProbe',
      defaultConfig: () => ({ component_name: 'SharedSeamProbe' }),
      generalTabComponent: { template: '<div />' },
      buildPreview: () => ({ html: '<div></div>' }),
    };
    registerWidgetEditor(descriptor);
    expect(getWidgetEditor('SharedSeamProbe')).toBe(descriptor);
  });
});
