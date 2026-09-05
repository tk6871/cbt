<script setup lang="ts">
import { useWorkspaceLayout } from './workspaceLayout';
const { design, device, active, safe } = useWorkspaceLayout();
</script>

<template>
  <section class="setting-group workspace-preferences">
    <span>화면 구성</span>
    <p class="setting-description">테마와 별개로 홈·메뉴·풀이 화면의 배치를 선택합니다. 답안과 타이머는 유지됩니다.</p>
    <div class="workspace-options" role="group" aria-label="화면 구성 선택">
      <button type="button" :aria-pressed="design === 'classic'" @click="design = 'classic'"><strong>기존 화면</strong><small>익숙한 CBT · 기본값</small></button>
      <button type="button" :disabled="safe" :aria-pressed="active" @click="design = 'workspace'"><strong>새 디자인</strong><small>빠른 시작 · 새 메뉴와 풀이 도구</small></button>
    </div>
    <template v-if="active">
      <p class="setting-description">새 디자인의 기기 배치</p>
      <div class="workspace-options device" role="group" aria-label="새 디자인 기기 배치">
        <button v-for="option in [{value: 'auto' as const, label: '자동'}, {value: 'desktop' as const, label: 'PC'}, {value: 'mobile' as const, label: '모바일·태블릿'}]" :key="option.value" type="button" :aria-pressed="device === option.value" @click="device = option.value">{{ option.label }}</button>
      </div>
      <small>심슨 테마는 아래 UI 스타일에서 선택하세요. 기존 동적 UI 설정으로 모션을 조절할 수 있습니다.</small>
    </template>
    <small v-if="safe">안전모드에서는 기존 화면을 사용합니다.</small>
  </section>
</template>

<style scoped>
.workspace-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.workspace-options button{min-width:0;min-height:58px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text);text-align:left}.workspace-options button[aria-pressed=true]{border-color:var(--primary);background:var(--primary-soft);box-shadow:inset 0 0 0 1px var(--primary)}.workspace-options strong,.workspace-options small{display:block}.workspace-options strong{font-size:14px}.workspace-options small,.workspace-preferences>small{margin-top:6px;color:var(--muted);font-size:12px;line-height:1.5}.workspace-options.device{grid-template-columns:repeat(3,1fr)}.workspace-options.device button{min-height:44px;font-size:13px;text-align:center}.workspace-options button:disabled{opacity:.5}
</style>
