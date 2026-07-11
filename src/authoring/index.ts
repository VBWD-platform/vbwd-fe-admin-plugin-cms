/**
 * Public authoring surface (S128).
 *
 * The reusable CMS authoring primitives, re-exported from one stable path so a
 * sibling fe-admin plugin (e.g. a dataset / shop / booking adopter) can build an
 * entity-page tab from the SAME components the CMS post editor uses — no code
 * doubling, no importing view-internal paths.
 *
 * Import as:
 *   import { SeoFieldsPanel, HtmlPreviewFrame } from '@plugins/cms-admin/src/authoring';
 */
export { default as TipTapEditor } from '../components/TipTapEditor.vue';
export { default as CodeMirrorEditor } from '../components/CodeMirrorEditor.vue';
export { default as CmsImagePicker } from '../components/CmsImagePicker.vue';
export { default as SeoFieldsPanel } from '../components/SeoFieldsPanel.vue';
export { default as HtmlPreviewFrame } from '../components/HtmlPreviewFrame.vue';
export { default as EntityPageTab } from '../components/EntityPageTab.vue';

export type { SeoFields } from '../components/SeoFieldsPanel.vue';
