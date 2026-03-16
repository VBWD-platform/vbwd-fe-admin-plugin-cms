/**
 * Vue-component widget editor registry.
 *
 * Each vue-component widget that wants admin editing registers a
 * VueWidgetEditorDescriptor here.  CmsWidgetEditor.vue is fully
 * widget-agnostic — it only reads from this registry.
 *
 * SOLID notes:
 *   OCP — add a new widget without touching CmsWidgetEditor.vue.
 *   SRP — each descriptor owns its own config shape and preview logic.
 *   DIP — CmsWidgetEditor depends on this abstraction, not concrete widgets.
 */
import type { Component } from 'vue';

export interface VueWidgetEditorDescriptor {
  /** Must match the value stored in widget.config.component_name */
  componentName: string;

  /**
   * Returns a fresh default config object for a *new* widget of this type.
   * Called once when the editor initialises a new widget.
   */
  defaultConfig(): Record<string, unknown>;

  /**
   * Vue component rendered as the "General" tab body.
   * Must accept `v-model:config` (prop `config`, emit `update:config`).
   */
  generalTabComponent: Component;

  /** Hint text shown below the CSS CodeMirror editor. */
  cssHint?: string;

  /**
   * Build a static preview of this widget for the iframe.
   * @returns { html } — body HTML; { baseStyles } — optional extra styles (appended before `css`).
   */
  buildPreview(config: Record<string, unknown>): { html: string; baseStyles?: string };
}

const _registry = new Map<string, VueWidgetEditorDescriptor>();

export function registerWidgetEditor(desc: VueWidgetEditorDescriptor): void {
  _registry.set(desc.componentName, desc);
}

export function getWidgetEditor(name: string): VueWidgetEditorDescriptor | undefined {
  return _registry.get(name);
}
