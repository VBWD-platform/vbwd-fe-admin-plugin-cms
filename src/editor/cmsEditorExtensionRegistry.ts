/**
 * CMS editor extension registry (AI-agnostic seams).
 *
 * `PostEditor.vue` exposes two slots so a sibling fe-admin plugin (e.g. cms-ai)
 * can inject editor surfaces WITHOUT cms-admin importing or knowing about that
 * plugin:
 *   - `cmsEditorHeaderActions` — rendered inside `.post-editor__actions`
 *     (before Save) in the editor header action bar.
 *   - `cmsEditorPanels` — rendered between the editor header and body.
 *
 * Each registered component receives one `context` prop typed as
 * `CmsEditorContext`. An empty registry leaves the editor exactly as it was
 * (Liskov null default): the editor renders no extra surfaces.
 *
 * SOLID notes:
 *   OCP  — add a header action / panel without touching PostEditor.vue.
 *   SRP  — this module only stores and lists editor extensions.
 *   DIP  — PostEditor depends on this abstraction, not on any AI plugin.
 *   ISP  — the slots carry the narrowest surface the consumers need.
 */
import { reactive } from 'vue';
import type { Component, Ref } from 'vue';

/** The shape a host page may apply to the editor form (core CMS fields). */
export interface CmsEditorPatch {
  content_html?: string | null;
  source_css?: string | null;
  excerpt?: string | null;
  title?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  schema_json?: unknown;
  /** Custom-field keys (S77) ride alongside core keys, by key. */
  [customFieldKey: string]: unknown;
}

/** The reactive context a registered editor extension receives. */
export interface CmsEditorContext<FormShape = Record<string, unknown>> {
  /** The reactive editor form (read title/excerpt/content_html/type, etc.). */
  form: Ref<FormShape>;
  /**
   * Write back only the supplied fields. Core keys land on `form`; keys that
   * are not core form fields are routed to the S77 custom-field store when one
   * is present, else they degrade into a custom-field bucket on the context.
   * `null`/`undefined` values are never applied.
   */
  applyPatch(patch: CmsEditorPatch): void;
  /** Build the request context from the current form. */
  getContext(options: { readExcerpt: boolean }): {
    title: string;
    excerpt: string;
    content_html: string;
    type: string;
    custom_fields?: Record<string, unknown>;
  };
}

/** A registered editor extension component (receives a `context` prop). */
type EditorExtensionComponent = Component;

const headerActions = reactive<EditorExtensionComponent[]>([]);
const panels = reactive<EditorExtensionComponent[]>([]);

/** Register a component into the header action bar (before Save). */
export function registerCmsEditorHeaderAction(component: EditorExtensionComponent): void {
  headerActions.push(component);
}

/** Register a component into the panel slot (between header and body). */
export function registerCmsEditorPanel(component: EditorExtensionComponent): void {
  panels.push(component);
}

/** All registered header-action components (empty array when none). */
export function getCmsEditorHeaderActions(): EditorExtensionComponent[] {
  return headerActions;
}

/** All registered panel components (empty array when none). */
export function getCmsEditorPanels(): EditorExtensionComponent[] {
  return panels;
}

/** Test-only reset so specs start from an empty registry. */
export function clearCmsEditorExtensions(): void {
  headerActions.splice(0, headerActions.length);
  panels.splice(0, panels.length);
}
