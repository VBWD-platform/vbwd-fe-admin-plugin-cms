<template>
  <div class="widget-config-fields">
    <!-- HTML widget: content (HTML) + CSS editors -->
    <template v-if="widgetType === 'html'">
      <label class="field-label">{{ $t('cms.content', 'Content') }} (HTML)</label>
      <CodeMirrorEditor
        :model-value="model.content_html ?? ''"
        lang="html"
        min-height="220px"
        data-testid="widget-config-html"
        @update:model-value="update({ content_html: $event })"
      />
      <label class="field-label">{{ $t('cms.css', 'CSS') }}</label>
      <CodeMirrorEditor
        :model-value="model.source_css ?? ''"
        lang="css"
        min-height="140px"
        data-testid="widget-config-css"
        @update:model-value="update({ source_css: $event })"
      />
    </template>

    <!-- Menu widget: tree editor + CSS -->
    <template v-else-if="widgetType === 'menu'">
      <label class="field-label">{{ $t('cms.menuItems', 'Menu items') }}</label>
      <CmsMenuTreeEditor
        :model-value="menuItemsModel"
        @update:model-value="update({ menu_items: $event })"
      />
      <label class="field-label">{{ $t('cms.css', 'CSS') }}</label>
      <CodeMirrorEditor
        :model-value="model.source_css ?? ''"
        lang="css"
        min-height="140px"
        data-testid="widget-config-css"
        @update:model-value="update({ source_css: $event })"
      />
    </template>

    <!-- Vue-component widget: descriptor's General tab (when registered) + CSS -->
    <template v-else-if="widgetType === 'vue-component'">
      <component
        :is="descriptor.generalTabComponent"
        v-if="descriptor"
        :config="configModel"
        @update:config="update({ config: $event })"
      />
      <p
        v-else
        class="widget-config-fields__hint"
        data-testid="widget-config-vue-missing"
      >
        {{ $t('cms.noWidgetConfigEditor', 'This component has no config editor; only the CSS below applies for this page.') }}
      </p>
      <label class="field-label">{{ $t('cms.css', 'CSS') }}</label>
      <CodeMirrorEditor
        :model-value="model.source_css ?? ''"
        lang="css"
        min-height="140px"
        data-testid="widget-config-css"
        @update:model-value="update({ source_css: $event })"
      />
      <!-- eslint-disable-next-line vue/no-v-html -->
      <p
        v-if="descriptor?.cssHint"
        class="widget-config-fields__hint"
        v-html="descriptor.cssHint"
      />
    </template>

    <!-- Other / unknown types: CSS only (block is never empty) -->
    <template v-else>
      <label class="field-label">{{ $t('cms.css', 'CSS') }}</label>
      <CodeMirrorEditor
        :model-value="model.source_css ?? ''"
        lang="css"
        min-height="140px"
        data-testid="widget-config-css"
        @update:model-value="update({ source_css: $event })"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CodeMirrorEditor from './CodeMirrorEditor.vue';
import CmsMenuTreeEditor from './CmsMenuTreeEditor.vue';
import type { CmsMenuItemData } from '../stores/useCmsAdminStore';
import { getWidgetEditor } from '../widgets/widgetEditorRegistry';

/**
 * Per-type widget editing body, shared between the global Widget Editor and the
 * PostEditor's per-page override collapsible. It edits a structured model
 * `{ content_html, source_css, config, menu_items }` via `v-model`, surfacing
 * only the keys relevant to `widgetType`. The host owns persistence; this
 * component only reflects the model and emits the changed keys.
 */
export interface WidgetConfigModel {
  content_html?: string;
  source_css?: string;
  config?: Record<string, unknown>;
  menu_items?: CmsMenuItemData[];
}

const props = defineProps<{
  /** The widget's type — selects which editors to render. */
  widgetType: string;
  /** vue-component identifier used to resolve the editor descriptor. */
  componentName?: string;
  modelValue: WidgetConfigModel;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: WidgetConfigModel): void }>();

const model = computed(() => props.modelValue);

// Resolve the vue-component editor descriptor for the General tab. Absent for
// html/menu widgets, or for a vue widget whose component has no registered
// descriptor — in that case only the CSS editor renders.
const descriptor = computed(() =>
  props.componentName ? getWidgetEditor(props.componentName) : undefined,
);

const configModel = computed<Record<string, unknown>>(() => model.value.config ?? {});
const menuItemsModel = computed<CmsMenuItemData[]>(() => model.value.menu_items ?? []);

function update(patch: Partial<WidgetConfigModel>): void {
  emit('update:modelValue', { ...model.value, ...patch });
}
</script>

<style scoped>
.widget-config-fields { display: flex; flex-direction: column; gap: 6px; }
.widget-config-fields__hint { font-size: 0.78rem; color: #6b7280; margin: 4px 0 0; }
.field-label { display: block; font-size: 0.82rem; font-weight: 600; margin: 8px 0 2px; color: #374151; }
</style>
