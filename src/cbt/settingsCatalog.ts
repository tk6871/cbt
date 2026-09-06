export interface SettingsValues {
  theme: 'system' | 'light' | 'dark';
  fontScale: number;
  fontFamily: 'regular' | 'bold' | 'd2coding' | 'd2coding-bold';
  visualStyle: 'default' | 'simpsons' | 'sunjae';
  display: 'auto' | 'mobile' | 'desktop';
  dynamic: boolean;
  solveLayout: 'standard' | 'comcbt' | 'combat';
  answerLayout: 'classic' | 'inline' | 'hotspot';
  indicator: 'marker' | 'area';
  imageTheme: 'auto' | 'original';
  experimental: boolean;
  judgment: boolean;
  rotation: number;
}
export type SettingChange = { [K in keyof SettingsValues]: { key: K; value: SettingsValues[K] } }[keyof SettingsValues];
export type SettingsCategory = 'quick' | 'appearance' | 'solving' | 'tools' | 'data';
export type SettingsAction = 'close' | 'full' | 'tour' | 'beta' | 'recovery' | 'export' | 'import' | 'reset' | 'omr';
export interface SettingsContext {
  jewelry: boolean; native: boolean; session: boolean; exam: boolean; omr: boolean;
  version: string; displayLabel: string;
}
export interface SettingGroup {
  key: keyof SettingsValues; title: string; description: string;
  category: SettingsCategory; quick?: boolean; jewelryOnly?: boolean; industrialOnly?: boolean;
  options: Array<{ value: string | number | boolean; label: string }>;
}
export const settingsCategories: Array<{ id: SettingsCategory; label: string }> = [
  { id: 'quick', label: '자주 쓰는 설정' }, { id: 'appearance', label: '화면·글씨' },
  { id: 'solving', label: '문제풀이' }, { id: 'tools', label: '학습 도구' }, { id: 'data', label: '기록·동기화' },
];
export const settingsHelp: Record<keyof SettingsValues, string> = {
  theme: '기기 설정은 운영체제의 밝기 모드를 따라갑니다. 사진 속 문제의 밝기는 문제풀이 → 문제 이미지 다크 표시에서 따로 바꿀 수 있습니다.',
  fontScale: '글씨가 작은 FHD 반쪽 창이나 큰 모니터에서는 120~130%부터 비교해 보세요. 사진에 인쇄된 글자는 글꼴 설정으로 바뀌지 않으므로 문제의 크게보기를 이용하세요.',
  answerLayout: '기존 번호 버튼은 사진 아래에서 1~4번을 고릅니다. 이미지 직접 선택은 좌표가 준비된 문제의 보기를 바로 누릅니다. 답안 문구는 추출된 보기 내용을 버튼으로 표시합니다. 지원하지 않는 문제는 번호 버튼을 사용합니다.',
  visualStyle: '색상과 캐릭터 표현을 바꿉니다. 정답·해설·학습 기록에는 영향을 주지 않습니다. 동적 UI를 켠 테마는 메뉴 배치와 전환 연출도 달라질 수 있습니다.',
  fontFamily: '나눔고딕은 일반적인 읽기용 글꼴이고, D2Coding은 글자 폭이 일정한 글꼴입니다. Bold는 더 굵게 보입니다. 문제 이미지 안의 글씨체는 바뀌지 않습니다.',
  display: '자동은 기기에 맞는 화면을 선택합니다. 원하는 화면이 아니면 직접 고를 수 있습니다. 이 항목은 화면을 다시 불러오므로 시험 중에는 다른 표시 설정부터 조절하는 것을 권장합니다.',
  dynamic: '메뉴·문제 전환과 테마 연출을 켜고 끕니다. 기기에서 동작 줄이기를 켰다면 일부 모션은 제한됩니다. 강조색·밀도 같은 세부 조절은 학습 도구의 UI·테마 실험실에 있습니다.',
  rotation: '현재 테마의 사진이 자동으로 바뀌는 시간입니다. 3분은 180초입니다. 끔을 고르면 자동 교체를 멈춥니다.',
  solveLayout: '기본 CBT는 익숙한 문제풀이 화면입니다. COMCBT 고밀도는 넓은 화면에서 문제를 두 열로 배치하고, 컴뱃 CBT는 집중 풀이 도구를 함께 보여줍니다. 좁은 화면에서는 읽기 쉬운 열 수로 조정됩니다.',
  indicator: '체크 마커는 선택한 번호 근처에 표시합니다. 영역 색상 박스는 보기 범위를 색으로 강조합니다. 사진의 보기 영역이 정확하지 않으면 마커 또는 기존 번호 버튼으로 전환할 수 있습니다.',
  imageTheme: '눈부심 완화는 다크 모드에서 흰 문제 이미지의 밝기를 낮춥니다. 색상이나 도표를 원래대로 확인하려면 항상 원본을 선택하세요. 원본 이미지 파일은 그대로 보존됩니다.',
  experimental: '학습·CBT 기록을 바탕으로 확신도와 실수 원인을 남기는 선택 기능입니다. 끄면 관련 입력 도구를 숨기고, 이미 저장한 기록은 지우지 않습니다.',
  judgment: '베타 학습 도구를 유지하면서 내 판단·메모 입력란만 숨길 수 있습니다. 킵·즐겨찾기·답안 선택과는 별개입니다.',
};
export const settingGroups: SettingGroup[] = [
  { key: 'theme', title: '밝기', category: 'appearance', quick: true, description: '화면의 밝고 어두운 색상을 고릅니다.', options: [{ value: 'system', label: '기기 설정' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }] },
  { key: 'fontScale', title: '문자 크기', category: 'appearance', quick: true, description: '문제·답안·해설에 적용됩니다. 큰 모니터에서도 직접 조절하세요.', options: [.8, 1, 1.2, 1.3, 1.4, 1.6].map(value => ({ value, label: `${Math.round(value * 100)}%${value === 1 ? ' · 기본' : ''}` })) },
  { key: 'answerLayout', title: '답안 선택 방식', category: 'solving', quick: true, description: '복원 이미지 문제의 답안을 누르는 방법입니다.', options: [{ value: 'classic', label: '기존 번호 버튼' }, { value: 'hotspot', label: '이미지 직접 선택' }, { value: 'inline', label: '답안 문구' }] },
  { key: 'visualStyle', title: '캐릭터 테마', category: 'appearance', description: '기존 메뉴와 공부 기능을 유지합니다.', options: [{ value: 'default', label: '기본 CBT' }, { value: 'simpsons', label: '심슨' }, { value: 'sunjae', label: '선재' }] },
  { key: 'fontFamily', title: '글씨체', category: 'appearance', description: '메뉴와 문제 글꼴을 함께 바꿉니다.', options: [{ value: 'regular', label: '나눔고딕' }, { value: 'bold', label: '나눔고딕 Bold' }, { value: 'd2coding', label: 'D2Coding' }, { value: 'd2coding-bold', label: 'D2Coding Bold' }] },
  { key: 'display', title: '기기 화면 모드', category: 'appearance', description: '자동을 권장합니다. 변경 시 풀이를 저장한 뒤 화면을 다시 엽니다.', options: [{ value: 'auto', label: '자동' }, { value: 'mobile', label: '모바일·태블릿' }, { value: 'desktop', label: 'PC' }] },
  { key: 'dynamic', title: '동적 UI·모션', category: 'appearance', description: '기존 테마의 동적 배치와 화면 전환입니다. 끄면 이전 정적 배치로 돌아갑니다.', options: [{ value: true, label: '켜기' }, { value: false, label: '끄기' }] },
  { key: 'rotation', title: '사진 자동 교체', category: 'appearance', jewelryOnly: true, description: '선재 테마 사진의 교체 간격입니다.', options: [0, 5, 10, 30, 60, 180, 300].map(value => ({ value, label: value === 0 ? '끔' : value < 60 ? `${value}초` : `${value / 60}분` })) },
  { key: 'solveLayout', title: '문제풀이 화면', category: 'solving', description: '답안·진도·타이머를 유지하며 전환합니다.', options: [{ value: 'standard', label: '기본 CBT' }, { value: 'comcbt', label: 'COMCBT · 고밀도' }, { value: 'combat', label: '컴뱃 CBT' }] },
  { key: 'indicator', title: '이미지 선택 표시', category: 'solving', description: '이미지 직접 선택에서 사용하는 표시입니다.', options: [{ value: 'marker', label: '체크 마커' }, { value: 'area', label: '영역 색상 박스' }] },
  { key: 'imageTheme', title: '문제 이미지 다크 표시', category: 'solving', industrialOnly: true, description: '다크 모드에서만 적용되며 원본 파일은 바꾸지 않습니다.', options: [{ value: 'auto', label: '눈부심 완화' }, { value: 'original', label: '항상 원본' }] },
  { key: 'experimental', title: '베타 학습 도구', category: 'tools', description: '확신도·실수 원인·속도 예측을 켜고 끕니다. 저장한 기록은 유지됩니다.', options: [{ value: true, label: '켜기' }, { value: false, label: '끄기' }] },
  { key: 'judgment', title: '내 판단·메모', category: 'tools', description: '문제 아래의 판단·메모만 따로 표시합니다. 베타 도구가 켜져 있어야 보입니다.', options: [{ value: true, label: '표시' }, { value: false, label: '숨기기' }] },
];
