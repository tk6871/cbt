<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

withDefaults(defineProps<{
  label?: string;
  compact?: boolean;
}>(), {
  label: '선택 기능',
  compact: false,
});

const failed = ref(false);
const detail = ref('');

onErrorCaptured((error) => {
  failed.value = true;
  detail.value = error instanceof Error ? error.message : String(error);
  console.error('선택 기능을 안전하게 격리했습니다.', error);
  return false;
});

function retry(): void {
  failed.value = false;
  detail.value = '';
}
</script>

<template>
  <slot v-if="!failed" />
  <section v-else class="optional-feature-fallback" :class="{ compact }" role="status">
    <strong>{{ label }}을 불러오지 못했습니다</strong>
    <p>기본 CBT 기능과 저장 기록에는 영향이 없습니다. 다시 시도하거나 UI 안전모드로 열 수 있습니다.</p>
    <div>
      <button type="button" @click="retry">다시 시도</button>
      <a href="?safe=1">UI 안전모드</a>
    </div>
    <details v-if="detail"><summary>오류 내용</summary><code>{{ detail }}</code></details>
  </section>
</template>

<style scoped>
.optional-feature-fallback{margin:14px 0;padding:16px;border:1px solid color-mix(in srgb,var(--red,#d94b59) 45%,var(--line,#d7e1ec));border-radius:13px;color:var(--text,#243b55);background:color-mix(in srgb,var(--red-soft,#fff0f1) 72%,var(--surface,#fff));display:grid;gap:7px}.optional-feature-fallback.compact{margin:8px 0;padding:12px}.optional-feature-fallback strong{font-size:.68rem}.optional-feature-fallback p{margin:0;color:var(--muted,#718095);font-size:.56rem;line-height:1.55}.optional-feature-fallback>div{display:flex;flex-wrap:wrap;gap:7px}.optional-feature-fallback button,.optional-feature-fallback a{min-height:34px;padding:0 10px;border:1px solid var(--line,#d7e1ec);border-radius:8px;color:var(--text,#243b55);background:var(--surface,#fff);display:inline-flex;align-items:center;font-size:.53rem;font-weight:850}.optional-feature-fallback details{color:var(--muted,#718095);font-size:.5rem}.optional-feature-fallback code{display:block;margin-top:5px;white-space:pre-wrap}
</style>
