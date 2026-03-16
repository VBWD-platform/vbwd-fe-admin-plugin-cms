<template>
  <!-- Recipient email -->
  <div class="field-group">
    <label class="field-label">Recipient Email *</label>
    <input
      :value="cfg.recipient_email"
      class="field-input"
      type="email"
      placeholder="info@example.com"
      @input="set('recipient_email', ($event.target as HTMLInputElement).value)"
    >
    <p class="editor-pane__hint">
      Submissions are emitted as a <code>contact_form.received</code> event and delivered
      by the email plugin to this address.
    </p>
  </div>

  <!-- Success message -->
  <div class="field-group">
    <label class="field-label">Success Message</label>
    <input
      :value="cfg.success_message"
      class="field-input"
      type="text"
      placeholder="Thank you! We will get back to you soon."
      @input="set('success_message', ($event.target as HTMLInputElement).value)"
    >
  </div>

  <!-- Field builder -->
  <div class="field-group">
    <label class="field-label">Form Fields</label>
    <div class="cf-field-list">
      <div
        v-for="(field, idx) in localFields"
        :key="field.id"
        class="cf-field-item"
      >
        <div class="cf-field-item__order">
          <button
            type="button"
            class="cf-order-btn"
            :disabled="idx === 0"
            title="Move up"
            @click="moveUp(idx)"
          >
            ▲
          </button>
          <button
            type="button"
            class="cf-order-btn"
            :disabled="idx === localFields.length - 1"
            title="Move down"
            @click="moveDown(idx)"
          >
            ▼
          </button>
        </div>

        <div class="cf-field-item__config">
          <div class="cf-field-row">
            <div
              class="field-group"
              style="margin:0"
            >
              <label
                class="field-label"
                style="font-size:0.78rem"
              >Label</label>
              <input
                v-model="field.label"
                class="field-input field-input--sm"
                type="text"
                placeholder="e.g. Your Message"
                @input="emitFields"
              >
            </div>
            <div
              class="field-group"
              style="margin:0"
            >
              <label
                class="field-label"
                style="font-size:0.78rem"
              >Type</label>
              <select
                v-model="field.type"
                class="field-input"
                :disabled="field.id === 'name' || field.id === 'email'"
                @change="emitFields"
              >
                <option value="text">
                  Text
                </option>
                <option value="email">
                  Email
                </option>
                <option value="tel">
                  Telephone
                </option>
                <option value="url">
                  URL
                </option>
                <option value="textarea">
                  Textarea
                </option>
                <option value="radio">
                  Radio
                </option>
                <option value="checkbox">
                  Checkbox
                </option>
              </select>
            </div>
            <div
              class="field-group"
              style="margin:0"
            >
              <label
                class="field-label"
                style="font-size:0.78rem"
              >Required</label>
              <label class="cf-required-toggle">
                <input
                  v-model="field.required"
                  type="checkbox"
                  :disabled="field.id === 'name' || field.id === 'email'"
                  @change="emitFields"
                >
                Required
              </label>
            </div>
            <button
              type="button"
              class="btn btn--xs btn--danger"
              :disabled="field.id === 'name' || field.id === 'email'"
              title="Remove field"
              @click="removeField(idx)"
            >
              ×
            </button>
          </div>

          <!-- Options for radio / checkbox -->
          <div
            v-if="field.type === 'radio' || field.type === 'checkbox'"
            class="cf-options-row"
          >
            <label
              class="field-label"
              style="font-size:0.78rem"
            >
              Options <span style="font-weight:400;color:#9ca3af">(comma-separated)</span>
            </label>
            <input
              :value="(field.options || []).join(', ')"
              class="field-input field-input--sm"
              type="text"
              placeholder="Option 1, Option 2, Option 3"
              @input="field.options = ($event.target as HTMLInputElement).value.split(',').map((s: string) => s.trim()).filter(Boolean); emitFields()"
            >
          </div>
        </div>
      </div>
    </div>

    <div class="cf-add-btns">
      <button
        v-for="ft in CF_ADDABLE_TYPES"
        :key="ft.type"
        type="button"
        class="btn btn--sm"
        @click="addField(ft.type)"
      >
        + {{ ft.label }}
      </button>
    </div>
    <p class="editor-pane__hint">
      Name and Email are always present and required. Reorder with ▲ ▼ buttons.
    </p>
  </div>

  <!-- Rate limiting -->
  <div class="field-group">
    <label class="field-label">Rate Limiting</label>
    <div class="cf-rate-row">
      <label
        class="cf-required-toggle"
        style="white-space:nowrap"
      >
        <input
          :checked="!!cfg.rate_limit_enabled"
          type="checkbox"
          @change="set('rate_limit_enabled', ($event.target as HTMLInputElement).checked)"
        >
        Enable
      </label>
      <div
        class="field-group"
        style="margin:0"
      >
        <label
          class="field-label"
          style="font-size:0.78rem"
        >Max requests</label>
        <input
          :value="cfg.rate_limit_max"
          class="field-input field-input--sm"
          type="number"
          min="1"
          max="200"
          :disabled="!cfg.rate_limit_enabled"
          @input="set('rate_limit_max', Number(($event.target as HTMLInputElement).value))"
        >
      </div>
      <div
        class="field-group"
        style="margin:0"
      >
        <label
          class="field-label"
          style="font-size:0.78rem"
        >Window (min)</label>
        <input
          :value="cfg.rate_limit_window_minutes"
          class="field-input field-input--sm"
          type="number"
          min="1"
          :disabled="!cfg.rate_limit_enabled"
          @input="set('rate_limit_window_minutes', Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>
    <p class="editor-pane__hint">
      Max submissions per IP per window. Requires Redis.
    </p>
  </div>

  <!-- CAPTCHA embed -->
  <div class="field-group">
    <label class="field-label">CAPTCHA / reCAPTCHA HTML</label>
    <CodeMirrorEditor
      :model-value="(cfg.captcha_html as string) || ''"
      lang="html"
      min-height="80px"
      @update:model-value="set('captcha_html', $event)"
    />
    <p class="editor-pane__hint">
      Paste any CAPTCHA widget script/markup here. Rendered inside the form before the submit button.
    </p>
  </div>

  <!-- Analytics embed -->
  <div
    class="field-group"
    style="margin-top:8px"
  >
    <label class="field-label">Analytics / Tracking HTML</label>
    <CodeMirrorEditor
      :model-value="(cfg.analytics_html as string) || ''"
      lang="html"
      min-height="80px"
      @update:model-value="set('analytics_html', $event)"
    />
    <p class="editor-pane__hint">
      E.g. Google Analytics event snippet. Rendered above the form in a hidden div.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import CodeMirrorEditor from '../components/CodeMirrorEditor.vue';

interface ContactFormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
}

const props = defineProps<{ config: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:config', val: Record<string, unknown>): void }>();

const cfg = computed(() => props.config);

const DEFAULT_FIELDS: ContactFormField[] = [
  { id: 'name',  type: 'text',  label: 'Name',  required: true },
  { id: 'email', type: 'email', label: 'Email', required: true },
];

const CF_ADDABLE_TYPES = [
  { type: 'tel',      label: 'Phone'    },
  { type: 'text',     label: 'Text'     },
  { type: 'url',      label: 'URL'      },
  { type: 'textarea', label: 'Textarea' },
  { type: 'radio',    label: 'Radio'    },
  { type: 'checkbox', label: 'Checkbox' },
] as const;

function initFields(): ContactFormField[] {
  const saved = props.config.fields;
  if (Array.isArray(saved) && saved.length) return (saved as ContactFormField[]).map(f => ({ ...f }));
  return DEFAULT_FIELDS.map(f => ({ ...f }));
}

const localFields = ref<ContactFormField[]>(initFields());

// Sync when parent loads a saved widget with existing fields
watch(() => props.config.fields, (incoming) => {
  if (!Array.isArray(incoming)) return;
  if (JSON.stringify(incoming) !== JSON.stringify(localFields.value)) {
    localFields.value = (incoming as ContactFormField[]).map(f => ({ ...f }));
  }
}, { deep: true });

function set(key: string, value: unknown) {
  emit('update:config', { ...props.config, [key]: value });
}

function emitFields() {
  emit('update:config', { ...props.config, fields: localFields.value.map(f => ({ ...f })) });
}

function addField(type: string) {
  const labelMap: Record<string, string> = {
    tel: 'Phone', text: 'Text Field', url: 'Website',
    textarea: 'Message', radio: 'Choose One', checkbox: 'Select Options',
  };
  const field: ContactFormField = {
    id: `field_${Date.now()}`,
    type,
    label: labelMap[type] ?? type,
    required: false,
  };
  if (type === 'radio' || type === 'checkbox') field.options = ['Option 1', 'Option 2'];
  localFields.value.push(field);
  emitFields();
}

function removeField(idx: number) {
  localFields.value.splice(idx, 1);
  emitFields();
}

function moveUp(idx: number) {
  if (idx === 0) return;
  [localFields.value[idx - 1], localFields.value[idx]] = [localFields.value[idx], localFields.value[idx - 1]];
  emitFields();
}

function moveDown(idx: number) {
  if (idx >= localFields.value.length - 1) return;
  [localFields.value[idx], localFields.value[idx + 1]] = [localFields.value[idx + 1], localFields.value[idx]];
  emitFields();
}
</script>

<style scoped>
/* ContactForm-specific layout — shared utilities come from cms-admin.css */
.cf-field-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.cf-field-item { display: flex; gap: 10px; align-items: flex-start; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 10px 10px 6px; }
.cf-field-item__order { display: flex; flex-direction: column; gap: 2px; }
.cf-order-btn { background: none; border: 1px solid #d1d5db; border-radius: 3px; padding: 2px 5px; cursor: pointer; font-size: 0.7rem; color: #6b7280; }
.cf-order-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.cf-order-btn:hover:not(:disabled) { background: #e5e7eb; }
.cf-field-item__config { flex: 1; }
.cf-field-row { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: end; }
.cf-options-row { margin-top: 8px; }
.cf-required-toggle { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; cursor: pointer; padding: 10px 0; }
.cf-add-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cf-rate-row { display: grid; grid-template-columns: auto 1fr 1fr; gap: 12px; align-items: end; }
</style>
