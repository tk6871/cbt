import { computed, watchEffect } from 'vue';
import { useMediaQuery, useStorage } from '@vueuse/core';

const design = useStorage<'classic' | 'workspace'>('unified-cbt-screen-design', 'classic');
const device = useStorage<'auto' | 'desktop' | 'mobile'>('unified-cbt-workspace-device', 'auto');
const narrow = useMediaQuery('(max-width: 1100px)');
const safe = new URLSearchParams(location.search).get('safe') === '1';
const active = computed(() => !safe && design.value === 'workspace');
const touchLayout = computed(() => device.value === 'mobile' || (device.value === 'auto' && narrow.value));
watchEffect(() => {
  document.documentElement.dataset.uiStructure = active.value ? 'workspace' : 'classic';
  document.documentElement.dataset.workspaceDevice = touchLayout.value ? 'mobile' : 'desktop';
});

export function useWorkspaceLayout() {
  return { design, device, active, touchLayout, safe };
}
