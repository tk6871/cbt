# 사용자 추가 필답 「가지1」 검토 기록

- 입력: 모두CBT_시험지_20260917_0706.pdf, 97쪽, 123문항. 제공 자료이며 공식 기출 회차나 공식 채점표로 간주하지 않는다.
- 원문 텍스트·답안·쪽 범위·PDF SHA-256·내장 이미지 객체/치수/SHA-256은 `data/hvac-practical-photo-20260917.json`에 보존한다.
- 모든 97쪽을 렌더링한 25개 검수표에서 문항·그림 연결을 직접 대조했다. 문항이 다음 페이지로 이어지는 경우도 포함하며 46번은 44~46쪽을 연결한다.
- 95문항에 내장 사진95개(43,007,136바이트)를 원본 압축 바이트 그대로 추출했다. 페이지 스크린샷·업스케일링·생성형 복원이 아니며 PDF에 이미 있던 흐림/라벨은 남을 수 있다.
- 82·88번은 정답 명칭이 적힌 비교 그림을 답안용으로 두고, 명칭 없는 왼쪽을 별도 PNG로 잘랐다. 82번 보기는 문제 본문에 전부 전사했다. 원본95개는 변경하지 않는다.
- 7·22·64·79·116번 등 일부 자료에는 설명·제품명 라벨이 원래 포함되어 있다. 모두 무힌트 실전 이미지로 검증됐다고 주장하지 않는다.
- 총572문항: 기존407 + 필답문제2 42 + 가지1 123. 새 자료는 `photos` 그룹 및 독립 ID로 연결한다. 기존 ID·기록·문제·답안은 대체하지 않는다.
- 공개47문항 중 새1~18,20~46은 사진과 주제가 대응하는45문항이다. 기존 검토 설명을 공통 모듈로 공유하되 새 PDF의 문제·원문답안은 독립 보존한다. 19번 직교류 냉각탑 때문에 이후 번호가 달라 단순 번호 복사는 하지 않았다.
- 자료 내부 반복 예: 10/66(원심식),13/73(스크루),41/80(공기빼기),49/92(모세관),56/83(버킷),93/95(과부하계전기). 질문의 요구 항목/사진이 달라 사용자 자료를 임의 삭제·합치지 않았다.

## 학습 답안 보완

보완 내용은 `src/cbt/hvacPracticalPhotos.ts`에서 원문과 분리하고 해당 문항 출처 안내에 표시한다.

- 4: 밀폐형 압축기의 과부하 운전 가능 주장을 제외.
- 9/23/27/28/31/32: 청소 난이도 일반화, 수분 지시 색, 덕트/냉매배관, 로터록 용도, 유효 유압, EPR 출구 위치를 구분.
- 26: 누락된 스톱 밸브 명칭 보완. 35/36: 캘리퍼스의 깊이 측정과 외측 마이크로미터의 외경·두께 측정을 구분. 부정확한 3가지 요구도 교정.
- 43/59/96: 중성능 필터, 깨진 음수·℃ 기호, 후향날개의 방향/정숙 표현 보완.
- 79/89: 수액기·냉매회수·불응축가스 추기의 목적 구분.
- 84: 에어커튼과 라인형 취출구를 같은 것으로 읽지 않도록 문제 대상 명시.
- 93/95/108/113: 과부하계전기의 제어접점, 고·저압 독립 감시, 2위치 제어와 구동 방식을 구분.
- 99/102: 액상 충전과 용기 무조건 뒤집기를 구분. 옛 화염 누설검사는 실제 작업 지시로 제공하지 않음.
- 119: 증기압 이하에서 기화한 기포의 붕괴라는 캐비테이션 원리 보완.
- 121/123: 65A 이상만 플랜지 사용한다는 한정 및 단수릴레이가 직접 급수한다는 오해를 제외.

## 주요 보완 근거

- [Danfoss: 고·저압 압력제어](https://www.danfoss.com/en-gb/service-and-support/case-stories/dcs/pressure-controls-for-heat-pumps/) — 고저압스위치와 차압스위치 구분.
- [KSB: Cavitation](https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/cavitation-1117364) — 증기압과 기포 생성/붕괴.
- [Mitutoyo: 캘리퍼스](https://www.mitutoyo.com/metrology-insights/mitutoyo-calipers-digital-dial-and-vernier-calipers-precision-measurement-tools-for-manufacturing/), [외측 마이크로미터](https://www.mitutoyo.co.jp/products/measuring-tools/micrometers/standard-analog/) — 측정 범위 구분.
- [TLV: 기계식 트랩](https://www.tlv.com/en-us/steam-info/steam-theory/steamtrap-basics/mechanical-steam-traps), [트랩 원리 분류](https://www.tlv.com/en-us/steam-info/steam-theory/steamtrap-basics/steam-trap-varieties-and-applications) — 부력식과 디스크형 구분.
- [ILO 화학물질 안전카드](https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_card_id=1281&p_lang=en) — 냉매와 고온/화염의 유해 분해 위험.

전123문항의 공식 채점 정답 확인이나 모든 장치 모델의 식별 완료를 의미하지 않는다. 불명확한 현장 장비 명칭은 제공 자료의 학습용 명칭임을 유지했다. 원문 PDF·기존 이미지·사용자 학습 기록은 보존한다.
