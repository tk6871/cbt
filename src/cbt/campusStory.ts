/** Original, non-explicit adult-campus dialogue. Never writes CBT study records. */
export type StoryProgress = { chapter: number; affinity: number; ending: 'friend' | 'date' | null };
export type StoryChoice = 'hello' | 'study' | 'coffee' | 'date' | 'friend';
const KEY = 'cbt-campus-story-v1';
export function readCampusStory(): Record<string, StoryProgress> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id]) => /^[a-z-]{1,30}$/.test(id)).map(([id, value]) => {
      const p = value as Partial<StoryProgress> | null;
      return [id, { chapter: Math.floor(Math.max(0, Math.min(3, Number(p?.chapter) || 0))), affinity: Math.floor(Math.max(0, Math.min(3, Number(p?.affinity) || 0))), ending: p?.ending === 'date' || p?.ending === 'friend' ? p.ending : null }];
    }));
  } catch { return {}; }
}
export const freshStory = (): StoryProgress => ({ chapter: 0, affinity: 0, ending: null });
export function advanceCampusStory(progress: StoryProgress, choice: StoryChoice): StoryProgress {
  if (choice === 'hello' && progress.chapter === 0) return { chapter: 1, affinity: 1, ending: null };
  if (choice === 'study' && progress.chapter === 1) return { chapter: 2, affinity: 2, ending: null };
  if (choice === 'coffee' && progress.chapter === 2) return { chapter: 3, affinity: 3, ending: null };
  if (progress.chapter === 3 && !progress.ending && (choice === 'friend' || choice === 'date')) return { ...progress, ending: choice };
  return { ...progress };
}
export function saveCampusStory(progress: Record<string, StoryProgress>): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
const personalities: Record<string, [string, string, string]> = {
  guide:['처음엔 이 복도가 미로처럼 느껴지죠? 저도 첫날엔 두 번이나 길을 잘못 들었어요.','같이 공부하니까 설명하다가 저도 이해하게 되네요. 다음에도 옆자리 비워 둘게요.','오늘은 길 안내 말고, 제가 좋아하는 카페를 소개하고 싶어요.'],
  reader:['책에 줄만 잔뜩 긋고 있었는데, 말 걸어줘서 고마워요.','혼자 읽을 때보다 같이 풀 때 시간이 빨리 가네요.','커피 취향은 달라도 좋아요. 천천히 알아가면 되니까.'],
  teacher:['수업 밖에서는 조금 편하게 이야기해도 좋아요. 오늘 하루는 어땠어요?','서로 설명해 주는 게 좋은 공부가 되죠. 오늘 집중하는 모습이 인상적이었어요.','공부 이야기는 잠깐 내려놓고, 좋아하는 계절 이야기를 해 볼까요?'],
  writer:['노트를 예쁘게 쓰려다가 정작 중요한 걸 놓칠 때도 있어요. 같이 봐 줄래요?','여기 빈칸이 이제 채워졌네요. 같이 정리한 페이지라 더 기억날 것 같아요.','오늘 이야기도 이 작은 노트 한쪽에 남겨 두고 싶네요.'],
};
export function campusStoryLine(id: string, progress: StoryProgress): string {
  const lines = personalities[id] || ['오늘도 만나네요. 잠깐 이야기하고 갈래요?', '서로 막힌 부분을 알려주니까 훨씬 낫네요. 다음에도 같이 공부해요.', '수업 끝나고 이렇게 느긋하게 이야기하는 시간이 좋네요.'];
  if (progress.ending === 'date') return '약속한 날, 두 사람은 캠퍼스 카페에서 만나 천천히 산책합니다. “다음에는 네가 좋아하는 곳도 알려 줘.” — 첫 데이트 이야기 완료';
  if (progress.ending === 'friend') return '“좋은 공부 친구가 생겨서 든든해요.” 두 사람은 다음 스터디 시간을 정합니다. — 스터디 친구 이야기 완료';
  return progress.chapter === 0 ? '아직 서로 잘 모르는 사이입니다. 가볍게 인사부터 건네 볼까요?' : lines[progress.chapter - 1];
}
export function campusStoryChoices(progress: StoryProgress): { id: StoryChoice; text: string }[] {
  if (progress.ending) return [];
  if (progress.chapter === 0) return [{ id:'hello', text:'반가워요. 잠깐 이야기해요.' }];
  if (progress.chapter === 1) return [{ id:'study', text:'다음 문제를 같이 생각해 볼까요?' }];
  if (progress.chapter === 2) return [{ id:'coffee', text:'잠깐 쉬면서 커피 한 잔 할래요?' }];
  return [{ id:'date', text:'다음엔 둘이 산책하는 데이트 어때요?' }, { id:'friend', text:'앞으로도 좋은 스터디 친구로 지내요.' }];
}
