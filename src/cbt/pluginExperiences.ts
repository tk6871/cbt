type PluginExperience = {
  name: string;
  area: string;
  role: string;
  change: string;
  loading: '기본' | '필요할 때만' | 'Android' | '검증 전용';
};

export const pluginExperiences: PluginExperience[] = [
  { name: 'VueUse', area: '설정 저장', role: 'UI 실험 설정과 기기 접근성 선호를 읽습니다.', change: '새 설정이 새로고침 뒤에도 유지되고 모션 줄이기·고대비 선호를 확인합니다.', loading: '기본' },
  { name: 'Color.js', area: '색상 대비', role: '선택한 글자색과 배경색의 대비를 계산합니다.', change: '강조색을 바꾸면서 현재 가독성 점수를 바로 확인할 수 있습니다.', loading: '기본' },
  { name: 'Reka UI', area: '접근성 UI', role: '키보드와 화면 읽기 도구를 고려한 스위치·접기 UI를 제공합니다.', change: 'UI 실험실을 한 번에 켜고 끄며 세부 설정을 접어 둘 수 있습니다.', loading: '기본' },
  { name: 'Lucide', area: '선명한 아이콘', role: '화면 크기가 달라도 깨지지 않는 벡터 아이콘을 표시합니다.', change: '설정·자료 자르기·계산 도구의 아이콘이 작은 모바일에서도 또렷합니다.', loading: '기본' },
  { name: 'Open Props', area: '동작 통일', role: '버튼과 패널의 시간·속도 곡선을 공통 값으로 맞춥니다.', change: '화면마다 제각각이던 전환 속도를 한결 자연스럽게 맞춥니다.', loading: '기본' },
  { name: 'Driver.js', area: '기능 안내', role: '처음 쓰는 기능을 화면 위에서 순서대로 안내합니다.', change: 'UI 실험실에서 새 기능 안내를 눌러 주요 위치를 차례로 볼 수 있습니다.', loading: '필요할 때만' },
  { name: 'Canvas Confetti', area: '합격 연출', role: '합격 결과에만 가벼운 축하 효과를 표시합니다.', change: 'UI 실험실이 켜진 상태에서 합격했을 때만 내려받고 실행합니다.', loading: '필요할 때만' },
  { name: 'Compute Engine', area: '수식 계산', role: '입력한 수식을 해석하고 계산 결과를 확인합니다.', change: '공조 계산문제 메뉴에서 별도 수식 실험실을 열어 대입식을 검산할 수 있습니다.', loading: '필요할 때만' },
  { name: 'Cropper.js', area: '사진 자르기', role: '촬영한 시험 자료에서 필요한 문제 영역만 자릅니다.', change: '학교 시험 준비관에서 회전·확대 후 PNG로 저장할 수 있습니다.', loading: '필요할 때만' },
  { name: 'PDF.js', area: 'PDF 준비', role: '서버 업로드 없이 이 기기에서 PDF 페이지를 미리 봅니다.', change: '원하는 페이지를 골라 이미지로 만든 뒤 같은 자르기 도구를 사용합니다.', loading: '필요할 때만' },
  { name: 'Zod', area: '자료 검사', role: '학교 시험 JSON의 필수 구조와 값 형식을 적용 전에 검사합니다.', change: '잘못된 정리본이 기존 시험 자료를 망가뜨리는 일을 줄입니다.', loading: '필요할 때만' },
  { name: 'TS-FSRS', area: '복습 일정', role: '암기카드 결과를 바탕으로 다음 복습 시점을 계산합니다.', change: '오늘 볼 카드가 먼저 나오고 기억 정도에 따라 복습 간격이 달라집니다.', loading: '필요할 때만' },
  { name: 'Capacitor Network', area: '연결 상태', role: 'Android 앱의 온라인·오프라인 전환을 감지합니다.', change: '연결이 끊기면 안내하고 내장 오프라인 화면으로 이어갈 준비를 합니다.', loading: 'Android' },
  { name: 'Capacitor Keyboard', area: '모바일 키보드', role: 'Android 키보드가 열린 높이와 상태를 감지합니다.', change: '입력할 때 하단 풀이 버튼이 키보드에 가려지는 현상을 줄입니다.', loading: 'Android' },
  { name: 'Playwright + axe', area: '화면 자동 검사', role: 'PC·휴대폰·태블릿 화면과 접근성 오류를 반복 검사합니다.', change: '업데이트 뒤 가로 넘침·버튼 이름·대비 같은 회귀 문제를 자동 확인할 기반을 만들었습니다.', loading: '검증 전용' },
];
