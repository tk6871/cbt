<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { cloudSyncState, listCampusPrivateAssets, downloadCampusPrivateAsset, uploadCampusPrivateAsset, type CampusPrivateAsset } from './cloudSync';
const emit = defineEmits<{ preview: [bytes: ArrayBuffer, asset: CampusPrivateAsset]; clear: [] }>();
const assets = ref<CampusPrivateAsset[] | null>(null), open = ref(false), busy = ref(false), message = ref('');
const title = ref(''), author = ref(''), source = ref(''), license = ref('');
let revision = 0;
async function refresh() {
  const current = ++revision;
  assets.value = null; emit('clear');
  try { const result = await listCampusPrivateAssets(); if (current === revision) assets.value = result; }
  catch { if (current === revision) message.value = '비공개 목록을 불러오지 못했어요.'; }
}
watch(() => cloudSyncState.email, refresh); onMounted(refresh);
onBeforeUnmount(() => { revision++; });
async function preview(asset: CampusPrivateAsset) {
  if (busy.value) return;
  const current = revision; busy.value = true; message.value = '모델을 불러오는 중…';
  try { const bytes = await downloadCampusPrivateAsset(asset.path); if (current === revision) { emit('preview', bytes, asset); message.value = '정문 옆 테스트 자리에 표시합니다.'; } }
  catch (e) { message.value = e instanceof Error ? e.message : '불러오기 실패'; }
  finally { busy.value = false; }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file || busy.value) return;
  if (!title.value.trim() || !author.value.trim() || !/^https:\/\//.test(source.value) || !license.value.trim()) { message.value = '이름·제작자·출처·사용 조건을 먼저 입력해 주세요.'; input.value = ''; return; }
  busy.value = true; message.value = '비공개 저장소에 업로드 중…';
  try { await uploadCampusPrivateAsset(file, { title: title.value.trim(), author: author.value.trim(), source: source.value, license: license.value.trim() }); await refresh(); message.value = '등록 완료. 목록에서 적용을 눌러 주세요.'; }
  catch (e) { message.value = e instanceof Error ? e.message : '업로드 실패'; }
  finally { busy.value = false; input.value = ''; }
}
</script>
<template>
  <aside v-if="assets !== null" class="private-models" @keydown.stop @pointerdown.stop>
    <button @click="open = !open" :aria-expanded="open">비공개 에셋 테스트 {{ open ? '닫기' : '열기' }}</button>
    <section v-if="open" aria-label="비공개 에셋 테스트">
      <p>허용된 계정 전용 · 기본 캐릭터는 유지합니다.</p>
      <article v-for="asset in assets" :key="asset.path">
        <strong>{{ asset.title }}</strong><small>{{ asset.author }} · {{ asset.license }}</small>
        <a :href="asset.source" target="_blank" rel="noopener noreferrer">제작자 출처 ↗</a>
        <button :disabled="busy" @click="preview(asset)">적용</button>
      </article>
      <p v-if="!assets.length">아직 등록된 모델이 없어요.</p>
      <button @click="emit('clear')">테스트 모델 치우기</button>
      <details><summary>모델 추가</summary>
        <label>모델 이름<input v-model="title" maxlength="100"></label>
        <label>제작자<input v-model="author" maxlength="100"></label>
        <label>원본 출처<input v-model="source" type="url" maxlength="1000"></label>
        <label>사용 조건<input v-model="license" maxlength="200" placeholder="예: CC BY 4.0 · 메시 경량화"></label>
        <p>웹 사용이 허용된, 텍스처 포함 GLB만 등록하세요. 비공개 설정은 이용 허락을 대신하지 않습니다.</p>
        <input aria-label="비공개 GLB 업로드" type="file" accept=".glb" :disabled="busy" @change="upload">
      </details>
      <p role="status">{{ message }}</p>
    </section>
  </aside>
</template>
<style scoped>
.private-models{position:absolute;top:80px;left:20px;z-index:5;color:#e7edf0;font:14px system-ui}.private-models section{width:min(340px,85vw);max-height:65vh;overflow:auto;background:#182c35;padding:16px;border-radius:12px;box-shadow:0 8px 30px #0005}.private-models button{padding:9px 12px;background:#204d53;color:white;border:1px solid #8aacac;border-radius:8px;cursor:pointer}.private-models article{display:grid;gap:6px;border-bottom:1px solid #6b8181;padding:12px 0}.private-models a{color:#a7dfed}.private-models label{display:grid;gap:4px;margin:10px 0}.private-models input{max-width:100%;padding:7px}.private-models small{color:#bdcdd0}
</style>
