<template>
  <iframe
    ref="frame"
    class="html-preview-frame"
    sandbox="allow-same-origin allow-scripts"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';

// A sandboxed live preview of authored HTML + scoped CSS. The content is written
// into the iframe's own document so its styles never leak into the editor. The
// `img` reset keeps oversized images inside the frame (parity with the legacy
// post-editor preview).
const props = defineProps<{
  contentHtml: string;
  sourceCss: string;
}>();

const frame = ref<HTMLIFrameElement | null>(null);

function render(): void {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><style>img{max-width:100%;height:auto}' +
      `${props.sourceCss}</style></head><body>${props.contentHtml}</body></html>`,
  );
  doc.close();
}

onMounted(render);

watch(
  () => [props.contentHtml, props.sourceCss],
  async () => {
    await nextTick();
    render();
  },
);

// Exposed so a host that shows the frame lazily (e.g. behind a Preview tab) can
// force a re-render when it becomes visible.
defineExpose({ render });
</script>

<style scoped>
.html-preview-frame {
  width: 100%;
  height: 420px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
}
</style>
