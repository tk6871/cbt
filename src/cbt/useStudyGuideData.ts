import { shallowRef } from 'vue';
import type { PracticalPrompt, StudyGuidePage } from './qualificationStudyGuides';

// Keep menu availability independent of the optional, large practice bank.
export const studyGuideKeys = new Set(['hvac', 'hvac-hansol', 'energy', 'maintenance']);

export function useStudyGuideData() {
  const practicalPrompts = shallowRef<PracticalPrompt[]>([]);
  const practicalSources = shallowRef<{ label: string; href: string }[]>([]);
  const studyGuidePages = shallowRef<Record<string, StudyGuidePage>>({});
  const guideLoaded = shallowRef(false);
  const guideLoading = shallowRef(false);
  const guideError = shallowRef('');
  let pending: Promise<void> | undefined;

  function loadStudyGuide(): Promise<void> {
    if (guideLoaded.value) return Promise.resolve();
    if (pending) return pending;
    guideLoading.value = true;
    guideError.value = '';
    pending = import('./qualificationStudyGuides').then(data => {
      practicalPrompts.value = data.practicalPrompts;
      practicalSources.value = data.practicalSources;
      studyGuidePages.value = data.studyGuidePages;
      guideLoaded.value = true;
    }).catch(error => {
      guideError.value = '자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 불러오기를 누르면 저장 기록을 유지하고 화면을 새로고침합니다.';
      throw error;
    }).finally(() => {
      guideLoading.value = false;
      pending = undefined;
    });
    return pending;
  }
  return { practicalPrompts, practicalSources, studyGuidePages, guideLoaded, guideLoading, guideError, loadStudyGuide };
}
