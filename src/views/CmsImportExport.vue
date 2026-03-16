<template>
  <div class="cms-view cms-ie">
    <div class="cms-ie__header">
      <h1>CMS Import / Export</h1>
    </div>

    <!-- ── EXPORT ──────────────────────────────────────────────────────── -->
    <section class="cms-ie__card">
      <h2 class="cms-ie__section-title">
        Export
      </h2>
      <p class="cms-ie__hint">
        Select which sections to include in the ZIP archive.
      </p>

      <div class="cms-ie__checkboxes">
        <label class="cms-ie__check-label cms-ie__check-label--all">
          <input
            type="checkbox"
            :checked="exportEverything"
            @change="toggleEverything"
          >
          <span>Everything</span>
        </label>
        <label
          v-for="s in SECTIONS"
          :key="s.key"
          class="cms-ie__check-label"
        >
          <input
            type="checkbox"
            :checked="exportSections.has(s.key)"
            :disabled="exportEverything"
            @change="toggleSection(s.key)"
          >
          <span>{{ s.label }}</span>
        </label>
      </div>

      <div class="cms-ie__actions">
        <button
          class="btn btn--primary"
          :disabled="exportBusy || (!exportEverything && exportSections.size === 0)"
          @click="doExport"
        >
          {{ exportBusy ? 'Exporting…' : 'Export ZIP' }}
        </button>
      </div>
      <p
        v-if="exportError"
        class="cms-ie__error"
      >
        {{ exportError }}
      </p>
    </section>

    <!-- ── IMPORT ──────────────────────────────────────────────────────── -->
    <section class="cms-ie__card">
      <h2 class="cms-ie__section-title">
        Import
      </h2>

      <!-- File picker -->
      <div class="field-group">
        <label class="field-label">ZIP file</label>
        <input
          type="file"
          accept=".zip"
          class="field-input"
          @change="onFileChange"
        >
      </div>

      <!-- Conflict strategy -->
      <div class="field-group">
        <label class="field-label">Conflict strategy</label>
        <div class="cms-ie__radio-group">
          <label class="cms-ie__radio-label">
            <input
              v-model="strategy"
              type="radio"
              value="add"
            >
            <span>
              <strong>Add</strong> — skip items whose slug already exists
            </span>
          </label>
          <label class="cms-ie__radio-label">
            <input
              v-model="strategy"
              type="radio"
              value="index"
            >
            <span>
              <strong>Rename duplicates</strong> — add <code>-2</code>, <code>-3</code>… suffix on slug conflict
            </span>
          </label>
          <label class="cms-ie__radio-label">
            <input
              v-model="strategy"
              type="radio"
              value="drop_all"
            >
            <span>
              <strong>Drop all &amp; replace</strong> — permanently delete all existing CMS content first
            </span>
          </label>
        </div>
      </div>

      <!-- DROP ALL confirmation -->
      <div
        v-if="strategy === 'drop_all'"
        class="cms-ie__danger-box"
      >
        <p>
          This will <strong>permanently delete</strong> all pages, layouts, widgets, categories,
          styles, routing rules, and images before importing. This cannot be undone.
        </p>
        <p>Type <code>DROP ALL</code> to confirm:</p>
        <input
          v-model="dropAllConfirm"
          class="field-input"
          placeholder="DROP ALL"
          autocomplete="off"
        >
      </div>

      <div class="cms-ie__actions">
        <button
          class="btn btn--primary"
          :disabled="!canImport"
          @click="doImport"
        >
          {{ importBusy ? 'Importing…' : 'Import ZIP' }}
        </button>
      </div>

      <p
        v-if="importError"
        class="cms-ie__error"
      >
        {{ importError }}
      </p>

      <!-- Result -->
      <div
        v-if="importResult"
        class="cms-ie__result"
      >
        <h3 class="cms-ie__result-title">
          Import complete
        </h3>
        <table class="cms-table cms-ie__result-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(count, key) in importResult.imported"
              :key="key"
            >
              <td>{{ key }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="importResult.errors.length"
          class="cms-ie__errors-list"
        >
          <strong>Warnings / errors:</strong>
          <ul>
            <li
              v-for="(err, i) in importResult.errors"
              :key="i"
            >
              {{ err }}
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCmsAdminStore } from '../stores/useCmsAdminStore';

const store = useCmsAdminStore();

const SECTIONS = [
  { key: 'pages', label: 'Pages' },
  { key: 'categories', label: 'Categories' },
  { key: 'layouts', label: 'Layouts' },
  { key: 'widgets', label: 'Widgets' },
  { key: 'styles', label: 'Styles' },
  { key: 'routing_rules', label: 'Routing Rules' },
  { key: 'images', label: 'Images' },
] as const;

// ── Export state ────────────────────────────────────────────────────────────
const exportEverything = ref(true);
const exportSections = ref<Set<string>>(new Set());
const exportBusy = ref(false);
const exportError = ref('');

function toggleEverything() {
  exportEverything.value = !exportEverything.value;
  if (exportEverything.value) exportSections.value.clear();
}

function toggleSection(key: string) {
  if (exportSections.value.has(key)) exportSections.value.delete(key);
  else exportSections.value.add(key);
}

async function doExport() {
  exportError.value = '';
  exportBusy.value = true;
  try {
    const sections = exportEverything.value ? ['everything'] : [...exportSections.value];
    await store.exportCms(sections);
  } catch (e: any) {
    exportError.value = e?.message ?? 'Export failed';
  } finally {
    exportBusy.value = false;
  }
}

// ── Import state ────────────────────────────────────────────────────────────
const importFile = ref<File | null>(null);
const strategy = ref<'add' | 'index' | 'drop_all'>('add');
const dropAllConfirm = ref('');
const importBusy = ref(false);
const importError = ref('');
const importResult = ref<{ imported: Record<string, number>; errors: string[] } | null>(null);

function onFileChange(e: Event) {
  importFile.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  importResult.value = null;
  importError.value = '';
}

const canImport = computed(() => {
  if (importBusy.value || !importFile.value) return false;
  if (strategy.value === 'drop_all' && dropAllConfirm.value !== 'DROP ALL') return false;
  return true;
});

async function doImport() {
  importError.value = '';
  importResult.value = null;
  importBusy.value = true;
  try {
    importResult.value = await store.importCms(importFile.value!, strategy.value);
  } catch (e: any) {
    importError.value = e?.message ?? 'Import failed';
  } finally {
    importBusy.value = false;
  }
}
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.cms-ie__header {
  margin-bottom: 1.5rem;
}
.cms-ie__header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--admin-heading, #2c3e50);
}

.cms-ie__card {
  background: var(--admin-card-bg, #fff);
  border: 1px solid var(--admin-border-light, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.cms-ie__section-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--admin-heading, #2c3e50);
}

.cms-ie__hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--admin-muted, #6b7280);
}

/* ── Checkboxes ──────────────────────────────────────────────────────────── */
.cms-ie__checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.2rem;
  margin-bottom: 1.25rem;
}

.cms-ie__check-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--admin-text, #333);
}

.cms-ie__check-label--all {
  font-weight: 600;
  width: 100%;
}

/* ── Radio group ─────────────────────────────────────────────────────────── */
.cms-ie__radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 0.25rem;
}

.cms-ie__radio-label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--admin-text, #333);
  line-height: 1.4;
}

.cms-ie__radio-label input[type="radio"] {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

/* ── Danger box ──────────────────────────────────────────────────────────── */
.cms-ie__danger-box {
  background: #fff5f5;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #7f1d1d;
}

.cms-ie__danger-box p {
  margin: 0 0 0.6rem;
}

.cms-ie__danger-box p:last-of-type {
  margin-bottom: 0.4rem;
}

/* ── Actions ─────────────────────────────────────────────────────────────── */
.cms-ie__actions {
  margin-top: 1.25rem;
}

/* ── Error ───────────────────────────────────────────────────────────────── */
.cms-ie__error {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: var(--admin-danger, #e74c3c);
}

/* ── Result ──────────────────────────────────────────────────────────────── */
.cms-ie__result {
  margin-top: 1.5rem;
  border-top: 1px solid var(--admin-border-light, #e5e7eb);
  padding-top: 1rem;
}

.cms-ie__result-title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  color: var(--admin-heading, #2c3e50);
}

.cms-ie__result-table {
  width: auto;
  min-width: 0;
  margin-bottom: 1rem;
}

.cms-ie__result-table th,
.cms-ie__result-table td {
  padding: 6px 16px 6px 0;
  font-size: 0.9rem;
}

.cms-ie__errors-list {
  font-size: 0.85rem;
  color: var(--admin-danger, #e74c3c);
}

.cms-ie__errors-list ul {
  margin: 0.4rem 0 0 1.25rem;
  padding: 0;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 599px) {
  .cms-ie__card {
    padding: 1rem;
  }

  .cms-ie__checkboxes {
    gap: 0.5rem 0.8rem;
  }
}
</style>
