# Vue Component Plugins — CMS Extension Guide

The `vue-component` widget type is the bridge between the CMS and external plugin components.
It allows any plugin to register a Vue component that the CMS admin can place into any layout
area — with zero coupling between the CMS and the plugin.

---

## Architecture overview

```
Plugin (e.g. GHRM)                CMS                     Admin
  install()                         vueComponentRegistry      CmsWidgetEditor
    └─► vueComponentRegistry          .get("MyComponent")       └─► JSON config editor
          .register("MyComponent",      └─► <component :is>           └─► widget.config
            MyComponent)                      :v-bind="config.props"
```

The CMS never imports plugin components directly. The registry is the only shared surface.

---

## Step 1 — Create the Vue component

Your component receives `config.props` as its props:

```vue
<!-- vbwd-fe-user/plugins/my-plugin/src/components/MyWidget.vue -->
<template>
  <div class="my-widget">
    <h2>{{ title }}</h2>
    <p>Count: {{ count }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  count: number
  show_footer?: boolean
}>()
</script>
```

No awareness of the CMS is needed in the component itself.

---

## Step 2 — Register the component in your plugin's `install()`

```typescript
// vbwd-fe-user/plugins/my-plugin/index.ts
import type { IPlugin } from 'vbwd-view-component'
import { vueComponentRegistry } from '@/registries/vueComponentRegistry'

export const myPlugin: IPlugin = {
  name: 'my-plugin',
  version: '1.0.0',

  install(sdk) {
    // Lazy-load to avoid pulling the component into the initial bundle
    import('./src/components/MyWidget.vue').then(({ default: component }) => {
      vueComponentRegistry.register('MyWidget', component)
    })

    // Register routes, translations, etc.
    sdk.addRoute({ path: '/my-page', name: 'MyPage', component: () => import('./src/views/MyPage.vue') })
  },

  activate() {},
  deactivate() {
    vueComponentRegistry.unregister('MyWidget')
  },
}
```

---

## Step 3 — Create the widget in the CMS admin

1. Navigate to **CMS → Widgets → New Widget**
2. Set `widget_type` to **Vue Component**
3. Set `slug` to a unique identifier (e.g. `my-widget-pricing`)
4. In the **Config** JSON editor, enter:

```json
{
  "component": "MyWidget",
  "props": {
    "title": "Our Plans",
    "count": 3,
    "show_footer": true
  }
}
```

5. Save the widget
6. Assign it to a layout area of type `vue-component`
7. Use that layout on a CMS page

---

## Step 4 — Document your component's config schema

Add a `WIDGET_SCHEMA` export to your component file so the admin's schema reference panel
can display it:

```typescript
// vbwd-fe-user/plugins/my-plugin/src/components/MyWidget.vue
// (in <script setup> or as a named export from a separate schema file)

export const WIDGET_SCHEMA = {
  component: 'MyWidget',
  description: 'Displays a configurable count of plans from a category.',
  props: {
    title:         { type: 'string',  required: true,  description: 'Section heading' },
    count:         { type: 'number',  required: true,  description: 'Number of plans to show (1–6)' },
    show_footer:   { type: 'boolean', required: false, default: true, description: 'Show plan footer links' },
  },
}
```

Register the schema with the registry:

```typescript
vueComponentRegistry.register('MyWidget', component, MyWidget.WIDGET_SCHEMA)
```

The admin's `CmsWidgetEditor.vue` reads schemas from the registry and renders a prop reference
panel next to the JSON editor.

---

## Real example: GHRM's `NativePricingPlans`

```typescript
// vbwd-fe-user/plugins/ghrm/index.ts
import('./src/components/NativePricingPlans.vue').then(({ default: c }) => {
  vueComponentRegistry.register('NativePricingPlans', c)
})
```

Widget config stored in DB (`CmsWidget.config`):

```json
{
  "component": "NativePricingPlans",
  "props": {
    "category": "root",
    "plan_count": 3,
    "show_billing_toggle": true,
    "default_billing_period": "monthly"
  }
}
```

Admin can change `category` to `backend` or `plan_count` to `6` without touching code —
just edit the widget's config JSON in the admin.

---

## `vueComponentRegistry` API

```typescript
// vbwd-fe-user/src/registries/vueComponentRegistry.ts

class VueComponentRegistry {
  register(name: string, component: Component, schema?: WidgetSchema): void
  unregister(name: string): void
  get(name: string): Component | null
  getSchema(name: string): WidgetSchema | null
  list(): string[]
}

export const vueComponentRegistry = new VueComponentRegistry()
```

The registry is a singleton. All plugins share the same instance.

---

## Graceful degradation

If a `vue-component` widget references a component that is not registered (e.g. the plugin
is disabled), `CmsVueComponentWidget.vue` renders a placeholder:

```vue
<div v-if="!resolvedComponent" class="cms-widget--missing">
  Component "{{ config.component }}" is not available.
  Enable the required plugin to render this widget.
</div>
```

This prevents the page from crashing when a plugin is toggled off.

---

## Security

The `config.props` are passed directly to the component via `v-bind`. Plugin components
are responsible for validating their own props. The CMS does not sanitize prop values.

Do not use `v-html` with unsanitized props inside a `vue-component` widget. Use a sanitizer
(e.g. `DOMPurify`) for any user-controlled HTML content.

---

## Plugin boundary rules

- A `vue-component` widget's component lives **in the plugin**, not in CMS
- The plugin registers the component; the CMS renders it — **no cross-import**
- The CMS `widget.config` is the **only interface** between admin and component
- The component reads route params / store data as needed — the CMS does not pass them

Violations (import `@/plugins/ghrm/...` from inside `@/plugins/cms/...`) break the plugin
boundary and must not be introduced.
