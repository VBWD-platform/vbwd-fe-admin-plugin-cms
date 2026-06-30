<template>
  <!-- Only on CMS admin pages (/admin/cms/...). Opens the fe-user front of the
       current instance: <protocol>://<vbwd-instance-domain-or-localhost>:<port>/ -->
  <a
    v-if="isCmsRoute"
    class="cms-topbar-home"
    :href="homeUrl"
    target="_blank"
    rel="noopener"
    data-testid="cms-topbar-home"
    :title="t('cms.home')"
    :aria-label="t('cms.home')"
  >
    <Icon name="home" />
    <span class="cms-topbar-home__label">{{ t('cms.home') }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from 'vbwd-view-component';

const { t } = useI18n();
const route = useRoute();

// Show only while the admin is on a CMS page. The plugin owns this rule so core
// stays agnostic (no CMS route strings in the core topbar).
const isCmsRoute = computed(() => route.path.startsWith('/admin/cms'));

// The fe-user front of this instance. Mirrors src/api/userPluginApi.ts: dev
// defaults to :8080, prod passes an explicit '' (same-origin) → root '/'.
const homeUrl = computed(() => {
  const base = import.meta.env.VITE_USER_APP_URL ?? 'http://localhost:8080';
  return `${base}/`;
});
</script>

<style scoped>
.cms-topbar-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  color: #2c3e50;
  text-decoration: none;
  font-size: 0.9rem;
  line-height: 1;
}

.cms-topbar-home:hover {
  background: #f5f5f5;
}

@media (max-width: 768px) {
  .cms-topbar-home__label {
    display: none;
  }
}
</style>
