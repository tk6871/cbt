(function () {
  const changelog = window.CBT_CHANGELOG || { currentVersion: '', versions: {}, entries: [] };
  changelog.versions = changelog.versions || {};
  changelog.entries = changelog.entries || [];

  const entries = [
    {
      version: '2.0.1',
      scope: 'industrial',
      date: '2026.07.29',
      title: '문제 2열·복원표시·화면 테마 개선',
      summary: '작은 노트북과 태블릿에서도 문제를 2열로 보고, 공조 복원문제와 화면 테마를 더 분명하게 확인할 수 있도록 다듬었습니다.',
      tags: ['2열 문제', '복원문제', '다크 모드', 'UI 개선'],
      changes: [
        '태블릿과 작은 노트북에서도 문제 카드가 좌우 2열로 유지되도록 반응형 기준을 조정했습니다.',
        '문제 카드의 글자, 여백, 선택지와 이미지 크기를 줄여 한 화면에서 더 많은 내용을 볼 수 있습니다.',
        '공조냉동 2021년 이후 문제에 CBT 복원문제·원문 이미지 표시를 다시 적용했습니다.',
        '상단에 라이트 모드와 다크 모드를 바로 전환하는 버튼을 추가하고 설정 화면의 테마 구분을 강화했습니다.',
        '이전 버전에서도 새 CBT 2.0으로 바로 이동할 수 있습니다.'
      ]
    },
    {
      version: '2.0.1',
      scope: 'jewelry',
      date: '2026.07.29',
      title: '2열 문제와 화면 테마 개선',
      summary: '태블릿에서도 문제를 2열로 유지하고 라이트·다크 모드를 쉽게 구분해 전환할 수 있도록 개선했습니다.',
      tags: ['2열 문제', '다크 모드', '반응형', 'UI 개선'],
      changes: [
        '태블릿과 작은 노트북에서도 문제 카드가 좌우 2열로 유지됩니다.',
        '문제와 선택지의 크기와 여백을 줄여 학습 화면의 정보 밀도를 높였습니다.',
        '상단의 라이트·다크 모드 버튼과 설정 화면의 테마 미리보기를 추가했습니다.'
      ]
    },
    {
      version: '2.0.0',
      scope: 'industrial',
      date: '2026.07.29',
      title: 'Vue 통합 CBT 2.0 정식 전환',
      summary: '메인부터 문제 검색, 오답노트, 통계, 학습모드와 실전시험까지 하나의 반응형 웹 앱으로 전면 개편했습니다.',
      tags: ['Vue 3', '통합 검색', '오답노트', '반응형 시험'],
      changes: [
        '종목·연도·출제 체계를 첫 화면에서 바로 선택하는 새 학습 홈을 적용했습니다.',
        '1만 7천 개 이상의 문제를 빠르게 찾는 백그라운드 검색 기능을 추가했습니다.',
        '틀린 문제 자동 수집, 과목별 학습률과 정답률 분석, 학습 기록 내보내기를 지원합니다.',
        '학습모드는 2·4·6문제 표시와 즉시 채점, 시험모드는 2열 문제와 OMR·타이머·과락 판정을 제공합니다.',
        '기존 화면은 legacy.html에 보관하고 휴대폰에는 앱형 하단 메뉴를 적용했습니다.'
      ]
    },
    {
      version: '2.0.0',
      scope: 'jewelry',
      date: '2026.07.29',
      title: '보석·귀금속 학습관 독립',
      summary: '보석관을 산업기사 CBT와 분리된 전용 페이지로 개편하고 별도의 학습 기록과 시험 환경을 적용했습니다.',
      tags: ['독립 페이지', '보석관', '학습 기록 분리', '반응형'],
      changes: [
        'jewelry.html에서 보석감정사와 귀금속가공 종목을 독립적으로 학습할 수 있습니다.',
        '산업기사 CBT와 보석관의 진도·오답·시험 기록을 서로 분리해 저장합니다.',
        '회차별 학습, 과목 균형 랜덤시험, 검색, 오답노트와 과목별 통계를 동일하게 지원합니다.',
        '보석·귀금속 학습관 전용 색상과 종목 카드를 적용했습니다.'
      ]
    }
  ];

  entries.reverse().forEach((entry) => {
    if (!changelog.entries.some((item) => item.version === entry.version && item.scope === entry.scope)) {
      changelog.entries.unshift(entry);
    }
  });
  changelog.versions.industrial = '2.0.1';
  changelog.versions.jewelry = '2.0.1';
  changelog.currentVersion = '2.0.1';
  window.CBT_CHANGELOG = changelog;
})();
