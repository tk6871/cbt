<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { cloudSyncState, getLearningRecoveryCopies, recoverLearningCopy } from './cloudSync';
import { recoveryPreview, type SyncRecovery } from './syncRecovery';

const copies = ref<SyncRecovery[]>([]);
const message = ref('');
const busy = ref(false);
async function refresh() {
  try { copies.value = await getLearningRecoveryCopies(); }
  catch { message.value = '복구 사본을 읽지 못했습니다. 브라우저의 저장 공간 설정을 확인해 주세요.'; }
}
async function restore(row: SyncRecovery, side: 'local' | 'remote') {
  if (!window.confirm(`${row.label}를 선택한 사본으로 복구할까요? 해당 풀이만 바뀌고 시험 점수·다른 문제 기록은 유지됩니다.`)) return;
  busy.value = true;
  try {
    await recoverLearningCopy(row.id, side);
    message.value = '선택한 풀이를 복구했습니다. 서버에도 다시 동기화합니다.';
  } catch (error) { message.value = error instanceof Error ? error.message : '복구에 실패했습니다.'; }
  finally { busy.value = false; }
}
function exportCopies() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, copies: copies.value }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cbt-learning-recovery.json'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
onMounted(refresh);
watch(() => [cloudSyncState.email, cloudSyncState.recoveryCount], () => { copies.value = []; void refresh(); });
</script>

<template>
  <section class="sync-recovery-panel" aria-label="풀이 복구 사본">
    <p>동기화 때 서로 달랐던 풀이를 이 브라우저에 최근 100건까지 보관합니다. 두 기기의 기록이 다르다는 뜻이며, 오류라고 단정하지 않습니다. 손글씨는 포함하지 않습니다.</p>
    <button type="button" :disabled="!copies.length" @click="exportCopies">사본 파일로 보관</button>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="!copies.length">보관된 다른 풀이가 없습니다.</p>
    <details v-for="row in copies" :key="row.id">
      <summary>{{ row.label }} · {{ new Date(row.createdAt).toLocaleString('ko-KR') }}</summary>
      <div class="sync-recovery-choices">
        <div v-for="side in (['local', 'remote'] as const)" :key="side">
          <strong>{{ side === 'local' ? '당시 이 기기 풀이' : '당시 서버 풀이' }}</strong>
          <pre>{{ recoveryPreview(row[side]) }}</pre>
          <button type="button" :disabled="busy || cloudSyncState.status === 'syncing'" @click="restore(row, side)">이 풀이 복구</button>
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.sync-recovery-panel { display:grid; gap:12px; font-size:14px; line-height:1.6; }
.sync-recovery-panel p { margin:0; }
.sync-recovery-panel button { min-height:44px; padding:8px 12px; color:inherit; border:1px solid currentColor; border-radius:10px; background:transparent; }
summary { cursor:pointer; overflow-wrap:anywhere; padding:10px 0; }
.sync-recovery-choices { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:12px; }
.sync-recovery-choices > div { min-width:0; padding:12px; border:1px solid #8886; border-radius:12px; }
pre { font:inherit; white-space:pre-wrap; overflow-wrap:anywhere; max-height:180px; overflow:auto; }
</style>
