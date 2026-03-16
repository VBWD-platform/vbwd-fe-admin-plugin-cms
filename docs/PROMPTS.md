# AI Agent Prompts — CMS Plugin Development

Copy-paste prompts for AI coding agents (Claude Code, GitHub Copilot, Cursor, etc.)
for common CMS development tasks. All prompts assume the VBWD codebase and conventions.

---

## Prompt 1: Create a new `vue-component` CMS widget

```
You are working in the VBWD codebase (vbwd-sdk-2).

Task: Create a new CMS vue-component widget called "<ComponentName>".

Context:
- Widget config is stored as JSON in CmsWidget.config (vbwd-backend/plugins/cms/src/models/cms_widget.py)
- The frontend registry is vbwd-fe-user/src/registries/vueComponentRegistry.ts
- GHRM's NativePricingPlans is a working reference implementation
- The component must be registered in the plugin's install() lifecycle hook (never in CMS itself)
- Plugin boundary: CMS never imports from the plugin; plugin registers into CMS registry

Steps to complete:
1. Create vbwd-fe-user/plugins/<plugin>/src/components/<ComponentName>.vue
   - Define props using defineProps<{...}>()
   - Export WIDGET_SCHEMA constant with prop descriptions
   - No CMS imports inside the component
2. In vbwd-fe-user/plugins/<plugin>/index.ts install():
   - Lazy-import the component and call vueComponentRegistry.register('<ComponentName>', component)
3. In deactivate(): call vueComponentRegistry.unregister('<ComponentName>')
4. Create a seed widget entry in vbwd-backend/plugins/cms/src/bin/populate_cms.py:
   - widget_type: "vue-component"
   - config: { "component": "<ComponentName>", "props": { ...defaults } }
5. Write unit tests:
   - Component renders correctly with given props
   - Registry registers and unregisters cleanly
   - Graceful degradation when component is missing from registry

Rules:
- TDD: write tests before implementation
- No cross-plugin imports
- Props must be TypeScript-typed
- Component must handle undefined/null props gracefully
```

---

## Prompt 2: Create a new plugin on top of the CMS (backend + frontend)

```
You are working in the VBWD codebase (vbwd-sdk-2).

Reference implementation: plugins/ghrm/ (backend) and vbwd-fe-user/plugins/ghrm/ (frontend)

Task: Create a new plugin called "<plugin-name>" that extends the CMS.

The plugin must follow the "core is agnostic — plugins are gnostic" rule:
- Never modify vbwd-backend/src/ for plugin functionality
- Never modify vbwd-fe-user/plugins/cms/ for plugin functionality
- All plugin code goes in plugins/<plugin-name>/ (backend) and plugins/<plugin-name>/ (frontend)

Backend steps:
1. Create vbwd-backend/plugins/<plugin-name>/__init__.py with class extending BasePlugin:
   - metadata property returning PluginMetadata
   - initialize(config) — merges with DEFAULT_CONFIG
   - get_blueprint() — returns Flask Blueprint from routes.py
   - get_url_prefix() — returns "" (routes use absolute paths) or "/api/v1/<prefix>"
   - on_enable() / on_disable()
2. Create models in plugins/<plugin-name>/src/models/ extending BaseModel
3. Create repositories in plugins/<plugin-name>/src/repositories/ with interface + SQLAlchemy impl
4. Create services in plugins/<plugin-name>/src/services/ — business logic, constructor-injected repos
5. Create plugins/<plugin-name>/src/routes.py — Flask Blueprint, factory functions for services
6. Create alembic/versions/<date>_create_<plugin>_tables.py migration
7. Register in plugins/plugins.json and plugins/config.json
8. Write unit tests (mock repos) and integration tests (real DB)

Frontend (fe-user) steps:
1. Create vbwd-fe-user/plugins/<plugin-name>/index.ts — named export IPlugin
2. Register routes via sdk.addRoute() in install()
3. Create views in plugins/<plugin-name>/src/views/
4. Create stores in plugins/<plugin-name>/src/stores/
5. Register any vue-component widgets into vueComponentRegistry in install()
6. Register any nav extensions via sdk or extensionRegistry
7. Write unit tests for views and stores

Frontend (fe-admin) steps:
1. Create vbwd-fe-admin/plugins/<plugin-name>-admin/index.ts — named export IPlugin
2. Use extensionRegistry.register() for tab extensions on existing admin pages
3. Or register new admin routes for dedicated admin views
4. Write unit tests for admin components

Rules:
- TDD: tests first
- SOLID: single responsibility per service, interface-based repos
- DI: constructor injection only
- DRY: no duplicated validation logic
- Liskov: all IRepository implementations are drop-in replaceable
- Plugin boundary: zero cross-plugin imports
- Use GHRM as the reference implementation throughout
```

---

## Prompt 3: Add a new CMS area type and layout

```
You are working in the VBWD codebase (vbwd-sdk-2).

Task: Add a new area type called "<area-type>" to the CMS.

Steps:
1. Backend — add to AREA_TYPES frozenset:
   File: vbwd-backend/plugins/cms/src/models/cms_layout.py
   Add: "<area-type>" to the frozenset (no migration needed — validated in Python only)

2. Backend — update area type validation in routes if explicit validation exists

3. Frontend admin — add option to area type dropdown:
   File: vbwd-fe-admin/plugins/cms-admin/src/views/CmsLayoutEditor.vue
   Add: { value: '<area-type>', label: '<Human Label>' } to AREA_TYPE_OPTIONS

4. Frontend fe-user — add CSS class mapping:
   File: vbwd-fe-user/plugins/cms/src/components/CmsLayout.vue
   Add: '<area-type>': 'cms-area--<area-type>' to AREA_WRAPPERS

5. Frontend fe-user — if the new area type requires a special wrapper component
   (not just a CSS class), create the wrapper component and add it to the area type dispatcher

6. Seed: add a layout using this area type to populate_cms.py if needed

7. Tests:
   - Unit: CmsLayout.vue renders new area type with correct class
   - Unit: CmsLayoutEditor.vue shows new option in dropdown
   - Backend: layout with new area type passes validation
```

---

## Prompt 4: Add a new widget type to the CMS

```
You are working in the VBWD codebase (vbwd-sdk-2).

Task: Add a new widget type called "<widget-type>" to the CMS.

Steps:
1. Backend model — add to WIDGET_TYPES frozenset:
   File: vbwd-backend/plugins/cms/src/models/cms_widget.py
   Add: "<widget-type>" to the frozenset (no migration needed)

2. Backend routes — add to allowed types in CRUD endpoint validation

3. Frontend store — extend TypeScript union type:
   File: vbwd-fe-admin/plugins/cms-admin/src/stores/useCmsAdminStore.ts
   Update: widget_type field to include '<widget-type>'

4. Frontend admin editor — add type option and editor panel:
   File: vbwd-fe-admin/plugins/cms-admin/src/views/CmsWidgetEditor.vue
   - Add <option value="<widget-type>"><Widget Type Label></option>
   - Add <div v-if="widget.widget_type === '<widget-type>'"> editor panel </div>

5. Frontend fe-user renderer — add renderer component:
   File: vbwd-fe-user/plugins/cms/src/components/CmsWidgetRenderer.vue (or dispatcher)
   - Create the renderer component: vbwd-fe-user/plugins/cms/src/components/Cms<WidgetType>Widget.vue
   - Add to WIDGET_RENDERERS map

6. Tests:
   - Unit: CmsWidgetEditor.vue shows editor panel for new type
   - Unit: CmsWidgetRenderer.vue dispatches to correct renderer
   - Backend: widget with new type passes validation, is saved and returned correctly
   - Integration: create widget via API, assign to layout, verify page API returns it
```

---

## Prompt 5: Extend the GHRM plugin with a new admin tab

```
You are working in the VBWD codebase (vbwd-sdk-2).

Task: Add a new admin tab to the GHRM software package admin page called "<TabName>".

Context:
- GHRM admin plugin: vbwd-fe-admin/plugins/ghrm-admin/
- Extension pattern: extensionRegistry.register('planTabSections', ...) — see ghrm-admin/index.ts
- The tab component receives the current package object as a prop
- All GHRM admin code lives in ghrm-admin/ — never modify cms-admin or other plugins

Steps:
1. Create component:
   vbwd-fe-admin/plugins/ghrm-admin/src/components/Ghrm<TabName>Tab.vue
   - Props: { package: GhrmPackage }
   - Calls GHRM admin API endpoints as needed

2. Register tab in ghrm-admin/index.ts:
   extensionRegistry.register('ghrmPackageTabSections', {
     id: '<tab-id>',
     label: t('ghrm.<tab-id>'),
     component: Ghrm<TabName>Tab,
     condition: (pkg) => true,  // or conditional logic
   })

3. Add translation key to locales/en.json

4. Backend: add required API endpoints to plugins/ghrm/src/routes.py if needed

5. Tests:
   - Unit: tab renders correctly with mock package
   - Unit: tab appears/disappears based on condition
   - Integration: API endpoint returns correct data
```

---

## Prompt 6: Seed CMS content for a new plugin

```
You are working in the VBWD codebase (vbwd-sdk-2).

Task: Add CMS seed data (pages, widgets, layouts) for the "<plugin-name>" plugin.

The seed script is: vbwd-backend/plugins/cms/src/bin/populate_cms.py

Important rules:
- All inserts must be idempotent (_get_or_create_* functions)
- Plugin pages use namespaced slugs: "<plugin-name>/<page-slug>"
- Plugin layouts use namespaced slugs: "<plugin-name>-<layout-slug>"
- Plugin widgets use namespaced slugs: "<plugin-name>-<widget-slug>"
- Never overwrite header-nav or footer-nav — add entries, don't replace

Steps:
1. Define HTML/CSS content constants at the top of the file (after existing constants)
2. Add layout(s) to the LAYOUTS list with namespaced slug
3. In populate_cms():
   a. Create widget(s) using _get_or_create_widget()
   b. Create page(s) using _get_or_create_page() with the plugin's layout
4. Update the summary print block at the end of populate_cms()
5. Test: run `docker compose exec api python plugins/cms/src/bin/populate_cms.py` twice
   — second run must produce "~ updated" lines, not "Already exists" errors

Output: idempotent seed that works from clean DB and from existing populated DB.
```
